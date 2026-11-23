import { supabase, isSupabaseConfigured } from "../supabase";

export type ManagedBucket =
  | "public-assets"
  | "admin-documents"
  | "partner-documents"
  | "payment-proofs";

export type PublicAssetCategory =
  | "logos"
  | "banners"
  | "products"
  | "services"
  | "general";

export type AdminDocCategory =
  | "contracts"
  | "reports"
  | "invoices"
  | "general";

export type AssetCategory = PublicAssetCategory | AdminDocCategory | "documents";

export type AssetVisibility = "public" | "private";

export type StorageErrorCode =
  | "not_configured"
  | "unauthenticated"
  | "unauthorized"
  | "invalid_file_type"
  | "file_too_large"
  | "invalid_payload"
  | "upload_failed"
  | "db_failed"
  | "not_found"
  | "in_use"
  | "delete_failed"
  | "signed_url_failed";

export interface PlatformAsset {
  id: string;
  title: string | null;
  description: string | null;
  bucket_id: ManagedBucket | string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  category: string;
  visibility: AssetVisibility;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  public_url?: string | null;
}

export interface AssetReference {
  asset_id?: string;
  bucket_id: string;
  storage_path: string;
  url?: string;
  mime_type?: string;
  file_size?: number;
  updated_at?: string;
}

export const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB

export const PUBLIC_ASSET_ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

export const PRIVATE_DOC_ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ADMIN_MANAGED_ROLES = new Set<string>(["super_admin", "admin"]);
const STAFF_UPLOAD_ROLES = new Set<string>([
  "super_admin",
  "admin",
  "operacao",
  "apoio",
]);

export const PROTECTED_ASSET_PATTERNS = [
  "/assets/",
  "file_0000000077e8820eae7db33507894d75",
  "images.unsplash.com",
];

export function isProtectedDefaultAsset(urlOrPath?: string | null): boolean {
  if (!urlOrPath || typeof urlOrPath !== "string") return false;
  const trimmed = urlOrPath.trim();
  return PROTECTED_ASSET_PATTERNS.some((p) => trimmed.includes(p));
}

export function isTransientLocalUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith("data:") || trimmed.startsWith("blob:");
}

export function sanitizeStorageFileName(fileName: string): {
  baseName: string;
  ext: string;
} {
  const rawName = (fileName || "ficheiro").split(/[/\\]/).pop() || "ficheiro";
  const lastDot = rawName.lastIndexOf(".");
  const rawBase = lastDot > 0 ? rawName.slice(0, lastDot) : rawName;
  const rawExt = lastDot > 0 ? rawName.slice(lastDot + 1) : "";

  const baseName =
    rawBase
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "ficheiro";

  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  return { baseName, ext };
}

export function resolveExtensionFromMime(mimeType: string, fallbackExt = ""): string {
  switch ((mimeType || "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "application/pdf":
      return "pdf";
    default:
      return fallbackExt || "bin";
  }
}

function generateUniqueSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return `${Math.random().toString(36).slice(2, 8)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function normalizeCategoryForBucket(
  bucketId: ManagedBucket,
  category?: string
): string {
  const clean = (category || "general").trim().toLowerCase();
  if (bucketId === "public-assets") {
    if (
      clean === "logos" ||
      clean === "banners" ||
      clean === "products" ||
      clean === "services" ||
      clean === "general"
    ) {
      return clean;
    }
    return "general";
  }
  if (bucketId === "admin-documents") {
    if (
      clean === "contracts" ||
      clean === "reports" ||
      clean === "invoices" ||
      clean === "general"
    ) {
      return clean;
    }
    return "general";
  }
  if (bucketId === "partner-documents") {
    return "documents";
  }
  return clean || "general";
}

export function buildOrganizedStoragePath(params: {
  bucketId: ManagedBucket;
  userId: string;
  category?: string;
  fileName: string;
  mimeType: string;
}): string {
  const { baseName, ext: rawExt } = sanitizeStorageFileName(params.fileName);
  const ext = resolveExtensionFromMime(params.mimeType, rawExt);
  const uniqueId = generateUniqueSuffix();
  const ts = Date.now();
  const safeUserId = params.userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const folder = normalizeCategoryForBucket(params.bucketId, params.category);

  if (params.bucketId === "partner-documents") {
    return `${safeUserId}/documents/${ts}_${uniqueId}_${baseName}.${ext}`;
  }

  if (params.bucketId === "payment-proofs") {
    return `${safeUserId}/${ts}_${uniqueId}_${baseName}.${ext}`;
  }

  // public-assets and admin-documents follow super-admin/{user_id}/{category}/...
  return `super-admin/${safeUserId}/${folder}/${ts}_${uniqueId}_${baseName}.${ext}`;
}

export function validateFileForBucket(
  file: File | Blob,
  bucketId: ManagedBucket,
  explicitMimeType?: string
): { ok: true; mimeType: string } | { ok: false; code: StorageErrorCode; error: string } {
  if (!file || typeof file.size !== "number") {
    return {
      ok: false,
      code: "invalid_payload",
      error: "Nenhum ficheiro válido foi selecionado.",
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      code: "invalid_payload",
      error: "O ficheiro selecionado está vazio.",
    };
  }

  if (file.size > MAX_ASSET_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      error: "O ficheiro excede o limite máximo permitido de 10 MB.",
    };
  }

  let mimeType = (explicitMimeType || file.type || "").trim().toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";

  if (!mimeType && "name" in file && typeof file.name === "string") {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".pdf")) mimeType = "application/pdf";
    else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) mimeType = "image/jpeg";
    else if (lowerName.endsWith(".png")) mimeType = "image/png";
    else if (lowerName.endsWith(".webp")) mimeType = "image/webp";
    else if (lowerName.endsWith(".gif")) mimeType = "image/gif";
    else if (lowerName.endsWith(".svg")) mimeType = "image/svg+xml";
  }

  const allowedSet =
    bucketId === "public-assets" ? PUBLIC_ASSET_ALLOWED_MIME : PRIVATE_DOC_ALLOWED_MIME;

  if (!mimeType || !allowedSet.has(mimeType)) {
    const acceptedLabel =
      bucketId === "public-assets"
        ? "JPEG, PNG, WebP, GIF, SVG ou PDF"
        : "PDF, JPEG, PNG ou WebP";
    return {
      ok: false,
      code: "invalid_file_type",
      error: `Formato de ficheiro não permitido para ${bucketId}. Aceite: ${acceptedLabel}.`,
    };
  }

  return { ok: true, mimeType };
}

async function verifyAuthenticatedUserRole(allowedRoles?: Set<string>): Promise<
  | { ok: true; userId: string; role: string }
  | { ok: false; code: StorageErrorCode; error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      error: "Supabase não está configurado no ambiente atual.",
    };
  }

  const { data: userData, error: authError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (authError || !user) {
    return {
      ok: false,
      code: "unauthenticated",
      error: "Sessão autenticada no Supabase obrigatória para gerir ficheiros.",
    };
  }

  const { data: profile, error: profError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profError) {
    return {
      ok: false,
      code: "unauthorized",
      error: "Não foi possível confirmar as permissões da conta no Supabase.",
    };
  }

  const role = String(profile?.role || "cliente").trim().toLowerCase();
  if (allowedRoles && !allowedRoles.has(role)) {
    return {
      ok: false,
      code: "unauthorized",
      error: "Acesso negado: apenas o Super Admin ou equipa autorizada pode realizar esta operação.",
    };
  }

  return { ok: true, userId: user.id, role };
}

export function getPublicAssetUrl(
  storagePath: string,
  bucketId: ManagedBucket = "public-assets"
): string | null {
  if (!storagePath || !isSupabaseConfigured()) return null;
  if (bucketId !== "public-assets") return null;
  const cleanPath = storagePath.replace(/^\/+/, "");
  const { data } = supabase.storage.from("public-assets").getPublicUrl(cleanPath);
  return data?.publicUrl || null;
}

export function extractAssetStoragePathFromUrl(
  url: string,
  bucketId: ManagedBucket = "public-assets"
): string | null {
  if (!url || typeof url !== "string") return null;
  const marker = `/storage/v1/object/public/${bucketId}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rawPath = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  if (!rawPath || rawPath.includes("..") || rawPath.startsWith("/")) {
    return null;
  }
  return rawPath;
}

export async function getPrivateAssetSignedUrl(
  bucketId: "admin-documents" | "partner-documents" | "payment-proofs",
  storagePath: string,
  expiresInSeconds = 300
): Promise<{
  ok: boolean;
  signedUrl?: string;
  code?: StorageErrorCode;
  error?: string;
}> {
  if (!storagePath || typeof storagePath !== "string") {
    return {
      ok: false,
      code: "invalid_payload",
      error: "Caminho do ficheiro privado em falta.",
    };
  }

  const allowedRoles =
    bucketId === "admin-documents" ? ADMIN_MANAGED_ROLES : undefined;
  const authCheck = await verifyAuthenticatedUserRole(allowedRoles);
  if (!authCheck.ok) {
    return { ok: false, code: authCheck.code, error: authCheck.error };
  }

  // Partner documents must only be requested by the owning partner or staff/admin
  if (bucketId === "partner-documents" && !STAFF_UPLOAD_ROLES.has(authCheck.role)) {
    const cleanPath = storagePath.replace(/^\/+/, "");
    const ownerPrefix = cleanPath.split("/")[0];
    if (ownerPrefix !== authCheck.userId) {
      return {
        ok: false,
        code: "unauthorized",
        error: "Acesso negado ao documento privado solicitado.",
      };
    }
  }

  try {
    const cleanPath = storagePath.replace(/^\/+/, "");
    const { data, error } = await supabase.storage
      .from(bucketId)
      .createSignedUrl(cleanPath, Math.max(60, Math.min(3600, expiresInSeconds)));

    if (error || !data?.signedUrl) {
      return {
        ok: false,
        code: "signed_url_failed",
        error: error?.message || "Não foi possível gerar link temporário seguro.",
      };
    }

    return { ok: true, signedUrl: data.signedUrl };
  } catch (err: any) {
    return {
      ok: false,
      code: "signed_url_failed",
      error: err?.message || "Erro inesperado ao gerar acesso temporário.",
    };
  }
}

function hydrateAssetPublicUrl(row: any): PlatformAsset {
  const bucket = String(row.bucket_id || "public-assets");
  const visibility: AssetVisibility =
    row.visibility === "private" ? "private" : "public";
  const publicUrl =
    bucket === "public-assets" && visibility === "public"
      ? getPublicAssetUrl(row.storage_path, "public-assets")
      : null;

  return {
    id: String(row.id),
    title: row.title ?? null,
    description: row.description ?? null,
    bucket_id: bucket,
    storage_path: String(row.storage_path),
    file_name: String(row.file_name),
    mime_type: String(row.mime_type || "application/octet-stream"),
    file_size: Number(row.file_size || 0),
    category: String(row.category || "general"),
    visibility,
    uploaded_by: row.uploaded_by ?? null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
    public_url: publicUrl,
  };
}

export async function uploadPlatformAsset(params: {
  file: File | Blob;
  fileName?: string;
  title?: string;
  description?: string;
  bucketId?: "public-assets" | "admin-documents" | "partner-documents";
  category?: AssetCategory;
  visibility?: AssetVisibility;
}): Promise<{
  ok: boolean;
  asset?: PlatformAsset;
  url?: string;
  code?: StorageErrorCode;
  error?: string;
}> {
  const bucketId: ManagedBucket = params.bucketId || "public-assets";
  const visibility: AssetVisibility =
    bucketId === "public-assets"
      ? params.visibility === "private"
        ? "private"
        : "public"
      : "private";

  const requiredRoles =
    bucketId === "admin-documents"
      ? ADMIN_MANAGED_ROLES
      : bucketId === "public-assets"
      ? STAFF_UPLOAD_ROLES
      : undefined;

  const authCheck = await verifyAuthenticatedUserRole(requiredRoles);
  if (!authCheck.ok) {
    return { ok: false, code: authCheck.code, error: authCheck.error };
  }

  const fileValidation = validateFileForBucket(params.file, bucketId);
  if (!fileValidation.ok) {
    return {
      ok: false,
      code: fileValidation.code,
      error: fileValidation.error,
    };
  }

  const originalFileName =
    params.fileName ||
    ("name" in params.file && typeof params.file.name === "string"
      ? params.file.name
      : `ficheiro.${resolveExtensionFromMime(fileValidation.mimeType)}`);

  const category = normalizeCategoryForBucket(bucketId, params.category);
  const storagePath = buildOrganizedStoragePath({
    bucketId,
    userId: authCheck.userId,
    category,
    fileName: originalFileName,
    mimeType: fileValidation.mimeType,
  });

  try {
    const { error: uploadErr } = await supabase.storage
      .from(bucketId)
      .upload(storagePath, params.file, {
        contentType: fileValidation.mimeType,
        upsert: false,
        cacheControl: bucketId === "public-assets" ? "3600" : "0",
      });

    if (uploadErr) {
      return {
        ok: false,
        code: "upload_failed",
        error: `Falha ao enviar ficheiro para ${bucketId}: ${uploadErr.message}`,
      };
    }

    const now = new Date().toISOString();
    const { data: insertedRow, error: insertErr } = await supabase
      .from("platform_assets")
      .insert({
        title: (params.title || originalFileName.replace(/\.[^.]+$/, "")).trim(),
        description: params.description?.trim() || null,
        bucket_id: bucketId,
        storage_path: storagePath,
        file_name: originalFileName,
        mime_type: fileValidation.mimeType,
        file_size: params.file.size,
        category,
        visibility,
        uploaded_by: authCheck.userId,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (insertErr || !insertedRow) {
      // Roll back Storage file to avoid orphaned unindexed files
      await supabase.storage
        .from(bucketId)
        .remove([storagePath])
        .catch(() => {});
      return {
        ok: false,
        code: "db_failed",
        error: `Ficheiro enviado, mas falhou o registo em platform_assets: ${
          insertErr?.message || "Erro desconhecido"
        }`,
      };
    }

    const asset = hydrateAssetPublicUrl(insertedRow);
    let url = asset.public_url || undefined;

    if (!url && visibility === "private") {
      const signed = await getPrivateAssetSignedUrl(
        bucketId as "admin-documents" | "partner-documents",
        storagePath,
        300
      );
      if (signed.ok && signed.signedUrl) {
        url = signed.signedUrl;
      }
    }

    return {
      ok: true,
      asset,
      url,
    };
  } catch (err: any) {
    return {
      ok: false,
      code: "upload_failed",
      error: err?.message || "Erro inesperado ao carregar ficheiro para o Supabase.",
    };
  }
}

function countReferenceInObject(
  target: { url?: string; storagePath?: string; assetId?: string },
  obj: any
): number {
  if (!obj) return 0;
  let count = 0;
  const targetUrl = target.url?.trim();
  const targetPath = target.storagePath?.trim();
  const targetId = target.assetId?.trim();

  const walk = (val: any) => {
    if (typeof val === "string") {
      const v = val.trim();
      if ((targetUrl && v === targetUrl) || (targetPath && v === targetPath) || (targetId && v === targetId)) {
        count++;
      }
    } else if (Array.isArray(val)) {
      for (const item of val) walk(item);
    } else if (val && typeof val === "object") {
      for (const k of Object.keys(val)) walk(val[k]);
    }
  };
  walk(obj);
  return count;
}

export async function checkStoragePathReferences(params: {
  bucketId: ManagedBucket | string;
  storagePath: string;
  excludeAssetId?: string;
}): Promise<{ referenced: boolean; count: number }> {
  if (!isSupabaseConfigured() || !params.storagePath) {
    return { referenced: false, count: 0 };
  }

  let totalRefs = 0;

  try {
    // 1. Other platform_assets rows pointing to the exact same bucket/path
    const { data: samePathAssets } = await supabase
      .from("platform_assets")
      .select("id")
      .eq("bucket_id", params.bucketId)
      .eq("storage_path", params.storagePath);

    const otherAssetRows = (samePathAssets || []).filter(
      (r: any) => !params.excludeAssetId || r.id !== params.excludeAssetId
    );
    totalRefs += otherAssetRows.length;

    const publicUrl =
      params.bucketId === "public-assets"
        ? getPublicAssetUrl(params.storagePath, "public-assets") || undefined
        : undefined;

    // 2. platform_settings references
    const { data: settingsRow } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", "global")
      .maybeSingle();

    if (settingsRow?.settings) {
      totalRefs += countReferenceInObject(
        {
          url: publicUrl,
          storagePath: params.storagePath,
          assetId: params.excludeAssetId,
        },
        settingsRow.settings
      );
    }

    // 3. products table references (only applicable for public-assets)
    if (publicUrl) {
      const { count: prodCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("image", publicUrl);
      totalRefs += prodCount || 0;
    }
  } catch (err) {
    console.warn("Could not fully inspect asset references:", err);
  }

  return { referenced: totalRefs > 0, count: totalRefs };
}

export async function updatePlatformAsset(
  id: string,
  params: {
    file?: File | Blob;
    fileName?: string;
    title?: string;
    description?: string;
    category?: AssetCategory;
  }
): Promise<{
  ok: boolean;
  asset?: PlatformAsset;
  url?: string;
  code?: StorageErrorCode;
  error?: string;
}> {
  const authCheck = await verifyAuthenticatedUserRole(ADMIN_MANAGED_ROLES);
  if (!authCheck.ok) {
    return { ok: false, code: authCheck.code, error: authCheck.error };
  }

  const existingRes = await getPlatformAssetById(id);
  if (!existingRes.ok || !existingRes.asset) {
    return {
      ok: false,
      code: "not_found",
      error: existingRes.error || "Registo de ficheiro não encontrado em platform_assets.",
    };
  }

  const current = existingRes.asset;
  const bucketId = (current.bucket_id || "public-assets") as ManagedBucket;
  const nextCategory = params.category
    ? normalizeCategoryForBucket(bucketId, params.category)
    : current.category;

  let nextStoragePath = current.storage_path;
  let nextFileName = current.file_name;
  let nextMimeType = current.mime_type;
  let nextFileSize = current.file_size;
  let newFileUploaded = false;

  if (params.file) {
    const fileValidation = validateFileForBucket(params.file, bucketId);
    if (!fileValidation.ok) {
      return {
        ok: false,
        code: fileValidation.code,
        error: fileValidation.error,
      };
    }

    nextFileName =
      params.fileName ||
      ("name" in params.file && typeof params.file.name === "string"
        ? params.file.name
        : current.file_name);
    nextMimeType = fileValidation.mimeType;
    nextFileSize = params.file.size;
    nextStoragePath = buildOrganizedStoragePath({
      bucketId,
      userId: authCheck.userId,
      category: nextCategory,
      fileName: nextFileName,
      mimeType: nextMimeType,
    });

    // Step 1: Upload NEW file FIRST before updating metadata or touching old file
    const { error: uploadErr } = await supabase.storage
      .from(bucketId)
      .upload(nextStoragePath, params.file, {
        contentType: nextMimeType,
        upsert: false,
        cacheControl: bucketId === "public-assets" ? "3600" : "0",
      });

    if (uploadErr) {
      return {
        ok: false,
        code: "upload_failed",
        error: `Falha ao enviar novo ficheiro de substituição: ${uploadErr.message}`,
      };
    }
    newFileUploaded = true;
  }

  // Step 2: Update platform_assets metadata
  const now = new Date().toISOString();
  const { data: updatedRow, error: updateErr } = await supabase
    .from("platform_assets")
    .update({
      title: params.title !== undefined ? params.title : current.title,
      description:
        params.description !== undefined ? params.description : current.description,
      category: nextCategory,
      storage_path: nextStoragePath,
      file_name: nextFileName,
      mime_type: nextMimeType,
      file_size: nextFileSize,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedRow) {
    // Roll back the new upload if DB update failed; keep the old file intact!
    if (newFileUploaded) {
      await supabase.storage
        .from(bucketId)
        .remove([nextStoragePath])
        .catch(() => {});
    }
    return {
      ok: false,
      code: "db_failed",
      error: `Falha ao atualizar registo em platform_assets: ${
        updateErr?.message || "Erro desconhecido"
      }`,
    };
  }

  // Step 3: Remove old Storage file ONLY if a new file replaced it AND old path is unreferenced
  if (newFileUploaded && current.storage_path !== nextStoragePath) {
    const refCheck = await checkStoragePathReferences({
      bucketId,
      storagePath: current.storage_path,
      excludeAssetId: id,
    });
    if (!refCheck.referenced) {
      await supabase.storage
        .from(bucketId)
        .remove([current.storage_path])
        .catch(() => {});
    }
  }

  const asset = hydrateAssetPublicUrl(updatedRow);
  let url = asset.public_url || undefined;
  if (!url && asset.visibility === "private") {
    const signed = await getPrivateAssetSignedUrl(
      bucketId as "admin-documents" | "partner-documents",
      asset.storage_path,
      300
    );
    if (signed.ok && signed.signedUrl) {
      url = signed.signedUrl;
    }
  }

  return { ok: true, asset, url };
}

export async function deletePlatformAsset(
  id: string,
  options?: { force?: boolean }
): Promise<{
  ok: boolean;
  deletedFromStorage?: boolean;
  code?: StorageErrorCode;
  error?: string;
}> {
  const authCheck = await verifyAuthenticatedUserRole(ADMIN_MANAGED_ROLES);
  if (!authCheck.ok) {
    return { ok: false, code: authCheck.code, error: authCheck.error };
  }

  const existingRes = await getPlatformAssetById(id);
  if (!existingRes.ok || !existingRes.asset) {
    return {
      ok: false,
      code: "not_found",
      error: existingRes.error || "Ficheiro não encontrado em platform_assets.",
    };
  }

  const asset = existingRes.asset;
  const bucketId = (asset.bucket_id || "public-assets") as ManagedBucket;

  // Verify external references in platform_settings / products before deletion
  if (!options?.force) {
    const publicUrl =
      bucketId === "public-assets"
        ? getPublicAssetUrl(asset.storage_path, "public-assets") || undefined
        : undefined;
    const { data: settingsRow } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", "global")
      .maybeSingle();

    const refInSettings = countReferenceInObject(
      { url: publicUrl, storagePath: asset.storage_path, assetId: asset.id },
      settingsRow?.settings
    );

    let refInProducts = 0;
    if (publicUrl) {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("image", publicUrl);
      refInProducts = count || 0;
    }

    if (refInSettings + refInProducts > 0) {
      return {
        ok: false,
        code: "in_use",
        error:
          "Este ficheiro ainda está referenciado nas configurações ou catálogo ativo. Remova ou substitua a referência primeiro.",
      };
    }
  }

  const { error: delDbErr } = await supabase
    .from("platform_assets")
    .delete()
    .eq("id", id);

  if (delDbErr) {
    return {
      ok: false,
      code: "delete_failed",
      error: `Erro ao remover registo de platform_assets: ${delDbErr.message}`,
    };
  }

  let deletedFromStorage = false;
  const remainingRefs = await checkStoragePathReferences({
    bucketId,
    storagePath: asset.storage_path,
    excludeAssetId: id,
  });

  if (!remainingRefs.referenced) {
    const { error: delStorageErr } = await supabase.storage
      .from(bucketId)
      .remove([asset.storage_path]);
    if (!delStorageErr) {
      deletedFromStorage = true;
    }
  }

  return { ok: true, deletedFromStorage };
}

export async function getPlatformAssets(filters?: {
  bucketId?: ManagedBucket;
  category?: string;
  visibility?: AssetVisibility;
  limit?: number;
}): Promise<{
  ok: boolean;
  assets: PlatformAsset[];
  code?: StorageErrorCode;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      assets: [],
      code: "not_configured",
      error: "Supabase não está configurado.",
    };
  }

  try {
    let query = supabase
      .from("platform_assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filters?.limit || 200);

    if (filters?.bucketId) {
      query = query.eq("bucket_id", filters.bucketId);
    }
    if (filters?.category) {
      query = query.eq("category", filters.category);
    }
    if (filters?.visibility) {
      query = query.eq("visibility", filters.visibility);
    }

    const { data, error } = await query;
    if (error) {
      return {
        ok: false,
        assets: [],
        code: "db_failed",
        error: error.message,
      };
    }

    return {
      ok: true,
      assets: (data || []).map(hydrateAssetPublicUrl),
    };
  } catch (err: any) {
    return {
      ok: false,
      assets: [],
      code: "db_failed",
      error: err?.message || "Erro ao listar ficheiros de platform_assets.",
    };
  }
}

export async function getPlatformAssetById(id: string): Promise<{
  ok: boolean;
  asset: PlatformAsset | null;
  code?: StorageErrorCode;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      asset: null,
      code: "not_configured",
      error: "Supabase não está configurado.",
    };
  }
  if (!id) {
    return {
      ok: false,
      asset: null,
      code: "invalid_payload",
      error: "ID do ficheiro em falta.",
    };
  }

  try {
    const { data, error } = await supabase
      .from("platform_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return { ok: false, asset: null, code: "db_failed", error: error.message };
    }
    if (!data) {
      return { ok: false, asset: null, code: "not_found", error: "Ficheiro não encontrado." };
    }

    return { ok: true, asset: hydrateAssetPublicUrl(data) };
  } catch (err: any) {
    return {
      ok: false,
      asset: null,
      code: "db_failed",
      error: err?.message || "Erro ao consultar ficheiro.",
    };
  }
}

export function buildAssetReference(
  asset: PlatformAsset,
  resolvedPublicUrl?: string
): AssetReference {
  return {
    asset_id: asset.id,
    bucket_id: asset.bucket_id,
    storage_path: asset.storage_path,
    ...(resolvedPublicUrl || asset.public_url
      ? { url: resolvedPublicUrl || asset.public_url || undefined }
      : {}),
    mime_type: asset.mime_type,
    file_size: asset.file_size,
    updated_at: asset.updated_at,
  };
}

export function resolveAssetDisplayUrl(ref?: AssetReference | null): string | null {
  if (!ref) return null;
  if (ref.url && !isTransientLocalUrl(ref.url)) return ref.url;
  if (ref.bucket_id === "public-assets" && ref.storage_path) {
    return getPublicAssetUrl(ref.storage_path, "public-assets");
  }
  return null;
}
