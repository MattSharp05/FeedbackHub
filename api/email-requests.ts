import { accounts, fetchEmailRequests } from "../server/email.js";

// Edge-cached so the mailboxes are read at most every 15 minutes per region.
export async function GET(): Promise<Response> {
  if (accounts.length === 0) {
    return Response.json({ error: "EMAIL_ACCOUNTS is not set" }, { status: 503 });
  }
  try {
    const result = await fetchEmailRequests();
    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
