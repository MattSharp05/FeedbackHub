import type { CategoryKey } from "../types.js";

// The in-app support form's category ("Report a bug", "Request a feature",
// "Subscription issue", …) is picked by the user, so it is a classification
// hint, not ground truth — confidence stays 0 until AI classification runs.
export function categoryHint(title: string | undefined): CategoryKey {
  const t = (title ?? "").toLowerCase();
  if (t.includes("bug")) return "bug";
  if (t.includes("feature")) return "feature";
  if (t.includes("subscription")) return "billing";
  return "other";
}
