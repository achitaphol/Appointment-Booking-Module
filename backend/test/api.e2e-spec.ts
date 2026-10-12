import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/models/database.service.js';
import { ApiExceptionFilter } from '../src/common/exception.filter.js';

const requiredDatabase = 'hlab_api_test';
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname.slice(1) !== requiredDatabase) {
  throw new Error(`E2E tests require a dedicated ${requiredDatabase} database.`);
}

describe('appointment API', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let schedulerToken: string;
  let clinicianToken: string;
  const suffix = randomUUID().slice(0, 8);
  const departmentId = randomUUID();
  const otherDepartmentId = randomUUID();
  const doctorId = randomUUID();
  const patientId = randomUUID();
  const schedulerId = randomUUID();
  const appointmentTypeId = { value: '' };
  const historicalAppointmentId = randomUUID();
  const historicalScheduleId = randomUUID();
  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const at = (time: string) => new Date(`${day}T${time}:00+07:00`).toISOString();
  const api = '/api/v1';

  beforeAll(async () => {
    db = new DatabaseService();
    const doctorType = await db.userType.findUniqueOrThrow({ where: { code: 'doctor' } });
    const receptionistType = await db.userType.findUniqueOrThrow({ where: { code: 'receptionist' } });
    const followUp = await db.appointmentType.findUniqueOrThrow({ where: { code: 'follow_up_visit' } });
    appointmentTypeId.value = followUp.id;
    await db.department.createMany({ data: [{ id: departmentId, code: `T${suffix}A`, name: 'Test Department A' }, { id: otherDepartmentId, code: `T${suffix}B`, name: 'Test Department B' }] });
    await db.departmentAppointmentType.createMany({ data: [{ departmentId, appointmentTypeId: followUp.id, durationMinutes: 30 }, { departmentId: otherDepartmentId, appointmentTypeId: followUp.id, durationMinutes: 45 }] });
    await db.user.create({ data: { id: doctorId, userTypeId: doctorType.id, employeeCode: `D${suffix}`, firstName: 'Test', lastName: 'Doctor' } });
    await db.doctor.create({ data: { id: doctorId, primaryDepartmentId: departmentId } });
    await db.doctorDepartment.createMany({ data: [{ doctorId, departmentId }, { doctorId, departmentId: otherDepartmentId }] });
    await db.user.create({ data: { id: schedulerId, userTypeId: receptionistType.id, employeeCode: `S${suffix}`, firstName: 'Test', lastName: 'Scheduler' } });
    const passwordHash = await argon2.hash('test-password-long-enough');
    const schedulerAccount = await db.userAccount.create({ data: { id: randomUUID(), userId: schedulerId, departmentId, email: `scheduler-${suffix}@example.test`, passwordHash } });
    const doctorAccount = await db.userAccount.create({ data: { id: randomUUID(), userId: doctorId, departmentId, email: `doctor-${suffix}@example.test`, passwordHash } });
    await db.userAccountRole.createMany({ data: [{ userAccountId: schedulerAccount.id, roleCode: 'scheduler' }, { userAccountId: doctorAccount.id, roleCode: 'clinician' }] });
    await db.patient.create({ data: { id: patientId, medicalRecordNumber: `MRN${suffix}`, firstName: 'Test', lastName: 'Patient' } });
    const pastDay = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    await db.doctorSchedule.create({ data: { id: historicalScheduleId, doctorId, departmentId, scheduleDate: new Date(`${pastDay}T00:00:00Z`), startTime: new Date('1970-01-01T09:00:00Z'), endTime: new Date('1970-01-01T17:00:00Z') } });
    await db.appointment.create({ data: { id: historicalAppointmentId, patientId, doctorId, departmentId, doctorScheduleId: historicalScheduleId, appointmentTypeId: followUp.id, startsAt: new Date(`${pastDay}T09:00:00+07:00`), endsAt: new Date(`${pastDay}T09:30:00+07:00`), createdByUserAccountId: schedulerAccount.id } });

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    const login = async (email: string) => request(app.getHttpServer()).post(`${api}/auth/login`).send({ departmentCode: `T${suffix}A`, email, password: 'test-password-long-enough' }).expect(200);
    schedulerToken = (await login(`scheduler-${suffix}@example.test`)).body.data.accessToken;
    clinicianToken = (await login(`doctor-${suffix}@example.test`)).body.data.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  it('exposes health and login options, while protecting private routes', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    const options = await request(app.getHttpServer()).get(`${api}/auth/departments`).expect(200);
    expect(options.body.data.some((d: { code: string }) => d.code === `T${suffix}A`)).toBe(true);
    await request(app.getHttpServer()).get(`${api}/appointments`).expect(401);
    await request(app.getHttpServer()).post(`${api}/auth/login`).send({ departmentCode: `T${suffix}B`, email: `scheduler-${suffix}@example.test`, password: 'test-password-long-enough' }).expect(401);
    const me = await request(app.getHttpServer()).get(`${api}/auth/me`).set('Authorization', `Bearer ${schedulerToken}`).expect(200);
    expect(me.body.data.roles).toContain('scheduler');
    const overview = await request(app.getHttpServer()).get(`${api}/dashboard/overview`).set('Authorization', `Bearer ${schedulerToken}`).expect(200);
    expect(overview.body.data.timeZone).toBe('Asia/Bangkok');
    expect(overview.body.data.scope).toBe('department');
    expect(Array.isArray(overview.body.data.appointments)).toBe(true);
  });

  it('supports lookup, schedules, availability, and protected booking transitions', async () => {
    const scheduler = { Authorization: `Bearer ${schedulerToken}` };
    const clinician = { Authorization: `Bearer ${clinicianToken}` };
    const patientResult = await request(app.getHttpServer()).get(`${api}/patients`).query({ medicalRecordNumber: `MRN${suffix}` }).set(scheduler).expect(200);
    expect(patientResult.body.data[0].id).toBe(patientId);
    await request(app.getHttpServer()).post(`${api}/patients`).set(scheduler).send({ medicalRecordNumber: `MRN2${suffix}`, firstName: 'Second', lastName: 'Patient' }).expect(201);
    const doctors = await request(app.getHttpServer()).get(`${api}/doctors`).set(scheduler).expect(200);
    expect(doctors.body.data.some((d: { id: string }) => d.id === doctorId)).toBe(true);
    const types = await request(app.getHttpServer()).get(`${api}/appointment-types`).set(scheduler).expect(200);
    expect(types.body.data.some((t: { id: string; durationMinutes: number }) => t.id === appointmentTypeId.value && t.durationMinutes === 30)).toBe(true);

    const schedule = await request(app.getHttpServer()).post(`${api}/doctor-schedules`).set(clinician).send({ doctorId, departmentId, scheduleDate: day, startTime: '09:00', endTime: '17:00', isBookable: true }).expect(201);
    const scheduleId = schedule.body.data.id as string;
    await request(app.getHttpServer()).get(`${api}/doctor-schedules`).query({ doctorId, from: day, to: day }).set(scheduler).expect(200);
    await request(app.getHttpServer()).patch(`${api}/doctor-schedules/${scheduleId}`).set(clinician).send({ endTime: '16:00' }).expect(200);
    const breakResult = await request(app.getHttpServer()).post(`${api}/doctor-schedules/${scheduleId}/breaks`).set(clinician).send({ startTime: '12:00', endTime: '13:00' }).expect(201);
    const breakId = breakResult.body.data.id as string;
    const availability = await request(app.getHttpServer()).get(`${api}/availability`).query({ doctorId, date: day, appointmentTypeId: appointmentTypeId.value }).set(scheduler).expect(200);
    expect(availability.body.data.slots.some((slot: { startsAt: string }) => slot.startsAt === at('12:00'))).toBe(false);

    const payload = (time: string) => ({ patientId, doctorScheduleId: scheduleId, appointmentTypeId: appointmentTypeId.value, startsAt: at(time) });
    await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('12:00')).expect(409);
    await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('16:00')).expect(409);
    await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send({ ...payload('09:00'), startsAt: new Date(Date.now() - 86_400_000).toISOString() }).expect(409);
    const booked = await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('09:00')).expect(201);
    const appointmentId = booked.body.data.id as string;
    expect(booked.body.data.endsAt).toBe(at('09:30'));
    await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('09:15')).expect(409);
    const concurrent = await Promise.all([request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('10:00')), request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('10:00'))]);
    expect(concurrent.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    const bookingAgainstBreak = await Promise.all([
      request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('14:00')),
      request(app.getHttpServer()).post(`${api}/doctor-schedules/${scheduleId}/breaks`).set(clinician).send({ startTime: '14:00', endTime: '14:30' }),
    ]);
    expect(bookingAgainstBreak.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    const [appointmentAtFourteen, breakAtFourteen] = await Promise.all([
      db.appointment.count({ where: { doctorScheduleId: scheduleId, startsAt: new Date(at('14:00')), status: 'booked' } }),
      db.doctorScheduleBreak.count({ where: { doctorScheduleId: scheduleId, startTime: new Date('1970-01-01T14:00:00Z') } }),
    ]);
    expect(appointmentAtFourteen + breakAtFourteen).toBe(1);
    const afterRace = await request(app.getHttpServer()).get(`${api}/availability`).query({ doctorId, date: day, appointmentTypeId: appointmentTypeId.value }).set(scheduler).expect(200);
    expect(afterRace.body.data.slots.some((slot: { startsAt: string }) => slot.startsAt === at('10:00'))).toBe(false);
    await request(app.getHttpServer()).patch(`${api}/doctor-schedules/${scheduleId}`).set(clinician).send({ startTime: '09:15' }).expect(409);
    await request(app.getHttpServer()).post(`${api}/doctor-schedules/${scheduleId}/breaks`).set(clinician).send({ startTime: '09:00', endTime: '09:15' }).expect(409);
    await request(app.getHttpServer()).get(`${api}/appointments`).set(scheduler).expect(200);
    await request(app.getHttpServer()).get(`${api}/appointments/${appointmentId}`).set(scheduler).expect(200);
    await request(app.getHttpServer()).post(`${api}/appointments/${appointmentId}/complete`).set(scheduler).expect(403);
    await request(app.getHttpServer()).post(`${api}/appointments/${appointmentId}/cancel`).set(scheduler).send({ reason: 'Patient requested cancellation' }).expect(200);
    await request(app.getHttpServer()).post(`${api}/appointments/${appointmentId}/cancel`).set(scheduler).send({ reason: 'Again' }).expect(409);
    await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('09:00')).expect(201);
    await request(app.getHttpServer()).patch(`${api}/doctor-schedules/${scheduleId}`).set(clinician).send({ isBookable: false }).expect(200);
    await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send(payload('11:00')).expect(409);
    await request(app.getHttpServer()).delete(`${api}/doctor-schedules/${scheduleId}/breaks/${breakId}`).set(clinician).expect(204);

    const otherSchedule = await request(app.getHttpServer()).post(`${api}/doctor-schedules`).set(clinician).send({ doctorId, departmentId: otherDepartmentId, scheduleDate: day, startTime: '17:00', endTime: '18:00', isBookable: true }).expect(201);
    await request(app.getHttpServer()).post(`${api}/appointments`).set(scheduler).send({ ...payload('17:00'), doctorScheduleId: otherSchedule.body.data.id }).expect(403);
  });

  it('allows only the treating clinician to complete a past booked appointment', async () => {
    const clinician = { Authorization: `Bearer ${clinicianToken}` };
    const scheduler = { Authorization: `Bearer ${schedulerToken}` };
    await request(app.getHttpServer()).post(`${api}/appointments/${historicalAppointmentId}/complete`).set(scheduler).expect(403);
    const result = await request(app.getHttpServer()).post(`${api}/appointments/${historicalAppointmentId}/complete`).set(clinician).expect(200);
    expect(result.body.data.status).toBe('completed');
    expect(result.body.data.completedAt).toBeTruthy();
    await request(app.getHttpServer()).post(`${api}/appointments/${historicalAppointmentId}/cancel`).set(scheduler).send({ reason: 'Too late' }).expect(409);
    await request(app.getHttpServer()).patch(`${api}/doctor-schedules/${historicalScheduleId}`).set(clinician).send({ startTime: '10:00' }).expect(409);
  });
});
