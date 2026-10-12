import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import type { DashboardOverview } from "@/features/dashboard/types";
import { authenticatedBackendGet, getCurrentAccount } from "@/lib/auth";

async function DashboardForCurrentAccount() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  let overview: DashboardOverview | null = null;
  const response = await authenticatedBackendGet("/api/v1/dashboard/overview");
  if (response?.ok) {
    const payload = await response.json() as { data?: DashboardOverview };
    overview = payload.data ?? null;
  }
  return <Dashboard account={account} overview={overview} />;
}

export default function Home() {
  return (
    <Suspense fallback={<Dashboard account={null} overview={null} loading />}>
      <DashboardForCurrentAccount />
    </Suspense>
  );
}
