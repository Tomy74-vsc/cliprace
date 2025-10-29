import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { token: "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
