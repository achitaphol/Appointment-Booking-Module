"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Department = { code: string; name: string };

export function LoginForm({ departments, loading = false }: { departments: Department[]; loading?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fieldClass = "h-11 rounded-lg border-[#C9D0D6] bg-white px-3 text-sm text-[#1F2933] placeholder:text-[#65717B] focus-visible:border-[#315A70] focus-visible:ring-[#315A70]/15";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentCode: form.get("departmentCode"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (!response.ok) {
        const result: { error?: string } = await response.json();
        setError(result.error ?? "Unable to sign in right now.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-4 space-y-2" onSubmit={handleSubmit}>
      <div className="relative">
        <select
          id="department"
          name="departmentCode"
          aria-label="Department"
          required
          disabled={departments.length === 0}
          defaultValue=""
          className={`${fieldClass} w-full appearance-none border pr-9 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:text-[#65717B]`}
        >
          <option value="" disabled>{loading ? "Loading departments" : departments.length ? "Select department" : "Departments unavailable"}</option>
          {departments.map((department) => (
            <option key={department.code} value={department.code}>{department.name}</option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-[#65717B]" />
      </div>

      <Input id="email" name="email" type="email" autoComplete="username" aria-label="Email" placeholder="Email" required className={fieldClass} />

      <Input id="password" name="password" type="password" autoComplete="current-password" aria-label="Password" placeholder="Password" required className={fieldClass} />

      <Button type="submit" disabled={departments.length === 0 || submitting} className="h-10 w-full rounded-lg bg-[#254D62] text-sm font-medium text-white hover:bg-[#1E3F50]">
        {submitting ? "Signing in..." : "Sign in"}
      </Button>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
