# Appointment Booking API Contract

This document describes the implemented REST API for the take-home appointment-booking workflow plus staff login. Base path: `/api/v1`, except `/health`. Request and response fields use `camelCase`; database columns use `snake_case`.

## Scope

The API lets authenticated hospital staff find a patient and doctor, inspect a doctor's schedule, find available slots, book an appointment, list/view appointments, cancel an appointment, and mark one completed. A schedule manager can manage schedules in their account department; a clinician can manage only their own schedules in departments where they are assigned. It does not expose general-purpose CRUD for departments, workforce users, roles, accounts, doctors, or appointment-type catalogs.

The development seed creates departments, doctors and assignments, department-specific appointment durations, active staff accounts, patients, and upcoming schedules. It deliberately creates no appointments. Use the operator-only `pnpm provision` commands described in [README.md](./README.md) for additional installation-specific records. This is intentionally not a public registration API.

## Authorization

`user_types` describes a staff member's job and does not grant access. The relevant action roles are stored through `user_account_roles`:

| Role | Allowed MVP actions |
| --- | --- |
| `scheduler` | Read patients, doctors, appointment types, schedules, and appointments; create patients; find slots; book and cancel appointments. |
| `schedule_manager` | Read doctors and schedules; create/update schedules and add/remove breaks. |
| `clinician` | Read and manage own schedules and breaks in assigned departments; read/complete own appointments only in the account department under the current appointment policy. |
| `clinical_delegate` | Read and complete booked appointments in the account department, if this role is intentionally assigned. |

`administrator` is reserved for setup/maintenance and has no appointment-booking bypass. An account may hold multiple roles. **Appointment creation, cancellation, completion, availability, and appointment reads remain limited to `user_accounts.department_id`.** A `schedule_manager` also works only in that department. The exception is a `clinician` managing **their own** schedules in any department listed in `doctor_departments`; this does not grant booking access or patient/appointment detail access in another department. The clinician's `users.id` must equal the schedule's `doctor_id`. Staff in the service department handle booking there.

The server derives the actor from the authenticated account. A request cannot supply audit actor IDs or override booking department scope. Filter collections by the appropriate scope; do not rely on UUID secrecy. Patients do not log in.

## Endpoint inventory: 20 method/path pairs

| Method | Path | Access | Request | Success |
| --- | --- | --- | --- | --- |
| GET | `/health` | Public | None | `200` health summary |
| GET | `/auth/departments` | Public | Optional `q` | `200` department code/name options for login |
| POST | `/auth/login` | Public | `departmentCode`, `email`, `password` | `200` access token and safe account summary |
| GET | `/auth/me` | Authenticated | None | `200` safe account summary, user type, and role codes |
| GET | `/dashboard/overview` | Authenticated operational roles | None | `200` current Bangkok-day summary scoped to the authenticated doctor or department |
| GET | `/patients` | `scheduler` | Optional `q` or exact `medicalRecordNumber`; pagination | `200` patient summaries |
| POST | `/patients` | `scheduler` | `medicalRecordNumber`, `firstName`, `lastName`, optional `dateOfBirth` | `201` patient |
| GET | `/doctors` | `scheduler`, `schedule_manager`, or `clinician` | Optional `q`; `departmentId` must equal account department if supplied | `200` doctors assigned to account department |
| GET | `/appointment-types` | `scheduler` | None | `200` configured types and durations for account department |
| GET | `/doctor-schedules` | `scheduler`/`schedule_manager` in account department, or `clinician` for own assigned schedules | `doctorId`, `from`, `to`, optional `departmentId` | `200` dated schedules with breaks; clinician sees own only |
| POST | `/doctor-schedules` | `schedule_manager` in account department, or `clinician` for self in assigned department | `doctorId`, `departmentId`, `scheduleDate`, `startTime`, `endTime`, `isBookable` | `201` future schedule |
| PATCH | `/doctor-schedules/{scheduleId}` | `schedule_manager` in account department, or `clinician` for own assigned schedule | `startTime`, `endTime`, and/or `isBookable` | `200` schedule; `409` if history or appointments would be invalidated |
| POST | `/doctor-schedules/{scheduleId}/breaks` | `schedule_manager` in account department, or `clinician` for own assigned schedule | `startTime`, `endTime` | `201` future break; `409` on overlap or appointment conflict |
| DELETE | `/doctor-schedules/{scheduleId}/breaks/{breakId}` | `schedule_manager` in account department, or `clinician` for own assigned schedule | None | `204`; future breaks only |
| GET | `/availability` | `scheduler` | `doctorId`, `date`, `appointmentTypeId` | `200` available slots in account department |
| GET | `/appointments` | `scheduler`, `schedule_manager`, `clinician`, or `clinical_delegate` | Optional `doctorId`, `patientId`, `from`, `to`, `status`; pagination | `200` appointments in account department; clinician sees own only |
| GET | `/appointments/{appointmentId}` | Same as appointment list | None | `200` appointment in account department; clinician sees own only |
| POST | `/appointments` | `scheduler` | `patientId`, `doctorScheduleId`, `appointmentTypeId`, `startsAt`, optional `reasonForVisit` | `201` booked appointment |
| POST | `/appointments/{appointmentId}/cancel` | `scheduler` | Required `reason` | `200` cancelled appointment with actor/time |
| POST | `/appointments/{appointmentId}/complete` | `clinician` for own appointment or `clinical_delegate` | Empty body | `200` completed appointment with time |

No separate `GET /departments`, doctor detail, patient detail, schedule detail, role-management, or generic CRUD routes are needed for this MVP. The account department is implicit for booking and availability; a clinician explicitly names the assigned department when creating their own schedule.

## Request and response rules

- UUIDs identify resources. Dates use `YYYY-MM-DD`; schedule/break times use `HH:mm` in the configured hospital time zone (`Asia/Bangkok` until confirmed). Appointment timestamps use ISO 8601 with an offset and are returned in UTC (`Z`). Schedules are dated, not recurring.
- A single resource is wrapped as `{ "data": { ... } }`. A collection is `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 0 } }`. Default `pageSize` is 20, maximum 100. Deletes return `204` with no body.
- Read responses use these shapes: patient `{ id, medicalRecordNumber, firstName, lastName, dateOfBirth }`; doctor `{ id, employeeCode, firstName, lastName, primaryDepartmentId }`; appointment type `{ id, code, name, durationMinutes }`; schedule `{ id, doctorId, departmentId, scheduleDate, startTime, endTime, isBookable, breaks: [{ id, startTime, endTime }] }`. Appointment reads also include safe nested `patient`, `doctor`, and `appointmentType` summaries so clients can render usable lists without additional privileged lookups. A break creation returns its `{ id, startTime, endTime }` resource.
- `POST /doctor-schedules` accepts `departmentId` only to identify the doctor's assigned work department; it must match the account department for a `schedule_manager`, or be one of the clinician's own `doctor_departments` assignments. `GET /availability` derives its department from the scheduler account. Appointment creation derives `doctorId`, `departmentId`, `endsAt`, `status`, `createdByUserAccountId`, and `createdAt` on the server.
- Schedule changes are prospective. A new schedule must start in the future. A `PATCH` to `startTime` or `endTime` may change only the still-future portion of an existing dated interval; the elapsed part of the original working interval must remain unchanged. It must not move, truncate, cancel, or otherwise invalidate any existing appointment, including past/completed appointments. Changing `isBookable` affects **new** bookings only; it does not change existing appointment records or statuses. A break can be added or removed only while that break interval is wholly in the future; adding one cannot intersect an existing non-cancelled appointment. Run these checks transactionally with booking so concurrent actions cannot bypass them. Return `409 SCHEDULE_CONFLICT` or `409 BREAK_CONFLICT` when a change is unsafe.
- A non-bookable schedule, a break, another booked/completed appointment, an out-of-hours interval, a past start, or an incompatible department appointment type excludes a slot. Cancelled appointments free their intervals; completed appointments still occupy them. A slot list is advisory: creation must recheck transactionally. Completion is allowed only after the appointment's end time.
- New appointments start `booked`. Only `booked` can transition to `cancelled` or `completed`; both are terminal. Cancellation requires a nonempty reason and server-recorded actor/time.
- Error format: `{ "error": { "code": "SLOT_UNAVAILABLE", "message": "The selected slot is no longer available.", "details": [] } }`. Use `400` for invalid input, `401` for authentication failure, `403` for insufficient role or department, `404` for an unavailable resource, `409` for slot/state/uniqueness conflict, and `500` for unexpected failures. Do not expose hashes, tokens, or SQL details in errors.

## Core payload examples

### Login

`POST /api/v1/auth/login`

```json
{ "departmentCode": "OPD", "email": "staff@example.test", "password": "<password>" }
```

`200`:

```json
{
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresInSeconds": 900,
    "account": {
      "id": "<uuid>",
      "userId": "<uuid>",
      "userType": { "code": "receptionist", "name": "Receptionist" },
      "department": { "id": "<uuid>", "code": "OPD", "name": "Outpatient Department" },
      "roles": ["scheduler"]
    }
  }
}
```

Login failures return the same generic `401` response whether the email, password, department, or account status is wrong. JWT bearer delivery is implemented. The frontend stores the short-lived token in an HttpOnly same-site cookie through its own login route. No refresh or logout flow is included in this MVP yet.

`GET /api/v1/auth/me` returns the same safe account fields (`id`, `userId`, `userType`, `department`, and `roles`) under `data`, without a token.

### Availability and booking

`GET /api/v1/availability?doctorId=<uuid>&date=2026-11-02&appointmentTypeId=<uuid>`

```json
{
  "data": {
    "doctorId": "<uuid>",
    "departmentId": "<account-department-uuid>",
    "date": "2026-11-02",
    "timeZone": "Asia/Bangkok",
    "appointmentTypeId": "<uuid>",
    "durationMinutes": 30,
    "slots": [
      { "doctorScheduleId": "<uuid>", "startsAt": "2026-11-02T02:00:00Z", "endsAt": "2026-11-02T02:30:00Z" }
    ]
  }
}
```

`POST /api/v1/appointments`:

```json
{ "patientId": "<uuid>", "doctorScheduleId": "<uuid>", "appointmentTypeId": "<uuid>", "startsAt": "2026-11-02T02:00:00Z", "reasonForVisit": "Follow-up" }
```

`201`:

```json
{
  "data": {
    "id": "<uuid>",
    "patientId": "<uuid>",
    "doctorId": "<uuid>",
    "departmentId": "<account-department-uuid>",
    "doctorScheduleId": "<uuid>",
    "appointmentTypeId": "<uuid>",
    "startsAt": "2026-11-02T02:00:00Z",
    "endsAt": "2026-11-02T02:30:00Z",
    "status": "booked",
    "reasonForVisit": "Follow-up",
    "createdByUserAccountId": "<uuid>",
    "createdAt": "2026-10-11T14:00:00Z",
    "cancellationReason": null,
    "cancelledByUserAccountId": null,
    "cancelledAt": null,
    "completedAt": null
  }
}
```

`POST /api/v1/appointments/{appointmentId}/cancel` takes `{ "reason": "Patient requested cancellation" }` and returns the same resource with `status: "cancelled"`, `cancellationReason`, `cancelledByUserAccountId`, and `cancelledAt` set. `POST /api/v1/appointments/{appointmentId}/complete` takes no body and returns `status: "completed"` with `completedAt` set. Invalid transitions return `409 APPOINTMENT_STATE_CONFLICT`.

## Remaining product decisions

1. Decide which real staff accounts and departments to provision on each installation. The operator-only setup command avoids committed credentials and general-purpose admin HTTP endpoints.
2. Confirm who may receive `clinical_delegate` and whether completion should be limited to the clinician only.
3. Slot starts are currently 15 minutes apart; adjust only if the hospital requires another granularity. Duration comes from the department/type rule.
4. Decide whether refresh and token revocation are needed beyond the current short-lived HTTP-only cookie flow.

The initial database migration does not yet enforce every cross-table booking rule in `SCHEMA_REVIEW.md`. Those checks must be completed before booking is considered safe.
