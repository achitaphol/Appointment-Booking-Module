import "server-only";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "hlab_access_token";

export type Account = {
  id: string;
  userId: string;
  userType: { code: string; name: string };
  department: { id: string; code: string; name: string };
  roles: string[];
};

export function backendUrl() {
  return process.env.BACKEND_URL ?? "http://127.0.0.1:4000";
}

export async function authenticatedBackendRequest(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return await fetch(`${backendUrl()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
}

export async function authenticatedBackendGet(path: string): Promise<Response | null> {
  return authenticatedBackendRequest(path);
}

export async function getCurrentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${backendUrl()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("data" in result)) return null;
    const account = result.data;
    if (!account || typeof account !== "object" || !("id" in account) || typeof account.id !== "string" || !("userType" in account) || !account.userType || typeof account.userType !== "object" || !("code" in account.userType) || typeof account.userType.code !== "string") return null;
    return account as Account;
  } catch {
    return null;
  }
}
