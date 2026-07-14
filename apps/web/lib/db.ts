import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var evBayPool: Pool | undefined;
}

export type BayStatus = "open" | "occupied" | "unknown";

export type Bay = {
  id: number;
  label: string;
  status: BayStatus;
  confidence: number;
  source: string;
  updated_at: string;
};

export type BayEvent = {
  id: string;
  bay_id: number;
  previous_status: BayStatus | null;
  status: BayStatus;
  confidence: number;
  source: string;
  created_at: string;
};

export const pool =
  global.evBayPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL
  });

if (process.env.NODE_ENV !== "production") {
  global.evBayPool = pool;
}

export async function getBays() {
  const result = await pool.query<Bay>(
    "SELECT id, label, status, confidence::float AS confidence, source, updated_at FROM bays ORDER BY id"
  );
  return result.rows;
}

export async function getRecentEvents(limit = 10) {
  const result = await pool.query<BayEvent>(
    `SELECT id, bay_id, previous_status, status, confidence::float AS confidence, source, created_at
     FROM bay_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export function countOpenBays(bays: Bay[]) {
  return bays.filter((bay) => bay.status === "open").length;
}

