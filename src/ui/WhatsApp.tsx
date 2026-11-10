import React, { useState, useEffect } from "react";
import { go } from "./kit";
import { useStore, waLink } from "../lib/store";

const Logo = () => (
  <svg viewBox="0 0 32 32" className="size-8" fill="currentColor" aria-hidden={true}>
    <path d="M16.04 3C9.4 3 4 8.38 4 15a11.9 11.9 0 0 0 1.62 6L4 29l8.2-1.6A12.06 12.06 0 0 0 16.04 27C22.68 27 28 21.62 28 15S22.68 3 16.04 3Zm0 21.8c-1.8 0-3.56-.48-5.1-1.4l-.36-.22-4.86.95.98-4.72-.24-.38A9.75 9.75 0 0 1 6.2 15c0-5.4 4.42-9.8 9.84-9.8 5.4 0 9.76 4.4 9.76 9.8 0 5.4-4.36 9.8-9.76 9.8Zm5.38-7.34c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.48-.5-.67-.5h-.57c-.2 0-.52.08-.79.37-.27.3-1.03 1-1.03 2.45 0 1.44 1.06 2.84 1.2 3.04.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.7.22 1.35.19 1.85.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.56-.35Z" />
  </svg>
);

export function WhatsApp({ message }: { message?: string | null }) {
  const [store] = useStore();
  const [showBubble, setShowBubble] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("rex:bubble")) return;
    const t = setTimeout(() => setShowBubble(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setShowBubble(false);
    sessionStorage.setItem("rex:bubble", "1");
  };

  const href = waLink(store.whatsapp, message || store.whatsappDefault);

  return (
    <div className="pointer-events-none fixed right-4 bottom-20 sm:bottom-4 z-50 flex flex-col items-end gap-3 @3xl:right-6 @3xl:bottom-6">
      {(showBubble || showMissing) && (
        <div className="wa-in pointer-events-auto relative max-w-64 rounded-[var(--radius)] bg-paper py-3 pr-10 pl-4 text-sm shadow-lg ring-1 ring-border">
          {showMissing ? (
            <>
              O número de WhatsApp ainda não foi configurado.{" "}
              <button
                type="button"
                className="font-semibold text-primary underline"
                onClick={() => {
                  setShowMissing(false);
                  go("/admin");
                }}
              >
                Configurar no painel
              </button>
            </>
          ) : (
            <span className="font-semibold">Precisa de ajuda? Fale connosco!</span>
          )}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              close();
              setShowMissing(false);
            }}
            className="absolute top-1 right-1 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-mist"
          >
            ×
          </button>
        </div>
      )}
      <a
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!href) {
            e.preventDefault();
            setShowMissing(true);
          }
          close();
        }}
        aria-label="Falar connosco no WhatsApp"
        className="wa-in wa-btn pointer-events-auto grid size-14 cursor-pointer place-items-center rounded-full bg-whatsapp text-white shadow-[0_6px_20px_oklch(0.4_0.1_150/0.35)] transition hover:scale-105 hover:shadow-[0_8px_28px_oklch(0.4_0.1_150/0.45)] active:scale-95 @3xl:size-16"
      >
        <Logo />
      </a>
    </div>
  );
}
