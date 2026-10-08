import { neon } from "@neondatabase/serverless";
import type { Enrichment, RequestStatus } from "../src/types.js";

// Vercel's Neon integration sets DATABASE_URL (POSTGRES_URL on older setups).
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

export const sql = url ? neon(url) : null;
export type Sql = NonNullable<typeof sql>;

let schemaReady: Promise<unknown> | null = null;

/** Creates the tables on first use; idempotent. */
export function ensureSchema(db: Sql): Promise<unknown> {
  schemaReady ??= Promise.all([
    db`CREATE TABLE IF NOT EXISTS enrichment (
      request_id text PRIMARY KEY,
      category text NOT NULL,
      confidence real NOT NULL,
      lang text NOT NULL,
      translation text,
      action text NOT NULL,
      draft text NOT NULL,
      draft_translation text,
      model text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    db`CREATE TABLE IF NOT EXISTS request_status (
      request_id text PRIMARY KEY,
      status text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  ]).catch((err: unknown) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export function rowToEnrichment(row: Record<string, unknown>): Enrichment {
  return {
    category: row.category as Enrichment["category"],
    confidence: Number(row.confidence),
    lang: String(row.lang),
    translation: (row.translation as string | null) ?? null,
    action: String(row.action),
    draft: String(row.draft),
    draftTranslation: (row.draft_translation as string | null) ?? null,
  };
}

export async function saveEnrichment(db: Sql, id: string, e: Enrichment, model: string) {
  await db`INSERT INTO enrichment
      (request_id, category, confidence, lang, translation, action, draft, draft_translation, model)
    VALUES
      (${id}, ${e.category}, ${e.confidence}, ${e.lang}, ${e.translation}, ${e.action}, ${e.draft}, ${e.draftTranslation}, ${model})
    ON CONFLICT (request_id) DO NOTHING`;
}

export async function saveStatus(db: Sql, id: string, status: RequestStatus) {
  await db`INSERT INTO request_status (request_id, status) VALUES (${id}, ${status})
    ON CONFLICT (request_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`;
}
