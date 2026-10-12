import { NextResponse } from "next/server";
import { authenticatedBackendGet } from "@/lib/auth";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  const response = await authenticatedBackendGet(`/api/v1/doctors${query}`);
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(await response.json(), { status: response.status });
}
