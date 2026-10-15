import { accounts } from "../server/email.js";
import { ReplyError, sendReply } from "../server/email-reply.js";
import { db, loadStatus, saveStatus } from "../server/db.js";

const MAX_TEXT_CHARS = 10_000;

/** Send an approved reply to an email-sourced item, from its support mailbox. */
export async function POST(request: Request): Promise<Response> {
  if (accounts.length === 0) {
    return Response.json({ error: "EMAIL_ACCOUNTS is not set" }, { status: 503 });
  }
  const body: unknown = await request.json().catch(() => null);
  const { id, mailbox, text } = (body ?? {}) as { id?: unknown; mailbox?: unknown; text?: unknown };
  if (
    typeof id !== "string" ||
    !id.startsWith("email:") ||
    id.length > 1000 ||
    typeof mailbox !== "string" ||
    typeof text !== "string" ||
    text.trim() === "" ||
    text.length > MAX_TEXT_CHARS
  ) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  try {
    if (db && (await loadStatus(db, id)) === "sent") {
      return Response.json({ error: "A reply was already sent for this item" }, { status: 409 });
    }
    const result = await sendReply(mailbox, id.slice("email:".length), text);
    // The email is out; failing to record that must not look like a failed send.
    let recorded = true;
    if (db) {
      try {
        await saveStatus(db, id, "sent");
      } catch (err) {
        console.error(`send-reply: sent ${id} but couldn't save its status`, err);
        recorded = false;
      }
    }
    return Response.json({ ...result, recorded });
  } catch (err) {
    if (err instanceof ReplyError) return Response.json({ error: err.message }, { status: err.status });
    console.error("send-reply failed", err);
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
