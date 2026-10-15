import type { FeedbackRequest, RequestStatus } from "../../types.js";
import { categoryHint } from "../inAppCategory.js";
import type { SupportDeskReport, SupportDeskStatus } from "./client.js";


const STATUS_MAP: Record<SupportDeskStatus, RequestStatus> = {
  pending: "new",
  resolved: "resolved",
  rejected: "rejected",
};

/** Our status → support-desk's coarser lifecycle (approval etc. stay pending). */
export function toSupportDeskStatus(status: RequestStatus): SupportDeskStatus {
  switch (status) {
    case "resolved":
    case "sent":
    case "auto-handled":
      return "resolved";
    case "rejected":
      return "rejected";
    default:
      return "pending";
  }
}

export function mapReport(
  report: SupportDeskReport,
  appNameById: ReadonlyMap<string, string>,
  categoryTitleById: ReadonlyMap<number, string>,
): FeedbackRequest {
  const createdMs = Date.parse(report.createdAt);
  return {
    id: report.id,
    app: appNameById.get(report.appId) ?? report.appId,
    source: "chat",
    category: categoryHint(
      report.categoryId === null
        ? undefined
        : categoryTitleById.get(report.categoryId),
    ),
    // The read API does not return language, country, or device model.
    lang: "EN",
    country: "—",
    device: null,
    appVersion: report.appVersion,
    screen: report.screenName || null,
    message: report.content,
    translation: null,
    draft: "",
    draftTranslation: null,
    action: "",
    confidence: 0,
    status: STATUS_MAP[report.status],
    ageMin: Number.isNaN(createdMs)
      ? 0
      : Math.max(0, Math.round((Date.now() - createdMs) / 60_000)),
    replyEmail: report.email,
  };
}
