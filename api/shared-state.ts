import {
  getServiceSupabaseClient,
  getBearerToken,
  verifyRequestAuth,
  STAFF_DB_ROLES,
  ADMIN_DB_ROLES,
  filterPublicSharedState,
  filterStateKeysForRole,
  setApiCorsHeaders,
} from "./_supabase.js";

// Vercel Serverless Function handler for /api/shared-state
export default async function handler(req: any, res: any) {
  setApiCorsHeaders(res, "GET,POST,OPTIONS", req);
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const supabase = getServiceSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        ok: false,
        state: null,
        error: "Supabase não configurado no servidor.",
      });
    }

    let isVerifiedStaff = false;
    if (getBearerToken(req)) {
      const auth = await verifyRequestAuth(req);
      if (auth.ok && STAFF_DB_ROLES.has(auth.dbRole)) {
        isVerifiedStaff = true;
      }
    }

    const { data, error } = await supabase
      .from("platform_settings")
      .select("settings, updated_at")
      .eq("id", "global")
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        ok: false,
        state: null,
        error: `Erro ao ler estado partilhado: ${error.message}`,
      });
    }

    const rawState =
      data?.settings && typeof data.settings === "object" ? data.settings : null;

    return res.status(200).json({
      ok: true,
      state: isVerifiedStaff ? rawState : filterPublicSharedState(rawState),
      timestamp: data?.updated_at || new Date().toISOString(),
    });
  }

  if (req.method === "POST") {
    try {
      const auth = await verifyRequestAuth(req);
      if (!auth.ok) {
        return res.status(auth.status).json({
          ok: false,
          persisted: false,
          error: auth.error,
        });
      }

      if (!STAFF_DB_ROLES.has(auth.dbRole)) {
        return res.status(403).json({
          ok: false,
          persisted: false,
          error: "Acesso negado: apenas administradores e operadores autorizados podem publicar estado global.",
        });
      }

      const { state } = req.body || {};
      if (!state || typeof state !== "object" || Array.isArray(state)) {
        return res.status(400).json({
          ok: false,
          persisted: false,
          error: "Payload inválido.",
        });
      }

      const { sanitized, rejectedKeys } = filterStateKeysForRole(state, auth.dbRole);
      if (!ADMIN_DB_ROLES.has(auth.dbRole) && rejectedKeys.length > 0 && Object.keys(sanitized).length === 0) {
        return res.status(403).json({
          ok: false,
          persisted: false,
          error: "Permissão insuficiente para alterar chaves administrativas.",
        });
      }

      const { data: existingRow } = await auth.supabase
        .from("platform_settings")
        .select("settings")
        .eq("id", "global")
        .maybeSingle();

      const existingSettings =
        existingRow?.settings && typeof existingRow.settings === "object"
          ? existingRow.settings
          : {};

      const timestamp = new Date().toISOString();
      const merged = {
        ...existingSettings,
        ...sanitized,
        _lastUpdatedByAdmin: timestamp,
      };

      const { error: upsertErr } = await auth.supabase
        .from("platform_settings")
        .upsert({
          id: "global",
          settings: merged,
          is_public: true,
          updated_at: timestamp,
          updated_by: auth.userId,
        });

      if (upsertErr) {
        return res.status(500).json({
          ok: false,
          persisted: false,
          error: `Erro ao gravar estado partilhado: ${upsertErr.message}`,
        });
      }

      return res.status(200).json({
        ok: true,
        persisted: true,
        message: "Shared state updated in Supabase",
        timestamp,
      });
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        persisted: false,
        error: e?.message || "Erro interno.",
      });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
