import { NextResponse } from "next/server";
import { authenticatedBackendRequest } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; breakId: string }> }) {
  const { id, breakId } = await params;
  const response = await authenticatedBackendRequest(`/api/v1/doctor-schedules/${encodeURIComponent(id)}/breaks/${encodeURIComponent(breakId)}`, { method: "DELETE" });
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await response.json(), { status: response.status });
}
