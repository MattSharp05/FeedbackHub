import { Star, Mail, MessageSquare } from "lucide-react";
import type {
  SourceKey,
  CategoryKey,
  RequestStatus,
  SourceMeta,
  CategoryMeta,
  StatusMeta,
  AutomationConfig,
} from "@/types";

/** Language-code → display name, for the "translated from ___" label. */
export const LANGUAGES: Record<string, string> = {
  EN: "English",
  ES: "Spanish",
  JA: "Japanese",
  FR: "French",
  DE: "German",
  PT: "Portuguese",
};

export const langName = (code: string): string => LANGUAGES[code] ?? code;

export const SOURCES: Record<SourceKey, SourceMeta> = {
  appstore: {
    label: "App Store",
    icon: Star,
    color: "#E8A33D",
    sendLabel: "Approve & post response",
    deliverVia: "App Store developer response",
    note: "Public reply · one response per review",
    live: true,
  },
  email: {
    label: "Email",
    icon: Mail,
    color: "#5B8DEF",
    sendLabel: "Approve & send email",
    deliverVia: "Email reply to the user",
    note: null,
    live: false,
  },
  chat: {
    label: "In-app chat",
    icon: MessageSquare,
    color: "#7B61FF",
    sendLabel: "Approve & send reply",
    deliverVia: "In-app chat reply",
    note: null,
    live: true,
  },
};

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  cancel: { label: "Cancellation", tone: "#C2410C", bg: "#FDEAD9" },
  refund: { label: "Refund", tone: "#B91C1C", bg: "#FBE3E3" },
  unsubscribe: { label: "Unsubscribe", tone: "#A16207", bg: "#FAF0D7" },
  billing: { label: "Billing", tone: "#7C3AED", bg: "#F0E9FB" },
  bug: { label: "Bug report", tone: "#1D4ED8", bg: "#E5ECFB" },
  feature: { label: "Feature request", tone: "#0F766E", bg: "#DBF1EE" },
  praise: { label: "Praise", tone: "#15803D", bg: "#E2F3E8" },
  other: { label: "Other", tone: "#57534E", bg: "#EEECEA" },
};

export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  new: { label: "New", color: "#B45309", dot: "#F59E0B" },
  drafted: { label: "Draft ready", color: "#1D4ED8", dot: "#3B82F6" },
  approved: { label: "Approved", color: "#15803D", dot: "#22C55E" },
  sent: { label: "Sent", color: "#57534E", dot: "#A8A29E" },
  "auto-handled": { label: "Auto-handled", color: "#0F766E", dot: "#14B8A6" },
};

// Trust mode per category: draft | approve | auto
export const DEFAULT_AUTOMATION: AutomationConfig = {
  cancel: "approve",
  refund: "approve",
  unsubscribe: "auto",
  billing: "approve",
  bug: "draft",
  feature: "draft",
  praise: "auto",
  other: "draft",
};

export const APPS: string[] = [
  "Gmoji",
  "Emojify",
  "Dynamic Lyrics",
  "Lyrix",
  "OJO",
  "Beam",
  "radcam",
  "Contraction Timer",
  "Baby Tracker",
  "2nd Phone Number",
  "AR Drawing",
  "Meal Planner",
  "Manifestation GPT",
  "Reverse Singing",
  "To Do App",
  "Lightning Tracker",
  "Spice it",
  "Flash Cards",
  "Invoice Maker",
  "Manga Infinity",
  "Manga Reader",
  "Hey Coach",
  "playground",
  "talkz",
  "VR 360",
  "Water Eject",
  "Screen Recorder",
  "Dog Translator",
  "Roomify",
  "CalPal",
];

// Deterministic color per app for the letter tile.
const TILE_COLORS = [
  "#E8734A",
  "#5B8DEF",
  "#34A853",
  "#9C5BEF",
  "#E84A7F",
  "#0FB5BA",
  "#E8A33D",
  "#6366F1",
  "#D9488A",
  "#2DA44E",
];

export function tileColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % TILE_COLORS.length;
  }
  return TILE_COLORS[h];
}
