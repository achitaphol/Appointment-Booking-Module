import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppointmentsPage } from "@/features/appointments/components/appointments-page";
import type { Appointment } from "@/features/appointments/types";
import { authenticatedBackendGet, getCurrentAccount } from "@/lib/auth";

type SearchParams = Promise<{ from?: string; to?: string; status?: string }>;

async function AppointmentsContent({ searchParams }: { searchParams: SearchParams }) {
  const [account, params] = await Promise.all([getCurrentAccount(), searchParams]);
  if (!account) redirect("/login");
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.status) query.set("status", params.status);
  query.set("pageSize", "50");

  const response = await authenticatedBackendGet(`/api/v1/appointments?${query.toString()}`);
  let appointments: Appointment[] = [];
  let total = 0;
  if (response?.ok) {
    const result = (await response.json()) as { data?: Appointment[]; meta?: { total?: number } };
    appointments = Array.isArray(result.data) ? result.data : [];
    total = typeof result.meta?.total === "number" ? result.meta.total : appointments.length;
  }

  return <AppointmentsPage account={account} appointments={appointments} total={total} />;
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AppointmentsPage account={null} appointments={[]} total={0} loading />}>
      <AppointmentsContent searchParams={searchParams} />
    </Suspense>
  );
}
