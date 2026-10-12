import { NextResponse } from "next/server";
import { authenticatedBackendGet, authenticatedBackendRequest } from "@/lib/auth";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  const response = await authenticatedBackendGet(`/api/v1/appointments${query}`);
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(await response.json(), { status: response.status });
}

export async function POST(request: Request) {
  const body = await request.text();
  const response = await authenticatedBackendRequest("/api/v1/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}
