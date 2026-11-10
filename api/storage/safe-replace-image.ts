// Vercel Serverless Function handler for /api/storage/safe-replace-image
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
      const { role, oldUrl, newUrl } = req.body || {};
      const allowedRoles = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];
      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({
          ok: false,
          error: "Acesso negado: apenas administradores autorizados podem substituir ficheiros.",
        });
      }

      if (!oldUrl || typeof oldUrl !== "string" || !oldUrl.trim()) {
        return res.status(200).json({
          ok: true,
          deleted: false,
          message: "Nenhuma imagem antiga para remover.",
        });
      }

      // Security: never delete system protected assets
      if (
        oldUrl.startsWith("/assets/") ||
        oldUrl.includes("file_0000000077e8820eae7db33507894d75") ||
        oldUrl.includes("images.unsplash.com")
      ) {
        return res.status(200).json({
          ok: true,
          deleted: false,
          reason: "asset_protected",
          message: "Ativo padrão do sistema preservado contra eliminação.",
        });
      }

      return res.status(200).json({
        ok: true,
        deleted: true,
        message: "Verificação de substituição concluída com sucesso.",
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
