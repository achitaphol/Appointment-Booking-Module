"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

function messageFrom(result: unknown, fallback: string) {
  if (!result || typeof result !== "object" || !("error" in result)) return fallback;
  const error = result.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export function AppointmentActions({ appointmentId, canCancel, canComplete }: { appointmentId: string; canCancel: boolean; canComplete: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState<"cancel" | "complete" | null>(null);
  const [error, setError] = useState("");
  const reasonInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!cancelOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    reasonInput.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setCancelOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, cancelOpen]);

  async function run(action: "cancel" | "complete") {
    if (action === "cancel" && !reason.trim()) {
      setError("Enter a cancellation reason.");
      return;
    }
    setError("");
    setBusy(action);
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "cancel" ? JSON.stringify({ reason: reason.trim() }) : "{}",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(messageFrom(result, `Unable to ${action} this appointment.`));
        return;
      }
      if (action === "cancel") setCancelOpen(false);
      router.refresh();
    } catch {
      setError(`Unable to ${action} this appointment.`);
    } finally {
      setBusy(null);
    }
  }

  if (!canCancel && !canComplete) return null;

  return (
    <section className="mt-6 border border-[#DCE2E4] bg-white p-5 sm:p-6" aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="text-sm font-semibold">Actions</h2>
      {canCancel && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#E6EAEC] pt-4">
          <div><p className="text-sm font-medium text-[#33434B]">Cancel this appointment</p><p className="mt-1 text-xs text-[#77848B]">The time slot will become available for another patient.</p></div>
          <button type="button" onClick={() => { setReason(""); setError(""); setCancelOpen(true); }} disabled={busy !== null} className="h-9 rounded-md border border-[#D4C5C5] px-3.5 text-sm font-medium text-[#8A3F3F] hover:bg-[#FAF5F5] disabled:opacity-50">
            Cancel appointment
          </button>
        </div>
      )}
      {canComplete && (
        <button type="button" onClick={() => run("complete")} disabled={busy !== null} className={`${canCancel ? "mt-5" : "mt-4"} h-9 rounded-md bg-[#244E63] px-3.5 text-sm font-medium text-white hover:bg-[#1D4356] disabled:opacity-50`}>
          {busy === "complete" ? "Completing..." : "Mark as completed"}
        </button>
      )}
      {error && !cancelOpen && <p role="alert" className="mt-3 text-sm text-[#A33E3E]">{error}</p>}
      {cancelOpen && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCancelOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#17242B]/35 px-4 py-8">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" aria-describedby="cancel-dialog-description" className="w-full max-w-md rounded-lg border border-[#D8DEE1] bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-[#E3E7E9] px-5 py-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F7ECEA] text-[#9A473C]"><AlertTriangle className="size-4.5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><h2 id="cancel-dialog-title" className="text-base font-semibold text-[#26363E]">Cancel appointment?</h2><p id="cancel-dialog-description" className="mt-1 text-sm text-[#68767E]">This releases the reserved time. Enter a reason for the patient record.</p></div>
              <button type="button" onClick={() => setCancelOpen(false)} disabled={busy !== null} aria-label="Close cancellation dialog" className="flex size-8 items-center justify-center rounded-md text-[#718087] hover:bg-[#F1F4F5] disabled:opacity-50"><X className="size-4" /></button>
            </div>
            <div className="px-5 py-5">
              <label className="grid gap-1.5 text-xs font-medium text-[#586870]">Cancellation reason<textarea ref={reasonInput} required value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} maxLength={500} rows={3} placeholder="Enter a clear reason" className="resize-none rounded-md border border-[#CCD5D9] bg-white px-3 py-2.5 text-sm font-normal text-[#273740] outline-none focus:border-[#315A70]" /></label>
              <div className="mt-1 flex justify-between text-[11px] text-[#8A969C]"><span>Required</span><span>{reason.length}/500</span></div>
              {error && <p role="alert" className="mt-3 text-sm text-[#A33E3E]">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E3E7E9] bg-[#FAFBFB] px-5 py-3.5">
              <button type="button" onClick={() => setCancelOpen(false)} disabled={busy !== null} className="h-9 rounded-md border border-[#CDD5D9] bg-white px-4 text-sm text-[#40515A] disabled:opacity-50">Back</button>
              <button type="button" onClick={() => run("cancel")} disabled={busy !== null || !reason.trim()} className="h-9 rounded-md bg-[#9A473C] px-4 text-sm font-medium text-white hover:bg-[#853B32] disabled:bg-[#C9B4B0]">{busy === "cancel" ? "Cancelling..." : "Confirm cancellation"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
