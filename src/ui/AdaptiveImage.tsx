import React, { useState } from "react";

export interface AdaptiveImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fitMode?: "cover" | "contain";
  aspect?: "video" | "square" | "wide" | "auto";
  fallbackSrc?: string;
  badge?: React.ReactNode;
}

/**
 * AdaptiveImage renders images that dynamically adapt to any dimension
 * or proportion provided by the Super Admin (16:9, 4:3, 1:1, or vertical portrait).
 */
export function AdaptiveImage({
  src,
  alt,
  className = "",
  containerClassName = "",
  fitMode = "cover",
  aspect = "video",
  fallbackSrc = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
  badge,
}: AdaptiveImageProps) {
  const safeSrc = (src && typeof src === "string" && src.trim()) ? src.trim() : fallbackSrc;
  const [imgSrc, setImgSrc] = useState(safeSrc);
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    const valid = (src && typeof src === "string" && src.trim()) ? src.trim() : fallbackSrc;
    setImgSrc(valid);
    setHasError(false);
  }, [src, fallbackSrc]);

  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "wide"
      ? "aspect-[21/9]"
      : aspect === "auto"
      ? "aspect-auto"
      : "aspect-video";

  const finalSrc = hasError || !imgSrc ? fallbackSrc : imgSrc;

  return (
    <div
      className={`relative w-full overflow-hidden ${aspectClass} ${
        fitMode === "contain"
          ? "bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-1"
          : "bg-mist"
      } ${containerClassName}`}
    >
      {finalSrc ? (
        <img
          src={finalSrc}
          alt={alt || "Imagem"}
          onError={() => {
            if (!hasError) {
              setHasError(true);
              setImgSrc(fallbackSrc);
            }
          }}
          className={`w-full h-full transition duration-300 ${
            fitMode === "contain"
              ? "object-contain max-h-full"
              : "object-cover object-center"
          } ${className}`}
          loading="lazy"
        />
      ) : null}
      {badge}
    </div>
  );
}
