import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import * as argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function required(name: string, max = 255): string {
  const value = process.env[`PROVISION_${name}`]?.trim();
  if (!value || value.length > max) throw new Error(`PROVISION_${name} is required (maximum ${max} characters).`);
  return value;
}

async function department() {
  const code = required('DEPARTMENT_CODE', 32);
  const name = required('DEPARTMENT_NAME', 120);
  const record = await db.department.create({ data: { id: randomUUID(), code, name } });
  console.log(`Created department ${record.code} (${record.id}).`);
}

async function account(isDoctor: boolean) {
  const departmentCode = required('DEPARTMENT_CODE', 32);
  const department = await db.department.findUniqueOrThrow({ where: { code: departmentCode } });
  const userTypeCode = isDoctor ? 'doctor' : required('USER_TYPE_CODE', 32);
  if (!isDoctor && userTypeCode === 'doctor') throw new Error('Use the doctor command for doctor accounts.');
  const userType = await db.userType.findUniqueOrThrow({ where: { code: userTypeCode } });
  const employeeCode = required('EMPLOYEE_CODE', 32);
  const firstName = required('FIRST_NAME', 100);
  const lastName = required('LAST_NAME', 100);
  const email = required('EMAIL', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('PROVISION_EMAIL must be a valid email address.');
  const password = required('PASSWORD', 1024);
  if (password.length < 12) throw new Error('PROVISION_PASSWORD must have at least 12 characters.');
  const roleCodes = required('ROLES', 255).split(',').map((role) => role.trim());
  if (new Set(roleCodes).size !== roleCodes.length) throw new Error('Duplicate role code.');
  const roles = await db.role.findMany({ where: { code: { in: roleCodes } }, select: { code: true } });
  if (roles.length !== roleCodes.length) throw new Error('Unknown role code.');
  if (isDoctor && !roleCodes.includes('clinician')) throw new Error('Doctor accounts require the clinician role.');
  if (!isDoctor && roleCodes.includes('clinician')) throw new Error('Only doctor accounts may receive the clinician role.');
  const hash = await argon2.hash(password);

  const accountId = await db.$transaction(async (tx) => {
    const userId = randomUUID();
    await tx.user.create({ data: { id: userId, userTypeId: userType.id, employeeCode, firstName, lastName } });
    if (isDoctor) {
      await tx.doctor.create({ data: { id: userId, primaryDepartmentId: department.id } });
      await tx.doctorDepartment.create({ data: { doctorId: userId, departmentId: department.id } });
    }
    const accountId = randomUUID();
    await tx.userAccount.create({ data: { id: accountId, userId, departmentId: department.id, email, passwordHash: hash } });
    await tx.userAccountRole.createMany({ data: roleCodes.map((roleCode) => ({ userAccountId: accountId, roleCode })) });
    return accountId;
  });
  console.log(`Created ${isDoctor ? 'doctor' : 'staff'} account ${accountId}.`);
}

async function duration() {
  const department = await db.department.findUniqueOrThrow({ where: { code: required('DEPARTMENT_CODE', 32) } });
  const appointmentType = await db.appointmentType.findUniqueOrThrow({ where: { code: required('APPOINTMENT_TYPE_CODE', 32) } });
  const durationMinutes = Number(required('DURATION_MINUTES', 4));
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) throw new Error('Duration must be between 1 and 480 minutes.');
  await db.departmentAppointmentType.upsert({ where: { departmentId_appointmentTypeId: { departmentId: department.id, appointmentTypeId: appointmentType.id } }, create: { departmentId: department.id, appointmentTypeId: appointmentType.id, durationMinutes }, update: { durationMinutes, isBookable: true } });
  console.log(`Configured ${appointmentType.code} for ${department.code}: ${durationMinutes} minutes.`);
}

async function assignDoctor() {
  const user = await db.user.findUniqueOrThrow({ where: { employeeCode: required('EMPLOYEE_CODE', 32) }, include: { doctor: true } });
  if (!user.doctor) throw new Error('Employee is not a doctor.');
  const department = await db.department.findUniqueOrThrow({ where: { code: required('DEPARTMENT_CODE', 32) } });
  await db.doctorDepartment.upsert({ where: { doctorId_departmentId: { doctorId: user.id, departmentId: department.id } }, create: { doctorId: user.id, departmentId: department.id }, update: {} });
  console.log(`Assigned doctor ${user.employeeCode} to ${department.code}.`);
}

async function main() {
  switch (process.argv[2]) {
    case 'department': return department();
    case 'staff': return account(false);
    case 'doctor': return account(true);
    case 'duration': return duration();
    case 'assign-doctor': return assignDoctor();
    default: throw new Error('Usage: pnpm provision <department|staff|doctor|duration|assign-doctor>');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Provisioning failed.');
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});
