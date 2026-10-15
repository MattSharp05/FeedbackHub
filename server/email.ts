import { ImapFlow, type MessageStructureObject } from "imapflow";
import type { FeedbackRequest } from "../src/types.js";
import { isFeedback, mapEmail, type RawEmail } from "../src/data/email/mapEmail.js";

interface MailAccount {
  user: string;
  pass: string;
}

// EMAIL_ACCOUNTS: "support@a.com:apppassword,support@b.com:apppassword"
// (commas or new lines between entries). Google shows app passwords with
// spaces; those are dropped.
export function parseAccounts(value: string | undefined): MailAccount[] {
  return (value ?? "")
    .split(/[,\n]/)
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

interface TextPart {
  part: string;
  html: boolean;
  encoding: string;
  charset: string;
}

function findNode(node: MessageStructureObject, type: string): MessageStructureObject | undefined {
  if (node.type === type) return node;
  for (const child of node.childNodes ?? []) {
    const found = findNode(child, type);
    if (found) return found;
  }
  return undefined;
}

/** The part holding the readable text: plain text, else HTML. */
function findText(structure: MessageStructureObject): TextPart | undefined {
  const plain = findNode(structure, "text/plain");
  const node = plain ?? findNode(structure, "text/html");
  if (!node) return undefined;
  return {
    part: node.part ?? "1",
    html: !plain,
    encoding: (node.encoding ?? "7bit").toLowerCase(),
    charset: node.parameters?.charset ?? "utf-8",
  };
}

function decodeQuotedPrintable(text: string): Buffer {
  const s = text.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const hex = s.slice(i + 1, i + 3);
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

// Body parts arrive still transfer-encoded (Gmail doesn't decode them).
function decodePart(raw: Buffer, text: TextPart, alreadyDecoded: boolean): string {
  let bytes = raw;
  if (!alreadyDecoded && text.encoding === "base64") {
    bytes = Buffer.from(raw.toString("latin1").replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
  } else if (!alreadyDecoded && text.encoding === "quoted-printable") {
    bytes = decodeQuotedPrintable(raw.toString("latin1"));
  }
  try {
    return new TextDecoder(text.charset).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
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

      const candidates: {
        uid: number;
        date: string;
        from: string;
        subject: string;
        text?: TextPart;
        messageId?: string;
      }[] = [];
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
          text: msg.bodyStructure ? findText(msg.bodyStructure) : undefined,
          messageId: msg.envelope?.messageId,
        });
      }

      // One batched fetch per body-part id instead of a round trip per email.
      const bodies = new Map<number, string>();
      const byPart = new Map<string, typeof candidates>();
      for (const c of candidates) {
        if (!c.text) continue;
        byPart.set(c.text.part, [...(byPart.get(c.text.part) ?? []), c]);
      }
      for (const [part, group] of byPart) {
        const uids = group.map((c) => c.uid);
        for await (const msg of client.fetch(
          uids.join(","),
          { bodyParts: [{ key: part, maxLength: MAX_BODY_BYTES }] },
          { uid: true },
        )) {
          const c = group.find((g) => g.uid === msg.uid);
          const raw = msg.bodyParts ? [...msg.bodyParts.values()][0] : undefined;
          if (!c?.text || !raw) continue;
          const decoded = decodePart(raw, c.text, (msg.binaryParts?.size ?? 0) > 0);
          bodies.set(msg.uid, c.text.html ? htmlToText(decoded) : decoded);
        }
      }

      const emails: RawEmail[] = candidates.map((c) => ({
        id: c.messageId || `${account.user}:${c.uid}`,
        mailbox: account.user,
        date: c.date,
        fromAddress: c.from,
        subject: c.subject,
        text: bodies.get(c.uid) ?? "",
      }));
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
