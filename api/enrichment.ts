import { db, DB_ENV, dbProblem, loadAllEnrichment, loadAllStatuses } from "../server/db.js";
import { aiConfigured } from "../server/classify.js";

/** Stored AI results and dashboard statuses, plus which settings are missing. */
export async function GET(): Promise<Response> {
  const missing = [
    ...(db || dbProblem ? [] : DB_ENV),
    ...(aiConfigured ? [] : ["ANTHROPIC_API_KEY"]),
  ];
  if (!db) {
    return Response.json(
      { dbConfigured: false, aiConfigured, missing, problem: dbProblem },
      { status: 503 },
    );
  }
  try {
    const [enrichment, statuses] = await Promise.all([loadAllEnrichment(db), loadAllStatuses(db)]);
    return Response.json({ dbConfigured: true, aiConfigured, missing, enrichment, statuses });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
