import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Product, Service } from "./data";
import type { BookingRecord, ProductOrderRecord } from "./store";

// VITE client environment variables (static import.meta.env access so Vite inlines identically in dev and prod)
const RAW_ENV_SUPABASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_URL
    : "") || "";
const RAW_ENV_ANON_KEY_PRIMARY: string =
  (typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : "") || "";
const RAW_ENV_PUBLISHABLE_KEY: string =
  (typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    : "") || "";
const RAW_ENV_PUBLISHABLE_DEFAULT_KEY: string =
  (typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    : "") || "";

const RAW_ENV_SUPABASE_ANON_KEY: string =
  RAW_ENV_ANON_KEY_PRIMARY ||
  RAW_ENV_PUBLISHABLE_KEY ||
  RAW_ENV_PUBLISHABLE_DEFAULT_KEY ||
  "";

export interface SupabaseUrlValidationResult {
  valid: boolean;
  present: boolean;
  normalizedUrl: string;
  error: string | null;
}

export type SupabaseKeyFormat =
  | "sb_publishable"
  | "jwt_anon"
  | "custom"
  | "missing"
  | "invalid";

export interface SupabaseConfigDiagnostics {
  configured: boolean;
  urlPresent: boolean;
  anonKeyPresent: boolean;
  resolvedUrl: string;
  urlValid: boolean;
  keyValid: boolean;
  keyFormat: SupabaseKeyFormat;
  error: string | null;
}

function stripOuterQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Validates that VITE_SUPABASE_URL is exclusively the base Supabase project URL:
 * e.g. https://PROJECT_REF.supabase.co
 * Rejects spaces, control chars, query/hash fragments, and paths like /auth/v1, /rest/v1, /storage/v1.
 */
export function validateAndNormalizeSupabaseUrl(rawUrl: string): SupabaseUrlValidationResult {
  const raw = typeof rawUrl === "string" ? rawUrl : "";
  const cleaned = stripOuterQuotes(raw);
  if (!cleaned) {
    return {
      valid: false,
      present: false,
      normalizedUrl: "",
      error: "VITE_SUPABASE_URL está ausente no bundle de produção.",
    };
  }

  if (/\s/.test(cleaned) || /[\u0000-\u001F\u007F]/.test(cleaned)) {
    return {
      valid: false,
      present: true,
      normalizedUrl: "",
      error: "VITE_SUPABASE_URL contém espaços ou caracteres inválidos.",
    };
  }

  if (
    cleaned.includes("your-project") ||
    cleaned.includes("placeholder-project")
  ) {
    return {
      valid: false,
      present: false,
      normalizedUrl: "",
      error: "VITE_SUPABASE_URL contém um valor placeholder.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return {
      valid: false,
      present: true,
      normalizedUrl: "",
      error: "VITE_SUPABASE_URL não é uma URL válida. Formato esperado: https://PROJECT_REF.supabase.co",
    };
  }

  const isLocalHost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(isLocalHost && parsed.protocol === "http:")) {
    return {
      valid: false,
      present: true,
      normalizedUrl: "",
      error: "VITE_SUPABASE_URL deve usar HTTPS (ex.: https://PROJECT_REF.supabase.co).",
    };
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return {
      valid: false,
      present: true,
      normalizedUrl: "",
      error: "VITE_SUPABASE_URL deve conter apenas a URL base sem credenciais, query string ou fragmento.",
    };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (normalizedPath !== "") {
    return {
      valid: false,
      present: true,
      normalizedUrl: "",
      error: `VITE_SUPABASE_URL contém caminho indevido ('${parsed.pathname}'). Deve ser apenas a URL base (ex.: ${parsed.origin}).`,
    };
  }

  return {
    valid: true,
    present: true,
    normalizedUrl: parsed.origin,
    error: null,
  };
}

/**
 * Validates public Supabase client keys (both modern `sb_publishable_...` and legacy JWT `anon` keys).
 * Explicitly blocks secret/service-role keys (`sb_secret_...`) from browser initialization.
 */
export function normalizeAnonKey(rawKey: string): {
  valid: boolean;
  present: boolean;
  cleanedKey: string;
  keyFormat: SupabaseKeyFormat;
  error: string | null;
} {
  const cleaned = stripOuterQuotes(typeof rawKey === "string" ? rawKey : "");
  if (!cleaned) {
    return {
      valid: false,
      present: false,
      cleanedKey: "",
      keyFormat: "missing",
      error: "VITE_SUPABASE_ANON_KEY está ausente no bundle de produção.",
    };
  }
  if (/\s/.test(cleaned) || /[\u0000-\u001F\u007F]/.test(cleaned)) {
    return {
      valid: false,
      present: true,
      cleanedKey: "",
      keyFormat: "invalid",
      error: "VITE_SUPABASE_ANON_KEY contém espaços ou quebras de linha inválidas.",
    };
  }
  if (cleaned.includes("your-anon-key") || cleaned.includes("placeholder")) {
    return {
      valid: false,
      present: false,
      cleanedKey: "",
      keyFormat: "missing",
      error: "VITE_SUPABASE_ANON_KEY contém um valor placeholder.",
    };
  }
  if (cleaned.startsWith("sb_secret_")) {
    return {
      valid: false,
      present: true,
      cleanedKey: "",
      keyFormat: "invalid",
      error: "Foi fornecida uma Secret Key (sb_secret_...) em VITE_SUPABASE_ANON_KEY. Use a Publishable Key (sb_publishable_...) ou a chave pública anon.",
    };
  }
  const keyFormat: SupabaseKeyFormat = cleaned.startsWith("sb_publishable_")
    ? "sb_publishable"
    : cleaned.startsWith("eyJ")
    ? "jwt_anon"
    : "custom";
  return { valid: true, present: true, cleanedKey: cleaned, keyFormat, error: null };
}

const urlValidation = validateAndNormalizeSupabaseUrl(RAW_ENV_SUPABASE_URL);
const keyValidation = normalizeAnonKey(RAW_ENV_SUPABASE_ANON_KEY);

const supabaseUrl: string = urlValidation.valid ? urlValidation.normalizedUrl : "";
const supabaseAnonKey: string = keyValidation.valid ? keyValidation.cleanedKey : "";

/**
 * Returns non-secret configuration diagnostics for Supabase client initialization.
 * Never exposes keys or tokens.
 */
export function getSupabaseConfigDiagnostics(): SupabaseConfigDiagnostics {
  const configured = Boolean(urlValidation.valid && keyValidation.valid);
  const error = !configured
    ? [urlValidation.error, keyValidation.error].filter(Boolean).join(" ") ||
      "Supabase não está configurado."
    : null;
  return {
    configured,
    urlPresent: urlValidation.present,
    anonKeyPresent: keyValidation.present,
    resolvedUrl: supabaseUrl,
    urlValid: urlValidation.valid,
    keyValid: keyValidation.valid,
    keyFormat: keyValidation.keyFormat,
    error,
  };
}

/**
 * Returns the exact base URL used by the browser Supabase client (or "" if not validly configured).
 */
export function getSupabaseClientUrl(): string {
  return supabaseUrl;
}

/**
 * Checks if Supabase credentials have been configured validly in .env or Vercel/build environment.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(urlValidation.valid && keyValidation.valid);
}

/**
 * Official Supabase Client
 * Initialized strictly with base project URL (https://PROJECT_REF.supabase.co) and anon key
 * for browser-safe operations with Row-Level-Security (RLS).
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export async function getAuthAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toValidUuidOrNull(value?: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function mapOrderPaymentStatusForDb(
  status?: string
): "Pendente" | "Confirmado" | "Reembolsado" | "Cancelado" {
  if (!status) return "Pendente";
  const normalized = status.trim();
  if (normalized === "Confirmado" || normalized === "Pago") return "Confirmado";
  if (normalized === "Reembolsado") return "Reembolsado";
  if (normalized === "Cancelado") return "Cancelado";
  return "Pendente";
}

function mapBookingPaymentStatusForDb(status?: string): string {
  if (!status) return "Pendente";
  const normalized = status.trim();
  if (normalized === "Pago" || normalized === "Confirmado") return "Confirmado";
  if (normalized === "Reembolsado") return "Reembolsado";
  if (normalized === "Cancelado") return "Cancelado";
  return "Pendente";
}

/* ==============================================================================
   SUPABASE DATA ACCESS HELPERS
   Works seamlessly alongside store.ts (with strict persistence error reporting)
   ============================================================================== */

/**
 * Fetches all active products from Supabase
 */
export async function getSupabaseProducts(): Promise<Product[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("available", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetch products warning:", error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      priceAOA: Number(row.price_aoa),
      promotionalPriceAOA: row.promotional_price_aoa ? Number(row.promotional_price_aoa) : undefined,
      available: row.available,
      stock: row.stock,
      sellerName: row.seller_name,
      sellerId: row.seller_id,
      sellerType: row.seller_type,
      category: row.category,
      image: row.image,
      deliveryLocation: row.delivery_location,
      estimatedDelivery: row.estimated_delivery,
      warranty: row.warranty,
      unit: row.unit,
      rating: Number(row.rating || 5),
      reviewsCount: row.reviews_count || 1,
      badge: row.badge,
    }));
  } catch (err) {
    console.warn("Failed to reach Supabase products table:", err);
    return null;
  }
}

/**
 * Saves or updates a product in Supabase with structured error reporting
 */
export async function saveSupabaseProductStrict(
  prod: Product
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  try {
    const { error } = await supabase.from("products").upsert({
      id: prod.id,
      name: prod.name,
      description: prod.description,
      price_aoa: prod.priceAOA,
      promotional_price_aoa: prod.promotionalPriceAOA || null,
      stock: prod.stock,
      available: prod.available,
      seller_name: prod.sellerName,
      seller_id: prod.sellerId,
      seller_type: prod.sellerType,
      category: prod.category,
      image: prod.image,
      delivery_location: prod.deliveryLocation,
      estimated_delivery: prod.estimatedDelivery,
      warranty: prod.warranty || null,
      unit: prod.unit,
      rating: prod.rating || 5.0,
      reviews_count: prod.reviewsCount || 1,
      badge: prod.badge || null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("Supabase save product error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    console.warn("Supabase save product exception:", err);
    return { ok: false, error: err?.message || "Erro ao gravar produto no Supabase." };
  }
}

export async function saveSupabaseProduct(prod: Product): Promise<boolean> {
  const res = await saveSupabaseProductStrict(prod);
  return res.ok;
}

/**
 * Saves or updates a Booking in Supabase with strict error reporting
 */
export async function syncBookingToSupabaseStrict(
  booking: BookingRecord,
  mode: "insert" | "update" = "insert"
): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  try {
    const authUser = (await supabase.auth.getUser()).data.user;
    const resolvedUserId =
      toValidUuidOrNull(booking.userId || (booking as any).user_id) || authUser?.id || null;
    const validPartnerId = toValidUuidOrNull(booking.partnerId);

    const paymentDetailsPayload = {
      ...(booking.paymentDetails || {}),
      uiPaymentStatus: booking.paymentStatus,
      selectedPaymentMethod: booking.payment,
      selectedPaymentReference: booking.paymentReference || null,
    };

    if (mode === "update") {
      const { data, error } = await supabase
        .from("bookings")
        .update({
          proof_of_payment: booking.proofOfPayment || null,
          payment_details: paymentDetailsPayload,
        })
        .eq("id", booking.id)
        .select()
        .single();

      if (error) {
        console.warn("Supabase update booking payment error:", error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        id: booking.id,
        user_id: resolvedUserId,
        service_id: booking.serviceId,
        service_name: booking.service,
        category: booking.category,
        customer_name: booking.customer,
        customer_phone: booking.phone,
        date: booking.date,
        time: booking.slot,
        location: booking.address,
        province: booking.province || "Huambo",
        municipio: booking.municipio || "Huambo",
        bairro: booking.bairro || null,
        details: booking.details || null,
        status: booking.status,
        payment_status: mapBookingPaymentStatusForDb(booking.paymentStatus),
        payment_method: booking.payment,
        payment_reference: booking.paymentReference || null,
        payment_details: paymentDetailsPayload,
        proof_of_payment: booking.proofOfPayment || null,
        total_aoa: booking.total,
        assigned_to: booking.assignedTo || null,
        partner_id: validPartnerId,
      })
      .select()
      .single();

    if (error) {
      console.warn("Supabase insert booking error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (err: any) {
    console.warn("Supabase sync booking exception:", err);
    return { ok: false, error: err?.message || "Erro ao sincronizar agendamento no Supabase." };
  }
}

export async function syncBookingToSupabase(booking: BookingRecord): Promise<boolean> {
  const res = await syncBookingToSupabaseStrict(booking, "insert");
  return res.ok;
}

export async function updateSupabaseBookingStatus(
  id: string,
  patch: {
    status?: BookingRecord["status"];
    assignedTo?: string | null;
    partnerId?: string | null;
    paymentStatus?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.status !== undefined) updatePayload.status = patch.status;
    if (patch.assignedTo !== undefined) updatePayload.assigned_to = patch.assignedTo;
    if (patch.partnerId !== undefined) {
      updatePayload.partner_id = toValidUuidOrNull(patch.partnerId);
    }
    if (patch.paymentStatus !== undefined) {
      updatePayload.payment_status = mapBookingPaymentStatusForDb(patch.paymentStatus);
    }

    const { error } = await supabase.from("bookings").update(updatePayload).eq("id", id);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao atualizar agendamento no Supabase." };
  }
}

/**
 * Saves or updates a Product Order in Supabase with strict error reporting
 */
export async function syncOrderToSupabaseStrict(
  order: ProductOrderRecord,
  mode: "insert" | "update_payment" = "insert"
): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  try {
    const authUser = (await supabase.auth.getUser()).data.user;
    const resolvedUserId =
      toValidUuidOrNull(order.userId || (order as any).user_id) || authUser?.id || null;

    if (!resolvedUserId) {
      return {
        ok: false,
        error: "Sessão autenticada obrigatória no Supabase para registar encomendas.",
      };
    }

    const paymentDetailsPayload = {
      ...(order.paymentDetails || {}),
      uiPaymentStatus: order.paymentStatus,
    };

    if (mode === "update_payment") {
      const { data, error } = await supabase
        .from("product_orders")
        .update({
          payment_method: order.paymentMethod,
          payment_reference: order.paymentReference || null,
          proof_of_payment: order.proofOfPayment || null,
          payment_details: paymentDetailsPayload,
        })
        .eq("id", order.id)
        .select()
        .single();

      if (error) {
        console.warn("Supabase update order payment error:", error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    }

    const { data, error } = await supabase
      .from("product_orders")
      .insert({
        id: order.id,
        user_id: resolvedUserId,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        items: order.items,
        subtotal_aoa: order.subtotalAOA,
        delivery_fee_aoa: order.deliveryFeeAOA,
        discount_aoa: order.discountAOA,
        total_aoa: order.totalAOA,
        delivery_address: order.deliveryAddress,
        delivery_bairro: order.deliveryBairro,
        delivery_province: order.deliveryProvince || "Huambo",
        delivery_municipio: order.deliveryMunicipio || "Huambo",
        payment_method: order.paymentMethod,
        payment_status: mapOrderPaymentStatusForDb(order.paymentStatus),
        payment_reference: order.paymentReference || null,
        payment_details: paymentDetailsPayload,
        proof_of_payment: order.proofOfPayment || null,
        order_status: order.orderStatus,
        seller_names: order.sellerNames || [],
      })
      .select()
      .single();

    if (error) {
      console.warn("Supabase insert order error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (err: any) {
    console.warn("Supabase sync order exception:", err);
    return { ok: false, error: err?.message || "Erro ao sincronizar encomenda no Supabase." };
  }
}

export async function syncOrderToSupabase(order: ProductOrderRecord): Promise<boolean> {
  const res = await syncOrderToSupabaseStrict(order, "insert");
  return res.ok;
}

export async function updateSupabaseOrderStatus(
  id: string,
  patch: {
    orderStatus?: ProductOrderRecord["orderStatus"];
    paymentStatus?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.orderStatus !== undefined) updatePayload.order_status = patch.orderStatus;
    if (patch.paymentStatus !== undefined) {
      updatePayload.payment_status = mapOrderPaymentStatusForDb(patch.paymentStatus);
    }

    const { error } = await supabase.from("product_orders").update(updatePayload).eq("id", id);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao atualizar encomenda no Supabase." };
  }
}

export async function getSupabaseWallet(userId: string): Promise<{
  ok: boolean;
  balanceAOA: number;
  transactions: Array<{
    id: string;
    date: string;
    amountAOA: number;
    type: "credit" | "debit";
    description: string;
  }>;
  error?: string;
}> {
  if (!isSupabaseConfigured() || !userId) {
    return { ok: false, balanceAOA: 0, transactions: [], error: "Supabase não configurado." };
  }
  try {
    const { data: walletRow, error: walletErr } = await supabase
      .from("wallets")
      .select("balance_aoa")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletErr) {
      return { ok: false, balanceAOA: 0, transactions: [], error: walletErr.message };
    }

    const { data: txRows } = await supabase
      .from("wallet_transactions")
      .select("id, type, amount_aoa, description, reference, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      ok: true,
      balanceAOA: Number(walletRow?.balance_aoa ?? 0),
      transactions: (txRows || []).map((t: any) => ({
        id: String(t.reference || t.id),
        date: String(t.created_at || "").slice(0, 16).replace("T", " "),
        amountAOA: Number(t.amount_aoa || 0),
        type: t.type === "credit" ? "credit" : "debit",
        description: String(t.description || ""),
      })),
    };
  } catch (err: any) {
    return {
      ok: false,
      balanceAOA: 0,
      transactions: [],
      error: err?.message || "Erro ao consultar carteira.",
    };
  }
}

/**
 * Executes a wallet movement strictly via transactional RPC (NO direct table upsert fallback)
 */
export async function executeWalletMovementStrict(params: {
  userId: string;
  type: "credit" | "debit";
  amountAOA: number;
  description: string;
  reference: string;
}): Promise<{ ok: boolean; balanceAOA?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  if (!params.userId || !toValidUuidOrNull(params.userId)) {
    return { ok: false, error: "Utilizador autenticado válido é obrigatório para movimentar a carteira." };
  }
  if (!params.reference || !params.reference.trim()) {
    return { ok: false, error: "Referência única de transação é obrigatória." };
  }
  try {
    const { data, error } = await supabase.rpc("execute_wallet_movement", {
      p_user_id: params.userId,
      p_type: params.type,
      p_amount: params.amountAOA,
      p_description: params.description,
      p_reference: params.reference.trim(),
    });

    if (error) {
      console.warn("Wallet RPC execution error:", error.message);
      return { ok: false, error: error.message };
    }

    const nextBal = Number(data?.new_balance ?? data?.balance_aoa ?? 0);
    return { ok: true, balanceAOA: nextBal };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Erro ao executar movimento na carteira.",
    };
  }
}

export async function syncWalletToSupabase(
  userId: string,
  _balanceAOA: number,
  transaction?: {
    type: "credit" | "debit";
    amountAOA: number;
    description: string;
    reference?: string;
  }
): Promise<boolean> {
  if (!transaction || !transaction.reference) return false;
  const res = await executeWalletMovementStrict({
    userId,
    type: transaction.type,
    amountAOA: transaction.amountAOA,
    description: transaction.description,
    reference: transaction.reference,
  });
  return res.ok;
}

/* ==============================================================================
   AUTHENTICATION & PROFILE SERVICES (SUPABASE AUTH + PROFILES)
   ============================================================================== */

export function mapDbRoleToUserRoleStrict(
  dbRole?: string | null
): import("./store").UserRole | null {
  if (typeof dbRole !== "string") return null;
  switch (dbRole.trim().toLowerCase()) {
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
      return "CUSTOMER";
    default:
      return null;
  }
}

export function mapDbRoleToUserRole(dbRole: string): import("./store").UserRole {
  return mapDbRoleToUserRoleStrict(dbRole) || "CUSTOMER";
}

export function mapUserRoleToDbRole(role: import("./store").UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "super_admin";
    case "ADMIN":
      return "admin";
    case "OPERATIONS":
      return "operacao";
    case "CUSTOMER_SUPPORT":
      return "apoio";
    case "BUSINESS_PARTNER":
    case "PARTNER":
      return "empresa_parceira";
    case "PROFESSIONAL":
      return "profissional";
    case "EMPLOYEE":
      return "funcionario";
    case "SELLER":
      return "vendedor";
    case "AFFILIATE":
      return "afiliado";
    case "CUSTOMER":
    default:
      return "cliente";
  }
}

/**
 * Real Supabase sign in with password
 */
export async function signInWithSupabase(email: string, pass: string) {
  const diag = getSupabaseConfigDiagnostics();
  if (!diag.configured) {
    return {
      data: null,
      error: new Error(diag.error || "Supabase não está configurado."),
    };
  }
  return await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: pass,
  });
}

/**
 * Real Supabase sign up with metadata
 */
export async function signUpWithSupabase(params: {
  email: string;
  pass: string;
  fullName: string;
  phone?: string;
  role?: string;
  province?: string;
  municipio?: string;
  bairro?: string;
}) {
  const diag = getSupabaseConfigDiagnostics();
  if (!diag.configured) {
    return {
      data: null,
      error: new Error(diag.error || "Supabase não está configurado."),
    };
  }
  return await supabase.auth.signUp({
    email: params.email.trim(),
    password: params.pass,
    options: {
      data: {
        full_name: params.fullName,
        phone: params.phone || "",
        // Security: Public signups can NEVER request administrative roles
        role: "cliente",
        province: params.province || "Huambo",
        municipio: params.municipio || "Huambo",
        bairro: params.bairro || "",
      },
    },
  });
}

/**
 * Sign out from Supabase
 */
export async function signOutSupabase() {
  if (!isSupabaseConfigured()) return { error: null };
  return await supabase.auth.signOut();
}

export function maskUuid(value?: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 12) return "***";
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

export interface SupabaseProfileDiagnostics {
  maskedUserId: string | null;
  sessionPresent: boolean;
  sessionUserMatches: boolean;
  getUserConfirmed: boolean;
  getUserError: string | null;
  projectUrl: string;
  queryStatus: number | null;
  queryState: "idle" | "success" | "empty" | "error" | "no_session";
  errorCode: string | null;
  errorMessage: string | null;
  errorDetails: string | null;
  errorHint: string | null;
  dbRole: string | null;
  mappedRole: import("./store").UserRole | null;
  finalState: "ready" | "missing" | "error" | "no_session";
  checkedAt: string;
}

export interface SupabaseProfileFetchResult {
  ok: boolean;
  profile: any | null;
  error?: string | null;
  status?: number | null;
  errorCode?: string | null;
  errorDetails?: string | null;
  errorHint?: string | null;
  diagnostics: SupabaseProfileDiagnostics;
}

/**
 * Fetch user profile from public.profiles with explicit session/auth verification and error reporting.
 * Uses the active Supabase client session (never localStorage UUIDs) and distinguishes HTTP/RLS errors
 * from genuine missing rows. Never logs or exposes access tokens.
 */
export async function getSupabaseProfileDetailed(
  expectedUserId?: string
): Promise<SupabaseProfileFetchResult> {
  const checkedAt = new Date().toISOString();
  const baseDiag: SupabaseProfileDiagnostics = {
    maskedUserId: maskUuid(expectedUserId),
    sessionPresent: false,
    sessionUserMatches: false,
    getUserConfirmed: false,
    getUserError: null,
    projectUrl: getSupabaseClientUrl(),
    queryStatus: null,
    queryState: "idle",
    errorCode: null,
    errorMessage: null,
    errorDetails: null,
    errorHint: null,
    dbRole: null,
    mappedRole: null,
    finalState: "error",
    checkedAt,
  };

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      profile: null,
      error: "Supabase não está configurado.",
      diagnostics: {
        ...baseDiag,
        errorMessage: "Supabase não está configurado.",
        queryState: "error",
        finalState: "error",
      },
    };
  }

  try {
    // 1. Verify active session & authenticated user on the SAME Supabase client instance
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const activeSession = sessionData?.session ?? null;
    const sessionUserId = activeSession?.user?.id ?? null;
    const hasAccessToken = Boolean(activeSession?.access_token);

    let authApiUserId: string | null = null;
    let getUserError: string | null = null;
    if (hasAccessToken) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      authApiUserId = userData?.user?.id ?? null;
      if (userErr) {
        getUserError = `${userErr.status ? `HTTP ${userErr.status}: ` : ""}${userErr.message}`;
      }
    } else if (sessionErr) {
      getUserError = sessionErr.message;
    }

    const authoritativeUserId = authApiUserId || sessionUserId;
    const maskedId = maskUuid(authoritativeUserId || expectedUserId);
    const sessionUserMatches = Boolean(
      authoritativeUserId && (!expectedUserId || authoritativeUserId === expectedUserId)
    );

    if (!hasAccessToken || !authoritativeUserId) {
      const noSessionMsg =
        "Sessão autenticada ausente no cliente Supabase (sem access_token ativo para validar auth.uid()).";
      console.warn("[AuthProfileDiagnostics] No active Supabase session", {
        maskedUserId: maskedId,
        projectUrl: baseDiag.projectUrl,
        getUserError,
      });
      return {
        ok: false,
        profile: null,
        error: noSessionMsg,
        diagnostics: {
          ...baseDiag,
          maskedUserId: maskedId,
          sessionPresent: Boolean(activeSession),
          sessionUserMatches: false,
          getUserConfirmed: Boolean(authApiUserId),
          getUserError,
          queryState: "no_session",
          errorMessage: noSessionMsg,
          finalState: "no_session",
        },
      };
    }

    if (expectedUserId && authoritativeUserId !== expectedUserId) {
      const mismatchMsg =
        "Divergência entre o UUID da sessão autenticada e o identificador esperado.";
      console.error("[AuthProfileDiagnostics] Auth UUID mismatch", {
        expectedMasked: maskUuid(expectedUserId),
        actualMasked: maskUuid(authoritativeUserId),
      });
      return {
        ok: false,
        profile: null,
        error: mismatchMsg,
        diagnostics: {
          ...baseDiag,
          maskedUserId: maskedId,
          sessionPresent: true,
          sessionUserMatches: false,
          getUserConfirmed: Boolean(authApiUserId),
          getUserError,
          queryState: "error",
          errorMessage: mismatchMsg,
          finalState: "error",
        },
      };
    }

    // 2. Query public.profiles with .eq("id", authoritativeUserId).maybeSingle()
    // Select "*" avoids HTTP 400 / 42703 failures if optional columns differ across deployments.
    const { data, error, status } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authoritativeUserId)
      .maybeSingle();

    if (error) {
      const errCode = (error as any)?.code ?? null;
      const errDetails = (error as any)?.details ?? null;
      const errHint = (error as any)?.hint ?? null;
      console.error("[AuthProfileDiagnostics] Error querying public.profiles", {
        maskedUserId: maskedId,
        status,
        code: errCode,
        message: error.message,
        details: errDetails,
        hint: errHint,
      });
      return {
        ok: false,
        profile: null,
        status,
        errorCode: errCode,
        errorDetails: errDetails,
        errorHint: errHint,
        error: `Erro ao consultar public.profiles${errCode ? ` [${errCode}]` : ""}: ${error.message}`,
        diagnostics: {
          ...baseDiag,
          maskedUserId: maskedId,
          sessionPresent: true,
          sessionUserMatches,
          getUserConfirmed: Boolean(authApiUserId),
          getUserError,
          queryStatus: status ?? null,
          queryState: "error",
          errorCode: errCode,
          errorMessage: error.message,
          errorDetails: errDetails,
          errorHint: errHint,
          finalState: "error",
        },
      };
    }

    if (!data) {
      const emptyMsg =
        "Perfil não encontrado em public.profiles para o utilizador autenticado (auth.uid()).";
      console.warn("[AuthProfileDiagnostics] Empty result from public.profiles", {
        maskedUserId: maskedId,
        status,
        getUserConfirmed: Boolean(authApiUserId),
      });
      return {
        ok: true,
        profile: null,
        status,
        error: emptyMsg,
        diagnostics: {
          ...baseDiag,
          maskedUserId: maskedId,
          sessionPresent: true,
          sessionUserMatches,
          getUserConfirmed: Boolean(authApiUserId),
          getUserError,
          queryStatus: status ?? null,
          queryState: "empty",
          errorMessage: emptyMsg,
          finalState: "missing",
        },
      };
    }

    const mappedRole = mapDbRoleToUserRoleStrict(data.role);
    const roleErrMsg = !mappedRole
      ? `Papel '${String(data.role ?? "")}' em public.profiles não é reconhecido.`
      : null;

    console.info("[AuthProfileDiagnostics] Profile resolved", {
      maskedUserId: maskedId,
      status,
      dbRole: data.role ?? null,
      mappedRole,
      getUserConfirmed: Boolean(authApiUserId),
    });

    return {
      ok: true,
      profile: data,
      status,
      error: roleErrMsg,
      diagnostics: {
        ...baseDiag,
        maskedUserId: maskedId,
        sessionPresent: true,
        sessionUserMatches,
        getUserConfirmed: Boolean(authApiUserId),
        getUserError,
        queryStatus: status ?? null,
        queryState: "success",
        errorMessage: roleErrMsg,
        dbRole: data.role ?? null,
        mappedRole,
        finalState: mappedRole ? "ready" : "error",
      },
    };
  } catch (err: any) {
    const errMsg = err?.message || "Exceção de rede ao consultar public.profiles.";
    console.error("[AuthProfileDiagnostics] Exception querying public.profiles", {
      maskedUserId: maskUuid(expectedUserId),
      message: errMsg,
    });
    return {
      ok: false,
      profile: null,
      error: errMsg,
      diagnostics: {
        ...baseDiag,
        queryState: "error",
        errorMessage: errMsg,
        finalState: "error",
      },
    };
  }
}

/**
 * Fetch user profile from public.profiles
 */
export async function getSupabaseProfile(userId: string) {
  const res = await getSupabaseProfileDetailed(userId);
  return res.ok ? res.profile : null;
}

/**
 * Upsert user profile in public.profiles
 */
export async function upsertSupabaseProfile(profile: {
  id: string;
  email?: string;
  full_name: string;
  phone?: string;
  role?: string;
  province?: string;
  municipio?: string;
  bairro?: string;
  avatar_url?: string;
}) {
  if (!isSupabaseConfigured() || !profile.id) return false;
  try {
    const { error } = await supabase.from("profiles").upsert({
      ...profile,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("Error upserting profile:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Exception upserting profile:", err);
    return false;
  }
}

/* ==============================================================================
   PLATFORM SETTINGS (GLOBAL PERSISTENCE)
   ============================================================================== */

export async function getSupabasePlatformSettingsResult(): Promise<{
  ok: boolean;
  exists: boolean;
  settings: any | null;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      exists: false,
      settings: null,
      error: "Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes).",
    };
  }
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("settings, updated_at")
      .eq("id", "global")
      .maybeSingle();

    if (error) {
      console.warn("Could not read platform_settings from Supabase:", error.message);
      return {
        ok: false,
        exists: false,
        settings: null,
        error: error.message,
      };
    }
    return {
      ok: true,
      exists: Boolean(data),
      settings: data?.settings || null,
    };
  } catch (err: any) {
    console.warn("Exception reading platform_settings:", err);
    return {
      ok: false,
      exists: false,
      settings: null,
      error: err?.message || "Erro de rede ao consultar platform_settings.",
    };
  }
}

export async function getSupabasePlatformSettings(): Promise<any | null> {
  const res = await getSupabasePlatformSettingsResult();
  return res.ok ? res.settings : null;
}

function stripTransientDataUrls<T>(input: T, depth = 0): T {
  if (depth > 8 || input === null || input === undefined) return input;
  if (typeof input === "string") {
    const t = input.trim().toLowerCase();
    return (t.startsWith("data:") || t.startsWith("blob:") ? "" : input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripTransientDataUrls(item, depth + 1)) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(input as Record<string, any>)) {
      out[k] = stripTransientDataUrls((input as Record<string, any>)[k], depth + 1);
    }
    return out as T;
  }
  return input;
}

export async function saveSupabasePlatformSettingsDetailed(
  settings: any
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes).",
    };
  }
  try {
    const now = new Date().toISOString();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return {
        ok: false,
        error: "Sessão autenticada no Supabase obrigatória para gravar em platform_settings.",
      };
    }

    const { data: existingRow, error: readErr } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", "global")
      .maybeSingle();

    if (readErr) {
      return {
        ok: false,
        error: `Falha ao ler platform_settings no Supabase: ${readErr.message}`,
      };
    }

    const existingSettings =
      existingRow?.settings && typeof existingRow.settings === "object"
        ? existingRow.settings
        : {};

    const cleanIncoming =
      settings && typeof settings === "object" ? stripTransientDataUrls(settings) : {};

    const mergedSettings = {
      ...existingSettings,
      ...cleanIncoming,
      _lastUpdatedByAdmin: now,
    };

    const { error } = await supabase.from("platform_settings").upsert({
      id: "global",
      settings: mergedSettings,
      is_public: true,
      updated_at: now,
      updated_by: authData.user.id,
    });
    if (error) {
      console.warn("Could not save platform_settings to Supabase:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    console.warn("Exception saving platform_settings:", err);
    return {
      ok: false,
      error: err?.message || "Erro inesperado ao gravar platform_settings.",
    };
  }
}

export async function saveSupabasePlatformSettings(settings: any): Promise<boolean> {
  const res = await saveSupabasePlatformSettingsDetailed(settings);
  return res.ok;
}

export function subscribePlatformSettingsRealtime(
  onUpdate: (settings: Record<string, any>) => void
): () => void {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return () => {};
  }

  try {
    const channel = supabase
      .channel(`resolve-platform-settings-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_settings",
          filter: "id=eq.global",
        },
        (payload: any) => {
          const nextSettings = payload?.new?.settings;
          if (nextSettings && typeof nextSettings === "object") {
            onUpdate(nextSettings);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // Ignore cleanup errors
      }
    };
  } catch {
    return () => {};
  }
}

/* ==============================================================================
   PARTNER & PROFESSIONAL DATA ISOLATION (MULTI-TENANT)
   ============================================================================== */

export async function getSupabasePartnerProfile(userId: string) {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveSupabasePartnerProfile(userId: string, data: any) {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    const { error } = await supabase.from("partner_profiles").upsert({
      id: userId,
      ...data,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function getSupabaseProfessionalProfile(userId: string) {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("professional_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveSupabaseProfessionalProfile(userId: string, data: any) {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    const { error } = await supabase.from("professional_profiles").upsert({
      id: userId,
      ...data,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

/* ==============================================================================
   SUPABASE STORAGE (PUBLIC-ASSETS & PARTNER-DOCUMENTS)
   ============================================================================== */

export type StorageBucketName =
  | "public-assets"
  | "admin-documents"
  | "partner-documents"
  | "payment-proofs";

export async function uploadToSupabaseStorageStrict(
  bucket: StorageBucketName,
  filePath: string,
  fileOrBlob: Blob | File,
  explicitContentType?: string
): Promise<{ ok: boolean; path?: string; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  try {
    const contentType =
      explicitContentType ||
      (fileOrBlob.type && fileOrBlob.type.trim() ? fileOrBlob.type.trim() : undefined);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileOrBlob, {
        upsert: true,
        cacheControl: "3600",
        ...(contentType ? { contentType } : {}),
      });

    if (error) {
      console.warn(`Supabase Storage upload error (${bucket}):`, error.message);
      return { ok: false, error: error.message };
    }

    if (bucket === "public-assets") {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { ok: true, path: filePath, url: data?.publicUrl || undefined };
    }

    const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
    return { ok: true, path: filePath, url: data?.signedUrl || filePath };
  } catch (err: any) {
    console.warn(`Exception uploading to Supabase Storage (${bucket}):`, err);
    return { ok: false, error: err?.message || "Erro ao carregar ficheiro no Supabase Storage." };
  }
}

export async function uploadToSupabaseStorage(
  bucket: StorageBucketName,
  filePath: string,
  fileOrBlob: Blob | File,
  explicitContentType?: string
): Promise<string | null> {
  const res = await uploadToSupabaseStorageStrict(
    bucket,
    filePath,
    fileOrBlob,
    explicitContentType
  );
  return res.ok ? res.url || res.path || null : null;
}

export async function uploadPublicDocumentToStorage(
  file: File
): Promise<{
  ok: boolean;
  path?: string;
  url?: string;
  bucket?: string;
  mimeType?: string;
  size?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  const safeBase = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40) || "documento";
  const extFromMime =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/webp"
      ? "webp"
      : file.type === "image/gif"
      ? "gif"
      : file.type === "image/svg+xml"
      ? "svg"
      : (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

  const rand = Math.random().toString(36).slice(2, 7);
  const filePath = `documents/${Date.now()}_${rand}_${safeBase}.${extFromMime}`;
  const res = await uploadToSupabaseStorageStrict("public-assets", filePath, file, file.type);
  if (!res.ok) return res;
  return {
    ...res,
    bucket: "public-assets",
    mimeType: file.type,
    size: file.size,
  };
}

export async function uploadPaymentProofToStorage(
  file: File,
  userId: string,
  referenceId: string
): Promise<{ ok: boolean; path?: string; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não está configurado." };
  }
  const safeUser = (userId || "anon").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeRef = (referenceId || "order").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filePath = `${safeUser}/${safeRef}-${Date.now()}.${ext}`;
  return uploadToSupabaseStorageStrict("payment-proofs", filePath, file, file.type);
}

/**
 * Safely delete a file from Supabase Storage bucket
 */
export async function deleteSupabaseStorageFile(
  bucket: StorageBucketName,
  filePath: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !filePath) return false;
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      console.warn(`Supabase Storage remove error (${bucket}/${filePath}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Exception deleting file from Supabase Storage (${bucket}):`, err);
    return false;
  }
}
