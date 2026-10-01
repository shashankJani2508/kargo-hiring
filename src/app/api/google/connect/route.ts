import { NextResponse, type NextRequest } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";

export async function GET(request: NextRequest) {
  if (!googleConfigured()) return NextResponse.json({ error: "Google sign-in isn't set up yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." }, { status: 400 });
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(request.nextUrl.origin, state));
  res.cookies.set("g_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return res;
}
