export type PatientOption = {
  id: string;
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
};

export type DoctorOption = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

export type AppointmentTypeOption = {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
};

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentTypeId: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "cancelled" | "completed";
  reasonForVisit: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  patient: Pick<PatientOption, "medicalRecordNumber" | "firstName" | "lastName">;
  doctor: Pick<DoctorOption, "employeeCode" | "firstName" | "lastName">;
  appointmentType: Pick<AppointmentTypeOption, "name">;
};
