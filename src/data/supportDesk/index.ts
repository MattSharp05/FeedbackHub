import type { FeedbackRequest, RequestStatus } from "@/types";
import { APPS } from "@/data/constants";
import {
  fetchAllReports,
  fetchApps,
  fetchCategories,
  updateReportStatus,
} from "./client";
import { mapReport, toSupportDeskStatus } from "./mapReport";

// Source app names can drift from the portfolio list ("VR360" vs "VR 360",
// mojibake like "Water EjectÂ°") — fold them onto the canonical name so the
// app axis stays unified across sources.
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const CANONICAL_BY_KEY = new Map(APPS.map((a): [string, string] => [nameKey(a), a]));
const canonicalAppName = (name: string) =>
  CANONICAL_BY_KEY.get(nameKey(name)) ?? name.trim();

/** Fetch all support-desk reports and normalize them into FeedbackRequests. */
export async function fetchSupportDeskRequests(): Promise<FeedbackRequest[]> {
  const [reports, apps, categories] = await Promise.all([
    fetchAllReports(),
    fetchApps(),
    fetchCategories(),
  ]);
  const appNameById = new Map(
    apps.map((a): [string, string] => [a.id, canonicalAppName(a.name)]),
  );
  const categoryTitleById = new Map(
    categories.map((c): [number, string] => [c.id, c.title]),
  );
  return reports
    // The API ignores empty-content submissions; some legacy rows have them.
    .filter((r) => r.content.trim() !== "")
    .map((r) => mapReport(r, appNameById, categoryTitleById));
}

/** Write a dashboard status change back to support-desk, if its status changes. */
export async function syncSupportDeskStatus(
  reportId: string,
  from: RequestStatus,
  to: RequestStatus,
): Promise<void> {
  const target = toSupportDeskStatus(to);
  if (target !== toSupportDeskStatus(from)) {
    await updateReportStatus(reportId, target);
  }
}
