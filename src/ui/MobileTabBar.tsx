import { useState, useEffect } from "react";
import { Icon, go } from "./kit";
import { useStore } from "../lib/store";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function MobileTabBar({
  currentRoute,
  onOpenAI,
}: {
  currentRoute: string;
  onOpenAI: () => void;
}) {
  const [store] = useStore();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const cartCount = store.cart.reduce((sum, item) => sum + item.quantity, 0);
  const isAuth = Boolean(store.currentUser);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Para instalar: toque no menu do navegador (três pontinhos ou botão de partilha) e escolha 'Adicionar ao ecrã principal'.");
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const getAccountRoute = () => {
    if (!store.currentUser) return "/entrar";
    switch (store.currentUser.role) {
      case "ADMIN":
      case "SUPER_ADMIN":
        return "/admin";
      case "EMPLOYEE":
        return "/portal-funcionario";
      case "PARTNER":
        return "/portal-empresa";
      case "PROFESSIONAL":
        return "/portal-parceiro";
      case "CUSTOMER":
      default:
        return "/portal-cliente";
    }
  };

  return (
    <>
      {/* PWA Install Banner (Mobile Top/Bottom) */}
      {showInstallBanner && (
        <aside
          aria-label="Notificação de instalação"
          className="fixed bottom-[68px] inset-x-3 z-40 sm:hidden flex items-center justify-between gap-3 rounded-2xl bg-primary text-white p-3.5 shadow-2xl border border-white/15 animate-fade-in"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-action text-white shadow-xs font-bold text-xs">
              REX
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">Instalar Aplicação</p>
              <p className="text-[11px] text-white/75 truncate">Acesso rápido no seu telemóvel</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="rounded-lg bg-action px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-110 active:scale-95"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="p-1 text-white/60 hover:text-white"
              aria-label="Fechar"
            >
              <Icon name="X" className="size-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        aria-label="Navegação móvel"
        className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-paper/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 flex justify-around items-center pb-[max(0.4rem,env(safe-area-inset-bottom))]"
      >
        {/* Início */}
        <button
          type="button"
          onClick={() => go("/")}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            currentRoute === "/" ? "text-action font-bold" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Icon name="Home" className="size-5" />
          <span className="text-[10px] mt-0.5">Início</span>
        </button>

        {/* Serviços */}
        <button
          type="button"
          onClick={() => go("/servicos")}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            currentRoute.startsWith("/servicos") ? "text-action font-bold" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Icon name="Wrench" className="size-5" />
          <span className="text-[10px] mt-0.5">Serviços</span>
        </button>

        {/* Resolve AI (Highlight in center) */}
        <button
          type="button"
          onClick={onOpenAI}
          className="relative -top-2 flex flex-col items-center justify-center cursor-pointer group"
          aria-label="Abrir Resolve AI"
        >
          <span className="grid size-11 place-items-center rounded-full bg-primary text-action shadow-lg ring-4 ring-paper transition group-hover:scale-105 active:scale-95">
            <Icon name="Sparkles" className="size-5 text-action" />
          </span>
          <span className="text-[9px] font-black text-primary uppercase mt-0.5 tracking-tight">
            AI
          </span>
        </button>

        {/* Loja / Carrinho */}
        <button
          type="button"
          onClick={() => go("/produtos")}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            currentRoute.startsWith("/produtos") ? "text-action font-bold" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <div className="relative">
            <Icon name="ShoppingBag" className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 grid size-4 place-items-center rounded-full bg-action text-[9px] font-black text-white">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">Loja</span>
        </button>

        {/* Conta / Perfil */}
        <button
          type="button"
          onClick={() => go(getAccountRoute())}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            currentRoute.startsWith("/portal") || currentRoute.startsWith("/admin") || currentRoute === "/entrar"
              ? "text-action font-bold"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          {isAuth && store.currentUser?.avatar && typeof store.currentUser.avatar === "string" && store.currentUser.avatar.trim() ? (
            <img
              src={store.currentUser.avatar.trim()}
              alt=""
              className="size-5 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <Icon name="User" className="size-5" />
          )}
          <span className="text-[10px] mt-0.5">
            {isAuth ? "Perfil" : "Entrar"}
          </span>
        </button>
      </nav>
    </>
  );
}
