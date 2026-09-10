import { NextResponse } from "next/server";
import { getAllLeads } from "@/lib/leads";

export const runtime = "nodejs";

/**
 * Admin export — the only way to read captured leads back out, including
 * the internal lead score/classification that never reaches the client.
 * Gated by a shared-secret query param (`ADMIN_TOKEN` env var) rather than
 * a real login, same as the sibling tools. Rotate the token (hosting
 * project env vars) if the URL ever leaks.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await getAllLeads();
  return NextResponse.json({ count: leads.length, leads });
}
