import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { Account } from "@/lib/auth";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const baseStaffNavigation: NavigationItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: UsersRound },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
];

const doctorNavigation: NavigationItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/appointments", label: "My appointments", icon: CalendarDays },
  { href: "/my-schedule", label: "My schedule", icon: CalendarRange },
];

export function WorkspaceShell({
  account,
  activePath,
  children,
  loading = false,
}: {
  account: Account | null;
  activePath: string;
  children: ReactNode;
  loading?: boolean;
}) {
  const isDoctor = account?.userType.code === "doctor";
  const departmentName = account?.department.name ?? "Hospital workspace";
  const userTypeName = account?.userType.name ?? "Guest";
  const navigation = !account
    ? []
    : isDoctor
      ? doctorNavigation
      : account.roles.includes("schedule_manager")
        ? [...baseStaffNavigation, { href: "/schedules", label: "Schedules", icon: CalendarRange }]
        : baseStaffNavigation;

  return (
    <div className="min-h-screen bg-[#F7F8F8] text-[#1D2B33]">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-[#DDE2E4] bg-white px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="HLAB overview">
          <span className="flex size-7 items-center justify-center rounded-md bg-[#244E63] text-xs font-semibold text-white">H</span>
          <span className="text-sm font-semibold tracking-[-0.01em]">HLAB</span>
        </Link>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {loading ? <div aria-hidden="true" className="h-7 w-24 bg-[#EEF1F2]" /> : <>
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-medium text-[#2B3941]">{userTypeName}</p>
              <p className="text-xs text-[#77848B]">{departmentName}</p>
            </div>
            <span className="flex size-8 items-center justify-center rounded-full bg-[#EDF1F2] text-[#52626B]">
              <UserRound aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </span>
            {account && (
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[#5B6970] hover:bg-[#F1F4F5] hover:text-[#244E63]" aria-label="Sign out">
                  <LogOut aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  <span className="hidden lg:inline">Sign out</span>
                </button>
              </form>
            )}
            {!account && <Link href="/login" className="font-medium text-[#244E63] hover:underline">Sign in</Link>}
          </>}
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1440px]">
        <aside className="hidden w-56 shrink-0 border-r border-[#DDE2E4] bg-white md:block">
          <div className="border-b border-[#E4E8EA] px-6 py-5">
            {loading ? <div aria-hidden="true" className="space-y-2"><div className="h-3 w-16 bg-[#EEF1F2]" /><div className="h-4 w-28 bg-[#EEF1F2]" /></div> : <><p className="text-xs text-[#7A878E]">Department</p><p className="mt-1 truncate text-sm font-medium text-[#2C3A42]">{departmentName}</p></>}
          </div>
          <nav aria-label="Main navigation" className="space-y-1 px-3 py-5">
            {loading && (
              <div aria-hidden="true" className="space-y-3 px-3 py-1">
                <div className="h-3 w-24 bg-[#EEF1F2]" />
                <div className="h-3 w-32 bg-[#EEF1F2]" />
                <div className="h-3 w-28 bg-[#EEF1F2]" />
              </div>
            )}
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activePath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm ${active ? "bg-[#EAF0F2] font-medium text-[#183F53]" : "text-[#53636C] hover:bg-[#F4F6F6]"}`}
                >
                  <Icon aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
