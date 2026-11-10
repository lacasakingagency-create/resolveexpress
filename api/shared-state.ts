// Vercel Serverless Function handler for /api/shared-state
let inMemorySharedState: any = null;

export default function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      state: inMemorySharedState || null,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === "POST") {
    try {
      const { state } = req.body || {};
      if (state && typeof state === "object") {
        inMemorySharedState = {
          ...(inMemorySharedState || {}),
          ...state,
          _lastUpdatedByAdmin: new Date().toISOString(),
        };
      }
      return res.status(200).json({
        ok: true,
        message: "Shared state updated",
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
