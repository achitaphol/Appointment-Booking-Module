import type { Appointment } from "@/features/appointments/types";

export type DashboardOverview = {
  date: string;
  timeZone: string;
  scope: "doctor" | "department";
  summary: {
    appointments: number;
    booked: number;
    completed: number;
    cancelled: number;
    doctorsScheduled: number;
  };
  nextAppointment: Appointment | null;
  workingHours: {
    startTime: string;
    endTime: string;
    isBookable: boolean;
    breaks: Array<{ startTime: string; endTime: string }>;
  } | null;
  appointments: Appointment[];
};
