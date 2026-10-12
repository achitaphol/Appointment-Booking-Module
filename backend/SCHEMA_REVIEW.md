# Appointment Schema Review

This document records the database rules that accompany [ERD.dbml](./ERD.dbml). The Prisma schema and migrations implement the relational structure and selected constraints, but the cross-table and authorization rules below still require application logic or further database enforcement.

## Decisions and Changes

| Area | Design decision |
| --- | --- |
| Account identity | `user_accounts.user_id` is unique: one user has at most one login account. |
| Email | `user_accounts.email` is globally unique and case insensitive through PostgreSQL `citext`. |
| Login department | `user_accounts.department_id` is the fixed department used to verify the department selected at login. It is not a work assignment or a department switch. |
| Doctor affiliation | `doctors.primary_department_id` is the primary affiliation. `doctor_departments` contains all work assignments, including the primary one. |
| Doctor account | If a doctor has a login account, its department must equal the doctor's primary department. Work assignments do not create additional accounts. |
| Appointment actors | The creating and cancelling staff accounts are referenced by account ID. Booking and cancellation are allowed only when the account department equals the appointment's service department at action time. |
| Authorization | `roles` and `user_account_roles` store action roles independently of workforce `user_types`. No role grants cross-department booking; the account's department is the booking boundary. A clinician may manage only their own schedule in an assigned department. |
| Appointment doctor | `appointments.doctor_id` is stored to support a database exclusion constraint across different schedules and departments. A composite foreign key ties it and `department_id` to the selected schedule. |
| Appointment duration | `ends_at` remains the recorded end time. Changing a department duration rule does not rewrite an existing appointment. |
| Status | Only `booked`, `cancelled`, and `completed` are used. New appointments start as `booked`; the other two are terminal. |

`patients` are separate from `users` and do not have login accounts. `user_types` classifies workforce members; it is not an authorization policy.

The appointment's `department_id` identifies the service department. The account's `department_id` identifies the department selected during login and is also the boundary for creating and cancelling appointments. These IDs must match when a booking or cancellation action occurs. The account foreign key records who acted but does not itself grant permission. The `scheduler` role is required in addition to the department match. Changing an account's department later does not rewrite historical actor information.

## Rules to Enforce in PostgreSQL

The DBML represents tables, uniqueness, and foreign keys. The following rules need a migration or transactional database logic before booking can be considered safe:

1. Enable `citext` for case insensitive account email and `btree_gist` for the doctor UUID equality operator in an exclusion constraint.
2. Add row checks for positive `duration_minutes`, `doctor_schedules.start_time < end_time`, `doctor_schedule_breaks.start_time < end_time`, and `appointments.starts_at < ends_at`.
3. Enforce that the doctor's primary department is present in `doctor_departments`. A deferred constraint trigger is suitable because inserting a doctor and its first assignment otherwise creates a circular dependency. Prevent deletion of the primary assignment, and validate primary department changes within the same transaction.
4. Enforce that a doctor's login account department equals `doctors.primary_department_id` on account creation or update and when the primary department changes. This is conditional because a doctor may have no login account. A constraint trigger must validate both sides; an ordinary foreign key cannot express the condition for doctors only.
5. Prevent overlapping schedules for the same doctor across departments. An exclusion constraint on the doctor and a date plus time range, or equivalent database-enforced serialization, is required. A unique start time does not prevent partial overlap.
6. Keep every break within its schedule and prevent breaks within the same schedule from overlapping. A break must also avoid existing non-cancelled appointments. Schedule and break edits must revalidate any affected non-cancelled appointments, including historical ones. Reject edits to elapsed schedule portions or breaks. Creating a schedule or break requires a future interval.
7. Add a partial GiST exclusion constraint on `appointments.doctor_id` and the half-open timestamp range `[starts_at, ends_at)` for `booked` and `completed` rows. This permits adjacent appointments, blocks overlaps across schedules, and releases time when an appointment becomes `cancelled`.
8. On creation or rescheduling, verify that the appointment starts in the future, fits completely within its schedule in the hospital time zone, avoids breaks, and matches the department's currently bookable appointment type and configured duration. Also verify that the schedule is bookable. Historical edits must not rerun the future-time check unless the booking time changes.
9. Enforce status metadata: booked has no cancellation or completion fields; cancelled has nonempty cancellation reason, cancellation actor, and cancellation time but no completion time; completed has completion time and no cancellation fields. Permit only booked to cancelled or booked to completed transitions.
10. Use a configured hospital time zone, assumed to be `Asia/Bangkok` until confirmed. Convert schedule dates and local times to `timestamptz` explicitly; never rely on the database session time zone.

If the department appointment duration changes, existing `ends_at` values stay intact. Disabling an appointment type or schedule stops new bookings but does not alter existing appointment status or time. Edits that change an existing booked or completed appointment's interval validity must be rejected or handled in an explicit rescheduling workflow.

## Concurrency Plan

Booking and schedule or break changes must use transactions. Lock the relevant doctor row before reading or changing its schedules, breaks, and appointments so work in different departments for the same doctor is serialized. Lock the department appointment type row while validating the active duration and bookability; updates to that rule must coordinate through the same row lock. Use a consistent lock order in every write path to avoid deadlocks.

The appointment exclusion constraint is the final database guard against concurrent overlapping writes, including requests that select different schedule rows. The service should translate an exclusion violation into a booking conflict response. Any trigger checking schedule coverage or breaks must run within the same transaction as the write. An application availability query is useful for display but is not a concurrency guarantee.

The login check looks up the account by case insensitive email, verifies the password hash, confirms both account and user are active, and checks the selected department against the account department. For doctors, it also checks the primary department. Authentication failures should return the same general message without identifying the incorrect input.

After login, booking authorization must check both the `scheduler` role and that the service department equals the account department. There is no central or cross-department booking role. An administrator without a scheduler role cannot create or cancel appointments; an administrator with that role remains limited to their account department. A clinician with the `clinician` role may manage a schedule only when `users.id = doctor_schedules.doctor_id` and that doctor is assigned to the schedule department; this grants no cross-department booking or patient-data access. The doctor named by `doctor_id` is the clinician providing the appointment, not implicitly the staff member who created it.

## Review Cases

| Case | Expected result |
| --- | --- |
| Same user receives a second account | Rejected by unique `user_id`. |
| Email is reused with different letter case or in another department | Rejected by unique `citext` email. |
| Correct email and password with the wrong department | Login rejected without revealing which input failed. |
| Booking staff account department differs from the appointment service department | Rejected, regardless of other roles. |
| Authenticated account has no booking permission | Booking rejected regardless of login department. |
| Doctor account department differs from primary department | Insert or update rejected. |
| Primary doctor assignment is removed | Rejected while it remains the primary department. |
| Two schedules for the same doctor overlap in different departments | Rejected. |
| Break is outside its schedule or overlaps another break | Rejected. |
| Booking falls during a break, outside a schedule, or into a non-bookable schedule | Rejected. |
| Appointment type is disabled or duration differs from the requested interval | New booking rejected. |
| Two appointments overlap for the same doctor but use different schedules | Rejected, including concurrent requests. |
| One appointment ends when the next starts | Allowed because ranges are half-open. |
| Appointment is cancelled | Cancellation metadata required; its time becomes available. |
| Appointment is completed | Completion metadata required; its time remains occupied. |
| Cancelled or completed appointment is moved back to booked | Rejected. |
| Schedule or break edit invalidates an existing non-cancelled appointment | Edit rejected pending explicit rescheduling. |
| Clinician changes another doctor's schedule or an unassigned department schedule | Rejected, even if the clinician has the schedule ID. |
| Clinician changes their own assigned-department schedule without affecting elapsed time or existing appointments | Allowed; this does not grant cross-department booking access. |
| Schedule or break edit rewrites an elapsed interval | Rejected; historical schedule information and past appointments remain intact. |
| Duration rule changes after an appointment exists | Existing `ends_at` remains unchanged. |
| Historical appointment metadata is corrected without changing its interval | Not rejected merely because its start is now in the past. |

The migrations implement the tables, foreign keys, selected row checks, and overlap exclusions. They do not yet enforce every cross-table rule listed here; authorization is not implemented in the application.
