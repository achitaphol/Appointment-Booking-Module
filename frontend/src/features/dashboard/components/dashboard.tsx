import Link from "next/link";
import { CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import type { Appointment } from "@/features/appointments/types";
import type { DashboardOverview } from "@/features/dashboard/types";
import type { Account } from "@/lib/auth";

const statusStyles = { booked: "bg-[#E8F0F3] text-[#315A70]", completed: "bg-[#EAF2EC] text-[#41664B]", cancelled: "bg-[#F2EEEE] text-[#775A5A]" };

function SummaryItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-0 px-5 py-4 sm:px-7"><p className="text-xs text-[#69777F]">{label}</p><p className="mt-1 truncate text-2xl font-semibold tracking-[-0.02em] text-[#1D2B33]">{value}</p><p className="mt-1 truncate text-xs text-[#879299]">{detail}</p></div>;
}

function time(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function appointmentDetail(value: string, today: string) {
  const appointmentDate = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
  if (appointmentDate === today) return `Today · ${time(value)}`;
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
  return `${date} · ${time(value)}`;
}

function patientName(appointment: Appointment | null) {
  return appointment ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "—";
}

export function Dashboard({ account, overview, loading = false }: { account: Account | null; overview: DashboardOverview | null; loading?: boolean }) {
  if (loading) return <WorkspaceShell account={null} activePath="/" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading overview...</div></WorkspaceShell>;

  const isDoctor = account?.userType.code === "doctor";
  const departmentName = account?.department.name ?? "Hospital workspace";
  const summary = overview?.summary;
  const appointments = overview?.appointments ?? [];
  const workingHours = overview?.workingHours;
  const breakText = workingHours?.breaks.length ? workingHours.breaks.map((item) => `${item.startTime}–${item.endTime}`).join(", ") : "No breaks";

  return <WorkspaceShell account={account} activePath="/">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-6"><div><h1 className="text-2xl font-semibold tracking-[-0.025em]">Overview</h1><p className="mt-1 text-sm text-[#6B7980]">Today</p></div><div className="hidden items-center gap-2 text-xs text-[#64727A] sm:flex"><Clock3 className="size-4" strokeWidth={1.8} aria-hidden="true" /><span>Bangkok time</span></div></div>

      <section aria-label="Daily summary" className="mt-7 grid grid-cols-2 divide-x divide-[#E0E5E7] border-y border-[#DCE2E4] bg-white sm:grid-cols-3">
        {isDoctor ? <>
          <SummaryItem label="Appointments today" value={String(summary?.appointments ?? 0)} detail={`${summary?.booked ?? 0} booked · ${summary?.completed ?? 0} completed`} />
          <SummaryItem label="Next patient" value={patientName(overview?.nextAppointment ?? null)} detail={overview?.nextAppointment && overview ? appointmentDetail(overview.nextAppointment.startsAt, overview.date) : "No upcoming visit"} />
          <div className="col-span-2 border-t border-[#E0E5E7] sm:col-span-1 sm:border-t-0"><SummaryItem label="Working hours" value={workingHours ? `${workingHours.startTime}–${workingHours.endTime}` : "—"} detail={workingHours ? `Break ${breakText}` : "No schedule today"} /></div>
        </> : <>
          <SummaryItem label="Appointments today" value={String(summary?.appointments ?? 0)} detail={`${summary?.completed ?? 0} completed · ${summary?.cancelled ?? 0} cancelled`} />
          <SummaryItem label="Booked today" value={String(summary?.booked ?? 0)} detail="Active appointments" />
          <div className="col-span-2 border-t border-[#E0E5E7] sm:col-span-1 sm:border-t-0"><SummaryItem label="Doctors scheduled" value={String(summary?.doctorsScheduled ?? 0)} detail={`Working in ${departmentName}`} /></div>
        </>}
      </section>

      <section className="mt-8 overflow-hidden border border-[#DCE2E4] bg-white" aria-labelledby="schedule-heading">
        <div className="flex items-center justify-between border-b border-[#E1E6E8] px-5 py-4"><div><h2 id="schedule-heading" className="text-sm font-semibold">{isDoctor ? "My appointments" : "Today’s appointments"}</h2><p className="mt-0.5 text-xs text-[#758289]">{isDoctor ? "Your patient list for today" : `All visits in ${departmentName}`}</p></div><span className="text-xs text-[#7B878D]">{appointments.length} {appointments.length === 1 ? "appointment" : "appointments"}</span></div>
        <div className="hidden grid-cols-[90px_minmax(180px,1.4fr)_minmax(140px,1fr)_120px_20px] gap-5 border-b border-[#E6EAEC] bg-[#FAFBFB] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#7A878E] sm:grid"><span>Time</span><span>Patient</span><span>{isDoctor ? "Visit type" : "Doctor"}</span><span>Status</span><span /></div>
        {appointments.length ? <div className="divide-y divide-[#E6EAEC]">{appointments.map((appointment) => <Link key={appointment.id} href={`/appointments/${appointment.id}`} className="grid gap-3 px-5 py-3.5 hover:bg-[#FAFBFB] sm:grid-cols-[90px_minmax(180px,1.4fr)_minmax(140px,1fr)_120px_20px] sm:items-center sm:gap-5"><span className="text-sm font-medium">{time(appointment.startsAt)}</span><span><span className="block truncate text-sm font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</span><span className="text-xs text-[#7A878E]">{appointment.patient.medicalRecordNumber}</span></span><span className="truncate text-sm text-[#53636C]">{isDoctor ? appointment.appointmentType.name : `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[appointment.status]}`}>{appointment.status}</span><ChevronRight className="hidden size-4 text-[#89949A] sm:block" aria-hidden="true" /></Link>)}</div> : <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center"><CalendarDays className="size-6 text-[#8A979D]" strokeWidth={1.5} aria-hidden="true" /><p className="mt-3 text-sm font-medium">No appointments today</p><p className="mt-1 text-sm text-[#77848B]">{isDoctor ? "Your appointments will appear here." : "New bookings will appear here."}</p></div>}
      </section>

      <section className="mt-8 border-t border-[#DCE2E4] pt-5" aria-labelledby="next-heading"><h2 id="next-heading" className="text-sm font-semibold">{isDoctor ? "Schedule" : "Department summary"}</h2><div className="mt-3 flex items-center justify-between gap-5 text-sm"><p className="text-[#65747C]">{isDoctor ? (workingHours ? `Today ${workingHours.startTime}–${workingHours.endTime}; break ${breakText}.` : "You do not have a schedule today.") : `${summary?.booked ?? 0} booked, ${summary?.completed ?? 0} completed, and ${summary?.cancelled ?? 0} cancelled today.`}</p><span className="hidden shrink-0 text-xs text-[#879299] sm:inline">Up to date</span></div></section>
    </div>
  </WorkspaceShell>;
}
