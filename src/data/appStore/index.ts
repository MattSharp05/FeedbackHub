// Runs server-side (api/app-store-reviews.ts, and the Vite dev middleware):
// Apple 403s browser User-Agents after a burst, so browsers must not fan out
// to the feed themselves. Relative imports carry `.js` for Node ESM on Vercel.
import type { FeedbackRequest } from "@/types";
import { fetchRecentReviews } from "./client.js";
import { mapReview, type Storefront } from "./mapReview.js";

// App Store IDs for every portfolio app, matched via the developer accounts of
// apps in the support-desk registry. Names must match `APPS` in constants.ts.
const APPS: { id: string; name: string }[] = [
  { id: "6651860228", name: "Lyrix" },
  { id: "6532628267", name: "Beam" },
  { id: "6759795504", name: "OJO" },
  { id: "6742023904", name: "Roomify" },
  { id: "6765959704", name: "Hey Coach" },
  { id: "6742901589", name: "Invoice Maker" },
  { id: "1579203943", name: "Manga Reader" },
  { id: "6465748012", name: "Manga Infinity" },
  { id: "1079944301", name: "radcam" },
  { id: "933501579", name: "Contraction Timer" },
  { id: "1469343811", name: "2nd Phone Number" },
  { id: "971833934", name: "Flash Cards" },
  { id: "6742198072", name: "AR Drawing" },
  { id: "6670211416", name: "Lightning Tracker" },
  { id: "6752294253", name: "Reverse Singing" },
  { id: "6736469598", name: "Manifestation GPT" },
  { id: "6766870627", name: "Baby Tracker" },
  { id: "6453523330", name: "Water Eject" },
  { id: "1579274717", name: "VR 360" },
  { id: "6738916284", name: "Emojify" },
  { id: "6740702907", name: "Spice it" },
];

// Reviews are per storefront; the feed has to be queried country by country.
const STOREFRONTS: Storefront[] = [
  { code: "us", country: "United States", lang: "EN" },
  { code: "gb", country: "United Kingdom", lang: "EN" },
  { code: "ca", country: "Canada", lang: "EN" },
  { code: "au", country: "Australia", lang: "EN" },
  { code: "de", country: "Germany", lang: "DE" },
  { code: "fr", country: "France", lang: "FR" },
  { code: "br", country: "Brazil", lang: "PT" },
  { code: "jp", country: "Japan", lang: "JA" },
];

// The feed's newest-50 page reaches back years in quiet storefronts; only
// recent reviews belong in a working queue.
const MAX_AGE_DAYS = 90;

// Apple rate-limits the feed per IP at a few hundred requests per few minutes,
// so each run is kept small (apps × storefronts), capped in flight, retried
// with backoff, and cached — a full result for an hour, a partial one briefly.
const MAX_IN_FLIGHT = 8;
const CACHE_MS = 60 * 60 * 1000;
const PARTIAL_CACHE_MS = 10 * 60 * 1000;
const RETRY_DELAYS_MS = [1_000, 3_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await fn();
    } catch {
      await sleep(delay);
    }
  }
  return fn();
}

async function settleWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export interface AppStoreResult {
  requests: FeedbackRequest[];
  failedFeeds: number;
  totalFeeds: number;
}

async function fanOut(): Promise<AppStoreResult> {
  const tasks = APPS.flatMap((app) =>
    STOREFRONTS.map((sf) => async () =>
      (await withRetry(() => fetchRecentReviews(app.id, sf.code))).map((r) =>
        mapReview(r, app.name, sf),
      ),
    ),
  );
  const results = await settleWithLimit(tasks, MAX_IN_FLIGHT);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === results.length) {
    throw new Error("App Store reviews: every storefront request failed");
  }
  if (failed.length > 0) {
    console.warn(`App Store reviews: ${failed.length}/${results.length} requests failed`);
  }
  const maxAgeMin = MAX_AGE_DAYS * 24 * 60;
  return {
    requests: results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((q) => q.ageMin <= maxAgeMin),
    failedFeeds: failed.length,
    totalFeeds: results.length,
  };
}

let cache: { expiresAt: number; result: Promise<AppStoreResult> } | null = null;

/** Recent App Store reviews for every known app × storefront (server-side). */
export function fetchAppStoreRequests(): Promise<AppStoreResult> {
  if (!cache || Date.now() > cache.expiresAt) {
    const entry = { expiresAt: Infinity, result: fanOut() };
    cache = entry;
    entry.result.then(
      (r) => {
        entry.expiresAt = Date.now() + (r.failedFeeds > 0 ? PARTIAL_CACHE_MS : CACHE_MS);
      },
      () => {
        if (cache === entry) cache = null;
      },
    );
  }
  return cache.result;
}

/** Browser entry point: the server fans out and caches; the page asks once. */
export async function loadAppStoreRequests(): Promise<{
  requests: FeedbackRequest[];
  warning?: string;
}> {
  const res = await fetch("/api/app-store-reviews");
  if (!res.ok) throw new Error(`/api/app-store-reviews: HTTP ${res.status}`);
  const { requests, failedFeeds, totalFeeds }: AppStoreResult = await res.json();
  return {
    requests,
    warning:
      failedFeeds > 0
        ? `${failedFeeds} of ${totalFeeds} App Store feeds were rate-limited by Apple, so reviews may be incomplete.`
        : undefined,
  };
}
