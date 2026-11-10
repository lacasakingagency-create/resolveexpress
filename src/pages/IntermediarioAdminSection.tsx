import React, { useState } from "react";
import { Icon, Btn, Field, inputCls, Empty } from "../ui/kit";
import { useStore, formatCurrency, kz, saveAdminStateAsync } from "../lib/store";
import {
  type IntermediaryListing,
  type IntermediaryCategory,
  type IntermediaryNegotiation,
} from "../lib/data";

export function IntermediarioAdminSection() {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState<"listings" | "categories" | "negotiations">("listings");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const listings = store.intermediaryListings || [];
  const categories = store.intermediaryCategories || [];
  const negotiations = store.intermediaryNegotiations || [];

  // Categorias Handlers
  const handleToggleCategory = async (catId: string) => {
    setIsSaving(true);
    const res = await saveAdminStateAsync(
      (st) => ({
        intermediaryCategories: (st.intermediaryCategories || []).map((c) =>
          c.id === catId ? { ...c, active: !c.active } : c
        ),
      }),
      "Alternar Categoria de Intermediário",
      `Categoria ${catId}`
    );
    setIsSaving(false);
    if (res.ok) {
      setFeedback("Estado da categoria atualizado com sucesso!");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Listings Handlers
  const handleUpdateListingStatus = async (
    id: string,
    status: IntermediaryListing["status"]
  ) => {
    setIsSaving(true);
    const res = await saveAdminStateAsync(
      (st) => ({
        intermediaryListings: (st.intermediaryListings || []).map((l) =>
          l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l
        ),
      }),
      "Modificação de Estado do Anúncio de Intermediação",
      `Anúncio ${id} alterado para ${status}`
    );
    setIsSaving(false);
    if (res.ok) {
      setFeedback(`Anúncio atualizado para "${status}" com sucesso!`);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleToggleFeaturedListing = async (id: string) => {
    setIsSaving(true);
    const res = await saveAdminStateAsync(
      (st) => ({
        intermediaryListings: (st.intermediaryListings || []).map((l) =>
          l.id === id ? { ...l, featuredHome: !l.featuredHome } : l
        ),
      }),
      "Alternar Destaque do Anúncio na Home",
      `Anúncio ID: ${id}`
    );
    setIsSaving(false);
    if (res.ok) {
      setFeedback("Destaque atualizado com sucesso!");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm("Tem a certeza que deseja eliminar este anúncio de intermediação?")) return;
    setIsSaving(true);
    const res = await saveAdminStateAsync(
      (st) => ({
        intermediaryListings: (st.intermediaryListings || []).filter((l) => l.id !== id),
      }),
      "Eliminação de Anúncio de Intermediação",
      `Anúncio removido ID: ${id}`
    );
    setIsSaving(false);
    if (res.ok) {
      setFeedback("Anúncio eliminado com sucesso!");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Negotiations Handlers
  const handleUpdateNegotiationStatus = async (
    id: string,
    status: IntermediaryNegotiation["status"]
  ) => {
    setIsSaving(true);
    const res = await saveAdminStateAsync(
      (st) => ({
        intermediaryNegotiations: (st.intermediaryNegotiations || []).map((n) =>
          n.id === id ? { ...n, status, updatedAt: new Date().toISOString() } : n
        ),
      }),
      "Atualização de Negociação de Intermediação",
      `Negociação ${id} alterada para ${status}`
    );
    setIsSaving(false);
    if (res.ok) {
      setFeedback(`Processo de negociação atualizado para "${status}"!`);
      setTimeout(() => setFeedback(null), 3000);
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

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-paper p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-black text-primary">
              Gestão da Plataforma de Intermediário (Bens Materiais)
            </h2>
            <span className="rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-bold text-action">
              Super Admin
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Gestão de bens materiais de alto valor (imóveis, viaturas, tratores agrícolas, padarias, máquinas industriais), categorias e processos seguros de intermediação.
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("listings")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "listings" ? "bg-primary text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Icon name="Briefcase" className="size-3.5" />
            <span>Anúncios ({listings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "categories" ? "bg-primary text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Icon name="LayoutGrid" className="size-3.5" />
            <span>Categorias ({categories.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("negotiations")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "negotiations" ? "bg-primary text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Icon name="FileCheck" className="size-3.5" />
            <span>Negociações ({negotiations.length})</span>
          </button>
        </div>
      </div>

      {/* SUB-ABA 1: ANÚNCIOS DE BENS MATERIAIS */}
      {activeTab === "listings" && (
        <div className="rounded-2xl border border-border bg-paper overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <span className="font-bold text-xs text-primary">
              Catálogo de Bens Materiais para Intermediação
            </span>
            <span className="text-[11px] text-muted-foreground">
              Total: {listings.length} bens
            </span>
          </div>

          <div className="divide-y divide-border">
            {listings.map((item) => {
              const catObj = categories.find((c) => c.id === item.categoryId);
              return (
                <div key={item.id} className="p-4 flex flex-col md:flex-row items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                  <div className="flex items-start gap-3.5">
                    <img
                      src={(item.images && item.images[0]?.trim()) || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"}
                      alt={item.title}
                      className="size-20 rounded-xl object-cover border border-border shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display text-sm font-bold text-primary">
                          {item.title}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            item.condition === "NOVO" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.condition}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            item.status === "PUBLICADO"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "PENDENTE_APROVACAO"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.featuredHome && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800">
                            Destaque
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-black text-action">
                        {kz(item.priceAOA)} {item.priceNegotiable ? "(Negociável)" : "(Preço Fixo)"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Categoria: <strong>{catObj?.name || item.categoryId}</strong> · Local: {item.province} ({item.municipio || item.bairro}) · Anunciante: {item.sellerName} ({item.sellerPhone})
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFeaturedListing(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        item.featuredHome
                          ? "bg-purple-600 text-white"
                          : "border border-border text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {item.featuredHome ? "★ Destacado" : "Destacar"}
                    </button>

                    {item.status === "PENDENTE_APROVACAO" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateListingStatus(item.id, "PUBLICADO")}
                        className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 transition"
                      >
                        Aprovar
                      </button>
                    )}

                    {item.status === "PUBLICADO" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateListingStatus(item.id, "OCULTO")}
                        className="rounded-lg bg-slate-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-700 transition"
                      >
                        Pausar
                      </button>
                    )}

                    {item.status === "OCULTO" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateListingStatus(item.id, "PUBLICADO")}
                        className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 transition"
                      >
                        Reativar
                      </button>
                    )}

                    {item.status !== "VENDIDO" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateListingStatus(item.id, "VENDIDO")}
                        className="rounded-lg bg-slate-800 text-white px-3 py-1.5 text-xs font-bold hover:bg-black transition"
                      >
                        Marcar Vendido
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteListing(item.id)}
                      className="rounded-lg border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1.5 text-xs font-bold transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-ABA 2: CATEGORIAS DE BENS */}
      {activeTab === "categories" && (
        <div className="rounded-2xl border border-border bg-paper p-5">
          <h3 className="font-display text-base font-bold text-primary mb-3">
            Categorias de Bens Materiais de Intermediação ({categories.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border p-3.5 bg-slate-50 dark:bg-slate-900"
              >
                <div>
                  <h4 className="font-display text-xs font-bold text-primary">
                    {c.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground">{c.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleCategory(c.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                    c.active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {c.active ? "Ativa" : "Desativada"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-ABA 3: NEGOCIAÇÕES */}
      {activeTab === "negotiations" && (
        <div className="rounded-2xl border border-border bg-paper overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <span className="font-bold text-xs text-primary">
              Processos de Intermediação em Andamento
            </span>
            <span className="text-[11px] text-muted-foreground">
              Total: {negotiations.length} processos
            </span>
          </div>

          <div className="divide-y divide-border">
            {negotiations.map((neg) => {
              const listing = listings.find((l) => l.id === neg.listingId);
              return (
                <div key={neg.id} className="p-4 flex flex-col md:flex-row items-start justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-sm font-bold text-primary">
                        {listing?.title || neg.listingTitle}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                        {neg.status}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Interessado: <strong className="text-primary">{neg.buyerName}</strong> ({neg.buyerWhatsapp || neg.buyerPhone}) · Proposta Oferecida: <strong className="text-action">{kz(neg.offeredPriceAOA)}</strong>
                    </p>
                    {neg.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                        "{neg.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`https://wa.me/244${(neg.buyerWhatsapp || neg.buyerPhone).replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Olá ${neg.buyerName}! Entramos em contacto da equipa de Intermediação Segura da Resolve Express sobre o seu interesse no bem ${listing?.title || neg.listingTitle}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1"
                    >
                      <Icon name="MessageCircle" className="size-3.5" />
                      <span>Contactar Interessado</span>
                    </a>

                    {neg.status === "PROPOSTA_INICIADA" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateNegotiationStatus(neg.id, "EM_ANALISE_RESOLVE")}
                        className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700 transition"
                      >
                        Validar Docs
                      </button>
                    )}

                    {neg.status === "EM_ANALISE_RESOLVE" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateNegotiationStatus(neg.id, "VISTORIA_AGENDADA")}
                        className="rounded-lg bg-purple-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-purple-700 transition"
                      >
                        Agendar Vistoria
                      </button>
                    )}

                    {neg.status === "VISTORIA_AGENDADA" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateNegotiationStatus(neg.id, "CONCLUIDA")}
                        className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 transition"
                      >
                        Finalizar Venda
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
