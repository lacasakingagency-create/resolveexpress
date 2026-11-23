import React, { useState, useRef, useEffect } from "react";
import { Icon } from "./kit";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  uploadPlatformAsset,
  MAX_ASSET_BYTES,
  type PlatformAsset,
  type PublicAssetCategory,
} from "../lib/supabase/storage";

export interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  fitMode?: "cover" | "contain";
  onFitModeChange?: (fit: "cover" | "contain") => void;
  label?: string;
  helperText?: string;
  aspectRatio?: "video" | "square" | "wide";
  placeholderText?: string;
  assetCategory?: PublicAssetCategory;
  assetTitle?: string;
  assetDescription?: string;
  onAssetUploaded?: (asset: PlatformAsset) => void;
}

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

/**
 * ImageUploader component supporting:
 * 1. Direct upload to Supabase Storage (`public-assets`) + `platform_assets` registry
 * 2. Web URL input with live preview
 * 3. Smart size adaptation mode toggle (cover vs contain)
 */
export function ImageUploader({
  value,
  onChange,
  fitMode = "cover",
  onFitModeChange,
  label = "Imagem",
  helperText = "Suporta upload de ficheiro (JPG, PNG, WebP, GIF, SVG até 10 MB) ou link externo da web.",
  aspectRatio = "video",
  placeholderText = "https://images.unsplash.com/...",
  assetCategory = "general",
  assetTitle,
  assetDescription,
  onAssetUploaded,
}: ImageUploaderProps) {
  const [tab, setTab] = useState<"file" | "url">(
    value && !value.startsWith("data:") ? "url" : "file"
  );
  const [urlInput, setUrlInput] = useState(
    value && !value.startsWith("data:") ? value : ""
  );
  const [loading, setLoading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setUrlInput(value && !value.startsWith("data:") && !value.startsWith("blob:") ? value : "");
    setPreviewError(false);
  }, [value]);

  useEffect(() => {
    if (!value) {
      setDimensions(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setDimensions(null);
    };
    img.src = value;
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so re-selecting the same file always triggers onChange
    e.target.value = "";
    if (!file) return;

    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      setErrorMsg(
        "Formato inválido. Envie apenas JPG, PNG, WebP, GIF ou SVG."
      );
      setUploadStatusMsg(null);
      return;
    }

    if (file.size > MAX_ASSET_BYTES) {
      setErrorMsg("A imagem excede o limite máximo permitido de 10 MB.");
      setUploadStatusMsg(null);
      return;
    }

    if (!isSupabaseConfigured()) {
      setErrorMsg(
        "Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes). O upload cloud requer ligação ao Supabase Storage."
      );
      setUploadStatusMsg(null);
      return;
    }

    setErrorMsg(null);
    setUploadStatusMsg(null);
    setLoading(true);

    try {
      const uploadRes = await uploadPlatformAsset({
        file,
        fileName: file.name,
        title: assetTitle || file.name.replace(/\.[^.]+$/, ""),
        description: assetDescription,
        bucketId: "public-assets",
        category: assetCategory,
        visibility: "public",
      });

      if (uploadRes.ok && uploadRes.url && uploadRes.asset) {
        setPreviewError(false);
        onChange(uploadRes.url);
        onAssetUploaded?.(uploadRes.asset);
        setUploadStatusMsg(
          `Carregado no bucket public-assets e registado em platform_assets (${uploadRes.asset.storage_path})`
        );
      } else {
        // Never overwrite existing value or fall back to Base64 / local disk on failure
        setErrorMsg(
          uploadRes.error ||
            "Não foi possível enviar a imagem para o Supabase Storage."
        );
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Erro inesperado ao carregar imagem para o Supabase Storage."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMsg(null);
      setUploadStatusMsg(null);
      onChange("");
      return;
    }
    const isSafeUrl =
      trimmed.startsWith("https://") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("/");
    if (!isSafeUrl) {
      setErrorMsg(
        "URL inválido. Utilize um endereço https://, http:// ou caminho relativo /."
      );
      return;
    }
    setErrorMsg(null);
    setUploadStatusMsg(null);
    onChange(trimmed);
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
    setErrorMsg(null);
    setUploadStatusMsg(null);
    setDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square max-h-56"
      : aspectRatio === "wide"
      ? "aspect-[21/9] max-h-48"
      : "aspect-video max-h-56";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-foreground">{label}</label>
        {onFitModeChange && (
          <div className="flex items-center gap-1 bg-mist p-0.5 rounded-lg border border-border text-[11px]">
            <span className="text-muted-foreground px-1.5 font-medium">
              Ajuste:
            </span>
            <button
              type="button"
              onClick={() => onFitModeChange("cover")}
              className={`px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 ${
                fitMode === "cover"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Preencher o espaço do card (recorta suavemente as bordas se necessário)"
            >
              <Icon name="Maximize2" className="size-3" />
              Preencher
            </button>
            <button
              type="button"
              onClick={() => onFitModeChange("contain")}
              className={`px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 ${
                fitMode === "contain"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Ajustar imagem inteira sem cortar nada (com fundo neutro adaptativo)"
            >
              <Icon name="Minimize2" className="size-3" />
              Inteira
            </button>
          </div>
        )}
      </div>

      {/* Tabs: Upload de Ficheiro vs Link / URL */}
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
          <Icon name="Upload" className="size-3.5 text-action" />
          <span>Upload de Ficheiro</span>
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

      {/* Mode 1: File Input Button */}
      {tab === "file" && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
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
                <Icon name="UploadCloud" className="size-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                {loading
                  ? "A enviar para o Supabase Storage..."
                  : "Clique para selecionar a imagem do seu telemóvel ou computador"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {loading
                  ? `A guardar em public-assets/${assetCategory}...`
                  : "PNG, JPG, WebP, GIF ou SVG (máx. 10 MB · sincronização global)"}
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
                Procurar Imagem
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Link / URL Input */}
      {tab === "url" && (
        <div className="space-y-2">
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
                placeholder={placeholderText}
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
        </div>
      )}

      {uploadStatusMsg && !errorMsg && (
        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
          <Icon name="CheckCircle2" className="size-3.5 shrink-0" />
          <span className="truncate">{uploadStatusMsg}</span>
        </p>
      )}

      {errorMsg && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
          <Icon name="AlertCircle" className="size-3.5 shrink-0" /> {errorMsg}
        </p>
      )}

      {/* Live Preview & Adaptation Indicator */}
      {value && typeof value === "string" && value.trim() ? (
        <div className="rounded-xl border border-border bg-paper p-2.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-border/60">
            <span className="font-bold text-primary flex items-center gap-1">
              <Icon name="Eye" className="size-3.5 text-action" />
              Pré-visualização da Imagem
            </span>
            <div className="flex items-center gap-2">
              {dimensions && (
                <span className="text-[10px] bg-mist px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                  {dimensions.width}×{dimensions.height}px
                </span>
              )}
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5"
                title="Remover imagem"
              >
                <Icon name="Trash2" className="size-3" />
                Remover
              </button>
            </div>
          </div>

          <div
            className={`relative w-full ${aspectClass} overflow-hidden rounded-lg border border-border/80 bg-slate-900/5 dark:bg-slate-950/40 flex items-center justify-center`}
          >
            {previewError ? (
              <div className="p-4 text-center text-xs text-red-600 space-y-1">
                <Icon name="AlertTriangle" className="size-5 mx-auto" />
                <p className="font-semibold">Não foi possível carregar a imagem a partir do URL atual.</p>
              </div>
            ) : (
              <img
                src={value.trim()}
                alt="Pré-visualização"
                onError={() => setPreviewError(true)}
                onLoad={() => setPreviewError(false)}
                className={`w-full h-full transition duration-300 ${
                  fitMode === "contain"
                    ? "object-contain p-1"
                    : "object-cover object-center"
                }`}
              />
            )}
            <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
              <Icon
                name={fitMode === "cover" ? "Maximize2" : "Minimize2"}
                className="size-2.5 text-action"
              />
              Modo:{" "}
              {fitMode === "cover"
                ? "Preenchimento total"
                : "Imagem inteira (sem corte)"}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">{helperText}</p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
