import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import * as argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required to seed the database.');

const demoPassword = process.env.SEED_USER_PASSWORD?.trim() || 'HlabDemo1234!';
if (demoPassword.length < 12)
  throw new Error('SEED_USER_PASSWORD must have at least 12 characters.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const userTypes = [
  { code: 'doctor', name: 'Doctor' },
  { code: 'nurse', name: 'Nurse' },
  { code: 'receptionist', name: 'Receptionist' },
  { code: 'administrator', name: 'Administrator' },
] as const;

const appointmentTypes = [
  { code: 'new_patient_visit', name: 'New Patient Visit' },
  { code: 'follow_up_visit', name: 'Follow-up Visit' },
  { code: 'consultation', name: 'Consultation' },
  { code: 'procedure', name: 'Procedure' },
] as const;

const roles = [
  { code: 'administrator', name: 'Administrator' },
  { code: 'scheduler', name: 'Scheduler' },
  { code: 'schedule_manager', name: 'Schedule Manager' },
  { code: 'clinician', name: 'Clinician' },
  { code: 'clinical_delegate', name: 'Clinical Delegate' },
] as const;

const departments = [
  { code: 'cardiology', name: 'Cardiology' },
  { code: 'dermatology', name: 'Dermatology' },
  { code: 'orthopedics', name: 'Orthopedics' },
  { code: 'pediatrics', name: 'Pediatrics' },
] as const;

const demoUsers = [
  {
    employeeCode: 'DOC-CAR-001',
    firstName: 'Emma',
    lastName: 'Carter',
    email: 'emma.carter@hlab.test',
    userTypeCode: 'doctor',
    departmentCode: 'cardiology',
    roles: ['clinician'],
  },
  {
    employeeCode: 'DOC-DER-001',
    firstName: 'Daniel',
    lastName: 'Kim',
    email: 'daniel.kim@hlab.test',
    userTypeCode: 'doctor',
    departmentCode: 'dermatology',
    roles: ['clinician'],
  },
  {
    employeeCode: 'DOC-ORT-001',
    firstName: 'Olivia',
    lastName: 'Martin',
    email: 'olivia.martin@hlab.test',
    userTypeCode: 'doctor',
    departmentCode: 'orthopedics',
    roles: ['clinician'],
  },
  {
    employeeCode: 'DOC-PED-001',
    firstName: 'Noah',
    lastName: 'Wilson',
    email: 'noah.wilson@hlab.test',
    userTypeCode: 'doctor',
    departmentCode: 'pediatrics',
    roles: ['clinician'],
  },
  {
    employeeCode: 'REC-CAR-001',
    firstName: 'Sophia',
    lastName: 'Brown',
    email: 'sophia.brown@hlab.test',
    userTypeCode: 'receptionist',
    departmentCode: 'cardiology',
    roles: ['scheduler'],
  },
  {
    employeeCode: 'NUR-DER-001',
    firstName: 'Mia',
    lastName: 'Taylor',
    email: 'mia.taylor@hlab.test',
    userTypeCode: 'nurse',
    departmentCode: 'dermatology',
    roles: ['scheduler', 'clinical_delegate'],
  },
  {
    employeeCode: 'REC-DER-001',
    firstName: 'Chloe',
    lastName: 'Lee',
    email: 'chloe.lee@hlab.test',
    userTypeCode: 'receptionist',
    departmentCode: 'dermatology',
    roles: ['scheduler'],
  },
  {
    employeeCode: 'REC-ORT-001',
    firstName: 'James',
    lastName: 'Anderson',
    email: 'james.anderson@hlab.test',
    userTypeCode: 'receptionist',
    departmentCode: 'orthopedics',
    roles: ['scheduler', 'schedule_manager'],
  },
  {
    employeeCode: 'NUR-PED-001',
    firstName: 'Ava',
    lastName: 'Thomas',
    email: 'ava.thomas@hlab.test',
    userTypeCode: 'nurse',
    departmentCode: 'pediatrics',
    roles: ['scheduler', 'clinical_delegate'],
  },
  {
    employeeCode: 'REC-PED-001',
    firstName: 'Grace',
    lastName: 'Clark',
    email: 'grace.clark@hlab.test',
    userTypeCode: 'receptionist',
    departmentCode: 'pediatrics',
    roles: ['scheduler'],
  },
  {
    employeeCode: 'ADM-CAR-001',
    firstName: 'Liam',
    lastName: 'Moore',
    email: 'liam.moore@hlab.test',
    userTypeCode: 'administrator',
    departmentCode: 'cardiology',
    roles: ['administrator', 'scheduler', 'schedule_manager'],
  },
] as const;

const patients = [
  {
    medicalRecordNumber: 'HN000001',
    firstName: 'Ethan',
    lastName: 'Walker',
    dateOfBirth: '1985-04-12',
  },
  {
    medicalRecordNumber: 'HN000002',
    firstName: 'Isabella',
    lastName: 'Hall',
    dateOfBirth: '1992-09-23',
  },
  {
    medicalRecordNumber: 'HN000003',
    firstName: 'Lucas',
    lastName: 'Young',
    dateOfBirth: '2018-01-08',
  },
  {
    medicalRecordNumber: 'HN000004',
    firstName: 'Amelia',
    lastName: 'King',
    dateOfBirth: '1971-11-30',
  },
] as const;

const durationByType: Record<
  (typeof appointmentTypes)[number]['code'],
  number
> = {
  new_patient_visit: 30,
  follow_up_visit: 20,
  consultation: 30,
  procedure: 60,
};

function nextWeekdays(count: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function main(): Promise<void> {
  for (const entry of userTypes) {
    await prisma.userType.upsert({
      where: { code: entry.code },
      create: { id: randomUUID(), ...entry },
      update: { name: entry.name },
    });
  }

  for (const entry of appointmentTypes) {
    await prisma.appointmentType.upsert({
      where: { code: entry.code },
      create: { id: randomUUID(), ...entry },
      update: { name: entry.name },
    });
  }

  for (const entry of roles) {
    await prisma.role.upsert({
      where: { code: entry.code },
      create: entry,
      update: { name: entry.name },
    });
  }

  for (const entry of departments) {
    await prisma.department.upsert({
      where: { code: entry.code },
      create: { id: randomUUID(), ...entry },
      update: { name: entry.name },
    });
  }

  const departmentRows = await prisma.department.findMany({
    where: { code: { in: departments.map((entry) => entry.code) } },
  });
  const departmentByCode = new Map(
    departmentRows.map((entry) => [entry.code, entry]),
  );
  const appointmentTypeRows = await prisma.appointmentType.findMany();

  for (const department of departmentRows) {
    for (const appointmentType of appointmentTypeRows) {
      const durationMinutes =
        durationByType[appointmentType.code as keyof typeof durationByType] ??
        30;
      await prisma.departmentAppointmentType.upsert({
        where: {
          departmentId_appointmentTypeId: {
            departmentId: department.id,
            appointmentTypeId: appointmentType.id,
          },
        },
        create: {
          departmentId: department.id,
          appointmentTypeId: appointmentType.id,
          durationMinutes,
        },
        update: { durationMinutes, isBookable: true },
      });
    }
  }

  const passwordHash = await argon2.hash(demoPassword);
  const doctorIds: string[] = [];

  for (const entry of demoUsers) {
    const department = departmentByCode.get(entry.departmentCode);
    if (!department)
      throw new Error(`Missing seeded department: ${entry.departmentCode}`);
    const userType = await prisma.userType.findUniqueOrThrow({
      where: { code: entry.userTypeCode },
    });

    const user = await prisma.user.upsert({
      where: { employeeCode: entry.employeeCode },
      create: {
        id: randomUUID(),
        userTypeId: userType.id,
        employeeCode: entry.employeeCode,
        firstName: entry.firstName,
        lastName: entry.lastName,
      },
      update: {
        userTypeId: userType.id,
        firstName: entry.firstName,
        lastName: entry.lastName,
        isActive: true,
      },
    });

    if (entry.userTypeCode === 'doctor') {
      await prisma.doctor.upsert({
        where: { id: user.id },
        create: { id: user.id, primaryDepartmentId: department.id },
        update: { primaryDepartmentId: department.id },
      });
      await prisma.doctorDepartment.upsert({
        where: {
          doctorId_departmentId: {
            doctorId: user.id,
            departmentId: department.id,
          },
        },
        create: { doctorId: user.id, departmentId: department.id },
        update: {},
      });
      doctorIds.push(user.id);
    }

    const account = await prisma.userAccount.upsert({
      where: { userId: user.id },
      create: {
        id: randomUUID(),
        userId: user.id,
        departmentId: department.id,
        email: entry.email,
        passwordHash,
      },
      update: {
        departmentId: department.id,
        email: entry.email,
        passwordHash,
        isActive: true,
        passwordChangedAt: new Date(),
      },
    });

    await prisma.userAccountRole.deleteMany({
      where: { userAccountId: account.id },
    });
    await prisma.userAccountRole.createMany({
      data: entry.roles.map((roleCode) => ({
        userAccountId: account.id,
        roleCode,
      })),
    });
  }

  for (const entry of patients) {
    await prisma.patient.upsert({
      where: { medicalRecordNumber: entry.medicalRecordNumber },
      create: {
        id: randomUUID(),
        medicalRecordNumber: entry.medicalRecordNumber,
        firstName: entry.firstName,
        lastName: entry.lastName,
        dateOfBirth: new Date(`${entry.dateOfBirth}T00:00:00Z`),
      },
      update: {
        firstName: entry.firstName,
        lastName: entry.lastName,
        dateOfBirth: new Date(`${entry.dateOfBirth}T00:00:00Z`),
      },
    });
  }

  const workdays = nextWeekdays(5);
  for (const doctorId of doctorIds) {
    const doctor = await prisma.doctor.findUniqueOrThrow({
      where: { id: doctorId },
    });
    for (const scheduleDate of workdays) {
      const startTime = new Date('1970-01-01T09:00:00Z');
      const schedule = await prisma.doctorSchedule.upsert({
        where: {
          doctorId_scheduleDate_startTime: {
            doctorId,
            scheduleDate,
            startTime,
          },
        },
        create: {
          id: randomUUID(),
          doctorId,
          departmentId: doctor.primaryDepartmentId,
          scheduleDate,
          startTime,
          endTime: new Date('1970-01-01T17:00:00Z'),
        },
        update: { endTime: new Date('1970-01-01T17:00:00Z'), isBookable: true },
      });
      await prisma.doctorScheduleBreak.upsert({
        where: {
          doctorScheduleId_startTime: {
            doctorScheduleId: schedule.id,
            startTime: new Date('1970-01-01T12:00:00Z'),
          },
        },
        create: {
          id: randomUUID(),
          doctorScheduleId: schedule.id,
          startTime: new Date('1970-01-01T12:00:00Z'),
          endTime: new Date('1970-01-01T13:00:00Z'),
        },
        update: { endTime: new Date('1970-01-01T13:00:00Z') },
      });
    }
  }

  console.log(
    `Seeded ${departments.length} departments, ${demoUsers.length} users, ${patients.length} patients, and ${doctorIds.length * workdays.length} doctor schedules.`,
  );
  console.log('No appointment records were created.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
