"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Search, UsersRound } from "lucide-react";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import type { PatientOption } from "@/features/appointments/types";
import type { Account } from "@/lib/auth";

function errorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  return "The request could not be completed.";
}

function formatDateOfBirth(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function PatientsPage({ account }: { account: Account }) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ pageSize: "50" });
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`/api/patients?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (response.ok) setPatients(Array.isArray(payload.data) ? payload.data : []);
        else setMessage(errorMessage(payload));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Unable to load patients.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicalRecordNumber: form.get("medicalRecordNumber"),
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        dateOfBirth: form.get("dateOfBirth") || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorMessage(payload));
    const created = payload.data as PatientOption;
    setPatients([created]);
    setQuery(created.medicalRecordNumber);
    setShowForm(false);
    event.currentTarget.reset();
  }

  return (
    <WorkspaceShell account={account} activePath="/patients">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">Patients</h1>
            <p className="mt-1 text-sm text-[#6B7980]">Find a patient by name or medical record number</p>
          </div>
          <button onClick={() => setShowForm((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#244E63] px-3.5 text-sm font-medium text-white hover:bg-[#1D4356]">
            <Plus className="size-4" aria-hidden="true" /> Add patient
          </button>
        </div>

        {showForm && (
          <form onSubmit={createPatient} className="mt-7 overflow-hidden border border-[#DCE2E4] bg-white">
            <div className="border-b border-[#E2E7E9] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#26363E]">New patient</h2>
              <p className="mt-1 text-xs text-[#77848B]">Enter the patient&apos;s identifying information.</p>
            </div>
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1.5 text-xs text-[#68767E]">Medical record number<input required name="medicalRecordNumber" autoComplete="off" className="h-10 rounded-md border border-[#CDD5D9] px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]" /></label>
              <label className="grid gap-1.5 text-xs text-[#68767E]">First name<input required name="firstName" autoComplete="given-name" className="h-10 rounded-md border border-[#CDD5D9] px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]" /></label>
              <label className="grid gap-1.5 text-xs text-[#68767E]">Last name<input required name="lastName" autoComplete="family-name" className="h-10 rounded-md border border-[#CDD5D9] px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]" /></label>
              <label className="grid gap-1.5 text-xs text-[#68767E]">Date of birth <span className="sr-only">Optional</span><input name="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} className="h-10 rounded-md border border-[#CDD5D9] px-3 text-sm text-[#53636C] outline-none focus:border-[#315A70]" /></label>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[#E2E7E9] bg-[#FAFBFB] px-5 py-3.5">
              <p className="text-xs text-[#77848B]">Date of birth is optional.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="h-9 rounded-md border border-[#CDD5D9] bg-white px-4 text-sm text-[#40515A]">Cancel</button>
                <button className="h-9 rounded-md bg-[#244E63] px-4 text-sm font-medium text-white">Save patient</button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-7 flex items-center gap-3">
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7A878E]" aria-hidden="true" />
            <input aria-label="Patient search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or medical record number" className="h-10 w-full rounded-md border border-[#CDD5D9] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#315A70]" />
          </div>
          {loading && <span className="text-xs text-[#77848B]">Loading...</span>}
        </div>
        {message && <p className="mt-3 text-sm text-[#8A4E4E]">{message}</p>}

        <section className="mt-6 overflow-hidden border border-[#DCE2E4] bg-white">
          <div className="grid grid-cols-[150px_1fr_140px] gap-5 border-b border-[#E1E6E8] bg-[#FAFBFB] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#7A878E]">
            <span>MRN</span><span>Patient</span><span>Date of birth</span>
          </div>
          {patients.length ? patients.map((patient) => (
            <div key={patient.id} className="grid grid-cols-[150px_1fr_140px] gap-5 border-b border-[#E6EAEC] px-5 py-4 text-sm last:border-0">
              <span className="font-medium">{patient.medicalRecordNumber}</span>
              <span>{patient.firstName} {patient.lastName}</span>
              <span className="text-[#617078]">{formatDateOfBirth(patient.dateOfBirth)}</span>
            </div>
          )) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <UsersRound className="size-6 text-[#8A979D]" strokeWidth={1.5} aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">No patients found</p>
              <p className="mt-1 text-sm text-[#77848B]">Try a different name or medical record number.</p>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
