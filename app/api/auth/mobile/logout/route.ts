import { NextResponse } from "next/server";

/** Mobile clients discard tokens locally; endpoint exists for symmetric logout UX. */
export async function POST() {
  return NextResponse.json({ ok: true });
}
