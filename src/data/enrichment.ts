import type { Enrichment, FeedbackRequest, RequestStatus } from "@/types";

export interface AiState {
  dbConfigured: boolean;
  aiConfigured: boolean;
  /** Environment variables the server still needs. */
  missing: string[];
  enrichment: Record<string, Enrichment>;
  statuses: Record<string, RequestStatus>;
}

export async function loadAiState(): Promise<AiState> {
  const res = await fetch("/api/enrichment");
  if (res.status === 503) {
    const { missing } = (await res.json()) as { missing: string[] };
    return { dbConfigured: false, aiConfigured: false, missing, enrichment: {}, statuses: {} };
  }
  if (!res.ok) throw new Error(`/api/enrichment: HTTP ${res.status}`);
  return res.json();
}

export async function classifyRequests(
  requests: FeedbackRequest[],
): Promise<{ enrichment: Record<string, Enrichment>; failed: string[] }> {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: requests.map((q) => ({
        id: q.id,
        source: q.source,
        app: q.app,
        message: q.message,
        country: q.country,
        appVersion: q.appVersion,
        screen: q.screen,
        categoryHint: q.category,
      })),
    }),
  });
  if (!res.ok) throw new Error(`/api/classify: HTTP ${res.status}`);
  return res.json();
}

export async function saveStatus(id: string, status: RequestStatus): Promise<void> {
  const res = await fetch("/api/status", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error(`/api/status: HTTP ${res.status}`);
}

/**
 * Overlay AI results and saved dashboard statuses on a request as its source
 * reported it. Saved statuses only refine items the source still reports as
 * open, and support-desk owns closed states for in-app chat.
 */
export function applyAi(
  q: FeedbackRequest,
  e: Enrichment | undefined,
  saved: RequestStatus | undefined,
): FeedbackRequest {
  let next = e ? { ...q, ...e, status: q.status === "new" ? ("drafted" as const) : q.status } : q;
  const sourceOwnsStatus = q.source === "chat" && saved !== "approved" && saved !== "drafted";
  if (saved && saved !== "new" && q.status === "new" && !sourceOwnsStatus) {
    next = { ...next, status: saved };
  }
  return next;
}
