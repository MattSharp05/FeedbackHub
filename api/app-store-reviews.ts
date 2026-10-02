import { fetchAppStoreRequests } from "../src/data/appStore/index.js";

// Cached at Vercel's edge so Apple sees one fan-out per cache window, not one
// per page load; partial (rate-limited) results are cached only briefly.
export async function GET(): Promise<Response> {
  try {
    const result = await fetchAppStoreRequests();
    const maxAge = result.failedFeeds > 0 ? 600 : 3600;
    return Response.json(result, {
      headers: {
        "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=86400`,
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
