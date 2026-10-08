// Checks email access for one mailbox by listing its 10 most recent emails.
// Put EMAIL_USER and EMAIL_APP_PASSWORD in .env.local, then run:
//   npm run email:test
import { ImapFlow } from "imapflow";

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
    for await (const msg of client.fetch(`${Math.max(1, total - 9)}:*`, { envelope: true })) {
      const date = msg.envelope?.date ? new Date(msg.envelope.date).toISOString().slice(0, 10) : "?";
      const from = msg.envelope?.from?.[0]?.address ?? "?";
      console.log(`  ${date}  ${from}  ${msg.envelope?.subject ?? "(no subject)"}`);
    }
  }
} finally {
  lock.release();
  await client.logout();
}
