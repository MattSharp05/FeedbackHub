import { ImapFlow, type MessageStructureObject } from "imapflow";
import type { FeedbackRequest } from "../src/types.js";
import { isFeedback, mapEmail, type RawEmail } from "../src/data/email/mapEmail.js";

interface MailAccount {
  user: string;
  pass: string;
}

// EMAIL_ACCOUNTS: "support@a.com:apppassword,support@b.com:apppassword".
// Google shows app passwords with spaces; those are dropped.
export function parseAccounts(value: string | undefined): MailAccount[] {
  return (value ?? "")
    .split(",")
    .map((entry) => {
      const i = entry.indexOf(":");
      return {
        user: entry.slice(0, i).trim().toLowerCase(),
        pass: entry.slice(i + 1).replace(/\s+/g, ""),
      };
    })
    .filter((a) => a.user.includes("@") && a.pass.length > 0);
}

export const accounts = parseAccounts(process.env.EMAIL_ACCOUNTS);

const MAX_AGE_DAYS = 30;
const MAX_PER_MAILBOX = 50;
const MAX_BODY_BYTES = 20_000;

function findPart(node: MessageStructureObject, type: string): string | undefined {
  if (node.type === type) return node.part ?? "1";
  for (const child of node.childNodes ?? []) {
    const found = findPart(child, type);
    if (found) return found;
  }
  return undefined;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(br|\/p|\/div|\/tr|\/li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n");
}

/** Recent customer emails from one inbox. Read-only: nothing is marked or moved. */
async function readMailbox(account: MailAccount): Promise<RawEmail[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: account,
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const since = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
      const uids = (await client.search({ since }, { uid: true })) || [];
      const recent = uids.slice(-MAX_PER_MAILBOX);
      if (recent.length === 0) return [];

      const candidates: { uid: number; date: string; from: string; subject: string; structure?: MessageStructureObject; messageId?: string }[] = [];
      for await (const msg of client.fetch(recent.join(","), { envelope: true, bodyStructure: true }, { uid: true })) {
        const email = {
          mailbox: account.user,
          fromAddress: msg.envelope?.from?.[0]?.address ?? "",
          subject: msg.envelope?.subject ?? "",
        };
        if (!isFeedback(email)) continue;
        candidates.push({
          uid: msg.uid,
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : "",
          from: email.fromAddress,
          subject: email.subject,
          structure: msg.bodyStructure,
          messageId: msg.envelope?.messageId,
        });
      }

      const emails: RawEmail[] = [];
      for (const c of candidates) {
        const plain = c.structure && findPart(c.structure, "text/plain");
        const html = !plain && c.structure ? findPart(c.structure, "text/html") : undefined;
        let text = "";
        const part = plain ?? html;
        if (part) {
          const download = await client.download(String(c.uid), part, { uid: true, maxBytes: MAX_BODY_BYTES });
          if (download.content) {
            for await (const chunk of download.content) text += chunk.toString();
          }
        }
        emails.push({
          id: c.messageId || `${account.user}:${c.uid}`,
          mailbox: account.user,
          date: c.date,
          fromAddress: c.from,
          subject: c.subject,
          text: html ? htmlToText(text) : text,
        });
      }
      return emails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export interface EmailResult {
  requests: FeedbackRequest[];
  /** Mailboxes that couldn't be read (e.g. a revoked app password). */
  failedMailboxes: string[];
  totalMailboxes: number;
}

async function readAll(): Promise<EmailResult> {
  const results = await Promise.allSettled(accounts.map(readMailbox));
  const failedMailboxes: string[] = [];
  const byId = new Map<string, FeedbackRequest>();
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`email: couldn't read ${accounts[i].user}`, r.reason);
      failedMailboxes.push(accounts[i].user);
      return;
    }
    for (const email of r.value) {
      const request = mapEmail(email);
      byId.set(request.id, request);
    }
  });
  if (failedMailboxes.length === accounts.length && accounts.length > 0) {
    throw new Error("email: no mailbox could be read");
  }
  return { requests: [...byId.values()], failedMailboxes, totalMailboxes: accounts.length };
}

const CACHE_MS = 10 * 60 * 1000;
let cache: { expiresAt: number; result: Promise<EmailResult> } | null = null;

/** Customer feedback from every configured mailbox, cached in-process. */
export function fetchEmailRequests(): Promise<EmailResult> {
  if (!cache || Date.now() > cache.expiresAt) {
    const entry = { expiresAt: Date.now() + CACHE_MS, result: readAll() };
    cache = entry;
    entry.result.catch(() => {
      if (cache === entry) cache = null;
    });
  }
  return cache.result;
}
