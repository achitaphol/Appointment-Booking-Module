# Appointment Booking Backend

NestJS, Prisma, and PostgreSQL implementation of the staff appointment-booking API. See [API_CONTRACT.md](./API_CONTRACT.md) for the 19 endpoint contracts and [SCHEMA_REVIEW.md](./SCHEMA_REVIEW.md) for database rules.

The source follows MVC boundaries: `src/controllers/` handles HTTP requests and responses, `src/services/` contains application rules, and `prisma/schema.prisma` plus `src/models/` define and access the data model. JSON is the API's view representation. `src/security/` holds authentication guards and rate limiting; `src/common/` holds shared validation and error formatting. Controllers do not access Prisma directly.

## Run

The recommended entry point is `../init.sh` from the repository root. Subsequent updates use `../deploy.sh`. These commands preserve database volumes. The backend is available at `http://localhost:4000`; `GET /health` is public, and protected API routes are under `/api/v1`.

For host development, set `DATABASE_URL` to the local PostgreSQL database and set a stable, random `JWT_SECRET` of at least 32 characters before running `pnpm start:dev`. Do not commit secrets or use the same key across environments. `init.sh` generates the local key in the ignored root `.env` file.

## Demonstration seed

`pnpm exec prisma db seed` creates a complete local demonstration dataset without creating appointments. It includes four departments, eleven users and accounts, one doctor and one receptionist per department, additional staff roles, patients, department appointment-type durations, and five upcoming weekday schedules per doctor with lunch breaks. Running it again updates the same records instead of duplicating them.

The password is read from `SEED_USER_PASSWORD` and stored only as an Argon2id hash. Docker Compose defaults it to `HlabDemo1234!` for local development.

| Department | User type | Email | Roles |
| --- | --- | --- | --- |
| Cardiology | Doctor | `emma.carter@hlab.test` | clinician |
| Dermatology | Doctor | `daniel.kim@hlab.test` | clinician |
| Orthopedics | Doctor | `olivia.martin@hlab.test` | clinician |
| Pediatrics | Doctor | `noah.wilson@hlab.test` | clinician |
| Cardiology | Receptionist | `sophia.brown@hlab.test` | scheduler |
| Dermatology | Nurse | `mia.taylor@hlab.test` | scheduler, clinical_delegate |
| Dermatology | Receptionist | `chloe.lee@hlab.test` | scheduler |
| Orthopedics | Receptionist | `james.anderson@hlab.test` | scheduler, schedule_manager |
| Pediatrics | Nurse | `ava.thomas@hlab.test` | scheduler, clinical_delegate |
| Pediatrics | Receptionist | `grace.clark@hlab.test` | scheduler |
| Cardiology | Administrator | `liam.moore@hlab.test` | administrator, scheduler, schedule_manager |

The default is a public development credential and must not be used outside a local demonstration environment.

## Provisioning additional departments and accounts

The operator-only `pnpm provision` command creates additional records from the backend directory (or in the `backend-tools` Compose service). It accepts values through environment variables, not positional password arguments. The available subcommands are:

| Command | Required `PROVISION_` variables | Result |
| --- | --- | --- |
| `department` | `DEPARTMENT_CODE`, `DEPARTMENT_NAME` | Creates a department. |
| `staff` | `DEPARTMENT_CODE`, `USER_TYPE_CODE`, `EMPLOYEE_CODE`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `PASSWORD`, `ROLES` | Creates a workforce user and one login account. |
| `doctor` | `DEPARTMENT_CODE`, `EMPLOYEE_CODE`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `PASSWORD`, `ROLES` | Creates a doctor, primary assignment, and login account. `ROLES` must include `clinician`. |
| `duration` | `DEPARTMENT_CODE`, `APPOINTMENT_TYPE_CODE`, `DURATION_MINUTES` | Sets a positive duration for an appointment type in a department. |
| `assign-doctor` | `DEPARTMENT_CODE`, `EMPLOYEE_CODE` | Assigns an existing doctor to an additional department. |

For example, after setting the variables in your shell, run `docker compose run --rm -e PROVISION_DEPARTMENT_CODE -e PROVISION_DEPARTMENT_NAME backend-tools pnpm provision department` from the repository root. For a staff account, pass each staff variable with `-e` the same way. Read passwords interactively into a shell variable instead of typing them into command history; clear the variable when done. Only an operator with Docker/database access should run provisioning. There is no public registration route.

Create at least one `scheduler` account, one doctor with `clinician`, and a duration for each desired appointment type. A `schedule_manager` role may be added to the scheduler account or a separate staff account. The doctor can also manage their own schedules in assigned departments. No role permits booking outside the account department.

## Tests

```sh
pnpm lint
pnpm test
pnpm build
```

Integration tests require a **separate** PostgreSQL database named `hlab_api_test`. Apply committed migrations and seed there, then run `DATABASE_URL=<test-database-url> JWT_SECRET=<test-secret> pnpm test:e2e`. The test refuses to run against any other database name. Do not point it at the main `hlab` database.

## Assumptions and known limits

- Schedules are dated intervals in `Asia/Bangkok` local time. The backend currently treats this as UTC+07:00; changing the hospital time zone requires updating date/time conversion.
- A department defines the duration of each bookable appointment type. Slot starts are 15 minutes apart. Existing appointment end times are snapshots and are not changed when a duration rule changes.
- `booked` and `completed` intervals occupy time; `cancelled` intervals do not. A cancellation stores a reason, account ID, and timestamp. Completion is allowed after the appointment end time.
- New booking and schedule/break changes revalidate inside transactions. PostgreSQL exclusion constraints guard against overlapping doctor schedules, breaks, and non-cancelled appointments.
- Login uses Argon2 password hashes and a 15-minute JWT bearer token. Roles and account active flags are loaded from the database on every protected request. Login attempts are throttled per IP in this single backend process; a multi-replica deployment needs shared rate-limit storage. There is no refresh-token or token-revocation service.
- The current Prisma migration does not enforce every cross-table rule if another application writes directly to PostgreSQL. Use this API for normal writes and add database triggers if untrusted direct writers are introduced.
- Redis and BullMQ are installed but no background jobs are required by the assignment or implemented yet. Frontend booking pages are not implemented.
