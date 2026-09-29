import { NextResponse } from "next/server";
import { authEnabled, sessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  if (authEnabled() && password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
