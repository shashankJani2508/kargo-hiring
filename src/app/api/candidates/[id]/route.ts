import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCandidate } from "@/lib/candidates";

export async function GET(_req: Request, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  const c = await getCandidate(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ candidate: c });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  await sql()`DELETE FROM candidates WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
