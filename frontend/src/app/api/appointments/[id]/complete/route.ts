import { NextResponse } from "next/server";
import { authenticatedBackendRequest } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await authenticatedBackendRequest(`/api/v1/appointments/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}
