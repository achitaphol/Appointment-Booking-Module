import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import type { DoctorOption } from "@/features/appointments/types";
import { ScheduleManager } from "@/features/schedules/components/schedule-manager";
import { authenticatedBackendGet, getCurrentAccount } from "@/lib/auth";

type SearchParams = Promise<{ doctorId?: string }>;

async function SchedulesContent({ searchParams }: { searchParams: SearchParams }) {
  const [account, params] = await Promise.all([getCurrentAccount(), searchParams]);
  if (!account) redirect("/login");
  if (!account.roles.includes("schedule_manager")) redirect("/");
  const response = await authenticatedBackendGet("/api/v1/doctors?pageSize=100");
  const payload = response?.ok ? await response.json() as { data?: DoctorOption[] } : {};
  const doctors = Array.isArray(payload.data) ? payload.data : [];
  const initialDoctorId = doctors.some((doctor) => doctor.id === params.doctorId) ? params.doctorId! : doctors[0]?.id ?? "";
  return <ScheduleManager account={account} doctors={doctors} initialDoctorId={initialDoctorId} allowDoctorSelection title="Schedules" subtitle={`Manage doctors' working hours in ${account.department.name}`} activePath="/schedules" />;
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<WorkspaceShell account={null} activePath="/schedules" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading schedules...</div></WorkspaceShell>}><SchedulesContent searchParams={searchParams} /></Suspense>;
}
