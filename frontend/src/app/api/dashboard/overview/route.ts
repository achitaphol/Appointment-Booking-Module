import { NextResponse } from "next/server";
import { authenticatedBackendGet } from "@/lib/auth";

export async function GET() {
  const response = await authenticatedBackendGet("/api/v1/dashboard/overview");
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(await response.json(), { status: response.status });
}
