import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Enrichment, RequestStatus } from "../src/types.js";

// Set by Vercel's Supabase integration (or copied from Supabase → Project
// Settings → API). The service-role key is server-only.
export const DB_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const url = process.env.SUPABASE_URL;
// Newer Supabase projects issue a "secret key" in place of the service-role key.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | null = null;
/** Set when the settings exist but are unusable, so the banner can say why. */
export let dbProblem: string | null = null;
if (url && key) {
  try {
    client = createClient(url, key, { auth: { persistSession: false } });
  } catch {
    dbProblem =
      "SUPABASE_URL in Vercel isn't a valid URL — it should be the Supabase project URL, like https://abcd1234.supabase.co.";
  }
}

export const db = client;
export type Db = NonNullable<typeof db>;

// Supabase's API returns at most 1000 rows per request by default.
const PAGE = 1000;

interface EnrichmentRow {
  request_id: string;
  category: Enrichment["category"];
  confidence: number;
  lang: string;
  translation: string | null;
  action: string;
  draft: string;
  draft_translation: string | null;
}

function check(error: { message: string; code?: string } | null, table: string) {
  if (!error) return;
  if (error.code === "PGRST205" || error.code === "42P01") {
    throw new Error(`table "${table}" is missing — run server/schema.sql in Supabase's SQL editor`);
  }
  throw new Error(`${table}: ${error.message}`);
}

function rowToEnrichment(row: EnrichmentRow): Enrichment {
  return {
    category: row.category,
    confidence: Number(row.confidence),
    lang: row.lang,
    translation: row.translation,
    action: row.action,
    draft: row.draft,
    draftTranslation: row.draft_translation,
  };
}

export async function loadAllEnrichment(db: Db): Promise<Record<string, Enrichment>> {
  const out: Record<string, Enrichment> = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("enrichment")
      .select("*")
      .order("request_id")
      .range(from, from + PAGE - 1);
    check(error, "enrichment");
    const rows = (data ?? []) as EnrichmentRow[];
    for (const row of rows) out[row.request_id] = rowToEnrichment(row);
    if (rows.length < PAGE) return out;
  }
}

export async function loadEnrichment(db: Db, ids: string[]): Promise<Record<string, Enrichment>> {
  const { data, error } = await db.from("enrichment").select("*").in("request_id", ids);
  check(error, "enrichment");
  const out: Record<string, Enrichment> = {};
  for (const row of (data ?? []) as EnrichmentRow[]) out[row.request_id] = rowToEnrichment(row);
  return out;
}

export async function loadAllStatuses(db: Db): Promise<Record<string, RequestStatus>> {
  const out: Record<string, RequestStatus> = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("request_status")
      .select("request_id, status")
      .order("request_id")
      .range(from, from + PAGE - 1);
    check(error, "request_status");
    const rows = (data ?? []) as { request_id: string; status: RequestStatus }[];
    for (const row of rows) out[row.request_id] = row.status;
    if (rows.length < PAGE) return out;
  }
}

export async function saveEnrichment(db: Db, id: string, e: Enrichment, model: string) {
  const { error } = await db.from("enrichment").upsert(
    {
      request_id: id,
      category: e.category,
      confidence: e.confidence,
      lang: e.lang,
      translation: e.translation,
      action: e.action,
      draft: e.draft,
      draft_translation: e.draftTranslation,
      model,
    },
    { onConflict: "request_id", ignoreDuplicates: true },
  );
  check(error, "enrichment");
}

export async function saveStatus(db: Db, id: string, status: RequestStatus) {
  const { error } = await db
    .from("request_status")
    .upsert(
      { request_id: id, status, updated_at: new Date().toISOString() },
      { onConflict: "request_id" },
    );
  check(error, "request_status");
}
