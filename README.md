# HLAB Test

Author: Achitaphol Bamrungmo

A full-stack appointment booking project with a Next.js frontend, a NestJS REST API, PostgreSQL, and Redis.

The backend implements the staff appointment-booking API, authentication, schedule management, availability, booking, cancellation, and completion. The frontend provides role-aware doctor and staff workflows for dashboards, appointments, patients, doctors, and schedules.

## Technology Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and Zustand (client UI state)
- Backend: NestJS, TypeScript
- Database: PostgreSQL 17
- Queue infrastructure: Redis 7, prepared for future BullMQ integration
- Package manager: pnpm 10.28.2
- Local environment: Docker Compose

## Repository Structure

See [STRUCTURE.md](./STRUCTURE.md) for a detailed description of the repository layout and service relationships.

## Prerequisites

The recommended way to run the complete project is Docker Compose. This requires:

- Docker Desktop, or Docker Engine with Docker Compose
- Sufficient free disk space for the application, PostgreSQL, and Redis images

Node.js and pnpm are only required when running the frontend or backend directly on the host machine.

## Environment Configuration

The first-time setup script copies the example environment file if `.env` does not exist. You can also create it manually:

```sh
cp .env.example .env
```

The default values expose the following ports:

| Service | Port |
| --- | ---: |
| Frontend | 3000 |
| Backend | 4000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

The values in `.env` can be changed if any default port is already in use. `init.sh` also generates a local `JWT_SECRET` there; keep this file private.

## First-Time Setup

On a new machine, review `.env.example`, then run:

```sh
./init.sh
```

The script builds the images, starts PostgreSQL and Redis, applies committed Prisma migrations, seeds complete demonstration data, and starts the backend and frontend. The idempotent seed creates departments, users, Argon2id-hashed accounts, roles, doctors, doctor assignments, patients, appointment-type settings, and upcoming schedules. It deliberately creates no appointment records.

All seeded accounts use the development password configured by `SEED_USER_PASSWORD` (`HlabDemo1234!` by default). Example logins are:

| Department | User type | Email |
| --- | --- | --- |
| Cardiology | Doctor | `emma.carter@hlab.test` |
| Cardiology | Receptionist | `sophia.brown@hlab.test` |
| Dermatology | Doctor | `daniel.kim@hlab.test` |
| Dermatology | Receptionist | `chloe.lee@hlab.test` |
| Orthopedics | Doctor | `olivia.martin@hlab.test` |
| Orthopedics | Receptionist | `james.anderson@hlab.test` |
| Pediatrics | Doctor | `noah.wilson@hlab.test` |
| Pediatrics | Receptionist | `grace.clark@hlab.test` |

These credentials are for local demonstration only. Override `SEED_USER_PASSWORD` before running the seed if a different local password is required. See [backend/README.md](./backend/README.md) for the complete account list and operator-only provisioning commands.

## Deploy Updates

After updating the source files, run:

```sh
./deploy.sh
```

This rebuilds images, applies pending migrations, and recreates the application containers as needed. It does not run the seed or delete PostgreSQL/Redis volumes. Back up the database before deploying a migration that changes existing data. The script deploys to the local Docker host; it does not pull Git changes or deploy to a remote server.

## Docker Compose

After initialization, start all services:

```sh
docker compose up
```

Run the services in the background:

```sh
docker compose up --detach
```

Once all health checks pass, the services are available at:

- Frontend: http://localhost:3000
- Backend health: http://localhost:4000/health
- REST API: `http://localhost:4000/api/v1` (see [API contract](./backend/API_CONTRACT.md))
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

View service status:

```sh
docker compose ps
```

View service logs:

```sh
docker compose logs --follow
```

Stop the services while preserving database data:

```sh
docker compose down
```

Do not use `docker compose down --volumes` unless you intentionally want to delete local PostgreSQL and Redis data.

## Run Without Docker

Start the frontend development server:

```sh
cd frontend
pnpm install
pnpm dev
```

Start the backend development server in a separate terminal:

```sh
cd backend
pnpm install
PORT=4000 pnpm start:dev
```

Running PostgreSQL and Redis without Docker is not covered by this setup. Host-run backend development also requires `DATABASE_URL` and `JWT_SECRET`.

## Quality Checks

Frontend:

```sh
cd frontend
pnpm lint
pnpm build
```

Backend:

```sh
cd backend
pnpm lint
pnpm test
pnpm test:e2e # only with a dedicated hlab_api_test database; see backend/README.md
pnpm build
```

## Database Development

The Prisma schema is in `backend/prisma/schema.prisma`; the initial migration is in `backend/prisma/migrations/`. Keep it aligned with `backend/ERD.dbml`. From the backend directory, with `DATABASE_URL` configured, create a migration after schema changes with `pnpm exec prisma migrate dev --name <change_name>`. Regenerate the client with `pnpm exec prisma generate`. Existing migrations should not be edited after they have been deployed.

The initial SQL migration adds database-level checks and overlap exclusions. The API validates cross-table rules in transactions; direct database writers must not bypass that service logic.

## Assumptions

- The hospital operates in the `Asia/Bangkok` time zone. Schedule dates and times are entered as Bangkok-local values, while appointment timestamps are stored and returned as UTC.
- A staff account belongs to one login department. Booking, cancellation, patient access, and appointment access are limited to that department; there is no cross-department booking role.
- A doctor has one primary department and may also be assigned to additional departments. Doctors may manage only their own schedules in assigned departments.
- Appointment types are shared reference records, while each department controls whether a type is bookable and defines its duration.
- Available slot start times use 15-minute increments. An appointment may have a longer duration and must fit completely inside one bookable schedule without intersecting a break or occupied appointment.
- `booked` and `completed` appointments occupy their time intervals. Cancelling an appointment releases its interval for a new booking.
- Schedules are explicit dated intervals rather than recurring weekly templates. Schedule and break changes are prospective and must not invalidate existing appointments or rewrite elapsed schedule history.
- The REST API is the controlled write boundary for application data. Operator provisioning commands are used for installation records that are intentionally outside the public API.

## Known Limitations

- Authentication uses a 15-minute JWT stored by the frontend in an HTTP-only, same-site cookie. Logout clears that cookie, but there is no refresh-token or server-side token-revocation service.
- Login throttling is held in the backend process memory. A multi-replica deployment would require shared rate-limit storage.
- Redis and BullMQ dependencies are prepared for future reminders or notifications, but this submission does not create queues, producers, processors, or workers.
- Some cross-table invariants are enforced transactionally by the API rather than by PostgreSQL triggers. Untrusted applications must not write directly to the database.
- The included end-to-end suite requires a separately prepared `hlab_api_test` database and is not run by `init.sh`.
- The demonstration seed intentionally creates no appointments so the reviewer can exercise the complete booking workflow from an empty appointment history.
- The Docker Compose configuration targets local evaluation. Remote hosting, TLS termination, centralized logs, metrics, backups, and CI/CD are outside this submission.
- The UI is designed for desktop hospital workflows and has not undergone formal accessibility, localization, or usability testing.

## Current Scope

The backend container receives `DATABASE_URL`, `JWT_SECRET`, and `REDIS_URL`. The API uses PostgreSQL through Prisma. The frontend login flow loads departments from the backend and authenticates through a same-origin Next.js route that stores the access token in an HTTP-only cookie. Redis is reserved for future background jobs.

The repository does not include production hosting configuration or active BullMQ jobs. Those boundaries are documented above rather than presented as completed functionality.
