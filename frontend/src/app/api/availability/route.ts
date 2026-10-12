import { NextResponse } from "next/server";
import { authenticatedBackendGet } from "@/lib/auth";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  const response = await authenticatedBackendGet(`/api/v1/availability${query}`);
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
