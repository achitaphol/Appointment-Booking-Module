import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";

type Department = { code: string; name: string };

export const metadata: Metadata = {
  title: "Sign in | HLAB",
  description: "Hospital staff sign-in.",
};

async function getDepartments(): Promise<Department[]> {
  const baseUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/departments`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("data" in result) || !Array.isArray(result.data)) return [];
    return result.data.filter(
      (item): item is Department =>
        item !== null &&
        typeof item === "object" &&
        "code" in item &&
        "name" in item &&
        typeof item.code === "string" &&
        typeof item.name === "string",
    );
  } catch {
    return [];
  }
}

async function DepartmentLoginForm() {
  const departments = await getDepartments();

  return <LoginForm departments={departments} />;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-8 text-[#1F2933]">
      <div className="w-full max-w-[320px]">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Welcome!</h1>
        <Suspense fallback={<LoginForm departments={[]} loading />}>
          <DepartmentLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
