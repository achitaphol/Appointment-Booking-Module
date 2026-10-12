import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../models/database.service.js';
import type { Actor } from '../security/auth.guard.js';
import {
  bad,
  boolean,
  collection,
  conflict,
  dateOnly,
  dateText,
  dateValue,
  forbidden,
  localTimestamp,
  notFound,
  object,
  overlaps,
  page,
  string,
  timeOnly,
  timeText,
  timeValue,
  uuid,
} from '../common/api-utils.js';

@Injectable()
export class ApiService {
  constructor(private readonly db: DatabaseService) {}

  private has(actor: Actor, ...roles: string[]): boolean {
    return roles.some((role) => actor.roles.has(role));
  }

  private require(actor: Actor, ...roles: string[]): void {
    if (!this.has(actor, ...roles)) forbidden();
  }

  async dashboardOverview(actor: Actor) {
    this.require(
      actor,
      'scheduler',
      'schedule_manager',
      'clinician',
      'clinical_delegate',
    );
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const dayStart = localTimestamp(today, '00:00');
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const now = new Date();
    const isDoctor = this.has(actor, 'clinician') && !!actor.doctorId;
    const appointmentWhere = {
      departmentId: actor.departmentId,
      startsAt: { gte: dayStart, lt: dayEnd },
      ...(isDoctor ? { doctorId: actor.doctorId! } : {}),
    };
    const scheduleWhere = {
      departmentId: actor.departmentId,
      scheduleDate: dateValue(today),
      ...(isDoctor ? { doctorId: actor.doctorId! } : {}),
    };
    const appointmentInclude = {
      patient: { select: { medicalRecordNumber: true, firstName: true, lastName: true } },
      doctor: { select: { user: { select: { employeeCode: true, firstName: true, lastName: true } } } },
      appointmentType: { select: { name: true } },
    } as const;
    const [appointments, schedules, upcomingAppointment] = await Promise.all([
      this.db.appointment.findMany({
        where: appointmentWhere,
        include: appointmentInclude,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      }),
      this.db.doctorSchedule.findMany({
        where: scheduleWhere,
        include: { breaks: true },
        orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
      }),
      this.db.appointment.findFirst({
        where: {
          departmentId: actor.departmentId,
          status: 'booked',
          startsAt: { gte: now },
          ...(isDoctor ? { doctorId: actor.doctorId! } : {}),
        },
        include: appointmentInclude,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const visibleAppointments = appointments.map(({ doctor, ...appointment }) => ({
      ...appointment,
      doctor: doctor.user,
    }));
    const nextAppointment = upcomingAppointment
      ? { ...upcomingAppointment, doctor: upcomingAppointment.doctor.user }
      : null;
    const doctorsScheduled = new Set(
      schedules.filter((schedule) => schedule.isBookable).map((schedule) => schedule.doctorId),
    ).size;
    const workingSchedule = isDoctor ? schedules[0] : undefined;

    return {
      data: {
        date: today,
        timeZone: 'Asia/Bangkok',
        scope: isDoctor ? 'doctor' : 'department',
        summary: {
          appointments: appointments.length,
          booked: appointments.filter((appointment) => appointment.status === 'booked').length,
          completed: appointments.filter((appointment) => appointment.status === 'completed').length,
          cancelled: appointments.filter((appointment) => appointment.status === 'cancelled').length,
          doctorsScheduled,
        },
        nextAppointment,
        workingHours: workingSchedule
          ? {
              startTime: timeText(workingSchedule.startTime),
              endTime: timeText(workingSchedule.endTime),
              isBookable: workingSchedule.isBookable,
              breaks: workingSchedule.breaks.map((item) => ({
                startTime: timeText(item.startTime),
                endTime: timeText(item.endTime),
              })),
            }
          : null,
        appointments: visibleAppointments,
      },
    };
  }

  async patients(actor: Actor, query: Record<string, unknown>) {
    this.require(actor, 'scheduler');
    const pagination = page(query);
    const q = query.q === undefined ? undefined : string(query.q, 'q', 100);
    const medicalRecordNumber =
      query.medicalRecordNumber === undefined
        ? undefined
        : string(query.medicalRecordNumber, 'medicalRecordNumber', 32);
    const where = medicalRecordNumber
      ? { medicalRecordNumber }
      : q
        ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { medicalRecordNumber: { contains: q } },
          ],
        }
        : {};
    const [data, total] = await Promise.all([
      this.db.patient.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.db.patient.count({ where }),
    ]);
    return collection(data, total, pagination);
  }

  async createPatient(actor: Actor, body: unknown) {
    this.require(actor, 'scheduler');
    const input = object(
      body,
      ['medicalRecordNumber', 'firstName', 'lastName', 'dateOfBirth'],
      ['medicalRecordNumber', 'firstName', 'lastName'],
    );
    const dateOfBirth =
      input.dateOfBirth === undefined || input.dateOfBirth === null
        ? null
        : dateValue(dateOnly(input.dateOfBirth, 'dateOfBirth'));
    if (dateOfBirth && dateOfBirth > new Date())
      bad('dateOfBirth cannot be in the future.');
    try {
      const data = await this.db.patient.create({
        data: {
          id: randomUUID(),
          medicalRecordNumber: string(
            input.medicalRecordNumber,
            'medicalRecordNumber',
            32,
          ),
          firstName: string(input.firstName, 'firstName', 100),
          lastName: string(input.lastName, 'lastName', 100),
          dateOfBirth,
        },
      });
      return { data };
    } catch (error) {
      if (dbConflict(error))
        conflict('UNIQUE_CONFLICT', 'Medical record number already exists.');
      throw error;
    }
  }

  async doctors(actor: Actor, query: Record<string, unknown>) {
    this.require(actor, 'scheduler', 'schedule_manager', 'clinician');
    const pagination = page(query);
    if (
      query.departmentId !== undefined &&
      uuid(query.departmentId, 'departmentId') !== actor.departmentId
    )
      forbidden();
    const q = query.q === undefined ? undefined : string(query.q, 'q', 100);
    const where = {
      departments: { some: { departmentId: actor.departmentId } },
      ...(q
        ? {
            user: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' as const } },
                { lastName: { contains: q, mode: 'insensitive' as const } },
                { employeeCode: { contains: q } },
              ],
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.doctor.findMany({
        where,
        include: { user: true },
        orderBy: { id: 'asc' },
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.db.doctor.count({ where }),
    ]);
    return collection(
      rows.map((r) => ({
        id: r.id,
        employeeCode: r.user.employeeCode,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        primaryDepartmentId: r.primaryDepartmentId,
      })),
      total,
      pagination,
    );
  }

  async appointmentTypes(actor: Actor) {
    this.require(actor, 'scheduler');
    const rows = await this.db.departmentAppointmentType.findMany({
      where: { departmentId: actor.departmentId, isBookable: true },
      include: { appointmentType: true },
      orderBy: { appointmentTypeId: 'asc' },
    });
    return {
      data: rows.map((r) => ({
        id: r.appointmentTypeId,
        code: r.appointmentType.code,
        name: r.appointmentType.name,
        durationMinutes: r.durationMinutes,
      })),
    };
  }

  private async mayReadSchedule(
    actor: Actor,
    doctorId: string,
    departmentId: string,
  ): Promise<boolean> {
    if (
      this.has(actor, 'scheduler', 'schedule_manager') &&
      departmentId === actor.departmentId
    )
      return true;
    if (this.has(actor, 'clinician') && actor.doctorId === doctorId)
      return !!(await this.db.doctorDepartment.findUnique({
        where: { doctorId_departmentId: { doctorId, departmentId } },
      }));
    return false;
  }

  private async mayWriteSchedule(
    actor: Actor,
    doctorId: string,
    departmentId: string,
  ): Promise<void> {
    if (
      !(await this.mayReadSchedule(actor, doctorId, departmentId)) ||
      (!this.has(actor, 'schedule_manager') && !this.has(actor, 'clinician'))
    )
      forbidden();
    if (departmentId !== actor.departmentId && actor.doctorId !== doctorId)
      forbidden();
  }

  private scheduleView(row: {
    id: string;
    doctorId: string;
    departmentId: string;
    scheduleDate: Date;
    startTime: Date;
    endTime: Date;
    isBookable: boolean;
    breaks: { id: string; startTime: Date; endTime: Date }[];
  }) {
    return {
      id: row.id,
      doctorId: row.doctorId,
      departmentId: row.departmentId,
      scheduleDate: dateText(row.scheduleDate),
      startTime: timeText(row.startTime),
      endTime: timeText(row.endTime),
      isBookable: row.isBookable,
      breaks: row.breaks.map((b) => ({
        id: b.id,
        startTime: timeText(b.startTime),
        endTime: timeText(b.endTime),
      })),
    };
  }

  async schedules(actor: Actor, query: Record<string, unknown>) {
    this.require(actor, 'scheduler', 'schedule_manager', 'clinician');
    const doctorId = uuid(query.doctorId, 'doctorId');
    const from = dateOnly(query.from, 'from');
    const to = dateOnly(query.to, 'to');
    if (
      from > to ||
      dateValue(to).getTime() - dateValue(from).getTime() > 93 * 86_400_000
    )
      bad('Invalid schedule date range.');
    const departmentId =
      query.departmentId === undefined
        ? undefined
        : uuid(query.departmentId, 'departmentId');
    const own = actor.doctorId === doctorId && this.has(actor, 'clinician');
    if (!own && !this.has(actor, 'scheduler', 'schedule_manager')) forbidden();
    if (
      departmentId &&
      !(await this.mayReadSchedule(actor, doctorId, departmentId))
    )
      forbidden();
    const allowedDepartments = own
      ? (
          await this.db.doctorDepartment.findMany({
            where: { doctorId },
            select: { departmentId: true },
          })
        ).map((x) => x.departmentId)
      : [actor.departmentId];
    const rows = await this.db.doctorSchedule.findMany({
      where: {
        doctorId,
        departmentId: departmentId ?? { in: allowedDepartments },
        scheduleDate: { gte: dateValue(from), lte: dateValue(to) },
      },
      include: { breaks: true },
      orderBy: [{ scheduleDate: 'asc' }, { startTime: 'asc' }],
    });
    return { data: rows.map((r) => this.scheduleView(r)) };
  }

  async createSchedule(actor: Actor, body: unknown) {
    const input = object(
      body,
      [
        'doctorId',
        'departmentId',
        'scheduleDate',
        'startTime',
        'endTime',
        'isBookable',
      ],
      [
        'doctorId',
        'departmentId',
        'scheduleDate',
        'startTime',
        'endTime',
        'isBookable',
      ],
    );
    const doctorId = uuid(input.doctorId, 'doctorId');
    const departmentId = uuid(input.departmentId, 'departmentId');
    await this.mayWriteSchedule(actor, doctorId, departmentId);
    const day = dateOnly(input.scheduleDate, 'scheduleDate');
    const start = timeOnly(input.startTime, 'startTime');
    const end = timeOnly(input.endTime, 'endTime');
    if (start >= end || localTimestamp(day, start) <= new Date())
      bad('Schedule must be a future interval with start before end.');
    const isBookable = boolean(input.isBookable, 'isBookable');
    try {
      const row = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM doctors WHERE id = ${doctorId}::uuid FOR UPDATE`;
        if (localTimestamp(day, start) <= new Date())
          conflict('SCHEDULE_CONFLICT', 'Schedule must start in the future.');
        const assignment = await tx.doctorDepartment.findUnique({
          where: { doctorId_departmentId: { doctorId, departmentId } },
        });
        if (!assignment) bad('Doctor is not assigned to this department.');
        return tx.doctorSchedule.create({
          data: {
            id: randomUUID(),
            doctorId,
            departmentId,
            scheduleDate: dateValue(day),
            startTime: timeValue(start),
            endTime: timeValue(end),
            isBookable,
          },
          include: { breaks: true },
        });
      });
      return { data: this.scheduleView(row) };
    } catch (error) {
      if (dbConflict(error))
        conflict(
          'SCHEDULE_CONFLICT',
          'Schedule overlaps another working interval.',
        );
      throw error;
    }
  }

  async updateSchedule(actor: Actor, idValue: unknown, body: unknown) {
    const id = uuid(idValue, 'scheduleId');
    const input = object(body, ['startTime', 'endTime', 'isBookable']);
    if (!Object.keys(input).length) bad('At least one field is required.');
    const current = await this.db.doctorSchedule.findUnique({
      where: { id },
      include: { breaks: true },
    });
    if (!current) notFound();
    await this.mayWriteSchedule(actor, current.doctorId, current.departmentId);
    const start =
      input.startTime === undefined
        ? timeText(current.startTime)
        : timeOnly(input.startTime, 'startTime');
    const end =
      input.endTime === undefined
        ? timeText(current.endTime)
        : timeOnly(input.endTime, 'endTime');
    const isBookable =
      input.isBookable === undefined
        ? current.isBookable
        : boolean(input.isBookable, 'isBookable');
    if (start >= end) bad('Schedule start must precede end.');
    const day = dateText(current.scheduleDate);
    const oldStart = localTimestamp(day, timeText(current.startTime));
    const oldEnd = localTimestamp(day, timeText(current.endTime));
    const newStart = localTimestamp(day, start);
    const newEnd = localTimestamp(day, end);
    const now = new Date();
    if (oldStart < now && newStart.getTime() !== oldStart.getTime())
      conflict('SCHEDULE_CONFLICT', 'Elapsed schedule time cannot be changed.');
    if (oldEnd < now && newEnd.getTime() !== oldEnd.getTime())
      conflict('SCHEDULE_CONFLICT', 'Elapsed schedule time cannot be changed.');
    if (newStart < now && oldStart >= now)
      conflict('SCHEDULE_CONFLICT', 'Schedule cannot be moved into the past.');
    try {
      const row = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM doctors WHERE id = ${current.doctorId}::uuid FOR UPDATE`;
        const fresh = await tx.doctorSchedule.findUniqueOrThrow({
          where: { id },
          include: {
            breaks: true,
            appointments: {
              where: { status: { in: ['booked', 'completed'] } },
            },
          },
        });
        if (
          fresh.startTime.getTime() !== current.startTime.getTime() ||
          fresh.endTime.getTime() !== current.endTime.getTime()
        )
          conflict('SCHEDULE_CONFLICT', 'Schedule changed; reload and retry.');
        const lockedAt = new Date();
        if (oldStart < lockedAt && newStart.getTime() !== oldStart.getTime())
          conflict(
            'SCHEDULE_CONFLICT',
            'Elapsed schedule time cannot be changed.',
          );
        if (oldEnd < lockedAt && newEnd.getTime() !== oldEnd.getTime())
          conflict(
            'SCHEDULE_CONFLICT',
            'Elapsed schedule time cannot be changed.',
          );
        if (
          fresh.appointments.some(
            (a) => a.startsAt < newStart || a.endsAt > newEnd,
          )
        )
          conflict(
            'SCHEDULE_CONFLICT',
            'Existing appointments must remain inside the schedule.',
          );
        if (
          fresh.breaks.some(
            (b) => timeText(b.startTime) < start || timeText(b.endTime) > end,
          )
        )
          conflict(
            'SCHEDULE_CONFLICT',
            'Existing breaks must remain inside the schedule.',
          );
        return tx.doctorSchedule.update({
          where: { id },
          data: {
            startTime: timeValue(start),
            endTime: timeValue(end),
            isBookable,
          },
          include: { breaks: true },
        });
      });
      return { data: this.scheduleView(row) };
    } catch (error) {
      if (dbConflict(error))
        conflict(
          'SCHEDULE_CONFLICT',
          'Schedule overlaps another working interval.',
        );
      throw error;
    }
  }

  async addBreak(actor: Actor, idValue: unknown, body: unknown) {
    const id = uuid(idValue, 'scheduleId');
    const input = object(
      body,
      ['startTime', 'endTime'],
      ['startTime', 'endTime'],
    );
    const start = timeOnly(input.startTime, 'startTime');
    const end = timeOnly(input.endTime, 'endTime');
    if (start >= end) bad('Break start must precede end.');
    const schedule = await this.db.doctorSchedule.findUnique({ where: { id } });
    if (!schedule) notFound();
    await this.mayWriteSchedule(
      actor,
      schedule.doctorId,
      schedule.departmentId,
    );
    const day = dateText(schedule.scheduleDate);
    const breakStart = localTimestamp(day, start);
    const breakEnd = localTimestamp(day, end);
    if (
      breakStart <= new Date() ||
      start < timeText(schedule.startTime) ||
      end > timeText(schedule.endTime)
    )
      conflict(
        'BREAK_CONFLICT',
        'Break must be future and within the schedule.',
      );
    try {
      const result = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM doctors WHERE id = ${schedule.doctorId}::uuid FOR UPDATE`;
        const fresh = await tx.doctorSchedule.findUniqueOrThrow({
          where: { id },
          include: {
            breaks: true,
            appointments: {
              where: { status: { in: ['booked', 'completed'] } },
            },
          },
        });
        if (
          start < timeText(fresh.startTime) ||
          end > timeText(fresh.endTime) ||
          breakStart <= new Date()
        )
          conflict('BREAK_CONFLICT', 'Break is outside the future schedule.');
        if (
          fresh.breaks.some(
            (b) => start < timeText(b.endTime) && timeText(b.startTime) < end,
          )
        )
          conflict('BREAK_CONFLICT', 'Break overlaps another break.');
        if (
          fresh.appointments.some((a) =>
            overlaps(breakStart, breakEnd, a.startsAt, a.endsAt),
          )
        )
          conflict('BREAK_CONFLICT', 'Break overlaps an appointment.');
        return tx.doctorScheduleBreak.create({
          data: {
            id: randomUUID(),
            doctorScheduleId: id,
            startTime: timeValue(start),
            endTime: timeValue(end),
          },
        });
      });
      return { data: { id: result.id, startTime: start, endTime: end } };
    } catch (error) {
      if (dbConflict(error))
        conflict('BREAK_CONFLICT', 'Break conflicts with another interval.');
      throw error;
    }
  }

  async removeBreak(
    actor: Actor,
    scheduleIdValue: unknown,
    breakIdValue: unknown,
  ): Promise<void> {
    const scheduleId = uuid(scheduleIdValue, 'scheduleId');
    const breakId = uuid(breakIdValue, 'breakId');
    const schedule = await this.db.doctorSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) notFound();
    await this.mayWriteSchedule(
      actor,
      schedule.doctorId,
      schedule.departmentId,
    );
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM doctors WHERE id = ${schedule.doctorId}::uuid FOR UPDATE`;
      const row = await tx.doctorScheduleBreak.findUnique({
        where: { id: breakId },
      });
      if (!row || row.doctorScheduleId !== scheduleId) notFound();
      if (
        localTimestamp(
          dateText(schedule.scheduleDate),
          timeText(row.startTime),
        ) <= new Date()
      )
        conflict('BREAK_CONFLICT', 'Elapsed breaks cannot be removed.');
      await tx.doctorScheduleBreak.delete({ where: { id: breakId } });
    });
  }

  async appointments(actor: Actor, query: Record<string, unknown>) {
    this.require(
      actor,
      'scheduler',
      'schedule_manager',
      'clinician',
      'clinical_delegate',
    );
    const pagination = page(query);
    const doctorId =
      query.doctorId === undefined
        ? undefined
        : uuid(query.doctorId, 'doctorId');
    const patientId =
      query.patientId === undefined
        ? undefined
        : uuid(query.patientId, 'patientId');
    const from =
      query.from === undefined ? undefined : dateOnly(query.from, 'from');
    const to = query.to === undefined ? undefined : dateOnly(query.to, 'to');
    const status =
      query.status === undefined
        ? undefined
        : string(query.status, 'status', 20);
    if (status && !['booked', 'cancelled', 'completed'].includes(status))
      bad('Invalid status.');
    if (from && to && from > to) bad('Invalid date range.');
    const clinicianOnly = !this.has(
      actor,
      'scheduler',
      'schedule_manager',
      'clinical_delegate',
    );
    if (clinicianOnly && !actor.doctorId) forbidden();
    const where = {
      departmentId: actor.departmentId,
      ...(doctorId || clinicianOnly
        ? { doctorId: clinicianOnly ? actor.doctorId! : doctorId }
        : {}),
      ...(patientId ? { patientId } : {}),
      ...(status
        ? { status: status as 'booked' | 'cancelled' | 'completed' }
        : {}),
      ...(from || to
        ? {
            startsAt: {
              ...(from ? { gte: localTimestamp(from, '00:00') } : {}),
              ...(to
                ? {
                    lt: new Date(
                      localTimestamp(to, '00:00').getTime() + 86_400_000,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.appointment.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              medicalRecordNumber: true,
              firstName: true,
              lastName: true,
            },
          },
          doctor: {
            select: {
              id: true,
              user: {
                select: { employeeCode: true, firstName: true, lastName: true },
              },
            },
          },
          appointmentType: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.db.appointment.count({ where }),
    ]);
    const data = rows.map(({ doctor, ...row }) => ({
      ...row,
      doctor: { id: doctor.id, ...doctor.user },
    }));
    return collection(data, total, pagination);
  }

  async appointment(actor: Actor, idValue: unknown) {
    this.require(
      actor,
      'scheduler',
      'schedule_manager',
      'clinician',
      'clinical_delegate',
    );
    const id = uuid(idValue, 'appointmentId');
    const row = await this.db.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            medicalRecordNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        doctor: {
          select: {
            id: true,
            user: {
              select: { employeeCode: true, firstName: true, lastName: true },
            },
          },
        },
        appointmentType: { select: { id: true, code: true, name: true } },
      },
    });
    if (!row || row.departmentId !== actor.departmentId) notFound();
    if (
      !this.has(actor, 'scheduler', 'schedule_manager', 'clinical_delegate') &&
      actor.doctorId !== row.doctorId
    )
      notFound();
    const { doctor, ...appointment } = row;
    return {
      data: { ...appointment, doctor: { id: doctor.id, ...doctor.user } },
    };
  }
}

function dbConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as {
    code?: string;
    cause?: { code?: string };
    meta?: { code?: string };
  };
  return (
    ['23P01', '23505', 'P2002', 'P2010'].includes(value.code ?? '') ||
    ['23P01', '23505'].includes(value.cause?.code ?? '') ||
    ['23P01', '23505'].includes(value.meta?.code ?? '')
  );
}
