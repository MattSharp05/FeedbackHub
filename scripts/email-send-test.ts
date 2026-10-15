// Sends one test email from a support mailbox to an address you choose, to
// check sending works before replying to customers. Run:
//   npm run email:send-test -- --to=you@example.com [--mailbox=support@example.com]
import nodemailer from "nodemailer";
import { accounts } from "../server/email.js";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const to = arg("to");
const wanted = arg("mailbox")?.toLowerCase();
const account = wanted ? accounts.find((a) => a.user === wanted) : accounts[0];
if (!to || !to.includes("@")) {
  console.error("Say where to send it: npm run email:send-test -- --to=you@example.com");
  process.exit(1);
}
if (!account) {
  console.error(wanted ? `${wanted} isn't in EMAIL_ACCOUNTS.` : "Add EMAIL_ACCOUNTS to .env.local first.");
  process.exit(1);
}

const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: account });
await transport.sendMail({
  from: { name: "Feedback Hub test", address: account.user },
  to,
  subject: "Feedback Hub sending test",
  text: `This is a test from Feedback Hub, sent from ${account.user}. If you can read this, reply sending works.`,
});
console.log(`Sent a test email from ${account.user} to ${to}. Check that inbox (and spam).`);
