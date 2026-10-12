import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import type { Account } from "@/lib/auth";
import type { Appointment } from "@/features/appointments/types";

const statusStyles = {
  booked: "bg-[#E8F0F3] text-[#315A70]",
  completed: "bg-[#EAF2EC] text-[#41664B]",
  cancelled: "bg-[#F2EEEE] text-[#775A5A]",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Bangkok" }).format(date),
    time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(date),
  };
}

export function AppointmentsPage({ account, appointments, total, loading = false }: { account: Account | null; appointments: Appointment[]; total: number; loading?: boolean }) {
  const isDoctor = account?.userType.code === "doctor";
  const canBook = account?.roles.includes("scheduler") ?? false;

  if (loading) {
    return <WorkspaceShell account={null} activePath="/appointments" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading appointments...</div></WorkspaceShell>;
  }

  return (
    <WorkspaceShell account={account} activePath="/appointments" loading={loading}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">{isDoctor ? "My appointments" : "Appointments"}</h1>
            <p className="mt-1 text-sm text-[#6B7980]">{isDoctor ? "Visits assigned to you" : `Visits in ${account?.department.name ?? "your department"}`}</p>
          </div>
          {canBook && (
            <Link href="/appointments/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-[#244E63] px-3.5 text-sm font-medium text-white hover:bg-[#1D4356]">
              <Plus aria-hidden="true" className="size-4" />
              New appointment
            </Link>
          )}
        </div>

        <form className="mt-7 flex flex-wrap items-end gap-3 border-y border-[#DCE2E4] bg-white px-4 py-4" method="get">
          <label className="grid gap-1.5 text-xs text-[#68767E]">
            From
            <input name="from" type="date" className="h-9 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]" />
          </label>
          <label className="grid gap-1.5 text-xs text-[#68767E]">
            To
            <input name="to" type="date" className="h-9 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]" />
          </label>
          <label className="grid gap-1.5 text-xs text-[#68767E]">
            Status
            <select name="status" defaultValue="" className="h-9 min-w-36 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]">
              <option value="">All statuses</option>
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button type="submit" className="h-9 rounded-md border border-[#C9D2D6] bg-white px-4 text-sm font-medium text-[#33464F] hover:bg-[#F4F6F6]">Apply</button>
        </form>

        <section className="mt-6 overflow-hidden border border-[#DCE2E4] bg-white" aria-label="Appointment list">
          <div className="flex items-center justify-between border-b border-[#E1E6E8] px-5 py-4">
            <p className="text-sm font-semibold">All appointments</p>
            <p className="text-xs text-[#77848B]">{total} {total === 1 ? "appointment" : "appointments"}</p>
          </div>

          {appointments.length ? (
            <div className="divide-y divide-[#E6EAEC]">
              <div className="hidden grid-cols-[110px_minmax(180px,1.5fr)_minmax(150px,1fr)_130px_28px] gap-5 bg-[#FAFBFB] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#7A878E] sm:grid">
                <span>Date & time</span><span>Patient</span><span>{isDoctor ? "Visit type" : "Doctor"}</span><span>Status</span><span />
              </div>
              {appointments.map((appointment) => {
                const dateTime = formatDateTime(appointment.startsAt);
                return (
                  <Link key={appointment.id} href={`/appointments/${appointment.id}`} className="grid gap-3 px-5 py-4 hover:bg-[#FAFBFB] sm:grid-cols-[110px_minmax(180px,1.5fr)_minmax(150px,1fr)_130px_28px] sm:items-center sm:gap-5">
                    <div><p className="text-sm font-medium">{dateTime.time}</p><p className="mt-0.5 text-xs text-[#7A878E]">{dateTime.date}</p></div>
                    <div><p className="truncate text-sm font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</p><p className="mt-0.5 text-xs text-[#7A878E]">{appointment.patient.medicalRecordNumber}</p></div>
                    <p className="truncate text-sm text-[#53636C]">{isDoctor ? appointment.appointmentType.name : `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`}</p>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[appointment.status]}`}>{appointment.status}</span>
                    <ChevronRight aria-hidden="true" className="hidden size-4 text-[#89949A] sm:block" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <CalendarDays aria-hidden="true" className="size-6 text-[#8A979D]" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium">No appointments found</p>
              <p className="mt-1 text-sm text-[#77848B]">Appointments matching these filters will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
