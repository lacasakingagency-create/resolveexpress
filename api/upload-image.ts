import path from "node:path";
import {
  verifyRequestAuth,
  STAFF_DB_ROLES,
  validateAndDecodeDataUrl,
  checkRateLimit,
  getClientIp,
  setApiCorsHeaders,
} from "./_supabase.js";

// Vercel Serverless Function handler for /api/upload-image
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

    const clientIp = getClientIp(req);
    if (!checkRateLimit(`upload:${auth.userId}:${clientIp}`, 30, 60_000)) {
      return res.status(429).json({
        ok: false,
        error: "Demasiados envios seguidos. Aguarde um momento antes de tentar novamente.",
      });
    }

    const { dataUrl, filename, purpose, category } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ ok: false, error: "Missing dataUrl" });
    }

    const targetPurpose =
      purpose === "payment-proof" ||
      purpose === "partner-document" ||
      purpose === "public-document" ||
      purpose === "admin-document"
        ? purpose
        : "public-asset";

    if (targetPurpose === "admin-document") {
      if (auth.dbRole !== "super_admin" && auth.dbRole !== "admin") {
        return res.status(403).json({
          ok: false,
          error:
            "Acesso negado: apenas administradores autorizados podem gerir documentos administrativos privados.",
        });
      }
    } else if (targetPurpose === "public-document") {
      if (!STAFF_DB_ROLES.has(auth.dbRole)) {
        return res.status(403).json({
          ok: false,
          error:
            "Acesso negado: apenas administradores e equipa autorizada podem publicar documentos públicos.",
        });
      }
    } else if (targetPurpose === "public-asset") {
      let allowedPublicAsset = STAFF_DB_ROLES.has(auth.dbRole);
      if (!allowedPublicAsset && (auth.dbRole === "empresa_parceira" || auth.dbRole === "vendedor")) {
        const { data: partnerProf } = await auth.supabase
          .from("partner_profiles")
          .select("is_verified")
          .eq("id", auth.userId)
          .maybeSingle();
        allowedPublicAsset = Boolean(partnerProf?.is_verified);
      }
      if (!allowedPublicAsset) {
        return res.status(403).json({
          ok: false,
          error: "Acesso negado: apenas administradores, equipa operacional ou parceiros verificados podem enviar ativos públicos.",
        });
      }
    }

    const validated = validateAndDecodeDataUrl(dataUrl, {
      allowPdf: targetPurpose !== "public-asset",
      maxBytes: 10 * 1024 * 1024,
    });
    if (!validated.ok) {
      return res.status(400).json({ ok: false, error: validated.error });
    }

    const bucket =
      targetPurpose === "payment-proof"
        ? "payment-proofs"
        : targetPurpose === "partner-document"
        ? "partner-documents"
        : targetPurpose === "admin-document"
        ? "admin-documents"
        : "public-assets";

    const safeBase = filename
      ? path
          .basename(String(filename))
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 32)
      : "file";
    const safeCategory =
      typeof category === "string"
        ? category.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "general"
        : "general";
    const rand = Math.random().toString(36).slice(2, 10);
    const storagePath =
      bucket === "public-assets" || bucket === "admin-documents"
        ? `super-admin/${auth.userId}/${safeCategory}/${Date.now()}_${rand}_${safeBase || "file"}.${validated.file.ext}`
        : bucket === "partner-documents"
        ? `${auth.userId}/documents/${Date.now()}_${rand}_${safeBase || "doc"}.${validated.file.ext}`
        : `${auth.userId}/${Date.now()}_${rand}_${safeBase || "doc"}.${validated.file.ext}`;

    const { error: uploadErr } = await auth.supabase.storage
      .from(bucket)
      .upload(storagePath, validated.file.buffer, {
        contentType: validated.file.mimeType,
        upsert: false,
        cacheControl: bucket === "public-assets" ? "3600" : "0",
      });

    if (uploadErr) {
      return res.status(500).json({
        ok: false,
        error: `Falha ao enviar para o Supabase Storage (${bucket}): ${uploadErr.message}`,
      });
    }

    if (bucket === "public-assets") {
      const { data: urlData } = auth.supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);
      return res.status(200).json({
        ok: true,
        url: urlData.publicUrl,
        bucket,
        path: storagePath,
        size: validated.file.buffer.length,
        mimeType: validated.file.mimeType,
      });
    }

    const { data: signedData, error: signedErr } = await auth.supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 300);

    if (signedErr) {
      return res.status(500).json({
        ok: false,
        error: `Ficheiro guardado em ${bucket}, mas falhou a geração de URL assinado: ${signedErr.message}`,
      });
    }

    return res.status(200).json({
      ok: true,
      url: signedData.signedUrl,
      bucket,
      path: storagePath,
      size: validated.file.buffer.length,
      mimeType: validated.file.mimeType,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Erro interno ao processar envio de ficheiro.",
    });
  }
}
