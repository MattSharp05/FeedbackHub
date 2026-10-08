import { ensureSchema, saveStatus, sql } from "../server/db.js";
import type { RequestStatus } from "../src/types.js";

const STATUSES: readonly RequestStatus[] = [
  "new",
  "drafted",
  "approved",
  "sent",
  "auto-handled",
  "resolved",
  "rejected",
];

/** Persist a dashboard status change. */
export async function PUT(request: Request): Promise<Response> {
  if (!sql) return Response.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);
  const { id, status } = (body ?? {}) as { id?: unknown; status?: unknown };
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 200 ||
    !STATUSES.includes(status as RequestStatus)
  ) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  try {
    await ensureSchema(sql);
    await saveStatus(sql, id, status as RequestStatus);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
