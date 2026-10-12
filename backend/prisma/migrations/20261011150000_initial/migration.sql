-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('booked', 'cancelled', 'completed');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "medical_record_number" VARCHAR(32) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "user_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "user_type_id" UUID NOT NULL,
    "employee_code" VARCHAR(32) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" UUID NOT NULL,
    "primary_department_id" UUID NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_departments" (
    "doctor_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "doctor_departments_pkey" PRIMARY KEY ("doctor_id","department_id")
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password_changed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_appointment_types" (
    "department_id" UUID NOT NULL,
    "appointment_type_id" UUID NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "department_appointment_types_pkey" PRIMARY KEY ("department_id","appointment_type_id")
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "schedule_date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_schedule_breaks" (
    "id" UUID NOT NULL,
    "doctor_schedule_id" UUID NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,

    CONSTRAINT "doctor_schedule_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_schedule_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "appointment_type_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'booked',
    "reason_for_visit" TEXT,
    "created_by_user_account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancellation_reason" TEXT,
    "cancelled_by_user_account_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "patients_medical_record_number_key" ON "patients"("medical_record_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_types_code_key" ON "user_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_code_key" ON "users"("employee_code");

-- CreateIndex
CREATE INDEX "doctors_primary_department_id_idx" ON "doctors"("primary_department_id");

-- CreateIndex
CREATE INDEX "doctor_departments_department_id_idx" ON "doctor_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_user_id_key" ON "user_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_types_code_key" ON "appointment_types"("code");

-- CreateIndex
CREATE INDEX "doctor_schedules_doctor_id_schedule_date_idx" ON "doctor_schedules"("doctor_id", "schedule_date");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedules_id_doctor_id_department_id_key" ON "doctor_schedules"("id", "doctor_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedules_doctor_id_schedule_date_start_time_key" ON "doctor_schedules"("doctor_id", "schedule_date", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedule_breaks_doctor_schedule_id_start_time_key" ON "doctor_schedule_breaks"("doctor_schedule_id", "start_time");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_starts_at_idx" ON "appointments"("doctor_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_doctor_schedule_id_starts_at_idx" ON "appointments"("doctor_schedule_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_patient_id_starts_at_idx" ON "appointments"("patient_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_department_id_appointment_type_id_idx" ON "appointments"("department_id", "appointment_type_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_user_type_id_fkey" FOREIGN KEY ("user_type_id") REFERENCES "user_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_primary_department_id_fkey" FOREIGN KEY ("primary_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_departments" ADD CONSTRAINT "doctor_departments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_departments" ADD CONSTRAINT "doctor_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_appointment_types" ADD CONSTRAINT "department_appointment_types_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_appointment_types" ADD CONSTRAINT "department_appointment_types_appointment_type_id_fkey" FOREIGN KEY ("appointment_type_id") REFERENCES "appointment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_department_id_fkey" FOREIGN KEY ("doctor_id", "department_id") REFERENCES "doctor_departments"("doctor_id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedule_breaks" ADD CONSTRAINT "doctor_schedule_breaks_doctor_schedule_id_fkey" FOREIGN KEY ("doctor_schedule_id") REFERENCES "doctor_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_appointment_type_id_fkey" FOREIGN KEY ("appointment_type_id") REFERENCES "appointment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_department_id_appointment_type_id_fkey" FOREIGN KEY ("department_id", "appointment_type_id") REFERENCES "department_appointment_types"("department_id", "appointment_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_schedule_id_doctor_id_department_id_fkey" FOREIGN KEY ("doctor_schedule_id", "doctor_id", "department_id") REFERENCES "doctor_schedules"("id", "doctor_id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_account_id_fkey" FOREIGN KEY ("created_by_user_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_user_account_id_fkey" FOREIGN KEY ("cancelled_by_user_account_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "department_appointment_types" ADD CONSTRAINT "department_appointment_types_duration_positive" CHECK ("duration_minutes" > 0);
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_valid_interval" CHECK ("start_time" < "end_time");
ALTER TABLE "doctor_schedule_breaks" ADD CONSTRAINT "doctor_schedule_breaks_valid_interval" CHECK ("start_time" < "end_time");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_valid_interval" CHECK ("starts_at" < "ends_at");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_status_metadata" CHECK (
    ("status" = 'booked' AND "cancellation_reason" IS NULL AND "cancelled_by_user_account_id" IS NULL AND "cancelled_at" IS NULL AND "completed_at" IS NULL)
    OR ("status" = 'cancelled' AND NULLIF(BTRIM("cancellation_reason"), '') IS NOT NULL AND "cancelled_by_user_account_id" IS NOT NULL AND "cancelled_at" IS NOT NULL AND "completed_at" IS NULL)
    OR ("status" = 'completed' AND "completed_at" IS NOT NULL AND "cancellation_reason" IS NULL AND "cancelled_by_user_account_id" IS NULL AND "cancelled_at" IS NULL)
);

ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_no_overlap" EXCLUDE USING gist (
    "doctor_id" WITH =,
    "schedule_date" WITH =,
    tsrange(("schedule_date" + "start_time"), ("schedule_date" + "end_time"), '[)') WITH &&
);
ALTER TABLE "doctor_schedule_breaks" ADD CONSTRAINT "doctor_schedule_breaks_no_overlap" EXCLUDE USING gist (
    "doctor_schedule_id" WITH =,
    tsrange(('2000-01-01'::date + "start_time"), ('2000-01-01'::date + "end_time"), '[)') WITH &&
);
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_no_overlap" EXCLUDE USING gist (
    "doctor_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" IN ('booked', 'completed'));
