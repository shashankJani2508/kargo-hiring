import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/google";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/?google=${status}`, origin));
    res.cookies.delete("g_oauth_state");
    return res;
  };
  if (searchParams.get("error")) return back("denied");
  const state = searchParams.get("state");
  if (!state || state !== request.cookies.get("g_oauth_state")?.value) return back("failed");
  try {
    await exchangeCode(searchParams.get("code") ?? "", origin);
    return back("connected");
  } catch {
    return back("failed");
  }
}
