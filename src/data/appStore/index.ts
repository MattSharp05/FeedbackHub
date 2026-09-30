import type { FeedbackRequest } from "@/types";
import { fetchRecentReviews } from "./client";
import { mapReview, type Storefront } from "./mapReview";

// App Store IDs known so far (from the support-desk app registry). The rest of
// the portfolio needs its IDs added here.
const APPS: { id: string; name: string }[] = [
  { id: "6651860228", name: "Lyrix" },
  { id: "1579203943", name: "Manga Reader" },
  { id: "6465748012", name: "Manga Infinity" },
  { id: "933501579", name: "Contraction Timer" },
  { id: "6689513347", name: "Gmoji" },
  { id: "6453523330", name: "Water Eject" },
  { id: "1579274717", name: "VR 360" },
  { id: "6738916284", name: "Emojify" },
];

// Reviews are per storefront; the feed has to be queried country by country.
const STOREFRONTS: Storefront[] = [
  { code: "us", country: "United States", lang: "EN" },
  { code: "gb", country: "United Kingdom", lang: "EN" },
  { code: "ca", country: "Canada", lang: "EN" },
  { code: "au", country: "Australia", lang: "EN" },
  { code: "de", country: "Germany", lang: "DE" },
  { code: "fr", country: "France", lang: "FR" },
  { code: "es", country: "Spain", lang: "ES" },
  { code: "it", country: "Italy", lang: "IT" },
  { code: "nl", country: "Netherlands", lang: "NL" },
  { code: "br", country: "Brazil", lang: "PT" },
  { code: "mx", country: "Mexico", lang: "ES" },
  { code: "jp", country: "Japan", lang: "JA" },
  { code: "tr", country: "Turkey", lang: "TR" },
];

// The feed's newest-50 page reaches back years in quiet storefronts; only
// recent reviews belong in a working queue.
const MAX_AGE_DAYS = 90;

/** Fetch recent App Store reviews for every known app × storefront. */
export async function fetchAppStoreRequests(): Promise<FeedbackRequest[]> {
  const jobs = APPS.flatMap((app) =>
    STOREFRONTS.map(async (sf) =>
      (await fetchRecentReviews(app.id, sf.code)).map((r) =>
        mapReview(r, app.name, sf),
      ),
    ),
  );
  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === results.length) {
    throw new Error("App Store reviews: every storefront request failed");
  }
  if (failed.length > 0) {
    console.warn(`App Store reviews: ${failed.length}/${results.length} requests failed`, failed);
  }
  const maxAgeMin = MAX_AGE_DAYS * 24 * 60;
  return results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((q) => q.ageMin <= maxAgeMin);
}
