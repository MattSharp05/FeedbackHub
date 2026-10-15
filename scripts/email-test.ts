// Checks email access for one mailbox by listing its 10 most recent emails.
// Put EMAIL_USER and EMAIL_APP_PASSWORD in .env.local, then run:
//   npm run email:test
// Add `-- --sample` to also print the body of the newest automated in-app
// report (subject starting with 📱).
import { ImapFlow, type MessageStructureObject } from "imapflow";

const showSample = process.argv.includes("--sample");

function findPart(node: MessageStructureObject, type: string): string | undefined {
  if (node.type === type) return node.part ?? "1";
  for (const child of node.childNodes ?? []) {
    const found = findPart(child, type);
    if (found) return found;
  }
  return undefined;
}

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_APP_PASSWORD;
if (!user || !pass) {
  console.error("Add EMAIL_USER and EMAIL_APP_PASSWORD to .env.local first.");
  process.exit(1);
}

const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: { user, pass },
  logger: false,
});

try {
  await client.connect();
} catch (err) {
  const e = err as { responseText?: string; message: string };
  console.error(`Google refused the login for ${user}: ${e.responseText ?? e.message}`);
  console.error(
    "Google doesn't accept an account's normal password from apps. Create an app password " +
      "(myaccount.google.com → Security → 2-Step Verification on → App passwords) and use that.",
  );
  process.exit(1);
}

const lock = await client.getMailboxLock("INBOX");
try {
  const total = client.mailbox ? client.mailbox.exists : 0;
  console.log(`Connected to ${user}: ${total} emails in the inbox.`);
  if (total > 0) {
    console.log("Most recent 10:");
    let sampleUid: number | undefined;
    for await (const msg of client.fetch(`${Math.max(1, total - 9)}:*`, { envelope: true })) {
      const date = msg.envelope?.date ? new Date(msg.envelope.date).toISOString().slice(0, 10) : "?";
      const from = msg.envelope?.from?.[0]?.address ?? "?";
      console.log(`  ${date}  ${from}  ${msg.envelope?.subject ?? "(no subject)"}`);
      if (msg.envelope?.subject?.startsWith("📱")) sampleUid = msg.uid;
    }
    if (showSample && sampleUid !== undefined) {
      const uid = String(sampleUid);
      const msg = await client.fetchOne(uid, { bodyStructure: true }, { uid: true });
      const structure = msg ? msg.bodyStructure : undefined;
      const part = structure && (findPart(structure, "text/plain") ?? findPart(structure, "text/html"));
      const download = part ? await client.download(uid, part, { uid: true }) : undefined;
      if (download?.content) {
        let body = "";
        for await (const chunk of download.content) body += chunk.toString();
        const text = body
          .replace(/<(br|\/p|\/div|\/tr)[^>]*>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/[ \t]+/g, " ")
          .replace(/\n\s*\n+/g, "\n");
        console.log("\nNewest in-app report email body:\n" + text.trim().slice(0, 2000));
      } else {
        console.log("\nCouldn't read a body for the newest in-app report email.");
      }
    }
  }
} finally {
  lock.release();
  await client.logout();
}
