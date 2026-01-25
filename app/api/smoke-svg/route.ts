export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { generateSvgFromPng } from "../../../lib/generateSvg";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      hasFn: typeof generateSvgFromPng === "function",
    });
  } catch (err: any) {
    console.error("smoke-svg failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? String(err),
        stack: err?.stack ?? null,
      },
      { status: 500 }
    );
  }
}
