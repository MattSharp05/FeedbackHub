import { ensureSchema, rowToEnrichment, sql } from "../server/db.js";
import { aiConfigured } from "../server/classify.js";
import type { Enrichment, RequestStatus } from "../src/types.js";

/** Stored AI results and dashboard statuses, plus which settings are missing. */
export async function GET(): Promise<Response> {
  const missing = [
    ...(sql ? [] : ["DATABASE_URL"]),
    ...(aiConfigured ? [] : ["ANTHROPIC_API_KEY"]),
  ];
  if (!sql) {
    return Response.json({ dbConfigured: false, aiConfigured, missing }, { status: 503 });
  }
  try {
    await ensureSchema(sql);
    const [enrichmentRows, statusRows] = await Promise.all([
      sql`SELECT * FROM enrichment`,
      sql`SELECT request_id, status FROM request_status`,
    ]);
    const enrichment: Record<string, Enrichment> = {};
    for (const row of enrichmentRows) enrichment[row.request_id] = rowToEnrichment(row);
    const statuses: Record<string, RequestStatus> = {};
    for (const row of statusRows) statuses[row.request_id] = row.status;
    return Response.json({ dbConfigured: true, aiConfigured, missing, enrichment, statuses });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
