import type { LucideIcon } from "lucide-react";

export type SourceKey = "appstore" | "email" | "chat";

export type CategoryKey =
  | "cancel"
  | "refund"
  | "unsubscribe"
  | "billing"
  | "bug"
  | "feature"
  | "praise"
  | "other";

export type TrustMode = "draft" | "approve" | "auto";

export type RequestStatus =
  | "new"
  | "drafted"
  | "approved"
  | "sent"
  | "auto-handled";

export type View = "overview" | "queue" | "automation";

export interface SourceMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  /** Label shown on the primary send button in the detail drawer. */
  sendLabel: string;
  /** Human description of where the reply is delivered. */
  deliverVia: string;
  /** Optional caution note (e.g. App Store replies are public). */
  note: string | null;
}

export interface CategoryMeta {
  label: string;
  tone: string;
  bg: string;
}

export interface StatusMeta {
  label: string;
  color: string;
  dot: string;
}

export interface FeedbackRequest {
  id: number;
  app: string;
  source: SourceKey;
  category: CategoryKey;
  lang: string;
  country: string;
  device: string | null;
  appVersion: string;
  screen: string | null;
  message: string;
  /** English translation of `message` when the original is non-English; null otherwise. */
  translation: string | null;
  draft: string;
  /** English translation of `draft` when the reply is non-English; null otherwise. */
  draftTranslation: string | null;
  action: string;
  confidence: number;
  status: RequestStatus;
  ageMin: number;
}

export interface Insight {
  app: string;
  text: string;
  sev: "high" | "med" | "low";
  cat: CategoryKey;
}

export type AutomationConfig = Record<CategoryKey, TrustMode>;
