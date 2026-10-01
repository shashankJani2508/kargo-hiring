import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { isConnected } from "@/lib/google";
import { nextSlot } from "@/lib/schedule";

// Preview of the slot an invite would get right now, for the confirmation pop-up.
export async function GET(request: Request) {
  try {
    const exclude = new URL(request.url).searchParams.get("exclude") ?? undefined;
    const settings = await getSettings();
    const [slot, google] = await Promise.all([nextSlot(settings, { excludeCandidateId: exclude }), isConnected()]);
    return NextResponse.json({ slot, meet: google ? "auto" : settings.meet_link ? "room" : "none" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
