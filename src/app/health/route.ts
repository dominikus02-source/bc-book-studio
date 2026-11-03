import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "bc-book-studio-frontend" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
