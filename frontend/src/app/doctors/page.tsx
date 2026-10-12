import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, Stethoscope } from "lucide-react";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import type { DoctorOption } from "@/features/appointments/types";
import { authenticatedBackendGet, getCurrentAccount } from "@/lib/auth";

async function DoctorsContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.roles.some((role) => ["scheduler", "schedule_manager", "clinician"].includes(role))) redirect("/");
  const response = await authenticatedBackendGet("/api/v1/doctors?pageSize=100");
  const payload = response?.ok ? await response.json() as { data?: DoctorOption[] } : {};
  const doctors = Array.isArray(payload.data) ? payload.data : [];
  const canManage = account.roles.includes("schedule_manager");

  return (
    <WorkspaceShell account={account} activePath="/doctors">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Doctors</h1>
        <p className="mt-1 text-sm text-[#6B7980]">Doctors working in {account.department.name}</p>
        <section className="mt-7 overflow-hidden border border-[#DCE2E4] bg-white">
          <div className="grid grid-cols-[1fr_160px_150px] gap-5 border-b border-[#E1E6E8] bg-[#FAFBFB] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#7A878E]">
            <span>Doctor</span><span>Employee code</span><span />
          </div>
          {doctors.length ? doctors.map((doctor) => (
            <div key={doctor.id} className="grid grid-cols-[1fr_160px_150px] items-center gap-5 border-b border-[#E6EAEC] px-5 py-4 text-sm last:border-0">
              <span className="font-medium">Dr. {doctor.firstName} {doctor.lastName}</span>
              <span className="text-[#617078]">{doctor.employeeCode}</span>
              {canManage ? <Link href={`/schedules?doctorId=${doctor.id}`} className="inline-flex items-center justify-end gap-2 text-[#315A70] hover:underline"><CalendarRange className="size-4" /> Schedule</Link> : <span />}
            </div>
          )) : (
            <div className="flex min-h-64 flex-col items-center justify-center text-center"><Stethoscope className="size-6 text-[#8A979D]" strokeWidth={1.5} /><p className="mt-3 text-sm font-medium">No doctors found</p></div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return <Suspense fallback={<WorkspaceShell account={null} activePath="/doctors" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading doctors...</div></WorkspaceShell>}><DoctorsContent /></Suspense>;
}
