export type ScheduleBreak = {
  id: string;
  startTime: string;
  endTime: string;
};

export type DoctorSchedule = {
  id: string;
  doctorId: string;
  departmentId: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  isBookable: boolean;
  breaks: ScheduleBreak[];
};
