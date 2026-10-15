import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { accounts, decodePart, findText, htmlToText } from "./email.js";
import { parseContactForm, parseInAppReport } from "../src/data/email/mapEmail.js";

/** The email being answered, as found in the support mailbox. */
export interface OriginalEmail {
  messageId: string;
  subject: string;
  from: string;
  replyTo: string | null;
  references: string | null;
  text: string;
}

export interface ReplyEnvelope {
  to: string;
  subject: string;
  inReplyTo?: string;
  references?: string;
  fromName: string;
}

/**
 * Who a reply goes to and how it threads. Automated in-app reports and
 * website contact-form notifications go to the customer they name, as a fresh
 * email (their notification thread is internal); a customer email is answered
 * in its own thread.
 */
export function composeReply(original: OriginalEmail): ReplyEnvelope {
  const report = parseInAppReport(original.subject);
  if (report) {
    return {
      to: report.customer,
      subject: `Your ${report.app} support request`,
      fromName: `${report.app} Support`,
    };
  }
  const form = parseContactForm(original.subject, original.text);
  if (form) {
    return {
      to: form.customer,
      subject: `Your message to ${form.site}`,
      fromName: "Support",
    };
  }
  const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`;
  return {
    to: original.replyTo ?? original.from,
    subject,
    inReplyTo: original.messageId,
    references: [original.references, original.messageId].filter(Boolean).join(" "),
    fromName: "Support",
  };
}

async function findOriginal(
  account: { user: string; pass: string },
  messageId: string,
): Promise<OriginalEmail | null> {
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
      const uids = (await client.search({ header: { "message-id": messageId } }, { uid: true })) || [];
      if (uids.length === 0) return null;
      const uid = String(uids[uids.length - 1]);
      const msg = await client.fetchOne(
        uid,
        { envelope: true, bodyStructure: true, headers: ["references"] },
        { uid: true },
      );
      if (!msg || !msg.envelope) return null;
      const references = msg.headers?.toString().replace(/^references:\s*/i, "").replace(/\s+/g, " ").trim();
      // The body is needed to find the customer in contact-form notifications.
      let text = "";
      const part = msg.bodyStructure ? findText(msg.bodyStructure) : undefined;
      if (part) {
        const withBody = await client.fetchOne(
          uid,
          { bodyParts: [{ key: part.part, maxLength: 20_000 }] },
          { uid: true },
        );
        const raw = withBody && withBody.bodyParts ? [...withBody.bodyParts.values()][0] : undefined;
        if (withBody && raw) {
          const decoded = decodePart(raw, part, (withBody.binaryParts?.size ?? 0) > 0);
          text = part.html ? htmlToText(decoded) : decoded;
        }
      }
      return {
        messageId: msg.envelope.messageId ?? messageId,
        subject: msg.envelope.subject ?? "",
        from: msg.envelope.from?.[0]?.address ?? "",
        replyTo: msg.envelope.replyTo?.[0]?.address ?? null,
        references: references || null,
        text,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export class ReplyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Send `body` as a reply to the email with `messageId` in `mailbox`. The
 * recipient always comes from that email, never from the caller.
 */
export async function sendReply(mailbox: string, messageId: string, body: string) {
  const account = accounts.find((a) => a.user === mailbox.toLowerCase());
  if (!account) throw new ReplyError(`${mailbox} isn't a configured support mailbox`, 400);

  const original = await findOriginal(account, messageId);
  if (!original) throw new ReplyError("The original email is no longer in that inbox", 404);

  const envelope = composeReply(original);
  if (!envelope.to) throw new ReplyError("The original email has no reply address", 422);

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: account,
  });
  await transport.sendMail({
    from: { name: envelope.fromName, address: account.user },
    to: envelope.to,
    subject: envelope.subject,
    text: body,
    inReplyTo: envelope.inReplyTo,
    references: envelope.references,
  });
  return { to: envelope.to, from: account.user };
}
