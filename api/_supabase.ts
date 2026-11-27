import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

export const PUBLIC_SHARED_KEYS = [
  "customLogo",
  "assetRefs",
  "heroBanners",
  "sectionHeroes",
  "categoryOverrides",
  "serviceOverrides",
  "customServices",
  "deletedServices",
  "products",
  "featuredProducts",
  "featured",
  "featuredHomeProducts",
  "disabledCats",
  "overrides",
  "whatsapp",
  "whatsappDefault",
  "supportPhone",
  "supportEmail",
  "supportDays",
  "supportHours",
  "pracaCategories",
  "pracaSettings",
  "intermediaryCategories",
  "intermediaryListings",
  "activeAffiliateRef",
  "publicDocuments",
] as const;

export function setApiCorsHeaders(
  res: any,
  methods = "GET,POST,OPTIONS",
  req?: any
) {
  const origin = typeof req?.headers?.origin === "string" ? req.headers.origin.trim() : "";
  const host = typeof (req?.headers?.["x-forwarded-host"] || req?.headers?.host) === "string"
    ? String(req.headers["x-forwarded-host"] || req.headers.host).trim()
    : "";
  const allowedList = (process.env.ALLOWED_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origin) {
    let isSameHost = false;
    try {
      const parsed = new URL(origin);
      isSameHost = Boolean(host && parsed.host === host);
    } catch {
      isSameHost = false;
    }
    if (isSameHost || allowedList.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export const STAFF_DB_ROLES = new Set([
  "super_admin",
  "admin",
  "operacao",
  "apoio",
]);

export const ADMIN_DB_ROLES = new Set(["super_admin", "admin"]);

export const IMAGE_MGMT_DB_ROLES = new Set([
  "super_admin",
  "admin",
  "operacao",
]);

export const OPERATIONAL_STATE_KEYS = new Set([
  "bookings",
  "productOrders",
  "operationalOccurrences",
  "importQuotes",
  "intermediaryListings",
  "intermediaryNegotiations",
  "supportTickets",
  "auditLogs",
]);

export function getSupabaseServerConfig() {
  const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

  let url = "";
  let urlValid = false;
  if (
    rawUrl &&
    !/\s/.test(rawUrl) &&
    !rawUrl.includes("your-project") &&
    !rawUrl.includes("placeholder-project")
  ) {
    try {
      const parsed = new URL(rawUrl);
      const isLocalHost =
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      const pathClean = parsed.pathname.replace(/\/+$/, "");
      if (
        (parsed.protocol === "https:" || (isLocalHost && parsed.protocol === "http:")) &&
        !parsed.username &&
        !parsed.password &&
        !parsed.search &&
        !parsed.hash &&
        pathClean === ""
      ) {
        url = parsed.origin;
        urlValid = true;
      }
    } catch {
      urlValid = false;
    }
  }

  const configured = Boolean(
    urlValid &&
      url &&
      serviceRoleKey &&
      !serviceRoleKey.includes("your-service-role-key")
  );
  return { url, serviceRoleKey, configured };
}

export function getServiceSupabaseClient(): SupabaseClient | null {
  const { url, serviceRoleKey, configured } = getSupabaseServerConfig();
  if (!configured) return null;
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getBearerToken(req: any): string | null {
  const authHeader =
    req?.headers?.authorization || req?.headers?.Authorization || "";
  if (typeof authHeader !== "string") return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function mapDbRoleToAppRole(dbRole: string): string {
  switch (dbRole) {
    case "super_admin":
      return "SUPER_ADMIN";
    case "admin":
      return "ADMIN";
    case "operacao":
      return "OPERATIONS";
    case "apoio":
      return "CUSTOMER_SUPPORT";
    case "empresa_parceira":
      return "BUSINESS_PARTNER";
    case "profissional":
      return "PROFESSIONAL";
    case "funcionario":
      return "EMPLOYEE";
    case "vendedor":
      return "SELLER";
    case "afiliado":
      return "AFFILIATE";
    case "cliente":
    default:
      return "CUSTOMER";
  }
}

export interface VerifiedAuthResult {
  ok: true;
  supabase: SupabaseClient;
  userId: string;
  email: string;
  fullName: string;
  dbRole: string;
  appRole: string;
}

export interface FailedAuthResult {
  ok: false;
  status: number;
  error: string;
}

export async function verifyRequestAuth(
  req: any
): Promise<VerifiedAuthResult | FailedAuthResult> {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error:
        "Supabase administrativo não configurado no servidor (SUPABASE_SERVICE_ROLE_KEY/URL ausentes).",
    };
  }

  const token = getBearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Autenticação obrigatória (Authorization: Bearer em falta).",
    };
  }

  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !userData?.user) {
    return {
      ok: false,
      status: 401,
      error: "Sessão inválida ou expirada no Supabase Auth.",
    };
  }

  const user = userData.user;
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return {
      ok: false,
      status: 500,
      error: "Erro ao verificar perfil de autorização no Supabase.",
    };
  }

  const dbRole = profile?.role || "cliente";
  return {
    ok: true,
    supabase,
    userId: user.id,
    email: profile?.email || user.email || "",
    fullName:
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Utilizador",
    dbRole,
    appRole: mapDbRoleToAppRole(dbRole),
  };
}

export function filterPublicSharedState(
  state: Record<string, any> | null | undefined
): Record<string, any> | null {
  if (!state || typeof state !== "object") return null;
  const filtered: Record<string, any> = {};
  for (const key of PUBLIC_SHARED_KEYS) {
    if (state[key] !== undefined) {
      filtered[key] = state[key];
    }
  }
  if (state._lastUpdatedByAdmin !== undefined) {
    filtered._lastUpdatedByAdmin = state._lastUpdatedByAdmin;
  }
  return filtered;
}

export function filterStateKeysForRole(
  incomingState: Record<string, any>,
  dbRole: string
): { sanitized: Record<string, any>; rejectedKeys: string[] } {
  if (ADMIN_DB_ROLES.has(dbRole)) {
    return { sanitized: incomingState, rejectedKeys: [] };
  }
  const sanitized: Record<string, any> = {};
  const rejectedKeys: string[] = [];
  for (const key of Object.keys(incomingState)) {
    if (OPERATIONAL_STATE_KEYS.has(key)) {
      sanitized[key] = incomingState[key];
    } else if (key !== "_lastUpdatedByAdmin") {
      rejectedKeys.push(key);
    }
  }
  return { sanitized, rejectedKeys };
}

export interface ParsedUpload {
  mimeType: string;
  ext: string;
  buffer: Buffer;
}

export function validateAndDecodeDataUrl(
  dataUrl: string,
  options: { allowPdf?: boolean; maxBytes?: number } = {}
): { ok: true; file: ParsedUpload } | { ok: false; error: string } {
  if (!dataUrl || typeof dataUrl !== "string") {
    return { ok: false, error: "Ficheiro em falta." };
  }

  const match = dataUrl.match(
    /^data:(image\/(?:jpeg|jpg|png|webp|gif|svg\+xml)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (!match) {
    return {
      ok: false,
      error: "Formato não permitido. Envie apenas JPG, PNG, WebP, GIF, SVG ou PDF.",
    };
  }

  let mimeType = match[1].toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (mimeType === "application/pdf" && !options.allowPdf) {
    return { ok: false, error: "Ficheiros PDF não são permitidos neste envio." };
  }

  const base64Clean = match[2].replace(/\s+/g, "");
  const buffer = Buffer.from(base64Clean, "base64");
  const maxBytes = options.maxBytes || 10 * 1024 * 1024;

  if (buffer.length === 0) {
    return { ok: false, error: "Ficheiro vazio." };
  }
  if (buffer.length > maxBytes) {
    return {
      ok: false,
      error: `Ficheiro excede o limite máximo de ${Math.round(maxBytes / (1024 * 1024))}MB.`,
    };
  }

  // Magic-bytes verification
  if (mimeType === "image/jpeg") {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      return { ok: false, error: "Assinatura binária JPEG inválida." };
    }
    return { ok: true, file: { mimeType, ext: "jpg", buffer } };
  }

  if (mimeType === "image/png") {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (buffer.length < 8 || !pngSig.every((b, i) => buffer[i] === b)) {
      return { ok: false, error: "Assinatura binária PNG inválida." };
    }
    return { ok: true, file: { mimeType, ext: "png", buffer } };
  }

  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 4).toString("ascii");
    if (header !== "GIF8") {
      return { ok: false, error: "Assinatura binária GIF inválida." };
    }
    return { ok: true, file: { mimeType, ext: "gif", buffer } };
  }

  if (mimeType === "image/webp") {
    const riff = buffer.subarray(0, 4).toString("ascii");
    const webp = buffer.subarray(8, 12).toString("ascii");
    if (buffer.length < 12 || riff !== "RIFF" || webp !== "WEBP") {
      return { ok: false, error: "Assinatura binária WebP inválida." };
    }
    return { ok: true, file: { mimeType, ext: "webp", buffer } };
  }

  if (mimeType === "application/pdf") {
    const pdfSig = buffer.subarray(0, 5).toString("ascii");
    if (pdfSig !== "%PDF-") {
      return { ok: false, error: "Assinatura binária PDF inválida." };
    }
    return { ok: true, file: { mimeType, ext: "pdf", buffer } };
  }

  if (mimeType === "image/svg+xml") {
    const svgText = buffer.toString("utf-8").toLowerCase();
    if (!svgText.includes("<svg")) {
      return { ok: false, error: "Conteúdo SVG inválido." };
    }
    if (
      svgText.includes("<script") ||
      svgText.includes("javascript:") ||
      /\son[a-z]+\s*=/.test(svgText)
    ) {
      return {
        ok: false,
        error: "SVG rejeitado por conter scripts ou manipuladores de eventos.",
      };
    }
    return { ok: true, file: { mimeType, ext: "svg", buffer } };
  }

  return { ok: false, error: "Tipo MIME não suportado." };
}

export function extractPublicAssetStoragePath(imageUrl: string): string | null {
  const { url } = getSupabaseServerConfig();
  if (!url || !imageUrl.startsWith(url)) return null;
  const marker = "/storage/v1/object/public/public-assets/";
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  const rawPath = decodeURIComponent(
    imageUrl.slice(idx + marker.length).split("?")[0]
  );
  if (!rawPath || rawPath.includes("..") || rawPath.startsWith("/")) {
    return null;
  }
  return rawPath;
}

const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter(
    (t) => now - t < windowMs
  );
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

export function getClientIp(req: any): string {
  const fwd = req?.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req?.socket?.remoteAddress || "unknown";
}
