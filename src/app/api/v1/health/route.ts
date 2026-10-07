import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      service: "kp-duty",
      api: "v1",
      status: "ok",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
