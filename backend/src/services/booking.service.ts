import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../models/database.service.js';
import type { Actor } from '../security/auth.guard.js';
import { bad, conflict, dateOnly, dateText, forbidden, localTimestamp, object, overlaps, optionalString, string, timeText, utcDate, uuid } from '../common/api-utils.js';

@Injectable()
export class BookingService {
  constructor(private readonly db: DatabaseService) {}

  require(actor: Actor, ...roles: string[]): void {
    if (!roles.some((role) => actor.roles.has(role))) forbidden();
  }

  async availability(actor: Actor, query: Record<string, unknown>) {
    this.require(actor, 'scheduler');
    const doctorId = uuid(query.doctorId, 'doctorId');
    const day = dateOnly(query.date, 'date');
    const appointmentTypeId = uuid(query.appointmentTypeId, 'appointmentTypeId');
    const rule = await this.db.departmentAppointmentType.findUnique({ where: { departmentId_appointmentTypeId: { departmentId: actor.departmentId, appointmentTypeId } } });
    if (!rule?.isBookable) conflict('APPOINTMENT_TYPE_UNAVAILABLE', 'Appointment type is not bookable in this department.');
    const schedules = await this.db.doctorSchedule.findMany({ where: { doctorId, departmentId: actor.departmentId, scheduleDate: new Date(`${day}T00:00:00Z`), isBookable: true }, include: { breaks: true }, orderBy: { startTime: 'asc' } });
    const dayStart = localTimestamp(day, '00:00');
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const appointments = await this.db.appointment.findMany({ where: { doctorId, status: { in: ['booked', 'completed'] }, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true } });
    const slots: { doctorScheduleId: string; startsAt: string; endsAt: string }[] = [];
    const durationMs = rule.durationMinutes * 60_000;
    for (const schedule of schedules) {
      const first = localTimestamp(day, timeText(schedule.startTime));
      const last = localTimestamp(day, timeText(schedule.endTime));
      for (let startMs = first.getTime(); startMs + durationMs <= last.getTime(); startMs += 15 * 60_000) {
        const start = new Date(startMs);
        const end = new Date(startMs + durationMs);
        if (start <= new Date()) continue;
        if (schedule.breaks.some((b) => overlaps(start, end, localTimestamp(day, timeText(b.startTime)), localTimestamp(day, timeText(b.endTime))))) continue;
        if (appointments.some((a) => overlaps(start, end, a.startsAt, a.endsAt))) continue;
        slots.push({ doctorScheduleId: schedule.id, startsAt: start.toISOString(), endsAt: end.toISOString() });
      }
    }
    return { data: { doctorId, departmentId: actor.departmentId, date: day, timeZone: 'Asia/Bangkok', appointmentTypeId, durationMinutes: rule.durationMinutes, slots } };
  }

  async book(actor: Actor, body: unknown) {
    this.require(actor, 'scheduler');
    const input = object(body, ['patientId', 'doctorScheduleId', 'appointmentTypeId', 'startsAt', 'reasonForVisit'], ['patientId', 'doctorScheduleId', 'appointmentTypeId', 'startsAt']);
    const patientId = uuid(input.patientId, 'patientId');
    const doctorScheduleId = uuid(input.doctorScheduleId, 'doctorScheduleId');
    const appointmentTypeId = uuid(input.appointmentTypeId, 'appointmentTypeId');
    const startsAt = utcDate(input.startsAt, 'startsAt');
    const reasonForVisit = optionalString(input.reasonForVisit, 'reasonForVisit', 2000);
    if (startsAt <= new Date()) conflict('BOOKING_IN_PAST', 'The appointment must start in the future.');
    const local = new Date(startsAt.getTime() + 7 * 3_600_000);
    if (local.getUTCMinutes() % 15 !== 0 || local.getUTCSeconds() !== 0 || local.getUTCMilliseconds() !== 0) bad('Start time must align to a 15-minute slot.');

    try {
      const appointment = await this.db.$transaction(async (tx) => {
        const initialSchedule = await tx.doctorSchedule.findUnique({ where: { id: doctorScheduleId }, select: { doctorId: true, departmentId: true } });
        if (!initialSchedule || initialSchedule.departmentId !== actor.departmentId) forbidden();
        // All booking and schedule mutations acquire the same doctor lock first.
        await tx.$queryRaw`SELECT id FROM doctors WHERE id = ${initialSchedule.doctorId}::uuid FOR UPDATE`;
        const schedule = await tx.doctorSchedule.findUnique({ where: { id: doctorScheduleId }, include: { breaks: true } });
        if (!schedule || schedule.departmentId !== actor.departmentId) forbidden();
        const patient = await tx.patient.findUnique({ where: { id: patientId }, select: { id: true } });
        if (!patient) bad('Patient does not exist.');
        const rule = await tx.departmentAppointmentType.findUnique({ where: { departmentId_appointmentTypeId: { departmentId: actor.departmentId, appointmentTypeId } } });
        if (!rule?.isBookable) conflict('APPOINTMENT_TYPE_UNAVAILABLE', 'Appointment type is not bookable in this department.');
        if (!schedule.isBookable) conflict('SLOT_UNAVAILABLE', 'The selected schedule is not bookable.');
        const endsAt = new Date(startsAt.getTime() + rule.durationMinutes * 60_000);
        const day = dateText(schedule.scheduleDate);
        const scheduleStart = localTimestamp(day, timeText(schedule.startTime));
        const scheduleEnd = localTimestamp(day, timeText(schedule.endTime));
        if (startsAt < scheduleStart || endsAt > scheduleEnd || startsAt <= new Date()) conflict('SLOT_UNAVAILABLE', 'The selected slot is outside the available schedule.');
        if (schedule.breaks.some((b) => overlaps(startsAt, endsAt, localTimestamp(day, timeText(b.startTime)), localTimestamp(day, timeText(b.endTime))))) conflict('SLOT_UNAVAILABLE', 'The selected slot overlaps a break.');
        const occupied = await tx.appointment.findFirst({ where: { doctorId: schedule.doctorId, status: { in: ['booked', 'completed'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
        if (occupied) conflict('SLOT_UNAVAILABLE', 'The selected slot is no longer available.');
        return tx.appointment.create({ data: { id: randomUUID(), patientId, doctorScheduleId, doctorId: schedule.doctorId, departmentId: actor.departmentId, appointmentTypeId, startsAt, endsAt, reasonForVisit, createdByUserAccountId: actor.accountId } });
      });
      return { data: appointment };
    } catch (error) {
      if (isDatabaseConflict(error)) conflict('SLOT_UNAVAILABLE', 'The selected slot is no longer available.');
      throw error;
    }
  }

  async cancel(actor: Actor, idValue: unknown, body: unknown) {
    this.require(actor, 'scheduler');
    const id = uuid(idValue, 'appointmentId');
    const input = object(body, ['reason'], ['reason']);
    const reason = string(input.reason, 'reason', 2000);
    return this.db.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({ where: { id }, select: { departmentId: true, status: true } });
      if (!appointment || appointment.departmentId !== actor.departmentId) forbidden();
      if (appointment.status !== 'booked') conflict('APPOINTMENT_STATE_CONFLICT', 'Only a booked appointment can be cancelled.');
      const changed = await tx.appointment.updateMany({ where: { id, status: 'booked' }, data: { status: 'cancelled', cancellationReason: reason, cancelledByUserAccountId: actor.accountId, cancelledAt: new Date() } });
      if (!changed.count) conflict('APPOINTMENT_STATE_CONFLICT', 'Appointment status changed.');
      return { data: await tx.appointment.findUniqueOrThrow({ where: { id } }) };
    });
  }

  async complete(actor: Actor, idValue: unknown) {
    this.require(actor, 'clinician', 'clinical_delegate');
    const id = uuid(idValue, 'appointmentId');
    return this.db.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({ where: { id }, select: { departmentId: true, doctorId: true, status: true, endsAt: true } });
      if (!appointment || appointment.departmentId !== actor.departmentId) forbidden();
      if (!actor.roles.has('clinical_delegate') && actor.doctorId !== appointment.doctorId) forbidden();
      if (appointment.status !== 'booked') conflict('APPOINTMENT_STATE_CONFLICT', 'Only a booked appointment can be completed.');
      if (appointment.endsAt > new Date()) conflict('APPOINTMENT_STATE_CONFLICT', 'An appointment cannot be completed before it ends.');
      const changed = await tx.appointment.updateMany({ where: { id, status: 'booked' }, data: { status: 'completed', completedAt: new Date() } });
      if (!changed.count) conflict('APPOINTMENT_STATE_CONFLICT', 'Appointment status changed.');
      return { data: await tx.appointment.findUniqueOrThrow({ where: { id } }) };
    });
  }
}

function isDatabaseConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; cause?: { code?: string }; meta?: { code?: string } };
  return ['23P01', '23505', 'P2002', 'P2010'].includes(value.code ?? '') || ['23P01', '23505'].includes(value.cause?.code ?? '') || ['23P01', '23505'].includes(value.meta?.code ?? '');
}
