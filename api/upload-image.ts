// Vercel Serverless Function handler for /api/upload-image
export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    try {
      const { dataUrl } = req.body || {};
      if (!dataUrl) {
        return res.status(400).json({ error: "Missing dataUrl" });
      }
      // On serverless read-only environments where local disk isn't persistent,
      // return back the optimized dataUrl or confirmation
      return res.status(200).json({
        ok: true,
        url: dataUrl,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
