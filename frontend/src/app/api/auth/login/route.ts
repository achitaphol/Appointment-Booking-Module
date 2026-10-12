import { NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { departmentCode, email, password } = body as Record<string, unknown>;
  if (typeof departmentCode !== "string" || typeof email !== "string" || typeof password !== "string" || !departmentCode || !email || !password) {
    return NextResponse.json({ error: "Complete all fields." }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(`${backendUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentCode, email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!backendResponse.ok) {
      const message = backendResponse.status === 401 ? "Invalid department, email, or password." : backendResponse.status === 429 ? "Too many attempts. Try again later." : "Unable to sign in right now.";
      return NextResponse.json({ error: message }, { status: backendResponse.status === 401 || backendResponse.status === 429 ? backendResponse.status : 502 });
    }

    const result: unknown = await backendResponse.json();
    if (!result || typeof result !== "object" || !("data" in result) || !result.data || typeof result.data !== "object" || !("accessToken" in result.data) || typeof result.data.accessToken !== "string") {
      return NextResponse.json({ error: "Invalid sign-in response." }, { status: 502 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE, result.data.accessToken, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to reach the authentication service." }, { status: 503 });
  }
}
