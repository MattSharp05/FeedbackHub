import type { FeedbackRequest } from "../../types.js";
import type { AppStoreReview } from "./client.js";

export interface Storefront {
  code: string;
  country: string;
  /** Storefront's primary language — a guess; reviews aren't language-tagged. */
  lang: string;
}

export function mapReview(
  review: AppStoreReview,
  appName: string,
  storefront: Storefront,
): FeedbackRequest {
  const updatedMs = Date.parse(review.updated);
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  return {
    id: `appstore-${review.id}`,
    app: appName,
    source: "appstore",
    // Star rating is only a hint; confidence stays 0 until AI classification runs.
    category: review.rating >= 4 ? "praise" : "other",
    lang: storefront.lang,
    country: storefront.country,
    device: null,
    appVersion: review.version,
    screen: null,
    message: `${stars} ${review.title} — ${review.content}`,
    translation: null,
    draft: "",
    draftTranslation: null,
    action: "",
    confidence: 0,
    // The public feed doesn't expose developer responses, so every review is new.
    status: "new",
    ageMin: Number.isNaN(updatedMs)
      ? 0
      : Math.max(0, Math.round((Date.now() - updatedMs) / 60_000)),
  };
}
