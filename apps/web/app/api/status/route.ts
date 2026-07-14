import { NextResponse } from "next/server";
import { countOpenBays, getBays } from "@/lib/db";

export async function GET() {
  const bays = await getBays();
  return NextResponse.json({
    openBayCount: countOpenBays(bays),
    bays
  });
}

