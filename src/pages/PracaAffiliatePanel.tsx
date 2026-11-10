import React, { useState, useMemo } from "react";
import { Icon, go, Btn, Field, inputCls, Section } from "../ui/kit";
import {
  type Product,
  type AffiliateRecord,
  type AffiliateLinkRecord,
  type AffiliateConversionRecord,
  type PracaPayoutRequest,
  ANGOLA_BANKS,
} from "../lib/data";
import {
  useStore,
  formatCurrency,
  kz,
  type StoreState,
  getStoreServices,
} from "../lib/store";

export function PracaAffiliatePanel({ initialTab = "overview" }: { initialTab?: string }) {
  const [store, setStore] = useStore();
  const [tab, setTab] = useState<"overview" | "generator" | "services" | "conversions" | "wallet">((initialTab as any) || "overview");

  // Current logged in affiliate profile or fallback to demo
  const currentAffiliate: AffiliateRecord = useMemo(() => {
    if (store.currentUser) {
      const match = store.affiliates.find(
        (a) => a.userId === store.currentUser?.id || a.email === store.currentUser?.email
      );
      if (match) return match;
    }
    return store.affiliates[0];
  }, [store.currentUser, store.affiliates]);

  // Affiliate's links
  const myLinks = useMemo(() => {
    return store.affiliateLinks.filter((l) => l.affiliateId === currentAffiliate.id || l.affiliateCode === currentAffiliate.code);
  }, [store.affiliateLinks, currentAffiliate]);

  // Affiliate's conversions
  const myConversions = useMemo(() => {
    return store.affiliateConversions.filter((c) => c.affiliateId === currentAffiliate.id || c.affiliateCode === currentAffiliate.code);
  }, [store.affiliateConversions, currentAffiliate]);

  // Available Praça products
  const availableProducts = useMemo(() => {
    return store.products.filter((p) => p.available);
  }, [store.products]);

  // Available Services
  const availableServices = useMemo(() => {
    return getStoreServices(store);
  }, [store]);

  // Link Generator State
  const [targetType, setTargetType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [selectedProductId, setSelectedProductId] = useState<string>(availableProducts[0]?.id || "");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(availableServices[0]?.id || "");
  const [copiedLink, setCopiedLink] = useState(false);

  // Selected Item details for Generator
  const selectedProduct = useMemo(() => {
    return availableProducts.find((p) => p.id === selectedProductId) || availableProducts[0];
  }, [availableProducts, selectedProductId]);

  const selectedService = useMemo(() => {
    return availableServices.find((s) => s.id === selectedServiceId) || availableServices[0];
  }, [availableServices, selectedServiceId]);

  // Commission Calculations for the generator
  const currentPrice = targetType === "PRODUCT"
    ? (selectedProduct?.promotionalPriceAOA || selectedProduct?.priceAOA || 10000)
    : 15000; // Average base price for services

  const affiliateRate = targetType === "PRODUCT"
    ? (selectedProduct?.affiliateCommissionRate || store.pracaSettings?.defaultAffiliateCommission || 5)
    : 6; // 6% on services

  const platformRate = targetType === "PRODUCT"
    ? (selectedProduct?.platformCommissionRate || store.pracaSettings?.defaultPlatformCommission || 10)
    : 15;

  const estimatedAffiliateEarning = Math.round((currentPrice * affiliateRate) / 100);
  const platformCut = Math.round((currentPrice * platformRate) / 100);
  const sellerOrPartnerNet = currentPrice - estimatedAffiliateEarning - platformCut;

  // Generated Link
  const generatedUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    if (targetType === "PRODUCT" && selectedProduct) {
      return `${base}/#praca?prod=${selectedProduct.id}&ref=${currentAffiliate.code}`;
    }
    if (targetType === "SERVICE" && selectedService) {
      return `${base}/#pedir/${selectedService.id}?ref=${currentAffiliate.code}`;
    }
    return `${base}/#praca?ref=${currentAffiliate.code}`;
  }, [targetType, selectedProduct, selectedService, currentAffiliate]);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(generatedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Create & Save Link
  const handleSaveLink = () => {
    const newLink: AffiliateLinkRecord = {
      id: `link-${Date.now()}`,
      affiliateId: currentAffiliate.id,
      affiliateCode: currentAffiliate.code,
      targetType: targetType === "PRODUCT" ? "PRACA_PRODUCT" : "SERVICE",
      targetId: targetType === "PRODUCT" ? selectedProduct.id : selectedService.id,
      targetTitle: targetType === "PRODUCT" ? selectedProduct.name : selectedService.name,
      targetPriceAOA: currentPrice,
      commissionPercent: affiliateRate,
      estimatedCommissionAOA: estimatedAffiliateEarning,
      url: generatedUrl,
      clicks: 0,
      conversions: 0,
      createdAt: new Date().toISOString(),
    };

    setStore((st) => ({
      affiliateLinks: [newLink, ...st.affiliateLinks],
    }));

    handleCopyLink();
  };

  // Payout request modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<number>(currentAffiliate.availableCommissionAOA || 10000);
  const [payoutBank, setPayoutBank] = useState("Banco BAI");
  const [payoutIban, setPayoutIban] = useState(currentAffiliate.bankAccount?.iban || "AO06.0040.0000.9999.8888.1111.9");
  const [payoutHolder, setPayoutHolder] = useState(currentAffiliate.name);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutAmount <= 0 || payoutAmount > currentAffiliate.availableCommissionAOA) return;

    const newRequest: PracaPayoutRequest = {
      id: `PAY-AFF-${Date.now().toString().slice(-6)}`,
      requesterType: "AFFILIATE",
      requesterId: currentAffiliate.id,
      requesterName: currentAffiliate.name,
      storeOrAffiliateName: `Afiliado ${currentAffiliate.name} (${currentAffiliate.code})`,
      amountAOA: Number(payoutAmount),
      method: "TRANSFERENCIA_BANCARIA",
      bankName: payoutBank,
      iban: payoutIban,
      accountHolder: payoutHolder,
      status: "PENDENTE",
      createdAt: new Date().toISOString(),
    };

    setStore((st) => ({
      pracaPayoutRequests: [newRequest, ...st.pracaPayoutRequests],
      affiliates: st.affiliates.map((a) =>
        a.id === currentAffiliate.id
          ? {
              ...a,
              availableCommissionAOA: Math.max(0, a.availableCommissionAOA - Number(payoutAmount)),
              pendingCommissionAOA: a.pendingCommissionAOA + Number(payoutAmount),
            }
          : a
      ),
    }));

    setPayoutSuccess(true);
    setTimeout(() => {
      setPayoutSuccess(false);
      setShowPayoutModal(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header do Painel */}
      <div className="bg-gradient-to-r from-primary via-slate-900 to-[#12365A] text-white pt-6 pb-12 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="size-14 rounded-2xl bg-action text-white grid place-items-center shadow-lg font-black text-xl">
                <Icon name="Award" className="size-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-xl sm:text-2xl font-black text-white">
                    Painel do Afiliado: {currentAffiliate.name}
                  </h1>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    Afiliado Oficial Activo
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Código de Referência Único: <strong className="text-action font-mono text-sm">{currentAffiliate.code}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("generator")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-action px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:brightness-110 shadow-md transition"
              >
                <Icon name="Link" className="size-4" />
                <span>Gerar Novo Link</span>
              </button>
              <button
                type="button"
                onClick={() => go("/praca")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:text-white border border-white/20 transition"
              >
                <Icon name="Store" className="size-3.5" />
                <span>Ver Praça</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => setTab("overview")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "overview"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Icon name="LayoutDashboard" className="size-4" />
              <span>Visão Geral</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("generator")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "generator"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Icon name="Link" className="size-4" />
              <span>Gerador de Links & Calculadora</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("services")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "services"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Icon name="Wrench" className="size-4" />
              <span>Afiliados de Serviços</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("conversions")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "conversions"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Icon name="DollarSign" className="size-4" />
              <span>Vendas e Comissões ({myConversions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("wallet")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "wallet"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Icon name="Wallet" className="size-4" />
              <span>Carteira & Levantamentos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo da Tab */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: VISÃO GERAL */}
        {tab === "overview" && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                  <span>Comissão Disponível</span>
                  <Icon name="CheckCircle2" className="size-4 text-emerald-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-600">
                  {kz(currentAffiliate.availableCommissionAOA)}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(true)}
                  className="mt-1 text-[11px] font-bold text-action hover:underline"
                >
                  Solicitar Levantamento →
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                  <span>Comissão Pendente</span>
                  <Icon name="Clock" className="size-4 text-amber-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-amber-600">
                  {kz(currentAffiliate.pendingCommissionAOA)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Valida após entrega do pedido</p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                  <span>Total de Cliques</span>
                  <Icon name="MousePointerClick" className="size-4 text-blue-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-primary dark:text-white">
                  {currentAffiliate.totalClicks}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">{currentAffiliate.uniqueClicks} visitantes únicos</p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                  <span>Vendas Convertidas</span>
                  <Icon name="TrendingUp" className="size-4 text-action" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-200">
                  {currentAffiliate.totalOrdersReferred}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Taxa de conversão: ~4.8%</p>
              </div>
            </div>

            {/* Performance Visual Chart */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <h3 className="font-display text-base sm:text-lg font-bold text-primary dark:text-white mb-1">
                Evolução de Cliques e Comissões
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Rastreio em tempo real com atribuição válida durante 30 dias
              </p>

              <div className="h-44 w-full flex items-end gap-3 sm:gap-6 pt-4 border-b border-slate-100 dark:border-slate-800">
                {[
                  { dia: "10 Jan", cliques: 18, comissao: 2500, height: "30%" },
                  { dia: "15 Jan", cliques: 34, comissao: 5200, height: "55%" },
                  { dia: "20 Jan", cliques: 22, comissao: 3100, height: "40%" },
                  { dia: "25 Jan", cliques: 55, comissao: 9400, height: "85%" },
                  { dia: "01 Fev", cliques: 42, comissao: 7200, height: "65%" },
                  { dia: "10 Fev", cliques: 68, comissao: 12500, height: "100%" },
                  { dia: "Hoje", cliques: 28, comissao: 4500, height: "45%" },
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[10px] font-bold text-action opacity-0 group-hover:opacity-100 transition">
                      {kz(item.comissao)}
                    </span>
                    <div
                      style={{ height: item.height }}
                      className="w-full rounded-t-xl bg-gradient-to-t from-primary to-action group-hover:brightness-110 transition-all duration-300"
                    />
                    <span className="text-xs font-bold text-slate-500 mt-1">{item.dia}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabela Resumo dos Links Ativos */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-bold text-primary dark:text-white">
                  Seus Links de Afiliado com Maior Desempenho
                </h3>
                <button
                  type="button"
                  onClick={() => setTab("generator")}
                  className="text-xs font-bold text-action hover:underline"
                >
                  + Criar Novo Link
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Produto / Serviço</th>
                      <th className="py-2.5 px-3">Preço</th>
                      <th className="py-2.5 px-3">Comissão Estimada</th>
                      <th className="py-2.5 px-3 text-center">Cliques</th>
                      <th className="py-2.5 px-3 text-center">Vendas</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {myLinks.map((link) => (
                      <tr key={link.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <span className="font-bold text-primary dark:text-white block truncate max-w-[220px]">
                            {link.targetTitle}
                          </span>
                          <span className="text-[10px] text-action font-mono">
                            Código: {link.affiliateCode}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold">{kz(link.targetPriceAOA)}</td>
                        <td className="py-3 px-3 font-bold text-emerald-600">
                          {kz(link.estimatedCommissionAOA)} ({link.commissionPercent}%)
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {link.clicks}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-primary dark:text-white">
                          {link.conversions}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(window.location.origin + "/#" + link.url.replace(/^#/, ""));
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-action px-2.5 py-1 text-[11px] font-bold text-white hover:brightness-105"
                          >
                            <Icon name="Copy" className="size-3" />
                            <span>Copiar</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GERADOR DE LINKS E CALCULADORA */}
        {tab === "generator" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-primary dark:text-white flex items-center gap-2">
                <Icon name="Link" className="size-5 text-action" />
                Gerador de Links de Afiliado com Calculadora Automática
              </h2>
              <p className="text-xs text-muted-foreground">
                Selecione o produto ou serviço que pretende divulgar e visualize exatamente quanto vai ganhar por cada venda.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
              {/* Escolha do Tipo de Item: Produto da Praça vs Serviço */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  1. O que deseja divulgar?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetType("PRODUCT")}
                    className={`flex items-center justify-center gap-2 rounded-2xl p-3 border-2 font-bold text-xs transition cursor-pointer ${
                      targetType === "PRODUCT"
                        ? "border-action bg-action/5 text-action"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Icon name="Store" className="size-4" />
                    <span>Produto da PRAÇA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("SERVICE")}
                    className={`flex items-center justify-center gap-2 rounded-2xl p-3 border-2 font-bold text-xs transition cursor-pointer ${
                      targetType === "SERVICE"
                        ? "border-action bg-action/5 text-action"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Icon name="Wrench" className="size-4" />
                    <span>Serviço da RESOLVEEXPRESS</span>
                  </button>
                </div>
              </div>

              {/* Seleção do Item Específico */}
              {targetType === "PRODUCT" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    2. Selecione o Produto da Praça:
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-bold text-primary dark:text-white outline-none"
                  >
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {kz(p.promotionalPriceAOA || p.priceAOA)} (Loja: {p.sellerName})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    2. Selecione o Serviço Resolve Express:
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-bold text-primary dark:text-white outline-none"
                  >
                    {availableServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* CALCULADORA AUTOMÁTICA DO AFILIADO EM TEMPO REAL */}
              <div className="rounded-2xl border-2 border-action/30 bg-action/5 p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-action/20">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Icon name="Calculator" className="size-4 text-action" />
                    Simulação de Ganhos para este Link:
                  </span>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    +{affiliateRate}% Comissão
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground text-[11px]">Preço do Item:</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{kz(currentPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px]">Sua Comissão:</p>
                    <p className="font-black text-emerald-600 text-base">{kz(estimatedAffiliateEarning)}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-muted-foreground text-[11px]">Comissão da Resolve:</p>
                    <p className="font-bold text-slate-700 dark:text-slate-300">{kz(platformCut)} ({platformRate}%)</p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-1 leading-snug">
                  Quando o cliente clicar no seu link e confirmar o pagamento, <strong>{kz(estimatedAffiliateEarning)}</strong> são registados automaticamente na sua carteira de afiliado.
                </p>
              </div>

              {/* Link Gerado com Código de Referência */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  3. O Seu Link Único de Divulgação:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveLink}
                    className="shrink-0 rounded-xl bg-action px-4 py-2.5 text-xs font-bold text-white hover:brightness-105 active:scale-95 transition"
                  >
                    {copiedLink ? "Copiado!" : "Copiar Link"}
                  </button>
                </div>
              </div>

              {/* Botões de Partilha Rápida nas Redes */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Partilhar com 1 Clique:</p>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Olá! Recomendo este excelente produto/serviço na ResolveExpress no Huambo: ${
                        targetType === "PRODUCT" ? selectedProduct.name : selectedService.name
                      } por apenas ${kz(currentPrice)}. Confira aqui: ${generatedUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-bold transition"
                  >
                    <Icon name="MessageCircle" className="size-4" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(generatedUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold transition"
                  >
                    <Icon name="Share2" className="size-4" />
                    <span>Facebook</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white py-2.5 text-xs font-bold transition"
                  >
                    <Icon name="Copy" className="size-4" />
                    <span>Copiar Link</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AFILIADOS DE SERVIÇOS */}
        {tab === "services" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-primary dark:text-white">
                Programa de Afiliados para Serviços ResolveExpress
              </h2>
              <p className="text-xs text-muted-foreground">
                Divulgue serviços ao domicílio (limpeza, canalização, eletricidade, cuidados) e ganhe por cada marcação concluída.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableServices.map((svc) => {
                const serviceLink = `${window.location.origin}/#pedir/${svc.id}?ref=${currentAffiliate.code}`;
                const estPrice = 15000;
                const estCommission = Math.round((estPrice * 6) / 100);

                return (
                  <div
                    key={svc.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-video w-full rounded-xl overflow-hidden mb-3 bg-slate-100">
                        <img src={svc.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"} alt={svc.name} className="h-full w-full object-cover" />
                      </div>
                      <h3 className="font-bold text-sm text-primary dark:text-white">{svc.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Comissão por serviço:</span>
                        <span className="font-black text-emerald-600">~{kz(estCommission)} (6%)</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(serviceLink);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="flex-1 rounded-xl bg-action py-2 text-xs font-bold text-white hover:brightness-105"
                      >
                        Copiar Link de Afiliado
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Precisa de serviço de ${svc.name} com equipa verificada no Huambo? Peça aqui: ${serviceLink}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Partilhar no WhatsApp"
                      >
                        <Icon name="MessageCircle" className="size-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: HISTÓRICO DE VENDAS E CONVERSÕES */}
        {tab === "conversions" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-primary dark:text-white">
                Vendas e Conversões Atribuídas
              </h2>
              <p className="text-xs text-muted-foreground">
                Registo de transações efetuadas através do seu código de afiliado ({currentAffiliate.code})
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3">Item / Serviço</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3">Valor da Venda</th>
                    <th className="py-3 px-3">Sua Comissão</th>
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {myConversions.map((conv) => (
                    <tr key={conv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-bold text-action">
                        {conv.orderId || conv.bookingId || conv.id}
                      </td>
                      <td className="py-3 px-3 font-bold text-primary dark:text-white">{conv.itemName}</td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {conv.itemType === "PRODUCT" ? "Produto Praça" : "Serviço Express"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold">{kz(conv.saleAmountAOA)}</td>
                      <td className="py-3 px-3 font-black text-emerald-600">
                        {kz(conv.commissionAmountAOA)} ({conv.affiliateCommissionPercent}%)
                      </td>
                      <td className="py-3 px-3 text-slate-500">{new Date(conv.createdAt).toLocaleDateString("pt-AO")}</td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            conv.status === "DISPONIVEL"
                              ? "bg-emerald-100 text-emerald-800"
                              : conv.status === "PENDENTE"
                              ? "bg-amber-100 text-amber-800"
                              : conv.status === "PAGO"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {conv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: CARTEIRA & LEVANTAMENTOS */}
        {tab === "wallet" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-primary dark:text-white">
                  Carteira do Afiliado
                </h2>
                <p className="text-xs text-muted-foreground">
                  Solicite levantamentos para a sua conta bancária a partir de 10.000 Kz
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-action px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:brightness-105 shadow-md"
              >
                <Icon name="ArrowDownToLine" className="size-4" />
                <span>Solicitar Levantamento</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Saldo Disponível para Levantamento</p>
                <p className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-300">
                  {kz(currentAffiliate.availableCommissionAOA)}
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">Pronto para transferência</p>
              </div>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Comissões em Processamento</p>
                <p className="mt-2 text-3xl font-black text-amber-700 dark:text-amber-300">
                  {kz(currentAffiliate.pendingCommissionAOA)}
                </p>
                <p className="text-[11px] text-amber-600 mt-1">Aguardando entrega de encomendas</p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <p className="text-xs font-bold text-slate-500">Total Já Recebido</p>
                <p className="mt-2 text-3xl font-black text-primary dark:text-white">
                  {kz(currentAffiliate.paidCommissionAOA)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Transferências bem-sucedidas</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL SOLICITAR LEVANTAMENTO DO AFILIADO */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowPayoutModal(false)}
              className="absolute right-4 top-4 size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 grid place-items-center"
            >
              <Icon name="X" className="size-4" />
            </button>

            <h3 className="font-display text-lg font-black text-primary dark:text-white mb-1">
              Solicitar Levantamento de Comissões
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Transfira as suas comissões confirmadas para a sua conta bancária angolana.
            </p>

            {payoutSuccess ? (
              <div className="p-6 text-center space-y-2">
                <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto">
                  <Icon name="CheckCircle2" className="size-6" />
                </div>
                <h4 className="font-bold text-emerald-700 text-base">Pedido Registado com Sucesso!</h4>
                <p className="text-xs text-slate-500">
                  O valor será creditado na sua conta nas próximas 24 horas.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Valor a Levantar (Saldo Disponível: {kz(currentAffiliate.availableCommissionAOA)})
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    max={currentAffiliate.availableCommissionAOA}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Banco Angolano</label>
                  <select
                    value={payoutBank}
                    onChange={(e) => setPayoutBank(e.target.value)}
                    className={inputCls}
                  >
                    {ANGOLA_BANKS.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">IBAN da Sua Conta</label>
                  <input
                    type="text"
                    required
                    value={payoutIban}
                    onChange={(e) => setPayoutIban(e.target.value)}
                    placeholder="AO06.0040.0000.1234.5678.9012.3"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Titular da Conta</label>
                  <input
                    type="text"
                    required
                    value={payoutHolder}
                    onChange={(e) => setPayoutHolder(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-action py-3 text-xs font-bold text-white hover:brightness-105 shadow-md"
                  >
                    Confirmar Levantamento ({kz(payoutAmount)})
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
