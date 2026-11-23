import {
  verifyRequestAuth,
  IMAGE_MGMT_DB_ROLES,
  extractPublicAssetStoragePath,
  setApiCorsHeaders,
} from "../_supabase.js";

function countUrlReferencesInObject(target: string, obj: any): number {
  if (!obj) return 0;
  let count = 0;
  const walk = (val: any) => {
    if (typeof val === "string") {
      if (val.trim() === target) count++;
    } else if (Array.isArray(val)) {
      for (const item of val) walk(item);
    } else if (val && typeof val === "object") {
      for (const k of Object.keys(val)) walk(val[k]);
    }
  };
  walk(obj);
  return count;
}

// Vercel Serverless Function handler for /api/storage/safe-replace-image
export default async function handler(req: any, res: any) {
  setApiCorsHeaders(res, "POST,OPTIONS", req);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await verifyRequestAuth(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }

    if (!IMAGE_MGMT_DB_ROLES.has(auth.dbRole)) {
      return res.status(403).json({
        ok: false,
        error: "Acesso negado: apenas administradores ou operação autorizada no Supabase podem remover ficheiros.",
      });
    }

    const { oldUrl, newUrl } = req.body || {};

    if (!oldUrl || typeof oldUrl !== "string" || !oldUrl.trim()) {
      return res.status(200).json({
        ok: true,
        deleted: false,
        message: "Nenhuma imagem antiga para remover.",
      });
    }

    const trimmedOld = oldUrl.trim();
    const trimmedNew = typeof newUrl === "string" ? newUrl.trim() : "";

    if (trimmedOld === trimmedNew) {
      return res.status(200).json({
        ok: true,
        deleted: false,
        message: "A nova imagem é idêntica à anterior.",
      });
    }

    // Security: never delete protected system/external assets
    if (
      trimmedOld.startsWith("/assets/") ||
      trimmedOld.includes("file_0000000077e8820eae7db33507894d75") ||
      trimmedOld.includes("images.unsplash.com")
    ) {
      return res.status(200).json({
        ok: true,
        deleted: false,
        reason: "asset_protected",
        message: "Ativo padrão do sistema preservado contra eliminação.",
      });
    }

    const { data: settingsRow } = await auth.supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", "global")
      .maybeSingle();

    const { count: prodRefCount } = await auth.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("image", trimmedOld);

    const settingsRefs = countUrlReferencesInObject(
      trimmedOld,
      settingsRow?.settings
    );
    const totalRefs = settingsRefs + (prodRefCount || 0);

    if (totalRefs > 0) {
      return res.status(200).json({
        ok: true,
        deleted: false,
        reason: "referenced_by_other_records",
        references: totalRefs,
        message: `Ficheiro antigo mantido porque ainda está referenciado em ${totalRefs} registo(s).`,
      });
    }

    const storagePath = extractPublicAssetStoragePath(trimmedOld);
    let deleted = false;
    if (storagePath) {
      const { error: rmErr } = await auth.supabase.storage
        .from("public-assets")
        .remove([storagePath]);
      if (rmErr) {
        return res.status(500).json({
          ok: false,
          error: `Falha ao remover ficheiro órfão do Storage: ${rmErr.message}`,
        });
      }
      await auth.supabase
        .from("platform_assets")
        .delete()
        .eq("bucket_id", "public-assets")
        .eq("storage_path", storagePath);
      deleted = true;
    }

    return res.status(200).json({
      ok: true,
      deleted,
      message: deleted
        ? "Imagem antiga órfã eliminada com segurança do Supabase Storage."
        : "Ficheiro externo não pertence ao bucket gerido public-assets.",
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Erro interno na verificação de substituição.",
    });
  }
}
