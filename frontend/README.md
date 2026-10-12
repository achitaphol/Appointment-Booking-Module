# Appointment Booking Frontend

Next.js App Router, TypeScript, Tailwind CSS 4, shadcn/ui, and Zustand. The authentication flow is connected to the backend; appointment screens are still under development.

The `/login` page loads department options from the backend's public departments endpoint. It submits the selected department, email, and password through a same-origin Next.js route to the backend login endpoint. A successful response stores the short-lived access token in an HTTP-only cookie and navigates to `/`. When the backend is unavailable or has no departments, the department select and submit button are disabled.

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
| `src/lib/api/` | Server/client API boundaries and typed request helpers for backend integration. |
| `src/lib/utils.ts` | Shared class-name utility configured by shadcn/ui. |
| `src/hooks/` | Cross-feature client hooks only. |
| `src/stores/` | Small, client-only Zustand stores for shared mutable UI state. |

The empty directories are intentional extension points, not implemented features.

## UI Components

The existing project was initialized with the shadcn/ui `nova` preset, Radix primitives, neutral CSS-variable theme, and Lucide icons. Configuration is in `components.json`. The `Button` primitive is installed as a smoke test and is not wired into a page yet.

From `frontend/`, add a component when a feature needs it:

```sh
pnpm dlx shadcn@latest add input
```

Review generated component files and dependencies before use. Do not add the entire component catalog up front.

## State Management Decision

Use **Zustand**, not Redux, for shared mutable client UI state such as a multi-step booking draft or panel visibility. The application currently has no store because no feature needs one yet.

Keep authoritative appointments, schedules, patient data, and permissions on the backend. Fetch them at the server boundary where appropriate and revalidate mutations; do not treat Zustand as a server-data cache or concurrency control. Keep short-lived form state local when it is not shared. Use URL search parameters for shareable filters.

With App Router, never create a request-dependent store as a module-level singleton on the server. Instantiate any Zustand store within a Client Component boundary, and do not read or write it from Server Components. Never persist access tokens or sensitive patient data in a client store or browser storage. Authentication tokens remain in HTTP-only cookies.
