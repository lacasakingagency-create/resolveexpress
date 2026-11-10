import React, { useState } from "react";
import { Icon, Btn, Field, inputCls, Empty } from "../ui/kit";
import { useStore, formatCurrency, kz, saveAdminStateAsync } from "../lib/store";
import { type VirtualCardRequest, type ImportQuoteRequest } from "../lib/data";

export function ImportAdminSection() {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState<"cards" | "quotes">("cards");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Quote pricing modal state
  const [pricingQuote, setPricingQuote] = useState<ImportQuoteRequest | null>(null);
  const [quotePriceUSD, setQuotePriceUSD] = useState<number>(0);
  const [quoteShippingAOA, setQuoteShippingAOA] = useState<number>(35000);
  const [quoteCustomsAOA, setQuoteCustomsAOA] = useState<number>(20000);
  const [quoteFeeAOA, setQuoteFeeAOA] = useState<number>(25000);
  const [quoteDays, setQuoteDays] = useState<string>("7 a 14 dias úteis");

  const virtualCards = store.virtualCardRequests || [];
  const importQuotes = store.importQuotes || [];

  const handleUpdateCardStatus = async (
    id: string,
    newStatus: "PENDENTE" | "EM_ATENDIMENTO" | "CONCLUIDO" | "CANCELADO",
    note?: string
  ) => {
    setIsSaving(true);
    const res = await saveAdminStateAsync(
      (st) => ({
        virtualCardRequests: (st.virtualCardRequests || []).map((req) =>
          req.id === id
            ? {
                ...req,
                status: newStatus,
                adminNotes: note !== undefined ? note : req.adminNotes,
                updatedAt: new Date().toISOString(),
              }
            : req
        ),
      }),
      "Atualização de Cartão Virtual",
      `Pedido ${id} alterado para ${newStatus}`
    );
    setIsSaving(false);
    if (res.ok) {
      setFeedback("Pedido de cartão virtual atualizado e gravado no servidor com sucesso!");
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleOpenPricingModal = (quote: ImportQuoteRequest) => {
    setPricingQuote(quote);
    setQuotePriceUSD(quote.productPriceAOA ? Math.round(quote.productPriceAOA / 950) : 50);
    setQuoteShippingAOA(quote.internationalFreightAOA || 35000);
    setQuoteCustomsAOA(quote.customsAndTaxesAOA || 20000);
    setQuoteFeeAOA(quote.handlingFeeAOA || 25000);
    setQuoteDays(quote.estimatedDays || "7 a 14 dias úteis");
  };

  const handleSaveQuotePricing = async () => {
    if (!pricingQuote) return;
    setIsSaving(true);

    const usdExchangeRate = 950; // Kz por USD referencial
    const itemAOA = quotePriceUSD * usdExchangeRate;
    const totalFinalAOA = itemAOA + quoteShippingAOA + quoteCustomsAOA + quoteFeeAOA;

    const res = await saveAdminStateAsync(
      (st) => ({
        importQuotes: (st.importQuotes || []).map((q) =>
          q.id === pricingQuote.id
            ? {
                ...q,
                status: "COTACAO_ENVIADA",
                productPriceOriginal: `$${quotePriceUSD} USD`,
                productPriceAOA: itemAOA,
                internationalFreightAOA: quoteShippingAOA,
                customsAndTaxesAOA: quoteCustomsAOA,
                handlingFeeAOA: quoteFeeAOA,
                totalQuotedAOA: totalFinalAOA,
                estimatedDays: quoteDays,
                quotedAt: new Date().toISOString(),
              }
            : q
        ),
      }),
      "Envio de Cotação de Importação",
      `Cotação gerada para ${pricingQuote.productName}: ${formatCurrency(totalFinalAOA, "AOA")}`
    );

    setIsSaving(false);
    setPricingQuote(null);
    if (res.ok) {
      setFeedback("Cotação gravada com sucesso! Cliente já pode visualizar e aprovar na plataforma.");
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleUpdateQuoteStatus = async (
    id: string,
    status: ImportQuoteRequest["status"],
    trackingNote?: string
  ) => {
    setIsSaving(true);
    const res = await saveAdminStateAsync(
      (st) => ({
        importQuotes: (st.importQuotes || []).map((q) =>
          q.id === id
            ? {
                ...q,
                status,
                quoteNotes: trackingNote ? `${q.quoteNotes || ""} | ${trackingNote}` : q.quoteNotes,
              }
            : q
        ),
      }),
      "Atualização de Estado de Importação",
      `Importação ${id} atualizada para ${status}`
    );
    setIsSaving(false);
    if (res.ok) {
      setFeedback(`Estado atualizado para "${status}" com sucesso!`);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <Icon name="CheckCircle2" className="size-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header com Navegação de Sub-Abas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-paper p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-black text-primary">
              Gestão de Importações & Cartões Internacionais
            </h2>
            <span className="rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-bold text-action">
              Super Admin
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Acompanhe pedidos de assistência em cartões virtuais (Wise, Pyypl, RedotPay) e gerencie cotações de compras por encomenda no exterior.
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "cards" ? "bg-primary text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Icon name="CreditCard" className="size-3.5" />
            <span>Cartões Virtuais ({virtualCards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quotes")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "quotes" ? "bg-primary text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Icon name="Globe" className="size-3.5" />
            <span>Pedidos de Importação ({importQuotes.length})</span>
          </button>
        </div>
      </div>

      {/* SUB-ABA 1: CARTÕES VIRTUAIS */}
      {activeTab === "cards" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-paper overflow-hidden">
            <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <span className="font-bold text-xs text-primary">
                Solicitações de Assistência para Emissão & Carregamento de Cartões
              </span>
              <span className="text-[11px] text-muted-foreground">
                Total: {virtualCards.length} solicitações
              </span>
            </div>

            {virtualCards.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum pedido de cartão virtual registado no momento.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {virtualCards.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-primary">
                          {req.customerName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            req.status === "CONCLUIDO"
                              ? "bg-emerald-100 text-emerald-800"
                              : req.status === "EM_ATENDIMENTO"
                              ? "bg-blue-100 text-blue-800"
                              : req.status === "CANCELADO"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {req.status}
                        </span>
                        {req.preferredCardProvider && (
                          <span className="text-xs font-bold text-action bg-action/10 px-2 py-0.5 rounded">
                            {req.preferredCardProvider}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Telefone / WhatsApp: <strong className="text-primary">{req.whatsapp || req.phone}</strong> · Província: {req.province} ({req.municipio})
                      </p>
                      {req.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                          " {req.notes} "
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        Criado a {new Date(req.createdAt).toLocaleString("pt-PT")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={`https://wa.me/244${(req.whatsapp || req.phone).replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Olá ${req.customerName}! Falamos da Resolve Express sobre o seu pedido de assistência para o cartão virtual ${req.preferredCardProvider || ""}.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1"
                      >
                        <Icon name="MessageCircle" className="size-3.5" />
                        <span>Falar no WhatsApp</span>
                      </a>

                      {req.status === "PENDENTE" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleUpdateCardStatus(req.id, "EM_ATENDIMENTO")}
                          className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700 transition"
                        >
                          Atender
                        </button>
                      )}

                      {req.status !== "CONCLUIDO" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleUpdateCardStatus(req.id, "CONCLUIDO")}
                          className="rounded-lg bg-action text-white px-3 py-1.5 text-xs font-bold hover:bg-action-hover transition"
                        >
                          Concluir
                        </button>
                      )}

                      {req.status !== "CANCELADO" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleUpdateCardStatus(req.id, "CANCELADO")}
                          className="rounded-lg border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1.5 text-xs font-bold transition"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 2: PEDIDOS DE IMPORTAÇÃO SOB ENCOMENDA */}
      {activeTab === "quotes" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-paper overflow-hidden">
            <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <span className="font-bold text-xs text-primary">
                Cotações e Pedidos de Importação de Produtos no Exterior
              </span>
              <span className="text-[11px] text-muted-foreground">
                Total: {importQuotes.length} pedidos
              </span>
            </div>

            {importQuotes.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum pedido de importação registado no momento.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {importQuotes.map((q) => (
                  <div key={q.id} className="p-4 flex flex-col md:flex-row items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                    <div className="flex items-start gap-3.5">
                      {q.photoUrl && typeof q.photoUrl === "string" && q.photoUrl.trim() ? (
                        <img
                          src={q.photoUrl.trim()}
                          alt={q.productName}
                          className="size-16 rounded-xl object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="size-16 rounded-xl bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-400 shrink-0">
                          <Icon name="Package" className="size-6" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display text-sm font-bold text-primary">
                            {q.productName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              q.status === "ENTREGUE"
                                ? "bg-emerald-100 text-emerald-800"
                                : q.status === "EM_TRANSITO_INTERNACIONAL"
                                ? "bg-purple-100 text-purple-800"
                                : q.status === "ENCOMENDA_PAGA"
                                ? "bg-blue-100 text-blue-800"
                                : q.status === "COTACAO_ENVIADA"
                                ? "bg-action/20 text-action"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {q.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Origem: {q.originCountryOrStore}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Cliente: <strong className="text-primary">{q.customerName}</strong> ({q.whatsapp || q.phone}) · Entrega em: {q.deliveryProvince} ({q.deliveryMunicipio})
                        </p>

                        {q.productUrl && (
                          <a
                            href={q.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-action hover:underline inline-flex items-center gap-1"
                          >
                            <span>Ver Link do Fornecedor</span>
                            <Icon name="ExternalLink" className="size-3" />
                          </a>
                        )}

                        {q.totalQuotedAOA && (
                          <p className="text-xs font-black text-emerald-600">
                            Cotação: {kz(q.totalQuotedAOA)} (Prazo: {q.estimatedDays || "10 a 15 dias"})
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenPricingModal(q)}
                        className="rounded-lg bg-action text-white px-3 py-1.5 text-xs font-bold hover:bg-action-hover transition flex items-center gap-1"
                      >
                        <Icon name="Calculator" className="size-3.5" />
                        <span>{q.totalQuotedAOA ? "Recalcular Cotação" : "Gerar Cotação"}</span>
                      </button>

                      {q.status === "COTACAO_ENVIADA" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuoteStatus(q.id, "ENCOMENDA_PAGA")}
                          className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700 transition"
                        >
                          Confirmar Pagamento
                        </button>
                      )}

                      {q.status === "ENCOMENDA_PAGA" && (
                        <button
                          type="button"
                          onClick={() => {
                            const code = prompt("Introduza o código de rastreio internacional ou nota:", "AO-EXP-" + Date.now().toString().slice(-6));
                            if (code) handleUpdateQuoteStatus(q.id, "EM_TRANSITO_INTERNACIONAL", `Rastreio: ${code}`);
                          }}
                          className="rounded-lg bg-purple-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-purple-700 transition"
                        >
                          Marcar em Trânsito
                        </button>
                      )}

                      {q.status === "EM_TRANSITO_INTERNACIONAL" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuoteStatus(q.id, "ENTREGUE")}
                          className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 transition"
                        >
                          Concluir Entrega
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CÁLCULO E ENVIO DE COTAÇÃO */}
      {pricingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-display text-base font-bold text-primary">
                Calcular Cotação: {pricingQuote.productName}
              </h3>
              <button
                type="button"
                onClick={() => setPricingQuote(null)}
                className="rounded p-1 hover:bg-mist text-muted-foreground"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Preço do Produto no Fornecedor (USD):
                </label>
                <input
                  type="number"
                  value={quotePriceUSD}
                  onChange={(e) => setQuotePriceUSD(Number(e.target.value))}
                  className={inputCls}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Convertido a taxa referencial 950 Kz/USD = {kz(quotePriceUSD * 950)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    2. Frete Internacional (AOA):
                  </label>
                  <input
                    type="number"
                    value={quoteShippingAOA}
                    onChange={(e) => setQuoteShippingAOA(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    3. Desalfandegamento (AOA):
                  </label>
                  <input
                    type="number"
                    value={quoteCustomsAOA}
                    onChange={(e) => setQuoteCustomsAOA(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    4. Taxa de Serviço Resolve (AOA):
                  </label>
                  <input
                    type="number"
                    value={quoteFeeAOA}
                    onChange={(e) => setQuoteFeeAOA(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    5. Prazo Estimado de Entrega:
                  </label>
                  <input
                    type="text"
                    value={quoteDays}
                    onChange={(e) => setQuoteDays(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Resumo do Total */}
              {(() => {
                const itemAOA = quotePriceUSD * 950;
                const total = itemAOA + quoteShippingAOA + quoteCustomsAOA + quoteFeeAOA;
                return (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-border p-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo do Artigo:</span>
                      <span className="font-bold">{kz(itemAOA)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Logística & Aduana:</span>
                      <span className="font-bold">{kz(quoteShippingAOA + quoteCustomsAOA)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa de Gestão Resolve:</span>
                      <span className="font-bold text-action">{kz(quoteFeeAOA)}</span>
                    </div>
                    <div className="border-t border-border pt-1 flex justify-between font-black text-sm text-primary">
                      <span>Total Garantido ao Cliente:</span>
                      <span className="text-action">{kz(total)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <Btn kind="ghost" onClick={() => setPricingQuote(null)}>
                  Cancelar
                </Btn>
                <Btn kind="action" disabled={isSaving} onClick={handleSaveQuotePricing}>
                  <Icon name="Send" className="size-3.5" />
                  <span>Gravar e Enviar Cotação ao Cliente</span>
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
