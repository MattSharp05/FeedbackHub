import type { FeedbackRequest } from "@/types";

/** Browser entry point: the server reads the mailboxes; the page asks once. */
export async function loadEmailRequests(): Promise<{ requests: FeedbackRequest[]; warning?: string }> {
  const res = await fetch("/api/email-requests");
  if (res.status === 503) {
    return { requests: [], warning: "Email isn't set up yet — add EMAIL_ACCOUNTS in Vercel." };
  }
  if (!res.ok) throw new Error(`/api/email-requests: HTTP ${res.status}`);
  const { requests, failedMailboxes } = (await res.json()) as {
    requests: FeedbackRequest[];
    failedMailboxes: string[];
  };
  return {
    requests,
    warning:
      failedMailboxes.length > 0
        ? `Couldn't read ${failedMailboxes.join(", ")} — check its app password.`
        : undefined,
  };
}

/** Send an approved reply; the server picks the recipient from the original email. */
export async function sendEmailReply(
  id: string,
  mailbox: string,
  text: string,
): Promise<{ to: string; recorded: boolean }> {
  const res = await fetch("/api/send-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, mailbox, text }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; to?: string; recorded?: boolean };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return { to: data.to ?? "", recorded: data.recorded ?? true };
}
