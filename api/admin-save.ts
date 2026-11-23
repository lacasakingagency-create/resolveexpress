import {
  verifyRequestAuth,
  STAFF_DB_ROLES,
  ADMIN_DB_ROLES,
  filterStateKeysForRole,
  setApiCorsHeaders,
} from "./_supabase.js";

// Vercel Serverless Function handler for /api/admin-save
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
        error: "Acesso negado: apenas staff autorizado no Supabase pode guardar alterações administrativas.",
      });
    }

    const { state, action, details } = req.body || {};
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return res.status(400).json({
        ok: false,
        persisted: false,
        error: "Payload de estado administrativo inválido.",
      });
    }

    const { sanitized, rejectedKeys } = filterStateKeysForRole(state, auth.dbRole);
    if (!ADMIN_DB_ROLES.has(auth.dbRole) && rejectedKeys.length > 0 && Object.keys(sanitized).length === 0) {
      return res.status(403).json({
        ok: false,
        persisted: false,
        error: `Acesso negado: o papel '${auth.dbRole}' não tem permissão para alterar configurações globais.`,
      });
    }

    const { data: existingRow, error: readErr } = await auth.supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", "global")
      .maybeSingle();

    if (readErr) {
      return res.status(500).json({
        ok: false,
        persisted: false,
        error: `Erro ao ler estado atual no Supabase: ${readErr.message}`,
      });
    }

    const existingSettings =
      existingRow?.settings && typeof existingRow.settings === "object"
        ? existingRow.settings
        : {};
    const existingLogs = Array.isArray(existingSettings.auditLogs)
      ? existingSettings.auditLogs
      : [];

    const timestamp = new Date().toISOString();
    const auditLogs = action
      ? [
          {
            id: `LOG-${Date.now()}`,
            action: String(action).slice(0, 120),
            user: auth.fullName,
            role: auth.appRole,
            timestamp: timestamp.replace("T", " ").slice(0, 16),
            details:
              typeof details === "string" && details.trim()
                ? details.slice(0, 400)
                : "Atualização confirmada no Supabase.",
          },
          ...existingLogs,
        ].slice(0, 500)
      : existingLogs;

    const mergedSettings = {
      ...existingSettings,
      ...sanitized,
      auditLogs,
      _lastUpdatedByAdmin: timestamp,
    };

    const { error: writeErr } = await auth.supabase
      .from("platform_settings")
      .upsert({
        id: "global",
        settings: mergedSettings,
        is_public: true,
        updated_at: timestamp,
        updated_by: auth.userId,
      });

    if (writeErr) {
      return res.status(500).json({
        ok: false,
        persisted: false,
        error: `Falha ao persistir no Supabase: ${writeErr.message}`,
      });
    }

    return res.status(200).json({
      ok: true,
      persisted: true,
      message: "Alterações administrativas gravadas no Supabase.",
      timestamp,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      persisted: false,
      error: e?.message || "Erro interno ao guardar alterações administrativas.",
    });
  }
}
