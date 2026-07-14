import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBays, pool } from "@/lib/db";
import { maybeNotifyAvailability } from "@/lib/notifications";

const baySchema = z.object({
  id: z.number().int().min(1).max(4),
  status: z.enum(["open", "occupied", "unknown"]),
  confidence: z.number().min(0).max(1)
});

const payloadSchema = z.object({
  bays: z.array(baySchema).min(1).max(4),
  source: z.string().min(1).default("detector")
});

export async function POST(request: NextRequest) {
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (expectedKey && request.headers.get("x-api-key") !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const previousBays = await getBays();
  const previousOpenCount = previousBays.filter((bay) => bay.status === "open").length;

  await pool.query("BEGIN");
  try {
    for (const bay of parsed.data.bays) {
      const current = previousBays.find((item) => item.id === bay.id);
      await pool.query(
        `UPDATE bays
         SET status = $1, confidence = $2, source = $3, updated_at = now()
         WHERE id = $4`,
        [bay.status, bay.confidence, parsed.data.source, bay.id]
      );

      if (!current || current.status !== bay.status) {
        await pool.query(
          `INSERT INTO bay_events (bay_id, previous_status, status, confidence, source)
           VALUES ($1, $2, $3, $4, $5)`,
          [bay.id, current?.status ?? null, bay.status, bay.confidence, parsed.data.source]
        );
      }
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  const updatedBays = await getBays();
  await maybeNotifyAvailability(previousOpenCount, updatedBays);

  return NextResponse.json({
    ok: true,
    bays: updatedBays
  });
}

