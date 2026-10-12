import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import { PatientsPage } from "@/features/patients/components/patients-page";
import { getCurrentAccount } from "@/lib/auth";

async function PatientsContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.roles.includes("scheduler")) redirect("/");
  return <PatientsPage account={account} />;
}

export default function Page() {
  return <Suspense fallback={<WorkspaceShell account={null} activePath="/patients" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading patients...</div></WorkspaceShell>}><PatientsContent /></Suspense>;
}
