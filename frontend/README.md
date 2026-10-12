# Appointment Booking Frontend

Next.js App Router, TypeScript, Tailwind CSS 4, shadcn/ui, and Zustand. The application provides role-aware doctor and staff workflows connected to the NestJS API.

The `/login` page loads department options from the backend's public departments endpoint. It submits the selected department, email, and password through a same-origin Next.js route to the backend login endpoint. A successful response stores the short-lived access token in an HTTP-only cookie and navigates to `/`. Protected pages redirect unauthenticated users to `/login`; signing out clears the cookie. When the backend is unavailable or has no departments, the department select and submit button are disabled.

Implemented pages include the role-aware overview, appointment list, appointment creation and detail, patient list and creation, doctor list, personal doctor schedule, and department schedule views. Page data comes from the API rather than embedded mock records.

## Development

From the repository root, use `./init.sh` for first-time setup or `./deploy.sh` for later updates. To run the frontend directly:

```sh
pnpm install
pnpm dev
```

Run these checks before deploying:

```sh
pnpm lint
pnpm build
```

## Source Structure

| Path | Responsibility |
| --- | --- |
| `src/app/` | Routes, layouts, metadata, and global styles. Pages and layouts remain Server Components by default. |
| `src/components/ui/` | shadcn/ui primitives owned by this repository. Add only the components needed for a feature. |
| `src/components/shared/` | Reusable application-level components that do not belong to one feature. |
| `src/features/` | Feature-specific components, hooks, types, and client interaction logic. Create a folder per feature when implementing it. |
| `src/lib/` | Shared utilities and server-side authentication helpers. |
| `src/lib/utils.ts` | Shared class-name utility configured by shadcn/ui. |
| `src/hooks/` | Cross-feature client hooks only. |
| `src/stores/` | Small, client-only Zustand stores for shared mutable UI state. |

Empty `.gitkeep` directories are intentional extension points for future cross-feature hooks, API helpers, or shared stores.

## UI Components

The project uses the shadcn/ui `nova` preset, Radix primitives, a neutral CSS-variable theme, and Lucide icons. Configuration is in `components.json`; the maintained UI primitives are used by the implemented workflows.

From `frontend/`, add a component when a feature needs it:

```sh
pnpm dlx shadcn@latest add input
```

Review generated component files and dependencies before use. Do not add the entire component catalog up front.

## State Management Decision

Use **Zustand**, not Redux, when shared mutable client UI state is needed, such as a multi-step booking draft or panel visibility. Current workflows keep transient state close to their forms because no state needs a global client store yet.

Keep authoritative appointments, schedules, patient data, and permissions on the backend. Fetch them at the server boundary where appropriate and revalidate mutations; do not treat Zustand as a server-data cache or concurrency control. Keep short-lived form state local when it is not shared. Use URL search parameters for shareable filters.

With App Router, never create a request-dependent store as a module-level singleton on the server. Instantiate any Zustand store within a Client Component boundary, and do not read or write it from Server Components. Never persist access tokens or sensitive patient data in a client store or browser storage. Authentication tokens remain in HTTP-only cookies.
