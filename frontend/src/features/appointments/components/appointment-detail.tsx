import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import { AppointmentActions } from "@/features/appointments/components/appointment-actions";
import type { Appointment } from "@/features/appointments/types";
import type { Account } from "@/lib/auth";

const statusStyles = {
  booked: "bg-[#E8F0F3] text-[#315A70]",
  completed: "bg-[#EAF2EC] text-[#41664B]",
  cancelled: "bg-[#F2EEEE] text-[#775A5A]",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs text-[#7B878D]">{label}</dt><dd className="mt-1 text-sm text-[#2B3941]">{children}</dd></div>;
}

export function AppointmentDetail({ account, appointment }: { account: Account; appointment: Appointment }) {
  const booked = appointment.status === "booked";
  const canCancel = booked && account.roles.includes("scheduler");
  const canComplete = booked && (account.roles.includes("clinician") || account.roles.includes("clinical_delegate"));

  return (
    <WorkspaceShell account={account} activePath="/appointments">
      <div className="mx-auto max-w-5xl">
        <Link href="/appointments" className="inline-flex items-center gap-2 text-sm text-[#607078] hover:text-[#244E63]">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Appointments
        </Link>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">Appointment details</h1>
            <p className="mt-1 text-sm text-[#6B7980]">{formatDate(appointment.startsAt)}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${statusStyles[appointment.status]}`}>{appointment.status}</span>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <section className="border border-[#DCE2E4] bg-white p-5 sm:p-6" aria-labelledby="visit-heading">
            <h2 id="visit-heading" className="text-sm font-semibold">Visit</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <Detail label="Date">{formatDate(appointment.startsAt)}</Detail>
              <Detail label="Time">{formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}</Detail>
              <Detail label="Appointment type">{appointment.appointmentType.name}</Detail>
              <Detail label="Doctor">Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}</Detail>
              <div className="sm:col-span-2"><Detail label="Reason for visit">{appointment.reasonForVisit || "Not provided"}</Detail></div>
            </dl>
          </section>

          <section className="border border-[#DCE2E4] bg-white p-5 sm:p-6" aria-labelledby="patient-heading">
            <h2 id="patient-heading" className="text-sm font-semibold">Patient</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <Detail label="Name">{appointment.patient.firstName} {appointment.patient.lastName}</Detail>
              <Detail label="Medical record number">{appointment.patient.medicalRecordNumber}</Detail>
              <Detail label="Department">{account.department.name}</Detail>
              <Detail label="Created">{formatDate(appointment.createdAt)}</Detail>
            </dl>
          </section>
        </div>

        {appointment.status === "cancelled" && (
          <section className="mt-6 border border-[#E3DADA] bg-[#FCF9F9] p-5 text-sm">
            <p className="font-medium text-[#684A4A]">Cancellation reason</p>
            <p className="mt-1 text-[#765F5F]">{appointment.cancellationReason}</p>
          </section>
        )}

        <AppointmentActions appointmentId={appointment.id} canCancel={canCancel} canComplete={canComplete} />
      </div>
    </WorkspaceShell>
  );
}
