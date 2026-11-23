import React, { useState, useRef } from "react";
import { Icon } from "./kit";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  uploadPlatformAsset,
  getPrivateAssetSignedUrl,
  MAX_ASSET_BYTES,
  type AssetCategory,
  type AssetVisibility,
  type PlatformAsset,
} from "../lib/supabase/storage";

export interface UploadedDocumentMeta {
  assetId?: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  bucket?: string;
  storagePath?: string;
  visibility?: AssetVisibility;
  category?: string;
}

export interface DocumentUploaderProps {
  value: UploadedDocumentMeta | null;
  onChange: (doc: UploadedDocumentMeta | null) => void;
  label?: string;
  helperText?: string;
  visibility?: AssetVisibility;
  assetCategory?: AssetCategory;
  title?: string;
  description?: string;
  allowExternalUrl?: boolean;
  onAssetUploaded?: (asset: PlatformAsset) => void;
}

const PUBLIC_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const PRIVATE_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isSafeHttpOrRelativeUrl(url: string): boolean {
  const trimmed = (url || "").trim();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  );
}

/**
 * DocumentUploader component supporting public assets (`public-assets`)
 * and private administrative documents (`admin-documents`).
 * Uploads via `uploadPlatformAsset()` and registers metadata in `public.platform_assets`.
 */
export function DocumentUploader({
  value,
  onChange,
  label = "Ficheiro do Documento (PDF ou Imagem)",
  helperText = "Formatos aceites: PDF, PNG, JPG, WebP, GIF ou SVG até 10 MB. Gravado permanentemente no Supabase Storage.",
  visibility = "public",
  assetCategory = "general",
  title,
  description,
  allowExternalUrl = true,
  onAssetUploaded,
}: DocumentUploaderProps) {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState(
    value?.url && isSafeHttpOrRelativeUrl(value.url) ? value.url : ""
  );
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPrivate = visibility === "private";
  const allowedSet = isPrivate ? PRIVATE_ALLOWED_MIME : PUBLIC_ALLOWED_MIME;
  const targetBucket = isPrivate ? "admin-documents" : "public-assets";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!allowedSet.has(file.type)) {
      setErrorMsg(
        isPrivate
          ? "Formato não suportado para documentos privados. Envie PDF, JPG, PNG ou WebP."
          : "Formato não suportado. Envie um ficheiro PDF, JPG, PNG, WebP, GIF ou SVG."
      );
      setStatusMsg(null);
      return;
    }

    if (file.size > MAX_ASSET_BYTES) {
      setErrorMsg("O documento excede o limite máximo permitido de 10 MB.");
      setStatusMsg(null);
      return;
    }

    if (!isSupabaseConfigured()) {
      setErrorMsg(
        "Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes). O envio de documentos requer ligação ativa ao Supabase Storage."
      );
      setStatusMsg(null);
      return;
    }

    setErrorMsg(null);
    setStatusMsg(null);
    setLoading(true);

    const runUpload = async () => {
      try {
        const res = await uploadPlatformAsset({
          file,
          fileName: file.name,
          title: title || file.name.replace(/\.[^.]+$/, ""),
          description,
          bucketId: targetBucket,
          category: assetCategory,
          visibility,
        });

        if (res.ok && res.asset) {
          const previewUrl =
            res.url ||
            (isPrivate
              ? (
                  await getPrivateAssetSignedUrl(
                    "admin-documents",
                    res.asset.storage_path,
                    300
                  )
                ).signedUrl || ""
              : "");

          onChange({
            assetId: res.asset.id,
            url: previewUrl,
            fileName: res.asset.file_name,
            fileType: res.asset.mime_type,
            fileSize: res.asset.file_size,
            bucket: res.asset.bucket_id,
            storagePath: res.asset.storage_path,
            visibility,
            category: res.asset.category,
          });
          onAssetUploaded?.(res.asset);
          setStatusMsg(
            isPrivate
              ? `Documento privado guardado em ${res.asset.bucket_id}/${res.asset.storage_path}`
              : `Documento público guardado em ${res.asset.bucket_id}/${res.asset.storage_path}`
          );
        } else {
          setErrorMsg(
            res.error ||
              "Falha ao enviar documento para o Supabase Storage. Verifique a sessão de Super Admin."
          );
        }
      } catch (err: any) {
        setErrorMsg(
          err?.message || "Erro inesperado ao enviar documento para o Supabase Storage."
        );
      } finally {
        setLoading(false);
      }
    };

    runUpload();
  };

  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMsg(null);
      setStatusMsg(null);
      onChange(null);
      return;
    }
    if (!isSafeHttpOrRelativeUrl(trimmed)) {
      setErrorMsg(
        "URL inválido. Utilize https://, http:// ou caminho relativo /."
      );
      return;
    }
    setErrorMsg(null);
    setStatusMsg(null);
    const guessedName = trimmed.split("/").pop()?.split("?")[0] || "documento";
    const isPdf = guessedName.toLowerCase().endsWith(".pdf");
    onChange({
      url: trimmed,
      fileName: guessedName,
      fileType: isPdf ? "application/pdf" : "image/webp",
      visibility,
    });
  };

  const handleClear = () => {
    onChange(null);
    setUrlInput("");
    setErrorMsg(null);
    setStatusMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const acceptTypes = isPrivate
    ? "application/pdf,image/png,image/jpeg,image/webp"
    : "application/pdf,image/png,image/jpeg,image/webp,image/gif,image/svg+xml";

  return (
    <div className="space-y-2.5">
      <label className="block text-xs font-bold text-foreground">{label}</label>

      {allowExternalUrl && !isPrivate && (
        <div className="flex rounded-lg bg-mist/60 p-1 border border-border/80">
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition ${
              tab === "file"
                ? "bg-paper text-primary shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="FileUp" className="size-3.5 text-action" />
            <span>Enviar Ficheiro (PDF / Imagem)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition ${
              tab === "url"
                ? "bg-paper text-primary shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="Link" className="size-3.5 text-action" />
            <span>Inserir Link / URL</span>
          </button>
        </div>
      )}

      {(tab === "file" || isPrivate || !allowExternalUrl) && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={() => !loading && fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/90 bg-mist/30 hover:bg-mist/60 hover:border-action/60 p-4 text-center cursor-pointer transition ${
              loading ? "opacity-70 pointer-events-none" : ""
            }`}
          >
            <div className="size-10 rounded-full bg-action/10 text-action grid place-items-center">
              {loading ? (
                <Icon name="Loader2" className="size-5 animate-spin" />
              ) : (
                <Icon name={isPrivate ? "Lock" : "FileText"} className="size-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                {loading
                  ? `A enviar para ${targetBucket}...`
                  : isPrivate
                  ? "Clique para selecionar documento administrativo privado"
                  : "Clique para selecionar PDF ou imagem do seu dispositivo"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isPrivate
                  ? "PDF, PNG, JPG ou WebP (máx. 10 MB · acesso restrito via URL assinado)"
                  : "PDF, PNG, JPG, WebP, GIF ou SVG (máx. 10 MB)"}
              </p>
            </div>
            {!loading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 text-xs font-bold text-action-ink hover:brightness-105 shadow-2xs"
              >
                <Icon name="FolderOpen" className="size-3.5" />
                Selecionar Documento
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "url" && allowExternalUrl && !isPrivate && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon
              name="Globe"
              className="absolute left-3 top-2.5 size-4 text-muted-foreground"
            />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-[var(--radius)] border border-border bg-paper py-2 pl-9 pr-3 text-xs text-foreground focus:border-action focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyUrl}
            className="rounded-[var(--radius)] bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 whitespace-nowrap"
          >
            Aplicar Link
          </button>
        </div>
      )}

      {statusMsg && !errorMsg && (
        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
          <Icon name="CheckCircle2" className="size-3.5 shrink-0" />
          <span className="truncate">{statusMsg}</span>
        </p>
      )}

      {errorMsg && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
          <Icon name="AlertCircle" className="size-3.5 shrink-0" /> {errorMsg}
        </p>
      )}

      {value && (value.url || value.storagePath) && (
        <div className="rounded-xl border border-border bg-paper p-3 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 shrink-0 rounded-lg bg-action/10 text-action grid place-items-center">
              <Icon
                name={
                  value.fileType === "application/pdf" ? "FileText" : "Image"
                }
                className="size-5"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {value.fileName}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                {value.fileType === "application/pdf" ? "PDF" : "IMAGEM"}
                {value.fileSize ? ` · ${formatBytes(value.fileSize)}` : ""}
                {value.bucket ? ` · ${value.bucket}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {value.url && (
              <a
                href={value.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-mist"
              >
                <Icon name="ExternalLink" className="size-3" />
                Abrir
              </a>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
            >
              <Icon name="Trash2" className="size-3" />
              Limpar
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">{helperText}</p>
    </div>
  );
}
