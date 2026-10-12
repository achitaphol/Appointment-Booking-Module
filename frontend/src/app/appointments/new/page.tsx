import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import { NewAppointmentForm } from "@/features/appointments/components/new-appointment-form";
import type { AppointmentTypeOption, DoctorOption } from "@/features/appointments/types";
import { authenticatedBackendGet, getCurrentAccount } from "@/lib/auth";

async function readData<T>(path: string): Promise<T[]> {
  const response = await authenticatedBackendGet(path);
  if (!response?.ok) return [];
  const result = (await response.json()) as { data?: T[] };
  return Array.isArray(result.data) ? result.data : [];
}

async function NewAppointmentContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.roles.includes("scheduler")) redirect("/appointments");

  const [doctors, appointmentTypes] = await Promise.all([
    readData<DoctorOption>("/api/v1/doctors?pageSize=100"),
    readData<AppointmentTypeOption>("/api/v1/appointment-types"),
  ]);

  return (
    <WorkspaceShell account={account} activePath="/appointments">
      <div className="mx-auto max-w-5xl">
        <Link href="/appointments" className="inline-flex items-center gap-2 text-sm text-[#607078] hover:text-[#244E63]">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Appointments
        </Link>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.025em]">New appointment</h1>
        <p className="mt-1 text-sm text-[#6B7980]">Book a visit in {account.department.name}</p>
        <NewAppointmentForm doctors={doctors} appointmentTypes={appointmentTypes} />
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<WorkspaceShell account={null} activePath="/appointments" loading><div className="mx-auto max-w-5xl text-sm text-[#77848B]">Loading booking form...</div></WorkspaceShell>}>
      <NewAppointmentContent />
    </Suspense>
  );
}
