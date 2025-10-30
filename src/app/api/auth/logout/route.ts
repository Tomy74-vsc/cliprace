import { NextResponse } from "next/server";

// Protected in client usage; server stub always OK
export async function POST() {
  return NextResponse.json({ success: true });
}


