// Runs the full email ingestion locally and prints what the dashboard would
// show. Put EMAIL_ACCOUNTS in .env.local, then run: npm run email:check
import { accounts, fetchEmailRequests } from "../server/email.js";

if (accounts.length === 0) {
  console.error('Add EMAIL_ACCOUNTS to .env.local, e.g. EMAIL_ACCOUNTS=support@a.com:code1,support@b.com:code2');
  process.exit(1);
}
console.log(`Reading ${accounts.length} mailbox(es): ${accounts.map((a) => a.user).join(", ")}…`);
const started = Date.now();
const { requests, failedMailboxes } = await fetchEmailRequests();
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
if (failedMailboxes.length) console.log(`Couldn't read: ${failedMailboxes.join(", ")}`);

const count = (pred: (q: (typeof requests)[number]) => boolean) => requests.filter(pred).length;
console.log(`\n${requests.length} feedback items (newest 50 per mailbox, last 30 days):`);
console.log(`  in-app reports (📱 notifications): ${count((q) => q.source === "chat")}`);
console.log(`  direct customer emails:           ${count((q) => q.source === "email")}`);
console.log(`  not matched to an app:            ${count((q) => q.app === "Unknown app")}`);

const byApp = new Map<string, number>();
for (const q of requests) byApp.set(q.app, (byApp.get(q.app) ?? 0) + 1);
console.log("\nBy app:");
for (const [app, n] of [...byApp].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${app}`);

console.log("\nNewest 5 (subject / start of message only):");
for (const q of [...requests].sort((a, b) => a.ageMin - b.ageMin).slice(0, 5)) {
  console.log(`  [${q.source === "chat" ? "in-app" : "email"}] ${q.app} · ${q.category} · ${q.message.replace(/\s+/g, " ").slice(0, 90)}`);
}
