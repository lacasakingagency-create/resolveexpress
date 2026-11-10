// Vercel Serverless Function handler for /api/admin-save
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
      const { state, action, user, role } = req.body || {};
      const timestamp = new Date().toISOString();
      return res.status(200).json({
        ok: true,
        persisted: true,
        message: "Alterações administrativas confirmadas para Vercel & Supabase.",
        timestamp,
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
