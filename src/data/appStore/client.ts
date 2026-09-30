// Client for Apple's public customer-reviews RSS feed (no auth, CORS-open).
// Read-only: it can't show developer responses or post them — that needs the
// App Store Connect API. External responses are validated here.

export interface AppStoreReview {
  id: string;
  rating: number;
  title: string;
  content: string;
  version: string;
  updated: string;
}

type Labeled = { label?: unknown };

const label = (v: unknown): unknown =>
  typeof v === "object" && v !== null ? (v as Labeled).label : undefined;

function toReview(entry: unknown): AppStoreReview | null {
  if (typeof entry !== "object" || entry === null) return null;
  const e = entry as Record<string, unknown>;
  const id = label(e.id);
  const rating = Number(label(e["im:rating"]));
  const title = label(e.title);
  const content = label(e.content);
  const version = label(e["im:version"]);
  const updated = label(e.updated);
  if (
    typeof id !== "string" ||
    !(rating >= 1 && rating <= 5) ||
    typeof title !== "string" ||
    typeof content !== "string" ||
    typeof version !== "string" ||
    typeof updated !== "string"
  ) {
    return null;
  }
  return { id, rating, title, content, version, updated };
}

/** The 50 most recent reviews for one app in one storefront. */
export async function fetchRecentReviews(
  appId: string,
  storefront: string,
): Promise<AppStoreReview[]> {
  const url = `https://itunes.apple.com/${storefront}/rss/customerreviews/page=1/id=${appId}/sortby=mostrecent/json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`App Store reviews ${appId}/${storefront}: HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  const feed =
    typeof body === "object" && body !== null
      ? (body as { feed?: { entry?: unknown } }).feed
      : undefined;
  if (!feed) {
    throw new Error(`App Store reviews ${appId}/${storefront}: unexpected body`);
  }
  // The feed omits `entry` when empty and returns a bare object for one entry.
  const entries =
    feed.entry === undefined ? [] : Array.isArray(feed.entry) ? feed.entry : [feed.entry];
  return entries.map(toReview).filter((r): r is AppStoreReview => r !== null);
}
