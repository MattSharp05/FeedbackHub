// Typed client for the support-desk read API. External responses are
// validated here; everything downstream trusts these shapes.

// Same-origin proxy path (vite dev proxy / vercel rewrite) — the API sends no
// CORS headers, so browsers can't hit it directly.
const BASE_URL: string =
  import.meta.env.VITE_SUPPORT_DESK_URL ?? "/support-desk";

export type SupportDeskStatus = "pending" | "resolved" | "rejected";

export interface SupportDeskReport {
  id: string;
  userDeviceId: string;
  screenName: string;
  appVersion: string;
  categoryId: number | null;
  appId: string;
  email: string | null;
  content: string;
  status: SupportDeskStatus;
  adminMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportDeskApp {
  id: string;
  name: string;
}

export interface SupportDeskCategory {
  id: number;
  title: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

function isReport(v: unknown): v is SupportDeskReport {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.appId === "string" &&
    typeof v.screenName === "string" &&
    typeof v.appVersion === "string" &&
    typeof v.content === "string" &&
    typeof v.createdAt === "string" &&
    (v.status === "pending" || v.status === "resolved" || v.status === "rejected") &&
    (typeof v.categoryId === "number" || v.categoryId === null) &&
    (typeof v.email === "string" || v.email === null)
  );
}

async function getJson(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`support-desk GET ${path}: HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  if (!isRecord(body) || body.success !== true) {
    throw new Error(`support-desk GET ${path}: unexpected response body`);
  }
  return body;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 40; // safety cap

/** Fetch every report, paging until the API reports no more. */
export async function fetchAllReports(): Promise<SupportDeskReport[]> {
  const all: SupportDeskReport[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await getJson(
      `/api/reports?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
    );
    const reports = body.reports;
    if (!Array.isArray(reports)) {
      throw new Error("support-desk /api/reports: missing reports array");
    }
    for (const r of reports) {
      if (isReport(r)) all.push(r);
      else console.warn("support-desk: skipping malformed report", r);
    }
    if (reports.length < PAGE_SIZE) break;
  }
  return all;
}

/**
 * Status-only update. Deliberately cannot set `adminMessage`, which may be
 * delivered to the user in-app — reply sending is not enabled yet.
 */
export async function updateReportStatus(
  id: string,
  status: SupportDeskStatus,
): Promise<SupportDeskReport> {
  const path = `/api/reports/${encodeURIComponent(id)}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`support-desk PUT ${path}: HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  if (
    !isRecord(body) ||
    body.success !== true ||
    !isReport(body.report) ||
    body.report.status !== status
  ) {
    throw new Error(`support-desk PUT ${path}: status was not updated`);
  }
  return body.report;
}

export async function fetchApps(): Promise<SupportDeskApp[]> {
  const body = await getJson("/api/apps");
  const apps = Array.isArray(body.apps) ? body.apps : [];
  return apps.filter(
    (a): a is SupportDeskApp =>
      isRecord(a) && typeof a.id === "string" && typeof a.name === "string",
  );
}

export async function fetchCategories(): Promise<SupportDeskCategory[]> {
  const body = await getJson("/api/categories");
  const categories = Array.isArray(body.categories) ? body.categories : [];
  return categories.filter(
    (c): c is SupportDeskCategory =>
      isRecord(c) && typeof c.id === "number" && typeof c.title === "string",
  );
}
