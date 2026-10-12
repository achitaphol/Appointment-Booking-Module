import { NextResponse } from "next/server";
import { authenticatedBackendRequest } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await authenticatedBackendRequest(`/api/v1/doctor-schedules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await request.json()),
  });
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(await response.json(), { status: response.status });
}
