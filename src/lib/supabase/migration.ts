import {
  isSupabaseConfigured,
  getSupabasePlatformSettings,
  saveSupabasePlatformSettings,
} from "../supabase";
import { isTransientLocalUrl } from "./storage";

const LEGACY_STORAGE_KEY = "rex:v2";

export interface LocalMigrationInspection {
  hasLegacyData: boolean;
  migratableKeys: string[];
  skippedTransientAssets: Array<{ location: string; reason: string }>;
  hasBase64OrBlob: boolean;
}

export interface LocalMigrationResult {
  ok: boolean;
  migratedKeys: string[];
  skippedTransientAssets: Array<{ location: string; reason: string }>;
  cleanedLocalCache: boolean;
  error?: string;
}

function readRawLegacyStore(): Record<string, any> | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function scanTransientRefs(
  val: any,
  path: string,
  out: Array<{ location: string; reason: string }>
) {
  if (typeof val === "string") {
    if (isTransientLocalUrl(val)) {
      out.push({
        location: path,
        reason: val.trim().startsWith("data:")
          ? "Imagem Base64 local (requer novo upload para o Supabase Storage)"
          : "URL temporário blob: (requer novo upload para o Supabase Storage)",
      });
    }
    return;
  }
  if (Array.isArray(val)) {
    val.forEach((item, idx) => scanTransientRefs(item, `${path}[${idx}]`, out));
    return;
  }
  if (val && typeof val === "object") {
    Object.keys(val).forEach((k) => {
      scanTransientRefs(val[k], path ? `${path}.${k}` : k, out);
    });
  }
}

function stripTransientRefs<T>(val: T): T {
  if (typeof val === "string") {
    return (isTransientLocalUrl(val) ? "" : val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripTransientRefs(item)) as unknown as T;
  }
  if (val && typeof val === "object") {
    const clean: Record<string, any> = {};
    for (const key of Object.keys(val as Record<string, any>)) {
      clean[key] = stripTransientRefs((val as Record<string, any>)[key]);
    }
    return clean as T;
  }
  return val;
}

const MIGRATABLE_ADMIN_KEYS = [
  "customLogo",
  "heroBanners",
  "categoryOverrides",
  "serviceOverrides",
  "customServices",
  "deletedServices",
  "products",
  "publicDocuments",
  "whatsapp",
  "whatsappDefault",
  "supportPhone",
  "supportEmail",
  "supportDays",
  "supportHours",
  "coupons",
  "contracts",
] as const;

export function inspectLocalLegacyAdminState(): LocalMigrationInspection {
  const parsed = readRawLegacyStore();
  if (!parsed) {
    return {
      hasLegacyData: false,
      migratableKeys: [],
      skippedTransientAssets: [],
      hasBase64OrBlob: false,
    };
  }

  const migratableKeys: string[] = [];
  const skippedTransientAssets: Array<{ location: string; reason: string }> = [];

  for (const key of MIGRATABLE_ADMIN_KEYS) {
    const val = parsed[key];
    if (val === undefined || val === null || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) {
      continue;
    }
    migratableKeys.push(key);
    scanTransientRefs(val, key, skippedTransientAssets);
  }

  return {
    hasLegacyData: migratableKeys.length > 0 || skippedTransientAssets.length > 0,
    migratableKeys,
    skippedTransientAssets,
    hasBase64OrBlob: skippedTransientAssets.length > 0,
  };
}

function mergeArrayById<T extends { id?: string }>(
  remoteArr: T[],
  localArr: T[]
): T[] {
  const existingIds = new Set(remoteArr.map((item) => item?.id).filter(Boolean));
  const merged = [...remoteArr];
  for (const localItem of localArr) {
    if (!localItem) continue;
    if (localItem.id && existingIds.has(localItem.id)) continue;
    const cleaned = stripTransientRefs(localItem);
    // Avoid migrating broken items that had only a transient image/fileUrl
    if ((cleaned as any).fileUrl === "") continue;
    merged.push(cleaned);
    if (localItem.id) existingIds.add(localItem.id);
  }
  return merged;
}

/**
 * Controlled, idempotent migration from legacy localStorage (rex:v2) to Supabase platform_settings.
 * Never deletes bookings, orders, customer cart, or preferences.
 * Never pushes Base64/blob URLs to Supabase.
 */
export async function migrateLocalAdminDataToSupabase(): Promise<LocalMigrationResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      migratedKeys: [],
      skippedTransientAssets: [],
      cleanedLocalCache: false,
      error: "Supabase não está configurado.",
    };
  }

  const localStore = readRawLegacyStore();
  if (!localStore) {
    return {
      ok: true,
      migratedKeys: [],
      skippedTransientAssets: [],
      cleanedLocalCache: false,
    };
  }

  const inspection = inspectLocalLegacyAdminState();
  if (!inspection.hasLegacyData) {
    return {
      ok: true,
      migratedKeys: [],
      skippedTransientAssets: [],
      cleanedLocalCache: false,
    };
  }

  try {
    const remoteSettings = (await getSupabasePlatformSettings()) || {};
    const patch: Record<string, any> = {};
    const migratedKeys: string[] = [];

    // 1. Custom Logo (only if remote doesn't already have one and local isn't Base64/blob)
    if (
      !remoteSettings.customLogo &&
      typeof localStore.customLogo === "string" &&
      localStore.customLogo.trim() &&
      !isTransientLocalUrl(localStore.customLogo)
    ) {
      patch.customLogo = localStore.customLogo.trim();
      migratedKeys.push("customLogo");
    }

    // 2. Hero Banners (merge missing banners by ID, stripping any transient URLs)
    if (Array.isArray(localStore.heroBanners) && localStore.heroBanners.length > 0) {
      const remoteBanners = Array.isArray(remoteSettings.heroBanners)
        ? remoteSettings.heroBanners
        : [];
      const mergedBanners = mergeArrayById(remoteBanners, localStore.heroBanners);
      if (mergedBanners.length > remoteBanners.length) {
        patch.heroBanners = mergedBanners;
        migratedKeys.push("heroBanners");
      }
    }

    // 3. Object override maps (categoryOverrides, serviceOverrides) - remote takes precedence
    for (const mapKey of ["categoryOverrides", "serviceOverrides"] as const) {
      const localMap = localStore[mapKey];
      if (localMap && typeof localMap === "object" && !Array.isArray(localMap)) {
        const remoteMap =
          remoteSettings[mapKey] && typeof remoteSettings[mapKey] === "object"
            ? remoteSettings[mapKey]
            : {};
        const nextMap = { ...remoteMap };
        let changed = false;
        for (const k of Object.keys(localMap)) {
          if (!nextMap[k]) {
            nextMap[k] = stripTransientRefs(localMap[k]);
            changed = true;
          }
        }
        if (changed) {
          patch[mapKey] = nextMap;
          migratedKeys.push(mapKey);
        }
      }
    }

    // 4. Arrays merged without duplicates by id
    for (const arrKey of ["customServices", "products", "publicDocuments"] as const) {
      const localArr = localStore[arrKey];
      if (Array.isArray(localArr) && localArr.length > 0) {
        const remoteArr = Array.isArray(remoteSettings[arrKey])
          ? remoteSettings[arrKey]
          : [];
        const mergedArr = mergeArrayById(remoteArr, localArr);
        if (mergedArr.length > remoteArr.length) {
          patch[arrKey] = mergedArr;
          migratedKeys.push(arrKey);
        }
      }
    }

    if (migratedKeys.length > 0) {
      const saved = await saveSupabasePlatformSettings(patch);
      if (!saved) {
        return {
          ok: false,
          migratedKeys: [],
          skippedTransientAssets: inspection.skippedTransientAssets,
          cleanedLocalCache: false,
          error:
            "Não foi possível guardar os dados migrados em platform_settings (verifique sessão de Super Admin).",
        };
      }
    }

    // Safely prune shared admin catalogs and Base64 clutter from localStorage
    // while keeping customer preferences, cart, bookings, and orders intact.
    let cleanedLocalCache = false;
    try {
      const sanitizedLocal: Record<string, any> = {
        currency: localStore.currency,
        language: localStore.language,
        location: localStore.location,
        subscriptionPlan: localStore.subscriptionPlan,
        cart: localStore.cart,
        clientFavorites: localStore.clientFavorites,
        clientFavoriteProducts: localStore.clientFavoriteProducts,
        clientAddresses: localStore.clientAddresses,
        bookings: localStore.bookings,
        productOrders: localStore.productOrders,
        activeAffiliateRef: localStore.activeAffiliateRef,
      };
      window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(sanitizedLocal));
      cleanedLocalCache = true;
    } catch {
      cleanedLocalCache = false;
    }

    return {
      ok: true,
      migratedKeys,
      skippedTransientAssets: inspection.skippedTransientAssets,
      cleanedLocalCache,
    };
  } catch (err: any) {
    return {
      ok: false,
      migratedKeys: [],
      skippedTransientAssets: inspection.skippedTransientAssets,
      cleanedLocalCache: false,
      error: err?.message || "Erro inesperado na migração de dados locais.",
    };
  }
}
