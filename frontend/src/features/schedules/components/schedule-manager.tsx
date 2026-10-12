"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Coffee, Plus, Trash2 } from "lucide-react";
import { WorkspaceShell } from "@/components/shared/workspace-shell";
import type { Appointment, DoctorOption } from "@/features/appointments/types";
import type { DoctorSchedule } from "@/features/schedules/types";
import type { Account } from "@/lib/auth";

function dateText(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const currentDate = new Date();
const initialToday = dateText(currentDate);
const initialRangeEnd = dateText(new Date(currentDate.getTime() + 60 * 86_400_000));

function getError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  return "The request could not be completed.";
}

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function position(time: string, start: number, end: number) {
  return Math.max(0, Math.min(100, ((minutes(time) - start) / (end - start)) * 100));
}

function timeLabel(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function displayDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date),
    date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date),
  };
}

function appointmentDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function appointmentTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export function ScheduleManager({
  account,
  doctors,
  initialDoctorId,
  allowDoctorSelection,
  title,
  subtitle,
  activePath,
}: {
  account: Account;
  doctors: DoctorOption[];
  initialDoctorId: string;
  allowDoctorSelection: boolean;
  title: string;
  subtitle: string;
  activePath: string;
}) {
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [breakFor, setBreakFor] = useState<string | null>(null);
  const today = initialToday;
  const rangeEnd = initialRangeEnd;
  const scheduleDefaults = useMemo(() => {
    const existingSchedule = schedules[0];
    const existing = schedules.find((schedule) => schedule.breaks.length)?.breaks[0];
    return {
      startTime: existingSchedule?.startTime ?? "",
      endTime: existingSchedule?.endTime ?? "",
      breakStartTime: existing?.startTime ?? "",
      breakEndTime: existing?.endTime ?? "",
    };
  }, [schedules]);
  const timeline = useMemo(() => {
    const start = schedules.length ? Math.floor(Math.min(...schedules.map((schedule) => minutes(schedule.startTime))) / 60) * 60 : 0;
    const end = schedules.length ? Math.ceil(Math.max(...schedules.map((schedule) => minutes(schedule.endTime))) / 60) * 60 : 24 * 60;
    const safeEnd = end > start ? end : start + 60;
    const labelStep = safeEnd - start > 8 * 60 ? 4 * 60 : 2 * 60;
    const labels = Array.from({ length: Math.floor((safeEnd - start) / labelStep) + 1 }, (_, index) => start + index * labelStep);
    if (labels.at(-1) !== safeEnd) labels.push(safeEnd);
    return { start, end: safeEnd, labels };
  }, [schedules]);

  const loadSchedules = useCallback(async () => {
    await Promise.resolve();
    if (!doctorId) { setSchedules([]); setLoading(false); return; }
    setLoading(true);
    setMessage("");
    const scheduleQuery = new URLSearchParams({ doctorId, departmentId: account.department.id, from: today, to: rangeEnd });
    const appointmentQuery = new URLSearchParams({ doctorId, from: today, to: rangeEnd, pageSize: "100" });
    const [scheduleResponse, appointmentResponse] = await Promise.all([
      fetch(`/api/doctor-schedules?${scheduleQuery}`),
      fetch(`/api/appointments?${appointmentQuery}`),
    ]);
    const [schedulePayload, appointmentPayload] = await Promise.all([scheduleResponse.json(), appointmentResponse.json()]);
    if (scheduleResponse.ok) setSchedules(Array.isArray(schedulePayload.data) ? schedulePayload.data : []);
    else setMessage(getError(schedulePayload));
    if (appointmentResponse.ok) setAppointments(Array.isArray(appointmentPayload.data) ? appointmentPayload.data : []);
    else setMessage(getError(appointmentPayload));
    setLoading(false);
  }, [account.department.id, doctorId, rangeEnd, today]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSchedules(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSchedules]);

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startTime = String(form.get("startTime"));
    const endTime = String(form.get("endTime"));
    const breakStartTime = String(form.get("breakStartTime"));
    const breakEndTime = String(form.get("breakEndTime"));
    if (minutes(breakStartTime) < minutes(startTime) || minutes(breakEndTime) > minutes(endTime) || minutes(breakStartTime) >= minutes(breakEndTime)) {
      return setMessage("Break time must be inside the working hours.");
    }
    const response = await fetch("/api/doctor-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId,
        departmentId: account.department.id,
        scheduleDate: form.get("scheduleDate"),
        startTime,
        endTime,
        isBookable: true,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(getError(payload));
    const scheduleId = payload?.data?.id;
    let followUpMessage = "";
    if (scheduleId && breakStartTime && breakEndTime) {
      const breakResponse = await fetch(`/api/doctor-schedules/${scheduleId}/breaks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: breakStartTime, endTime: breakEndTime }),
      });
      if (!breakResponse.ok) followUpMessage = `Schedule saved. ${getError(await breakResponse.json())}`;
    }
    event.currentTarget.reset();
    setShowCreate(false);
    await loadSchedules();
    if (followUpMessage) setMessage(followUpMessage);
  }

  async function toggleBookable(schedule: DoctorSchedule) {
    const response = await fetch(`/api/doctor-schedules/${schedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBookable: !schedule.isBookable }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(getError(payload));
    await loadSchedules();
  }

  async function addBreak(event: FormEvent<HTMLFormElement>, scheduleId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/doctor-schedules/${scheduleId}/breaks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: form.get("startTime"), endTime: form.get("endTime") }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(getError(payload));
    setBreakFor(null);
    await loadSchedules();
  }

  async function removeBreak(scheduleId: string, breakId: string) {
    const response = await fetch(`/api/doctor-schedules/${scheduleId}/breaks/${breakId}`, { method: "DELETE" });
    if (!response.ok) setMessage(getError(await response.json()));
    else await loadSchedules();
  }

  return (
    <WorkspaceShell account={account} activePath={activePath}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div><h1 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h1><p className="mt-1 text-sm text-[#6B7980]">{subtitle}</p></div>
          <button disabled={!doctorId} onClick={() => setShowCreate((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#244E63] px-3.5 text-sm font-medium text-white disabled:opacity-50">
            <Plus className="size-4" aria-hidden="true" /> Add schedule
          </button>
        </div>

        {allowDoctorSelection && (
          <label className="mt-7 grid max-w-sm gap-1.5 text-xs text-[#68767E]">Doctor
            <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="h-10 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]">
              <option value="">Select doctor</option>
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>Dr. {doctor.firstName} {doctor.lastName}</option>)}
            </select>
          </label>
        )}

        {showCreate && (
          <form onSubmit={createSchedule} className="mt-6 overflow-hidden border border-[#DCE2E4] bg-white">
            <div className="border-b border-[#E2E7E9] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#26363E]">New working day</h2>
              <p className="mt-1 text-xs text-[#77848B]">Set the doctor&apos;s working period and regular break.</p>
            </div>
            <div className="grid gap-6 px-5 py-5 md:grid-cols-[minmax(170px,0.75fr)_minmax(260px,1fr)_minmax(260px,1fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#68767E]">Schedule date</p>
                <label className="mt-3 grid gap-1.5 text-xs text-[#68767E]">Date<input required name="scheduleDate" type="date" min={today} className="h-10 w-full rounded-md border border-[#CDD5D9] bg-white px-3 text-sm text-[#293840] outline-none focus:border-[#315A70]" /></label>
              </div>
              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-[#68767E]">Working hours</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-xs text-[#68767E]">Starts<input required name="startTime" type="time" defaultValue={scheduleDefaults.startTime} className="h-10 min-w-0 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm outline-none focus:border-[#315A70]" /></label>
                  <label className="grid gap-1.5 text-xs text-[#68767E]">Ends<input required name="endTime" type="time" defaultValue={scheduleDefaults.endTime} className="h-10 min-w-0 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm outline-none focus:border-[#315A70]" /></label>
                </div>
              </fieldset>
              <fieldset>
                <legend className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#68767E]"><Coffee className="size-3.5" />Break time</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-xs text-[#68767E]">Starts<input required name="breakStartTime" type="time" defaultValue={scheduleDefaults.breakStartTime} className="h-10 min-w-0 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm outline-none focus:border-[#315A70]" /></label>
                  <label className="grid gap-1.5 text-xs text-[#68767E]">Ends<input required name="breakEndTime" type="time" defaultValue={scheduleDefaults.breakEndTime} className="h-10 min-w-0 rounded-md border border-[#CDD5D9] bg-white px-3 text-sm outline-none focus:border-[#315A70]" /></label>
                </div>
              </fieldset>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E2E7E9] bg-[#FAFBFB] px-5 py-3.5">
              <p className="text-xs text-[#77848B]">Break time is copied from the doctor&apos;s existing schedule when available.</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 rounded-md border border-[#CDD5D9] bg-white px-4 text-sm text-[#40515A]">Cancel</button>
                <button className="h-9 rounded-md bg-[#244E63] px-4 text-sm font-medium text-white">Save schedule</button>
              </div>
            </div>
          </form>
        )}
        {message && <p className="mt-4 text-sm text-[#8A4E4E]">{message}</p>}

        <section className="mt-7 overflow-hidden border border-[#DCE2E4] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E6E8] px-5 py-4">
            <div><p className="text-sm font-semibold">Upcoming schedules</p><p className="mt-0.5 text-xs text-[#77848B]">Times shown in Bangkok time</p></div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#77848B]"><span className="flex items-center gap-1.5"><span className="size-2.5 bg-[#DCEBEF]" /> Available</span><span className="flex items-center gap-1.5"><span className="size-2.5 bg-[#315A70]" /> Booked</span><span className="flex items-center gap-1.5"><span className="size-2.5 bg-[#D8C59B]" /> Break</span><span className="flex items-center gap-1.5"><span className="size-2.5 bg-[#D5DADD]" /> Closed</span></div>
          </div>
          {loading ? <p className="px-5 py-12 text-center text-sm text-[#77848B]">Loading schedules...</p> : schedules.length ? (
            <div className="divide-y divide-[#E6EAEC]">
              {schedules.map((schedule) => {
                const dayAppointments = appointments.filter((appointment) => appointment.doctorId === schedule.doctorId && appointmentDate(appointment.startsAt) === schedule.scheduleDate && appointment.status !== "cancelled");
                return (
                <div key={schedule.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <div className="w-20 shrink-0"><p className="text-sm font-medium">{displayDate(schedule.scheduleDate).weekday}</p><p className="mt-0.5 text-xs text-[#77848B]">{displayDate(schedule.scheduleDate).date}</p></div>
                    <div className="min-w-64 flex-1">
                      <div className="mb-1.5 flex justify-between text-[10px] text-[#8A969C]">{timeline.labels.map((value) => <span key={value}>{timeLabel(value)}</span>)}</div>
                      <div className="relative h-8 border-x border-[#DCE2E4] bg-[#F3F5F5]">
                        <span className={`absolute top-1.5 h-5 ${schedule.isBookable ? "bg-[#DCEBEF]" : "bg-[#D5DADD]"}`} style={{ left: `${position(schedule.startTime, timeline.start, timeline.end)}%`, width: `${position(schedule.endTime, timeline.start, timeline.end) - position(schedule.startTime, timeline.start, timeline.end)}%` }} />
                        {Array.from({ length: Math.max(0, Math.floor((timeline.end - timeline.start) / 30) - 1) }, (_, index) => index + 1).map((slot) => <span key={slot} className={`absolute inset-y-0 border-l ${slot % 4 === 0 ? "border-[#D2D9DC]" : "border-white/70"}`} style={{ left: `${(slot * 30 / (timeline.end - timeline.start)) * 100}%` }} />)}
                        {schedule.breaks.map((item) => <span key={item.id} title={`Break ${item.startTime}–${item.endTime}`} className="absolute top-1.5 h-5 bg-[#D8C59B]" style={{ left: `${position(item.startTime, timeline.start, timeline.end)}%`, width: `${position(item.endTime, timeline.start, timeline.end) - position(item.startTime, timeline.start, timeline.end)}%` }} />)}
                        {dayAppointments.map((appointment) => {
                          const startTime = appointmentTime(appointment.startsAt);
                          const endTime = appointmentTime(appointment.endsAt);
                          return <span key={appointment.id} title={`${startTime}–${endTime} ${appointment.patient.firstName} ${appointment.patient.lastName}`} className={`absolute top-1.5 h-5 border-x border-white/70 ${appointment.status === "completed" ? "bg-[#68777E]" : "bg-[#315A70]"}`} style={{ left: `${position(startTime, timeline.start, timeline.end)}%`, width: `${position(endTime, timeline.start, timeline.end) - position(startTime, timeline.start, timeline.end)}%` }} />;
                        })}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#66757D]"><span>{schedule.startTime}–{schedule.endTime}</span>{schedule.breaks.map((item) => <span key={item.id} className="inline-flex items-center gap-1"><Coffee className="size-3" />{item.startTime}–{item.endTime}</span>)}<span>{dayAppointments.length} {dayAppointments.length === 1 ? "appointment" : "appointments"}</span></div>
                    </div>
                    <button onClick={() => void toggleBookable(schedule)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${schedule.isBookable ? "bg-[#EAF2EC] text-[#41664B]" : "bg-[#F2EEEE] text-[#775A5A]"}`}>{schedule.isBookable ? "Bookable" : "Closed"}</button>
                    <button onClick={() => setBreakFor(breakFor === schedule.id ? null : schedule.id)} className="text-sm text-[#315A70] hover:underline">Add break</button>
                  </div>
                  {breakFor === schedule.id && (
                    <form onSubmit={(event) => void addBreak(event, schedule.id)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#E6EAEC] pt-4">
                      <label className="grid gap-1 text-xs text-[#68767E]">Start<input required name="startTime" type="time" defaultValue={scheduleDefaults.breakStartTime} className="h-8 rounded-md border border-[#CDD5D9] px-2 text-sm" /></label>
                      <label className="grid gap-1 text-xs text-[#68767E]">End<input required name="endTime" type="time" defaultValue={scheduleDefaults.breakEndTime} className="h-8 rounded-md border border-[#CDD5D9] px-2 text-sm" /></label>
                      <button className="h-8 rounded-md border border-[#C9D2D6] px-3 text-sm font-medium">Save break</button>
                      {schedule.breaks.map((item) => <button key={item.id} type="button" onClick={() => void removeBreak(schedule.id, item.id)} className="inline-flex h-8 items-center gap-1.5 px-2 text-xs text-[#775A5A]"><Trash2 className="size-3.5" /> {item.startTime}–{item.endTime}</button>)}
                    </form>
                  )}
                </div>
              );})}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center text-center"><CalendarRange className="size-6 text-[#8A979D]" strokeWidth={1.5} /><p className="mt-3 text-sm font-medium">No upcoming schedules</p><p className="mt-1 text-sm text-[#77848B]">Add a working day to get started.</p></div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
