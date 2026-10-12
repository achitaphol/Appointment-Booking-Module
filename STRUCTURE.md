# Repository Structure

## Overview

The project keeps the frontend, backend, and local infrastructure in one repository so the complete environment can be started with a single Docker Compose command. The infrastructure includes PostgreSQL for persistent application data and Redis for future BullMQ queues.

```text
HLAB-TEST/
├── frontend/                 Next.js application
│   ├── public/               Static assets
│   ├── src/
│   │   ├── app/              App Router routes, layouts, and global styles
│   │   ├── components/
│   │   │   ├── ui/           shadcn/ui primitives
│   │   │   └── shared/       Cross-feature application components
│   │   ├── features/         Feature-local UI and interaction logic
│   │   ├── hooks/            Cross-feature client hooks
│   │   ├── lib/              Shared utilities and authentication boundary
│   │   └── stores/           Client-only Zustand stores when needed
│   ├── components.json       shadcn/ui configuration
│   ├── .dockerignore         Frontend Docker build exclusions
│   ├── Dockerfile            Frontend production image
│   ├── next.config.ts        Next.js configuration
│   ├── package.json          Frontend scripts and dependencies
│   ├── pnpm-lock.yaml        Locked frontend dependencies
│   └── tsconfig.json         Frontend TypeScript configuration
├── backend/                  NestJS application
│   ├── src/                  Application source code (MVC layers)
│   │   ├── controllers/      HTTP routes and request/response handling
│   │   ├── services/         Appointment and scheduling business rules
│   │   ├── models/           Prisma database access adapter
│   │   ├── generated/prisma/ Generated Prisma model/client types
│   │   ├── security/         Authentication guard and login limiter
│   │   └── common/           Validation helpers and exception filter
│   ├── test/                 End-to-end tests
│   ├── .dockerignore         Backend Docker build exclusions
│   ├── Dockerfile            Backend production image
│   ├── prisma/               Prisma schema, migrations, demo-data seed, and provisioning CLI
│   ├── prisma.config.ts      Prisma 7 configuration
│   ├── nest-cli.json         NestJS CLI configuration
│   ├── package.json          Backend scripts and dependencies
│   ├── pnpm-lock.yaml        Locked backend dependencies
│   ├── tsconfig.json         Backend TypeScript configuration
│   └── vitest.config.ts      Unit test configuration
├── .env.example              Example local environment values
├── .gitignore                Repository-level ignored files
├── docker-compose.yml        Local multi-service environment
├── init.sh                   First-time local setup
├── deploy.sh                 Apply updates to local Docker deployment
├── README.md                 Setup and usage documentation
└── STRUCTURE.md              Repository structure documentation
```

Generated dependency, build, and cache directories are intentionally omitted from the diagram.

## Services

### Frontend

The `frontend` service is a Next.js application using the App Router, TypeScript, Tailwind CSS 4, and shadcn/ui. It provides role-aware dashboards, appointment booking and detail workflows, patient lookup and creation, doctor views, and schedule management. Zustand is reserved for small shared client UI state; authoritative server data remains in the backend. Its Docker image uses a multi-stage build and the Next.js standalone production output.

- Container port: `3000`
- Default host port: `3000`
- Internal backend URL: `http://backend:4000`
- Browser-facing backend URL: `http://localhost:4000`

### Backend

The `backend` service is a NestJS application using TypeScript. Its Docker image compiles the application in a build stage and includes production dependencies only in the runtime stage.

- Container port: `4000`
- Default host port: `4000`
- Database hostname inside Docker: `database`
- Redis hostname inside Docker: `redis`

The backend receives a PostgreSQL connection string through `DATABASE_URL`, a JWT signing key through `JWT_SECRET`, and a Redis connection string through `REDIS_URL`. The API uses Prisma for data access. BullMQ integration has not been implemented yet.

The backend follows NestJS's MVC separation: controllers are the HTTP boundary, services own application logic, and Prisma schema/client plus the database adapter form the model and persistence layer. API JSON responses are the view representation. Security and shared validation live outside those layers. Controllers do not query Prisma directly.

### Database

The `database` service runs PostgreSQL 17 Alpine.

- Container port: `5432`
- Default host port: `5432`
- Persistent volume: `postgres_data`

The database name, user, password, and exposed port can be overridden through the root `.env` file.

### Redis

The `redis` service runs Redis 7 Alpine with append-only persistence enabled. It is available for future BullMQ integration, but the backend does not currently create queues, producers, processors, or workers.

- Container port: `6379`
- Default host port: `6379`
- Persistent volume: `redis_data`
- Internal connection URL: `redis://redis:6379`

## Startup Order

Docker Compose starts the services according to their health checks:

```text
database healthy ─┐
                  ├── backend healthy
redis healthy ────┘       └── frontend healthy
```

This order confirms that each dependency is reachable before the next service starts.

## Docker Build Strategy

Both application images use multi-stage builds:

1. Install locked dependencies with pnpm.
2. Compile the application in a dedicated build stage.
3. Copy only the required runtime files into the final image.
4. Run the application as a non-root user.

The frontend and backend use pnpm `10.28.2` to keep local and container dependency installation consistent.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRONTEND_PORT` | `3000` | Frontend host port |
| `BACKEND_PORT` | `4000` | Backend host port |
| `POSTGRES_PORT` | `5432` | PostgreSQL host port |
| `REDIS_PORT` | `6379` | Redis host port |
| `POSTGRES_DB` | `hlab` | PostgreSQL database name |
| `POSTGRES_USER` | `hlab` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `hlab_password` | PostgreSQL password for local development |
| `JWT_SECRET` | Generated by `init.sh` | Backend JWT signing secret |
| `SEED_USER_PASSWORD` | `HlabDemo1234!` | Password for local demonstration accounts |

The checked-in values are development defaults only. Different credentials must be used outside a local development environment.

## Setup and Deployment

`init.sh` is the first-run entry point: it creates `.env` when absent, builds images, starts infrastructure, applies migrations, runs the idempotent reference-data seed, and starts the apps. `deploy.sh` rebuilds and applies pending migrations without reseeding or deleting volumes. Both scripts operate on the local Docker host.

The `backend-tools` Compose profile supplies the Prisma CLI and seed dependencies without adding those development tools to the running backend image.

## Development Boundaries

The backend implements the appointment API described in `backend/API_CONTRACT.md`, and the Next.js frontend consumes it through same-origin route handlers. Redis is present for future BullMQ jobs; no background-job workflow is claimed as part of this submission.
