"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, UserRound } from "lucide-react";
import type { Appointment, AppointmentTypeOption, DoctorOption, PatientOption } from "@/features/appointments/types";
import type { DoctorSchedule } from "@/features/schedules/types";

type Slot = { doctorScheduleId: string; startsAt: string; endsAt: string };

function messageFrom(result: unknown, fallback: string) {
  if (!result || typeof result !== "object" || !("error" in result)) return fallback;
  const error = result.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

function slotTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function position(value: string, start: number, end: number) {
  return Math.max(0, Math.min(100, ((minutes(value) - start) / (end - start)) * 100));
}

export function NewAppointmentForm({ doctors, appointmentTypes }: { doctors: DoctorOption[]; appointmentTypes: AppointmentTypeOption[] }) {
  const router = useRouter();
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [date, setDate] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedHour, setSelectedHour] = useState("");
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedPatient || patientQuery.trim().length < 2) return;
    const timer = window.setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const response = await fetch(`/api/patients?q=${encodeURIComponent(patientQuery.trim())}&pageSize=10`, { cache: "no-store" });
        const result: unknown = await response.json();
        const data = result && typeof result === "object" && "data" in result && Array.isArray(result.data) ? result.data as PatientOption[] : [];
        setPatients(response.ok ? data : []);
        if (!response.ok) setError(messageFrom(result, "Unable to search patients."));
      } catch { setPatients([]); setError("Unable to search patients."); }
      finally { setSearchingPatients(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [patientQuery, selectedPatient]);

  useEffect(() => {
    if (!doctorId || !appointmentTypeId || !date) return;
    const timer = window.setTimeout(async () => {
      setLoadingSlots(true);
      setError("");
      setSelectedSlot(null);
      setSelectedHour("");
      try {
        const availabilityQuery = new URLSearchParams({ doctorId, appointmentTypeId, date });
        const scheduleQuery = new URLSearchParams({ doctorId, from: date, to: date });
        const appointmentQuery = new URLSearchParams({ doctorId, from: date, to: date, pageSize: "100" });
        const [availabilityResponse, scheduleResponse, appointmentResponse] = await Promise.all([
          fetch(`/api/availability?${availabilityQuery}`, { cache: "no-store" }),
          fetch(`/api/doctor-schedules?${scheduleQuery}`, { cache: "no-store" }),
          fetch(`/api/appointments?${appointmentQuery}`, { cache: "no-store" }),
        ]);
        const [availabilityResult, scheduleResult, appointmentResult] = await Promise.all([availabilityResponse.json(), scheduleResponse.json(), appointmentResponse.json()]);
        if (!availabilityResponse.ok) throw new Error(messageFrom(availabilityResult, "Unable to load available times."));
        const nextSlots: Slot[] = Array.isArray(availabilityResult?.data?.slots) ? availabilityResult.data.slots : [];
        setSlots(nextSlots);
        setSelectedSlot(nextSlots[0] ?? null);
        setSelectedHour(nextSlots[0] ? slotTime(nextSlots[0].startsAt).slice(0, 2) : "");
        setSchedules(scheduleResponse.ok && Array.isArray(scheduleResult.data) ? scheduleResult.data : []);
        setAppointments(appointmentResponse.ok && Array.isArray(appointmentResult.data) ? appointmentResult.data.filter((item: Appointment) => item.status !== "cancelled") : []);
      } catch (requestError) {
        setSlots([]); setSchedules([]); setAppointments([]);
        setError(requestError instanceof Error ? requestError.message : "Unable to load available times.");
      } finally { setLoadingSlots(false); }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [appointmentTypeId, date, doctorId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient || !selectedSlot || !appointmentTypeId) return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: selectedPatient.id, doctorScheduleId: selectedSlot.doctorScheduleId, appointmentTypeId, startsAt: selectedSlot.startsAt, ...(reasonForVisit.trim() ? { reasonForVisit: reasonForVisit.trim() } : {}) }) });
      const result: unknown = await response.json();
      if (!response.ok) return setError(messageFrom(result, "Unable to book the appointment."));
      const data = result && typeof result === "object" && "data" in result ? result.data : null;
      if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") return setError("The appointment was created, but its response was invalid.");
      router.push(`/appointments/${data.id}`); router.refresh();
    } catch { setError("Unable to book the appointment."); }
    finally { setSubmitting(false); }
  }

  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  const selectedType = appointmentTypes.find((type) => type.id === appointmentTypeId);
  const primarySchedule = schedules[0];
  const timelineStart = primarySchedule ? minutes(primarySchedule.startTime) : 0;
  const timelineEnd = primarySchedule ? minutes(primarySchedule.endTime) : 1;
  const timelineHours = primarySchedule
    ? Array.from({ length: Math.floor(timelineEnd / 60) - Math.ceil(timelineStart / 60) + 1 }, (_, index) => Math.ceil(timelineStart / 60) + index)
    : [];
  const timelineSegments = primarySchedule
    ? Array.from({ length: Math.ceil((timelineEnd - timelineStart) / 15) }, (_, index) => timelineStart + index * 15)
    : [];
  const availableHours = Array.from(new Set(slots.map((slot) => slotTime(slot.startsAt).slice(0, 2))));
  const activeHour = availableHours.includes(selectedHour) ? selectedHour : (availableHours[0] ?? "");
  const hourSlots = slots.filter((slot) => slotTime(slot.startsAt).startsWith(`${activeHour}:`));
  const fieldClass = "h-10 w-full rounded-md border border-[#CCD5D9] bg-white px-3 text-sm text-[#273740] outline-none focus:border-[#315A70]";

  return <form onSubmit={submit} className="mt-7 max-w-4xl border border-[#DCE2E4] bg-white">
    <section className="border-b border-[#E2E7E9] p-5 sm:p-6">
      <h2 className="text-sm font-semibold">Patient</h2>
      {selectedPatient ? <div className="mt-4 flex items-center gap-3 border border-[#DCE2E4] px-4 py-3"><UserRound className="size-5 text-[#607078]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p><p className="text-xs text-[#77848B]">{selectedPatient.medicalRecordNumber}</p></div><button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(""); }} className="text-sm text-[#315A70] hover:underline">Change</button></div> : <div className="relative mt-4 w-full"><Search className="absolute left-3 top-3 size-4 text-[#7A878E]" /><input aria-label="Search patient" value={patientQuery} onChange={(event) => { setPatientQuery(event.target.value); setPatients([]); setError(""); }} placeholder="Type patient name or medical record number" autoComplete="off" className={`${fieldClass} pl-9`} />{(patients.length > 0 || searchingPatients) && <div className="absolute z-10 mt-1 w-full border border-[#DCE2E4] bg-white shadow-sm">{searchingPatients ? <p className="px-4 py-3 text-sm text-[#77848B]">Searching...</p> : patients.map((patient) => <button key={patient.id} type="button" onClick={() => { setSelectedPatient(patient); setPatientQuery(`${patient.firstName} ${patient.lastName}`); setPatients([]); }} className="flex w-full items-center justify-between border-b border-[#E6EAEC] px-4 py-3 text-left last:border-0 hover:bg-[#F7F9F9]"><span className="text-sm font-medium">{patient.firstName} {patient.lastName}</span><span className="text-xs text-[#77848B]">{patient.medicalRecordNumber}</span></button>)}</div>}</div>}
    </section>

    <section className="border-b border-[#E2E7E9] p-5 sm:p-6"><h2 className="text-sm font-semibold">Visit</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="grid gap-1.5 text-xs text-[#68767E]">Doctor<select required value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className={fieldClass}><option value="">Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>Dr. {doctor.firstName} {doctor.lastName}</option>)}</select></label><label className="grid gap-1.5 text-xs text-[#68767E]">Appointment type<select required value={appointmentTypeId} onChange={(event) => setAppointmentTypeId(event.target.value)} className={fieldClass}><option value="">Select visit type</option>{appointmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name} · {type.durationMinutes} min</option>)}</select></label><label className="grid gap-1.5 text-xs text-[#68767E]">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} /></label></div></section>

    <section className="border-b border-[#E2E7E9] p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Available time</h2>{loadingSlots && <span className="text-xs text-[#77848B]">Loading...</span>}</div>
      {!doctorId || !appointmentTypeId || !date ? <p className="mt-4 text-sm text-[#77848B]">Select a doctor, appointment type, and date to view availability.</p> : !loadingSlots && !primarySchedule ? <p className="mt-4 text-sm text-[#77848B]">This doctor has no schedule on the selected date.</p> : primarySchedule && <div className="mt-5"><div className="relative pt-6"><div className="relative h-14 overflow-visible rounded border border-[#C9D7DC] bg-[#E6F0F2]">{timelineHours.map((hour) => { const left = position(`${String(hour).padStart(2, "0")}:00`, timelineStart, timelineEnd); return <span key={hour} className="absolute inset-y-0 z-10 border-l border-[#AFC2C9]" style={{ left: `${left}%` }}><span className="absolute -top-6 -translate-x-1/2 text-[10px] text-[#7B898F]">{String(hour).padStart(2, "0")}:00</span></span>; })}{primarySchedule.breaks.map((item) => <span key={item.id} title={`Break ${item.startTime}–${item.endTime}`} className="absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-sm bg-[#D8C59B] px-1 text-[10px] font-medium text-[#594D32]" style={{ left: `${position(item.startTime, timelineStart, timelineEnd)}%`, width: `${position(item.endTime, timelineStart, timelineEnd) - position(item.startTime, timelineStart, timelineEnd)}%` }}>Break</span>)}{appointments.map((appointment) => { const start = slotTime(appointment.startsAt); const end = slotTime(appointment.endsAt); return <span key={appointment.id} title={`Booked ${start}–${end}`} className="absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-sm bg-[#315A70] px-1 text-[10px] font-medium text-white" style={{ left: `${position(start, timelineStart, timelineEnd)}%`, width: `${Math.max(1.5, position(end, timelineStart, timelineEnd) - position(start, timelineStart, timelineEnd))}%` }}><span className="sr-only">Booked {start}–{end}</span></span>; })}{timelineSegments.map((segmentStart) => { const hour = Math.floor(segmentStart / 60); const minute = segmentStart % 60; const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`; return <span key={segmentStart} title={label} className="pointer-events-none absolute inset-y-0 z-20 border-r border-white/80" style={{ left: `${position(label, timelineStart, timelineEnd)}%`, width: `${(15 / (timelineEnd - timelineStart)) * 100}%` }} />; })}{selectedSlot && <span className="pointer-events-none absolute -bottom-2 -top-2 z-30 w-0.5 bg-[#C8513D]" style={{ left: `${position(slotTime(selectedSlot.startsAt), timelineStart, timelineEnd)}%` }}><span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-[#C8513D] px-1.5 py-0.5 text-[10px] font-semibold text-white">{slotTime(selectedSlot.startsAt)}</span></span>}</div><div className="mt-1 flex justify-between text-[10px] text-[#8A969C]"><span>Each block is 15 minutes</span><span>{primarySchedule.endTime}</span></div></div><div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#77848B]"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#E6F0F2] ring-1 ring-[#C9D7DC]" />Available</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#315A70]" />Booked</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#D8C59B]" />Break</span><span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-[#C8513D]" />Selected</span></div><div className="mt-6"><p className="text-sm font-medium text-[#33464F]">Choose a start time</p><p className="mt-1 text-xs text-[#77848B]">Choose an available hour, then adjust the minute if needed.</p></div>{slots.length ? <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-[minmax(0,1fr)_180px]"><div className="rounded-md border border-[#DCE2E4] bg-[#F8FAFA] p-3"><div className="grid grid-cols-2 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#68767E]"><span>Hour</span><span>Minute</span></div><div className="relative mt-2 grid grid-cols-2 gap-2"><div className="pointer-events-none absolute inset-x-0 top-11 z-10 h-11 rounded border-y border-[#B8C8CF] bg-[#EAF1F3]/45" /><div role="listbox" aria-label="Available hours" className="relative z-20 h-[132px] snap-y snap-mandatory overflow-y-auto px-1 py-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{availableHours.map((hour) => { const selected = activeHour === hour; return <button key={hour} type="button" role="option" aria-selected={selected} onClick={(event) => { setSelectedHour(hour); const firstSlot = slots.find((slot) => slotTime(slot.startsAt).startsWith(`${hour}:`)) ?? null; setSelectedSlot(firstSlot); event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" }); }} className={`flex h-11 w-full snap-center items-center justify-center rounded text-lg font-medium transition-colors ${selected ? "bg-[#244E63] text-white" : "text-[#718087] hover:bg-[#EDF3F5]"}`}>{hour}</button>; })}</div><div role="listbox" aria-label={`Available minutes for ${activeHour}`} className="relative z-20 h-[132px] snap-y snap-mandatory overflow-y-auto px-1 py-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{hourSlots.map((slot) => { const time = slotTime(slot.startsAt); const selected = selectedSlot?.startsAt === slot.startsAt; return <button key={slot.startsAt} type="button" role="option" aria-selected={selected} onClick={(event) => { setSelectedSlot(slot); event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" }); }} className={`flex h-11 w-full snap-center items-center justify-center rounded text-lg font-medium transition-colors ${selected ? "bg-[#244E63] text-white" : "text-[#718087] hover:bg-[#EDF3F5]"}`}>{time.slice(3, 5)}</button>; })}</div></div></div><div className="flex min-h-32 flex-col items-center justify-center rounded-md border border-[#DCE2E4] bg-white px-4 text-center"><p className="text-xs text-[#77848B]">Start time</p><p className="mt-2 text-3xl font-semibold tracking-tight text-[#244E63]">{selectedSlot ? slotTime(selectedSlot.startsAt) : `${activeHour}:--`}</p><p className="mt-2 text-xs text-[#77848B]">{selectedType ? `${selectedType.durationMinutes} minute visit` : "Select a visit type"}</p></div></div> : !loadingSlots && <p className="mt-3 text-sm text-[#77848B]">No available start times.</p>}</div>}
    </section>

    <section className="p-5 sm:p-6"><label className="grid gap-1.5 text-xs text-[#68767E]">Reason for visit <span className="text-[#929CA1]">Optional</span><textarea value={reasonForVisit} onChange={(event) => setReasonForVisit(event.target.value)} rows={2} maxLength={1000} className="w-full resize-none rounded-md border border-[#CCD5D9] px-3 py-2.5 text-sm outline-none focus:border-[#315A70]" /></label>{selectedPatient && selectedDoctor && selectedType && selectedSlot && <div className="mt-5 border-t border-[#E2E7E9] pt-4 text-sm"><p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p><p className="mt-1 text-[#66757D]">{selectedType.name} with Dr. {selectedDoctor.firstName} {selectedDoctor.lastName} · {date} at {slotTime(selectedSlot.startsAt)}</p></div>}{error && <p role="alert" className="mt-4 text-sm text-[#A33E3E]">{error}</p>}<div className="mt-5 flex justify-end"><button type="submit" disabled={!selectedPatient || !selectedSlot || !appointmentTypeId || submitting} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#244E63] px-4 text-sm font-medium text-white disabled:bg-[#AAB7BD]"><Check className="size-4" />{submitting ? "Booking..." : "Confirm appointment"}</button></div></section>
  </form>;
}
