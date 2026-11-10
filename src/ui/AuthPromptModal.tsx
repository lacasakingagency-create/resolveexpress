import React, { useEffect } from "react";
import { Icon, go, Btn } from "./kit";

export interface AuthPromptModalProps {
  open: boolean;
  onClose: () => void;
  actionType?: "buy" | "service" | "general";
  itemName?: string;
}

export function AuthPromptModal({
  open,
  onClose,
  actionType = "general",
  itemName,
}: AuthPromptModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isBuy = actionType === "buy";
  const isService = actionType === "service";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-action/40 bg-paper p-6 sm:p-8 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-200 z-10">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-mist hover:text-primary transition"
          aria-label="Fechar"
        >
          <Icon name="X" className="size-5" />
        </button>

        {/* Icon Header */}
        <div className="mb-5 flex items-center gap-3.5">
          <span className="grid size-14 place-items-center rounded-2xl bg-action/15 text-action shadow-inner">
            <Icon
              name={isBuy ? "ShoppingCart" : isService ? "CalendarCheck" : "UserPlus"}
              className="size-7 text-action"
            />
          </span>
          <div>
            <span className="inline-block rounded-full bg-action/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-action">
              Identificação Necessária
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-black text-primary leading-tight mt-0.5">
              {isBuy
                ? "Criar Conta para Comprar"
                : isService
                ? "Criar Conta para Solicitar Serviço"
                : "Acesso de Cliente Necessário"}
            </h2>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-foreground/80 leading-relaxed">
          {isBuy ? (
            <>
              Para {itemName ? <strong>comprar &quot;{itemName}&quot;</strong> : "comprar produtos"} e receber a sua entrega ao domicílio com toda a segurança, é necessário <strong>criar primeiro a sua conta de cliente</strong> na Resolve Express.
            </>
          ) : isService ? (
            <>
              Para {itemName ? <strong>solicitar o serviço &quot;{itemName}&quot;</strong> : "solicitar serviços"} e agendar com profissionais certificados na sua província, é necessário <strong>criar primeiro a sua conta de cliente</strong>.
            </>
          ) : (
            <>
              Para continuar e usufruir de todos os serviços e produtos em Angola, <strong>crie a sua conta de cliente gratuita</strong> ou inicie sessão.
            </>
          )}
        </p>

        {/* Benefits list */}
        <div className="my-5 rounded-2xl border border-border bg-mist/60 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Icon name="CheckCircle2" className="size-4 text-ok shrink-0" />
            <span>Registo 100% gratuito e rápido em menos de 1 minuto</span>
          </div>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Icon name="CheckCircle2" className="size-4 text-ok shrink-0" />
            <span>Entregas e atendimento em todas as províncias de Angola</span>
          </div>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Icon name="CheckCircle2" className="size-4 text-ok shrink-0" />
            <span>Acompanhamento dos pedidos e recibos em tempo real</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <Btn
            kind="action"
            className="w-full min-h-12 text-sm font-black shadow-md flex items-center justify-center gap-2"
            onClick={() => {
              onClose();
              go("/cadastro");
            }}
          >
            <Icon name="UserPlus" className="size-4" />
            <span>Criar Conta de Cliente Grátis</span>
          </Btn>

          <button
            type="button"
            onClick={() => {
              onClose();
              go("/entrar");
            }}
            className="w-full rounded-[var(--radius)] border border-border bg-paper py-3 text-xs sm:text-sm font-bold text-primary hover:bg-mist transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icon name="LogIn" className="size-4 text-action" />
            <span>Já tenho uma conta? Iniciar Sessão</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs font-semibold text-muted-foreground hover:text-primary transition cursor-pointer"
        >
          Continuar apenas a ver o catálogo
        </button>
      </div>
    </div>
  );
}
