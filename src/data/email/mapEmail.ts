import type { FeedbackRequest } from "../../types.js";
import { APPS } from "../apps.js";
import { categoryHint } from "../inAppCategory.js";

/** An email as read from a support mailbox. */
export interface RawEmail {
  id: string;
  /** The support mailbox it arrived in. */
  mailbox: string;
  date: string;
  fromAddress: string;
  subject: string;
  text: string;
}

// Which portfolio apps each support mailbox serves, inferred from the App
// Store developer accounts and the support-desk app registry. Mailboxes not
// listed (gmoji.app, appoftheyear.net) are matched against every app.
const MAILBOX_APPS: Record<string, string[]> = {
  "titanotechnology.com": ["Lyrix", "Beam", "OJO", "Roomify", "Hey Coach", "Invoice Maker"],
  "goingmerry.xyz": [
    "radcam",
    "Contraction Timer",
    "2nd Phone Number",
    "Flash Cards",
    "AR Drawing",
    "Lightning Tracker",
    "Reverse Singing",
    "Manifestation GPT",
    "Baby Tracker",
  ],
  "appwingsltd.com": ["Emojify", "Spice it"],
  "barbarossaapps.com": ["Water Eject"],
  "blackbeardtreasure.org": ["VR 360"],
  "sevenseasapps.com": ["Manga Infinity"],
};

export const UNKNOWN_APP = "Unknown app";

// Automated in-app report notifications: "📱 Lyrix - Report a bug - user@example.com".
const IN_APP_REPORT = /^📱\s*(.+?)\s+-\s+(.+?)\s+-\s+(\S+@\S+)\s*$/u;

export function parseInAppReport(subject: string): { app: string; category: string; customer: string } | null {
  const m = subject.match(IN_APP_REPORT);
  return m ? { app: canonicalApp(m[1]), category: m[2], customer: m[3] } : null;
}

// Website contact-form notifications: subject `New message from "site"`, body
// "Name: … Email: customer@… Message: …". The customer is the Email field, not
// the sender.
const CONTACT_FORM_SUBJECT = /^New message from\s+"?([^"]+?)"?\s*$/i;

export function parseContactForm(
  subject: string,
  text: string,
): { site: string; customer: string; message: string } | null {
  const site = subject.match(CONTACT_FORM_SUBJECT)?.[1];
  const customer = text.match(/^\s*E-?mail:\s*<?([^\s<>]+@[^\s<>]+?)>?\s*$/im)?.[1];
  if (!site || !customer) return null;
  const message = text.match(/(?:^|\n)\s*Message:\s*([\s\S]*?)(?:\n\s*-{2,}[\s\S]*)?$/i)?.[1]?.trim();
  return { site, customer, message: message || text.trim() };
}

const SKIP_SENDER_LOCAL = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|notifications?|alerts?)\b/i;
const SKIP_SENDER_DOMAINS = [
  "google.com",
  "apple.com",
  "apphud.com",
  "revenuecat.com",
  "vercel.com",
  "github.com",
  "slack.com",
  "stripe.com",
];

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Whether an email is customer feedback, judged from its envelope alone. */
export function isFeedback(email: Pick<RawEmail, "mailbox" | "fromAddress" | "subject">): boolean {
  if (IN_APP_REPORT.test(email.subject)) return true;
  const from = email.fromAddress.toLowerCase();
  if (!from || from === email.mailbox) return false;
  if (SKIP_SENDER_LOCAL.test(from.split("@")[0])) return false;
  const domain = domainOf(from);
  return !SKIP_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function canonicalApp(name: string): string {
  const key = nameKey(name);
  return APPS.find((a) => nameKey(a) === key) ?? name.trim();
}

/** The app named in the text, preferring the mailbox's own apps. */
function attributeApp(mailbox: string, text: string): string {
  const candidates = MAILBOX_APPS[domainOf(mailbox)] ?? APPS;
  if (candidates.length === 1) return candidates[0];
  const lower = text.toLowerCase();
  let best: { app: string; at: number } | null = null;
  for (const app of candidates) {
    const escaped = app.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const at = lower.search(new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`));
    if (at >= 0 && (!best || at < best.at)) best = { app, at };
  }
  return best?.app ?? UNKNOWN_APP;
}

// Keep the customer's own words: drop quoted earlier messages in a thread.
const QUOTED_HISTORY = /\n\s*(On .{0,200}wrote:|-{2,}\s*Original Message\s*-{2,}|From: .+\nSent: )[\s\S]*$/i;
const MAX_MESSAGE_CHARS = 6000;

function cleanBody(text: string): string {
  return text.replace(QUOTED_HISTORY, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_MESSAGE_CHARS);
}

export function mapEmail(email: RawEmail): FeedbackRequest {
  const dateMs = Date.parse(email.date);
  const body = cleanBody(email.text);
  const report = parseInAppReport(email.subject);
  const base = {
    id: `email:${email.id}`,
    mailbox: email.mailbox,
    lang: "—",
    country: "—",
    device: null,
    appVersion: "—",
    screen: null,
    translation: null,
    draft: "",
    draftTranslation: null,
    action: "",
    confidence: 0,
    status: "new" as const,
    ageMin: Number.isNaN(dateMs) ? 0 : Math.max(0, Math.round((Date.now() - dateMs) / 60_000)),
  };
  if (report) {
    return {
      ...base,
      app: report.app,
      source: "chat",
      category: categoryHint(report.category),
      message: body || report.category,
      replyEmail: report.customer,
    };
  }
  const form = parseContactForm(email.subject, body);
  if (form) {
    return {
      ...base,
      app: attributeApp(email.mailbox, `${form.site}\n${form.message}`),
      source: "email",
      category: "other",
      message: form.message,
      replyEmail: form.customer,
    };
  }
  return {
    ...base,
    app: attributeApp(email.mailbox, `${email.subject}\n${body}`),
    source: "email",
    category: "other",
    message: email.subject ? `${email.subject} — ${body}` : body,
    replyEmail: email.fromAddress,
  };
}
