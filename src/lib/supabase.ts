import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Product, Service } from "./data";
import type { BookingRecord, ProductOrderRecord } from "./store";

// VITE client environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * Checks if Supabase credentials have been configured in .env or Vercel dashboard.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("your-project")
  );
}

/**
 * Official Supabase Client
 * Initialized with anon key for browser-safe operations with Row-Level-Security (RLS).
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

/* ==============================================================================
   SUPABASE DATA ACCESS HELPERS
   Works seamlessly alongside store.ts (with graceful fallback if offline/unconfigured)
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
 * Saves or updates a product in Supabase
 */
export async function saveSupabaseProduct(prod: Product): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
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
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase save product exception:", err);
    return false;
  }
}

/**
 * Saves a new Booking to Supabase
 */
export async function syncBookingToSupabase(booking: BookingRecord): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("bookings").upsert({
      id: booking.id,
      service_id: booking.serviceId,
      service_name: booking.service,
      category: booking.category,
      customer_name: booking.customer,
      customer_phone: booking.phone,
      date: booking.date,
      time: booking.slot,
      location: booking.address,
      province: (booking as any).province || "Huambo",
      municipio: (booking as any).municipio || "Huambo",
      bairro: (booking as any).bairro || null,
      details: booking.details || null,
      status: booking.status,
      payment_status: booking.paymentStatus,
      payment_method: booking.payment,
      payment_reference: booking.paymentReference || null,
      payment_details: booking.paymentDetails || {},
      proof_of_payment: booking.proofOfPayment || null,
      total_aoa: booking.total,
      assigned_to: booking.assignedTo || null,
      partner_id: booking.partnerId || null,
      history: booking.history || [],
      rating: booking.rating || null,
      review_comment: booking.reviewComment || null,
    });
    if (error) {
      console.warn("Supabase sync booking error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase sync booking exception:", err);
    return false;
  }
}

/**
 * Saves a new Product Order to Supabase
 */
export async function syncOrderToSupabase(order: ProductOrderRecord): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("product_orders").upsert({
      id: order.id,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      items: order.items,
      subtotal_aoa: order.subtotalAOA,
      delivery_fee_aoa: order.deliveryFeeAOA,
      discount_aoa: order.discountAOA,
      total_aoa: order.totalAOA,
      delivery_address: order.deliveryAddress,
      delivery_bairro: order.deliveryBairro,
      delivery_province: (order as any).deliveryProvince || "Huambo",
      delivery_municipio: (order as any).deliveryMunicipio || "Huambo",
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      payment_reference: order.paymentReference || null,
      payment_details: order.paymentDetails || {},
      proof_of_payment: order.proofOfPayment || null,
      order_status: order.orderStatus,
      seller_names: order.sellerNames || [],
    });
    if (error) {
      console.warn("Supabase sync order error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase sync order exception:", err);
    return false;
  }
}

/**
 * Syncs user wallet with Supabase via secure transactional RPC
 */
export async function syncWalletToSupabase(
  userId: string,
  balanceAOA: number,
  transaction?: {
    type: "credit" | "debit";
    amountAOA: number;
    description: string;
    reference?: string;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    if (transaction) {
      // Use transactional RPC with row-level locks, balance checks and idempotency
      const { data, error } = await supabase.rpc("execute_wallet_movement", {
        p_user_id: userId,
        p_type: transaction.type,
        p_amount: transaction.amountAOA,
        p_description: transaction.description,
        p_reference: transaction.reference || null,
      });

      if (error) {
        console.warn("Wallet RPC execution warning (falling back to direct update):", error.message);
        // Fallback for dev/unmigrated schema:
        await supabase.from("wallets").upsert({
          user_id: userId,
          balance_aoa: balanceAOA,
          updated_at: new Date().toISOString(),
        });
      }
      return !error;
    } else {
      await supabase.from("wallets").upsert({
        user_id: userId,
        balance_aoa: balanceAOA,
        updated_at: new Date().toISOString(),
      });
      return true;
    }
  } catch (err) {
    console.warn("Supabase sync wallet error:", err);
    return false;
  }
}

/* ==============================================================================
   AUTHENTICATION & PROFILE SERVICES (SUPABASE AUTH + PROFILES)
   ============================================================================== */

export function mapDbRoleToUserRole(dbRole: string): import("./store").UserRole {
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
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error("Supabase não está configurado.") };
  }
  return await supabase.auth.signInWithPassword({
    email,
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
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error("Supabase não está configurado.") };
  }
  return await supabase.auth.signUp({
    email: params.email,
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

/**
 * Fetch user profile from public.profiles
 */
export async function getSupabaseProfile(userId: string) {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Error fetching Supabase profile:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("Exception fetching Supabase profile:", err);
    return null;
  }
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

export async function getSupabasePlatformSettings(): Promise<any | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("settings, updated_at")
      .eq("id", "global")
      .maybeSingle();

    if (error) {
      console.warn("Could not read platform_settings from Supabase:", error.message);
      return null;
    }
    return data?.settings || null;
  } catch (err) {
    console.warn("Exception reading platform_settings:", err);
    return null;
  }
}

export async function saveSupabasePlatformSettings(settings: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("platform_settings").upsert({
      id: "global",
      settings,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("Could not save platform_settings to Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Exception saving platform_settings:", err);
    return false;
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

export async function uploadToSupabaseStorage(
  bucket: "public-assets" | "partner-documents",
  filePath: string,
  fileOrBlob: Blob | File
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileOrBlob, {
        upsert: true,
        cacheControl: "3600",
      });

    if (error) {
      console.warn(`Supabase Storage upload error (${bucket}):`, error.message);
      return null;
    }

    if (bucket === "public-assets") {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data?.publicUrl || null;
    } else {
      // Signed URL for private documents (e.g. 1 hour validity)
      const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
      return data?.signedUrl || null;
    }
  } catch (err) {
    console.warn(`Exception uploading to Supabase Storage (${bucket}):`, err);
    return null;
  }
}

/**
 * Safely delete a file from Supabase Storage bucket
 */
export async function deleteSupabaseStorageFile(
  bucket: "public-assets" | "partner-documents",
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
