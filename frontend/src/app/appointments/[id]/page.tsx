import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import { AppointmentDetail } from "@/features/appointments/components/appointment-detail";
import type { Appointment } from "@/features/appointments/types";
import { authenticatedBackendGet, getCurrentAccount } from "@/lib/auth";

async function AppointmentContent({ params }: { params: Promise<{ id: string }> }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  const { id } = await params;
  const response = await authenticatedBackendGet(`/api/v1/appointments/${encodeURIComponent(id)}`);
  if (!response?.ok) notFound();
  const result = (await response.json()) as { data?: Appointment };
  if (!result.data) notFound();
  return <AppointmentDetail account={account} appointment={result.data} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<WorkspaceShell account={null} activePath="/appointments" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading appointment...</div></WorkspaceShell>}>
      <AppointmentContent params={params} />
    </Suspense>
  );
}
