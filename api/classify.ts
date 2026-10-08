import { db as database, loadEnrichment, saveEnrichment } from "../server/db.js";
import {
  aiConfigured,
  CATEGORY_KEYS,
  classifyItem,
  MODEL,
  type ClassifyItem,
} from "../server/classify.js";
import type { CategoryKey, SourceKey } from "../src/types.js";

// Small batches keep each call well inside the function time limit and a new
// Anthropic account's rate limits; the browser sends batches one at a time.
const MAX_ITEMS = 5;
const IN_FLIGHT = 2;
const MAX_MESSAGE_CHARS = 8000;
const SOURCES: readonly SourceKey[] = ["appstore", "email", "chat"];

const isText = (v: unknown, max = 500): v is string => typeof v === "string" && v.length <= max;

function parseItems(body: unknown): ClassifyItem[] | null {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) return null;
  const parsed: ClassifyItem[] = [];
  for (const raw of items) {
    const i = raw as Record<string, unknown>;
    if (
      !isText(i.id, 200) ||
      i.id.length === 0 ||
      !SOURCES.includes(i.source as SourceKey) ||
      !isText(i.app) ||
      !isText(i.message, MAX_MESSAGE_CHARS) ||
      !isText(i.country) ||
      !isText(i.appVersion) ||
      !(i.screen === null || isText(i.screen)) ||
      !CATEGORY_KEYS.includes(i.categoryHint as CategoryKey)
    ) {
      return null;
    }
    parsed.push(i as unknown as ClassifyItem);
  }
  return parsed;
}

/** Classify and draft replies for items not yet in the database. */
export async function POST(request: Request): Promise<Response> {
  const db = database;
  if (!db || !aiConfigured) {
    return Response.json({ error: "AI classification is not configured" }, { status: 503 });
  }
  const items = parseItems(await request.json().catch(() => null));
  if (!items) return Response.json({ error: "invalid request" }, { status: 400 });

  try {
    const enrichment = await loadEnrichment(
      db,
      items.map((i) => i.id),
    );
    const todo = items.filter((i) => !enrichment[i.id]);
    const failed: string[] = [];
    for (let i = 0; i < todo.length; i += IN_FLIGHT) {
      await Promise.all(
        todo.slice(i, i + IN_FLIGHT).map(async (item) => {
          try {
            const e = await classifyItem(item);
            await saveEnrichment(db, item.id, e, MODEL);
            enrichment[item.id] = e;
          } catch (err) {
            console.error(`classify ${item.id} failed`, err);
            failed.push(item.id);
          }
        }),
      );
    }
    return Response.json({ enrichment, failed });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
