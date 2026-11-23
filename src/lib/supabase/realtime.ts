import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  supabase,
  isSupabaseConfigured,
  getSupabasePlatformSettingsResult,
} from "../supabase";
import {
  getPlatformAssets,
  getPublicAssetUrl,
  type PlatformAsset,
} from "./storage";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "subscribed"
  | "reconnecting"
  | "error"
  | "offline";

export interface PlatformAssetsCallbacks {
  onInitial?: (assets: PlatformAsset[]) => void;
  onInsert?: (asset: PlatformAsset) => void;
  onUpdate?: (asset: PlatformAsset) => void;
  onDelete?: (oldRow: Partial<PlatformAsset>) => void;
  onStatus?: (status: RealtimeStatus) => void;
}

export interface PlatformSettingsCallbacks {
  onInitial?: (settings: Record<string, any>) => void;
  onChange?: (settings: Record<string, any>) => void;
  onStatus?: (status: RealtimeStatus) => void;
  onSyncState?: (confirmed: boolean, error?: string | null) => void;
}

function hydrateRealtimeAsset(row: any): PlatformAsset {
  const bucketId = String(row?.bucket_id || "public-assets");
  const visibility = row?.visibility === "private" ? "private" : "public";
  const storagePath = String(row?.storage_path || "");
  return {
    id: String(row?.id || ""),
    title: row?.title ?? null,
    description: row?.description ?? null,
    bucket_id: bucketId,
    storage_path: storagePath,
    file_name: String(row?.file_name || ""),
    mime_type: String(row?.mime_type || "application/octet-stream"),
    file_size: Number(row?.file_size || 0),
    category: String(row?.category || "general"),
    visibility,
    uploaded_by: row?.uploaded_by ?? null,
    created_at: String(row?.created_at || new Date().toISOString()),
    updated_at: String(row?.updated_at || row?.created_at || new Date().toISOString()),
    public_url:
      bucketId === "public-assets" && visibility === "public" && storagePath
        ? getPublicAssetUrl(storagePath, "public-assets")
        : null,
  };
}

let assetsChannel: RealtimeChannel | null = null;
let assetsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let assetsReconnectAttempts = 0;
let assetsStatus: RealtimeStatus = "idle";
const assetSubscribers = new Set<PlatformAssetsCallbacks>();

let settingsChannel: RealtimeChannel | null = null;
let settingsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let settingsReconnectAttempts = 0;
let settingsStatus: RealtimeStatus = "idle";
const settingsSubscribers = new Set<PlatformSettingsCallbacks>();

let networkListenersAttached = false;

function notifyAssetsStatus(next: RealtimeStatus) {
  assetsStatus = next;
  assetSubscribers.forEach((cb) => cb.onStatus?.(next));
}

function notifySettingsStatus(next: RealtimeStatus) {
  settingsStatus = next;
  settingsSubscribers.forEach((cb) => cb.onStatus?.(next));
}

export async function refreshPlatformAssetsSnapshot() {
  if (!isSupabaseConfigured()) return;
  const res = await getPlatformAssets({ limit: 250 });
  if (res.ok) {
    assetSubscribers.forEach((cb) => cb.onInitial?.(res.assets));
  }
}

export async function refreshPlatformSettingsSnapshot() {
  if (!isSupabaseConfigured()) return;
  const res = await getSupabasePlatformSettingsResult();
  if (res.ok) {
    settingsSubscribers.forEach((cb) => cb.onSyncState?.(true, null));
    if (res.settings && typeof res.settings === "object" && Object.keys(res.settings).length > 0) {
      settingsSubscribers.forEach((cb) => cb.onInitial?.(res.settings));
    }
  } else {
    settingsSubscribers.forEach((cb) => cb.onSyncState?.(false, res.error || "Falha ao ler platform_settings"));
  }
}

function attachNetworkRecoveryListeners() {
  if (networkListenersAttached || typeof window === "undefined") return;
  networkListenersAttached = true;

  window.addEventListener("online", () => {
    if (!isSupabaseConfigured()) return;
    if (assetSubscribers.size > 0) {
      refreshPlatformAssetsSnapshot();
      ensureAssetsChannel(true);
    }
    if (settingsSubscribers.size > 0) {
      refreshPlatformSettingsSnapshot();
      ensureSettingsChannel(true);
    }
  });

  window.addEventListener("offline", () => {
    if (assetSubscribers.size > 0) notifyAssetsStatus("offline");
    if (settingsSubscribers.size > 0) notifySettingsStatus("offline");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isSupabaseConfigured()) {
      if (assetSubscribers.size > 0) refreshPlatformAssetsSnapshot();
      if (settingsSubscribers.size > 0) refreshPlatformSettingsSnapshot();
    }
  });
}

function teardownAssetsChannel() {
  if (assetsReconnectTimer) {
    clearTimeout(assetsReconnectTimer);
    assetsReconnectTimer = null;
  }
  if (assetsChannel) {
    try {
      supabase.removeChannel(assetsChannel);
    } catch {
      // Ignore cleanup errors
    }
    assetsChannel = null;
  }
}

function scheduleAssetsReconnect() {
  if (assetsReconnectTimer || assetSubscribers.size === 0 || !isSupabaseConfigured()) {
    return;
  }
  const delayMs = Math.min(30000, 1500 * Math.pow(2, assetsReconnectAttempts));
  assetsReconnectAttempts = Math.min(assetsReconnectAttempts + 1, 5);
  notifyAssetsStatus("reconnecting");
  assetsReconnectTimer = setTimeout(() => {
    assetsReconnectTimer = null;
    if (assetSubscribers.size > 0) {
      ensureAssetsChannel(true);
    }
  }, delayMs);
}

function ensureAssetsChannel(forceRecreate = false) {
  if (!isSupabaseConfigured() || typeof window === "undefined") return;
  if (assetsChannel && !forceRecreate) return;

  teardownAssetsChannel();
  notifyAssetsStatus("connecting");

  const channel = supabase
    .channel("resolve-express:platform_assets")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "platform_assets",
      },
      (payload: any) => {
        if (payload.eventType === "INSERT" && payload.new) {
          const asset = hydrateRealtimeAsset(payload.new);
          assetSubscribers.forEach((cb) => cb.onInsert?.(asset));
        } else if (payload.eventType === "UPDATE" && payload.new) {
          const asset = hydrateRealtimeAsset(payload.new);
          assetSubscribers.forEach((cb) => cb.onUpdate?.(asset));
        } else if (payload.eventType === "DELETE" && payload.old) {
          const oldRow: Partial<PlatformAsset> = {
            id: payload.old.id ? String(payload.old.id) : undefined,
            storage_path: payload.old.storage_path,
            bucket_id: payload.old.bucket_id,
          };
          assetSubscribers.forEach((cb) => cb.onDelete?.(oldRow));
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        assetsReconnectAttempts = 0;
        notifyAssetsStatus("subscribed");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        notifyAssetsStatus("error");
        scheduleAssetsReconnect();
      } else if (status === "CLOSED") {
        if (assetSubscribers.size > 0) {
          scheduleAssetsReconnect();
        } else {
          notifyAssetsStatus("idle");
        }
      }
    });

  assetsChannel = channel;
}

function teardownSettingsChannel() {
  if (settingsReconnectTimer) {
    clearTimeout(settingsReconnectTimer);
    settingsReconnectTimer = null;
  }
  if (settingsChannel) {
    try {
      supabase.removeChannel(settingsChannel);
    } catch {
      // Ignore cleanup errors
    }
    settingsChannel = null;
  }
}

function scheduleSettingsReconnect() {
  if (
    settingsReconnectTimer ||
    settingsSubscribers.size === 0 ||
    !isSupabaseConfigured()
  ) {
    return;
  }
  const delayMs = Math.min(30000, 1500 * Math.pow(2, settingsReconnectAttempts));
  settingsReconnectAttempts = Math.min(settingsReconnectAttempts + 1, 5);
  notifySettingsStatus("reconnecting");
  settingsReconnectTimer = setTimeout(() => {
    settingsReconnectTimer = null;
    if (settingsSubscribers.size > 0) {
      ensureSettingsChannel(true);
    }
  }, delayMs);
}

function ensureSettingsChannel(forceRecreate = false) {
  if (!isSupabaseConfigured() || typeof window === "undefined") return;
  if (settingsChannel && !forceRecreate) return;

  teardownSettingsChannel();
  notifySettingsStatus("connecting");

  const channel = supabase
    .channel("resolve-express:platform_settings")
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
        if (nextSettings && typeof nextSettings === "object" && Object.keys(nextSettings).length > 0) {
          settingsSubscribers.forEach((cb) => {
            cb.onSyncState?.(true, null);
            cb.onChange?.(nextSettings);
          });
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        settingsReconnectAttempts = 0;
        notifySettingsStatus("subscribed");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        notifySettingsStatus("error");
        scheduleSettingsReconnect();
      } else if (status === "CLOSED") {
        if (settingsSubscribers.size > 0) {
          scheduleSettingsReconnect();
        } else {
          notifySettingsStatus("idle");
        }
      }
    });

  settingsChannel = channel;
}

export function subscribeToPlatformAssets(
  callbacks: PlatformAssetsCallbacks
): () => void {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    callbacks.onStatus?.("idle");
    return () => {};
  }

  attachNetworkRecoveryListeners();
  assetSubscribers.add(callbacks);
  callbacks.onStatus?.(assetsStatus);
  ensureAssetsChannel(false);

  // Initial authoritative snapshot
  getPlatformAssets({ limit: 250 }).then((res) => {
    if (res.ok && assetSubscribers.has(callbacks)) {
      callbacks.onInitial?.(res.assets);
    }
  });

  return () => {
    assetSubscribers.delete(callbacks);
    if (assetSubscribers.size === 0) {
      teardownAssetsChannel();
      assetsStatus = "idle";
    }
  };
}

export function subscribeToPlatformSettings(
  callbacks: PlatformSettingsCallbacks
): () => void {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    callbacks.onStatus?.("idle");
    return () => {};
  }

  attachNetworkRecoveryListeners();
  settingsSubscribers.add(callbacks);
  callbacks.onStatus?.(settingsStatus);
  ensureSettingsChannel(false);

  // Initial authoritative snapshot
  getSupabasePlatformSettingsResult().then((res) => {
    if (!settingsSubscribers.has(callbacks)) return;
    if (res.ok) {
      callbacks.onSyncState?.(true, null);
      if (res.settings && typeof res.settings === "object" && Object.keys(res.settings).length > 0) {
        callbacks.onInitial?.(res.settings);
      }
    } else {
      callbacks.onSyncState?.(false, res.error || "Falha ao ler platform_settings");
    }
  });

  return () => {
    settingsSubscribers.delete(callbacks);
    if (settingsSubscribers.size === 0) {
      teardownSettingsChannel();
      settingsStatus = "idle";
    }
  };
}

export function getRealtimeHealthStatus(): {
  assetsStatus: RealtimeStatus;
  settingsStatus: RealtimeStatus;
} {
  return {
    assetsStatus,
    settingsStatus,
  };
}
