import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  const startTime = Date.now();
  let dbOk = false;

  try {
    const db = getDb();
    const row = await db.prepare("SELECT 1 AS ok").get<{ ok: number }>();
    dbOk = row?.ok === 1;
  } catch (err) {
    logger.error("Health check database probe failed", "health", err);
  }

  const duration = Date.now() - startTime;
  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status: dbOk ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTimeMs: duration,
      checks: {
        database: dbOk ? "connected" : "unreachable",
      },
    },
    { status }
  );
}

