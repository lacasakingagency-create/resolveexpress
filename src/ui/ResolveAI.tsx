import { useState, useRef, useEffect } from "react";
import { Icon, go } from "./kit";
import { useStore, waLink } from "../lib/store";
import { allServices, CATEGORIES } from "../lib/data";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  action?: { label: string; url: string };
  time: string;
}

export function ResolveAI({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [store] = useStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "ai",
      text: "Olá! Sou o Resolve AI, o assistente inteligente da Resolve Express no Huambo. Posso ajudá-lo a encontrar serviços, consultar o estado de um pedido (ex: REX-...), tirar dúvidas sobre orçamentos ou encaminhá-lo para a nossa equipa. Em que posso ser útil hoje?",
      time: "Agora",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isOpen, messages, loading]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setLoading(true);

    // Try server-side Gemini API route first
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          context: {
            location: store.location,
            bookings: store.bookings.map((b) => ({
              id: b.id,
              service: b.service,
              status: b.status,
              date: b.date,
              slot: b.slot,
            })),
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: String(Date.now() + 1),
              sender: "ai",
              text: data.reply,
              action: data.action,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Server route not reached, proceed to intelligent local knowledge fallback
    }

    // Intelligent domain fallback
    setTimeout(() => {
      const lower = textToSend.toLowerCase();
      let reply = "";
      let action: { label: string; url: string } | undefined;

      // Check for booking tracking
      const bookingMatch = textToSend.match(/REX-\d{4}-\d+/i);
      if (bookingMatch) {
        const bid = bookingMatch[0].toUpperCase();
        const found = store.bookings.find((b) => b.id.toUpperCase() === bid);
        if (found) {
          reply = `Encontrei o seu pedido ${found.id} para "${found.service}".\n• Estado: ${found.status}\n• Data: ${found.date} às ${found.slot}\n• Endereço: ${found.address}\n• Pagamento: ${found.paymentStatus}`;
          action = { label: "Acompanhar nos Meus Pedidos", url: "/pedidos" };
        } else {
          reply = `Não encontrei nenhum pedido registado com o código ${bid} neste dispositivo. Verifique se o código está correto ou fale diretamente connosco pelo WhatsApp.`;
        }
      } else if (lower.includes("escola") || lower.includes("explica") || lower.includes("estudo") || lower.includes("professor") || lower.includes("apoio escolar")) {
        reply = "O departamento Resolve Educação / Apoio Escolar disponibiliza professores e explicadores qualificados para apoio escolar ao domicílio em Matemática, Física, Química, Português e Inglês, desde o ensino primário ao pré-universitário no Huambo.";
        action = { label: "Ver Apoio Escolar", url: "/servicos/apoio-escolar" };
      } else if (lower.includes("produto") || lower.includes("loja") || lower.includes("comprar") || lower.includes("mercado") || lower.includes("cesta básica") || lower.includes("cimento") || lower.includes("tinta")) {
        reply = "Na nossa Loja de Produtos / Marketplace pode adquirir com entrega rápida ao domicílio no Huambo: Botijas de Gás 12kg (15.000 Kz), Garrafões de Água 18.9L (4.500 Kz), Cestas Básicas completas (38.500 Kz), Frango Assado (6.500 Kz), Cimento Portland e tintas com talão e garantia.";
        action = { label: "Ir para Loja de Produtos", url: "/produtos" };
      } else if (lower.includes("limpeza") || lower.includes("faxina") || lower.includes("casa")) {
        reply = "Para a sua residência temos o departamento Resolve Casa: Limpeza geral, profunda, lavagem de sofás, higienização de cozinhas e casas de banho, ou organização pós-mudança em Huambo com equipa uniformizada e produtos incluídos.";
        action = { label: "Ver Resolve Casa", url: "/servicos/casa" };
      } else if (lower.includes("lavandaria") || lower.includes("roupa") || lower.includes("passar")) {
        reply = "A Resolve Lavandaria faz recolha e entrega ao domicílio de roupas pesadas, engomadoria, cortinas e tapetes, por kg ou por peça.";
        action = { label: "Ver Lavandaria", url: "/servicos/lavandaria" };
      } else if (lower.includes("gás") || lower.includes("gas") || lower.includes("água") || lower.includes("agua") || lower.includes("garrafão")) {
        reply = "No departamento Resolve Water & Gas e na nossa Loja entregamos botijas de gás Sonangol/Saquel (15.000 Kz) e garrafões de água mineral 18.9L (4.500 Kz) diretamente à sua porta em 45 minutos no Huambo.";
        action = { label: "Comprar Água & Gás", url: "/produtos" };
      } else if (lower.includes("carro") || lower.includes("lavagem") || lower.includes("auto")) {
        reply = "O Resolve Auto faz lavagem exterior e interior, higienização e polimento da sua viatura no conforto da sua residência no Huambo!";
        action = { label: "Ver Resolve Auto", url: "/servicos/auto" };
      } else if (lower.includes("canalizador") || lower.includes("eletricista") || lower.includes("reparo") || lower.includes("obra") || lower.includes("tech")) {
        reply = "O Resolve Tech dispõe de técnicos verificados para canalização, eletricidade, carpintaria, pintura e montagem de móveis com diagnóstico prévio.";
        action = { label: "Ver Resolve Tech", url: "/servicos/tech" };
      } else if (lower.includes("trança") || lower.includes("cabelo") || lower.includes("barba") || lower.includes("manicure")) {
        reply = "O Resolve Beauty leva barbeiros, cabeleireiras e manicures com portefólio verificado e material higienizado diretamente ao seu domicílio.";
        action = { label: "Ver Resolve Beauty", url: "/servicos/beauty" };
      } else if (lower.includes("plano") || lower.includes("assinatura") || lower.includes("mensal")) {
        reply = "A Resolve Express tem 4 planos: FREE (avulso), FAMILY (com 10% desconto e lavagem grátis), PREMIUM (atendimento prioritário e taxa grátis) e BUSINESS (para empresas com faturação mensal).";
        action = { label: "Conhecer Planos", url: "/planos" };
      } else if (lower.includes("preço") || lower.includes("valor") || lower.includes("quanto custa")) {
        reply = "Os preços podem ser fixos desde valores base ou sob orçamento gratuito após avaliação dos detalhes no pedido. Tudo é confirmado consigo antes de qualquer pagamento.";
        action = { label: "Explorar Serviços", url: "/servicos" };
      } else {
        reply = `Com a Resolve Express você pede e nós resolvemos! Atuamos no Huambo e províncias com serviços residenciais, técnicos, explicações escolares e uma loja de conveniência com entregas em minutos.`;
        action = { label: "Ver Catálogo Completo", url: "/servicos" };
      }

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "ai",
          text: reply,
          action,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setLoading(false);
    }, 600);
  };

  const quickPrompts = [
    "Comprar botija de gás",
    "Apoio escolar e explicações",
    "Como funciona a limpeza geral?",
    "Quais são os planos de assinatura?",
    "Consultar estado de pedido",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex h-[620px] w-full max-w-lg flex-col overflow-hidden rounded-[calc(var(--radius)*1.5)] border border-border bg-paper shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-ink px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-action text-action-ink">
              <Icon name="Sparkles" className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black tracking-tight text-white">
                  RESOLVE AI
                </span>
                <span className="rounded-full bg-action/20 px-2 py-0.5 text-[10px] font-bold text-action">
                  ASSISTENTE OFICIAL
                </span>
              </div>
              <p className="text-xs text-white/70">
                Respostas inteligentes e suporte para Huambo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <Icon name="X" className="size-5" />
          </button>
        </div>

        {/* Chat message body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-[var(--radius)] px-4 py-3 text-sm leading-relaxed ${
                  m.sender === "user"
                    ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                    : "bg-mist text-foreground ring-1 ring-border rounded-tl-none shadow-xs"
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                {m.action && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      go(m.action!.url);
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-action px-3 py-1 font-display text-xs font-bold text-action-ink transition hover:brightness-105"
                  >
                    <span>{m.action.label}</span>
                    <Icon name="ArrowRight" className="size-3" />
                  </button>
                )}
              </div>
              <span className="mt-1 px-1 text-[11px] text-muted-foreground">
                {m.time}
              </span>
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <div className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-mist px-4 py-2.5 text-sm text-muted-foreground ring-1 ring-border">
                <span className="pulse size-2 rounded-full bg-action" />
                <span>O Resolve AI está a responder...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions */}
        <div className="border-t border-border bg-background/50 px-4 py-2">
          <p className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Sugestões rápidas:
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
            {quickPrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSend(p)}
                className="shrink-0 rounded-full border border-border bg-paper px-3 py-1 font-medium text-foreground transition hover:border-primary hover:bg-mist"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="border-t border-border bg-paper p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte ao Resolve AI sobre serviços, pedidos ou Huambo..."
              className="flex-1 rounded-[var(--radius)] border border-border bg-mist px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:bg-paper focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="grid size-10 place-items-center rounded-[var(--radius)] bg-action text-action-ink transition hover:brightness-105 disabled:opacity-40"
              aria-label="Enviar mensagem"
            >
              <Icon name="Send" className="size-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Dúvidas urgentes? Fale com uma pessoa:</span>
            {store.whatsapp && (
              <a
                href={waLink(store.whatsapp, "Olá! Preciso de ajuda de um operador da Resolve Express.") || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-whatsapp hover:underline"
              >
                Abrir WhatsApp Oficial
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
