import React, { useState, useRef, useEffect } from "react";
import { Icon } from "./kit";
import { isSupabaseConfigured, uploadToSupabaseStorage } from "../lib/supabase";

export interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  fitMode?: "cover" | "contain";
  onFitModeChange?: (fit: "cover" | "contain") => void;
  label?: string;
  helperText?: string;
  aspectRatio?: "video" | "square" | "wide";
  placeholderText?: string;
}

/**
 * ImageUploader component supporting:
 * 1. File upload via input button (with client-side optimization & base64 conversion)
 * 2. Web URL input with live preview
 * 3. Smart size adaptation mode toggle (cover vs contain)
 */
export function ImageUploader({
  value,
  onChange,
  fitMode = "cover",
  onFitModeChange,
  label = "Imagem",
  helperText = "Suporta upload de ficheiro (JPG, PNG, WebP) ou link externo da web.",
  aspectRatio = "video",
  placeholderText = "https://images.unsplash.com/...",
}: ImageUploaderProps) {
  const [tab, setTab] = useState<"file" | "url">(
    value && !value.startsWith("data:") ? "url" : "file"
  );
  const [urlInput, setUrlInput] = useState(value && !value.startsWith("data:") ? value : "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external changes
  useEffect(() => {
    if (value && !value.startsWith("data:")) {
      setUrlInput(value);
    }
  }, [value]);

  // Measure image dimensions when value changes
  useEffect(() => {
    if (!value) {
      setDimensions(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = value;
  }, [value]);

  // Handle local file selection with canvas resizing and server upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Por favor selecione um ficheiro de imagem válido (JPG, PNG, WebP, etc.).");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        // Optimize image size (max 960px) to ensure fast loading and avoid browser storage limits
        const maxDimension = 960;
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
            targetWidth = maxDimension;
          } else {
            targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
            targetHeight = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        let optimizedDataUrl = rawDataUrl;
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          // Export lightweight WebP
          try {
            optimizedDataUrl = canvas.toDataURL("image/webp", 0.78);
          } catch {
            optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          }
        }

        // 1. Attempt upload to Supabase Storage if configured
        if (isSupabaseConfigured()) {
          try {
            const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const storagePath = `uploads/${Date.now()}_${cleanName}`;
            
            // Convert canvas or dataUrl to blob
            const blob = await new Promise<Blob | null>((resolve) => {
              if (ctx) {
                canvas.toBlob((b) => resolve(b), "image/webp", 0.85);
              } else {
                resolve(file);
              }
            });

            if (blob) {
              const publicUrl = await uploadToSupabaseStorage("public-assets", storagePath, blob);
              if (publicUrl) {
                onChange(publicUrl);
                setDimensions({ width: targetWidth, height: targetHeight });
                setLoading(false);
                return;
              }
            }
          } catch (storageErr) {
            console.warn("Supabase storage upload failed, falling back:", storageErr);
          }
        }

        // 2. Attempt server-side upload for lightweight static URL (/uploads/...)
        try {
          const res = await fetch("/api/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataUrl: optimizedDataUrl,
              filename: file.name,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.url) {
              onChange(data.url);
              setDimensions({ width: targetWidth, height: targetHeight });
              setLoading(false);
              return;
            }
          }
        } catch (uploadErr) {
          console.warn("Could not upload to /api/upload-image, using local optimized image:", uploadErr);
        }

        // Fallback: use lightweight local optimized WebP
        onChange(optimizedDataUrl);
        setDimensions({ width: targetWidth, height: targetHeight });
        setLoading(false);
      };
      img.onerror = () => {
        setErrorMsg("Erro ao processar imagem.");
        setLoading(false);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      setErrorMsg("Erro ao ler ficheiro local.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      onChange("");
      return;
    }
    setErrorMsg(null);
    onChange(urlInput.trim());
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
    setErrorMsg(null);
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
            <span className="text-muted-foreground px-1.5 font-medium">Ajuste:</span>
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
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/90 bg-mist/30 hover:bg-mist/60 hover:border-action/60 p-4 text-center cursor-pointer transition ${loading ? "opacity-70 pointer-events-none" : ""}`}
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
                {loading ? "A processar e otimizar imagem..." : "Clique para selecionar a imagem do seu telemóvel ou computador"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {loading ? "Guardando no servidor com resolução adaptada..." : "PNG, JPG, WebP ou SVG (otimização e adaptação automática de tamanho)"}
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

      {errorMsg && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
          <Icon name="AlertCircle" className="size-3.5" /> {errorMsg}
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

          {/* Adaptable Container Preview */}
          <div
            className={`relative w-full ${aspectClass} overflow-hidden rounded-lg border border-border/80 bg-slate-900/5 dark:bg-slate-950/40 flex items-center justify-center`}
          >
            <img
              src={value.trim()}
              alt="Pré-visualização"
              className={`w-full h-full transition duration-300 ${
                fitMode === "contain"
                  ? "object-contain p-1"
                  : "object-cover object-center"
              }`}
            />
            <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
              <Icon
                name={fitMode === "cover" ? "Maximize2" : "Minimize2"}
                className="size-2.5 text-action"
              />
              Modo: {fitMode === "cover" ? "Preenchimento total" : "Imagem inteira (sem corte)"}
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
