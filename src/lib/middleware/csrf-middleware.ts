import { NextRequest, NextResponse } from "next/server";

/**
 * Pass 2 shim: legacy middleware now a no-op while the app transitions to bearer-only auth.
 */
export async function legacyTokenMiddleware(_request: NextRequest): Promise<NextResponse | null> {
  return null;
}

export async function getLegacyToken(): Promise<string | null> {
  return "";
}

export function withLegacyToken(_token: string | null) {
  return {
    headers: {
      "Content-Type": "application/json",
    },
  };
}

