import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import { ScheduleManager } from "@/features/schedules/components/schedule-manager";
import { getCurrentAccount } from "@/lib/auth";

async function MyScheduleContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.userType.code !== "doctor" || !account.roles.includes("clinician")) redirect("/");
  return <ScheduleManager account={account} doctors={[]} initialDoctorId={account.userId} allowDoctorSelection={false} title="My schedule" subtitle="Manage your upcoming working hours and breaks" activePath="/my-schedule" />;
}

export default function Page() {
  return <Suspense fallback={<WorkspaceShell account={null} activePath="/my-schedule" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading schedule...</div></WorkspaceShell>}><MyScheduleContent /></Suspense>;
}
