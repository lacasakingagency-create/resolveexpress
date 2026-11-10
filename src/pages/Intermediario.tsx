import React, { useState, useMemo } from "react";
import { Icon, Btn, Field, inputCls, Section } from "../ui/kit";
import { useStore, kz, waLink, formatCurrency } from "../lib/store";
import { ImageUploader } from "../ui/ImageUploader";
import {
  IntermediaryListing,
  IntermediaryNegotiation,
  ANGOLA_PROVINCES,
} from "../lib/data";

export function Intermediario() {
  const [store, update] = useStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [selectedCondition, setSelectedCondition] = useState<"TODOS" | "NOVO" | "USADO">("TODOS");
  const [selectedProvince, setSelectedProvince] = useState<string>("TODAS");
  const [sortBy, setSortBy] = useState<"recent" | "price_asc" | "price_desc">("recent");

  // Listing Detail Modal
  const [activeListing, setActiveListing] = useState<IntermediaryListing | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // New Listing Publishing Modal
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({
    title: "",
    description: "",
    categoryId: store.intermediaryCategories?.[0]?.id || "casas-apartamentos",
    subcategory: "",
    condition: "USADO" as "NOVO" | "USADO",
    priceAOA: 5000000,
    priceNegotiable: true,
    province: store.currentUser?.province || "Huambo",
    municipio: store.currentUser?.municipio || "Huambo",
    bairro: "",
    image1: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80",
    image2: "",
    image3: "",
    sellerName: store.currentUser?.name || "",
    sellerPhone: store.currentUser?.phone || "923 111 222",
    sellerWhatsapp: store.currentUser?.phone || "923 111 222",
    sellerType: "PROPRIETARIO" as IntermediaryListing["sellerType"],
    spec1Key: "Ano / Modelo",
    spec1Val: "",
    spec2Key: "Estado Mecânico / Físico",
    spec2Val: "",
  });
  const [publishSubmitting, setPublishSubmitting] = useState(false);

  // Intermediation Request Modal
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [negotiationForm, setNegotiationForm] = useState({
    buyerName: store.currentUser?.name || "",
    buyerPhone: store.currentUser?.phone || "923 111 222",
    buyerWhatsapp: store.currentUser?.phone || "923 111 222",
    offeredPriceAOA: 0,
    inspectionRequested: true,
    escrowRequested: true,
    notes: "",
  });
  const [negotiationSubmitting, setNegotiationSubmitting] = useState(false);

  // Open negotiation modal for active listing
  const handleOpenNegotiation = (listing: IntermediaryListing) => {
    setActiveListing(listing);
    setNegotiationForm({
      buyerName: store.currentUser?.name || "",
      buyerPhone: store.currentUser?.phone || "923 111 222",
      buyerWhatsapp: store.currentUser?.phone || "923 111 222",
      offeredPriceAOA: listing.priceAOA,
      inspectionRequested: true,
      escrowRequested: true,
      notes: "Pretendo vistoria técnica no local e garantia de intermediação da Resolve Express antes do pagamento final.",
    });
    setShowNegotiationModal(true);
  };

  // Submit Listing
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishForm.title || !publishForm.priceAOA || !publishForm.sellerPhone) {
      alert("Por favor preencha os campos obrigatórios do anúncio.");
      return;
    }
    setPublishSubmitting(true);
    try {
      const cat = store.intermediaryCategories?.find((c) => c.id === publishForm.categoryId);
      const images = [publishForm.image1, publishForm.image2, publishForm.image3].filter(Boolean);

      const features: Record<string, string> = {};
      if (publishForm.spec1Key && publishForm.spec1Val) {
        features[publishForm.spec1Key] = publishForm.spec1Val;
      }
      if (publishForm.spec2Key && publishForm.spec2Val) {
        features[publishForm.spec2Key] = publishForm.spec2Val;
      }

      const newListing: IntermediaryListing = {
        id: `INT-${new Date().getFullYear()}-${String(store.intermediaryListings?.length + 1 || 1).padStart(4, "0")}`,
        title: publishForm.title,
        description: publishForm.description,
        categoryId: publishForm.categoryId,
        categoryName: cat?.name || "Bens Diversos",
        subcategory: publishForm.subcategory,
        condition: publishForm.condition,
        priceAOA: Number(publishForm.priceAOA),
        priceNegotiable: publishForm.priceNegotiable,
        province: publishForm.province,
        municipio: publishForm.municipio,
        bairro: publishForm.bairro,
        images: images.length > 0 ? images : ["https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"],
        features,
        sellerName: publishForm.sellerName || "Anunciante",
        sellerPhone: publishForm.sellerPhone,
        sellerWhatsapp: publishForm.sellerWhatsapp || publishForm.sellerPhone,
        sellerType: publishForm.sellerType,
        status: "PENDENTE_APROVACAO",
        viewsCount: 1,
        intermediationRequestedCount: 0,
        createdAt: new Date().toISOString(),
      };

      update((s) => ({
        intermediaryListings: [newListing, ...(s.intermediaryListings || [])],
      }));

      setShowPublishModal(false);
      alert(`Anúncio ${newListing.id} submetido com sucesso! Passará pela moderação da equipa da Resolve Express para verificação de autenticidade.`);
    } finally {
      setPublishSubmitting(false);
    }
  };

  // Submit Intermediation Proposal
  const handleNegotiationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListing) return;
    setNegotiationSubmitting(true);
    try {
      const cat = store.intermediaryCategories?.find((c) => c.id === activeListing.categoryId);
      const commissionRate = (cat?.suggestedCommissionPercent || 3) / 100;
      const agreedCommissionAOA = Math.round(Number(negotiationForm.offeredPriceAOA) * commissionRate);

      const newNeg: IntermediaryNegotiation = {
        id: `NEG-${new Date().getFullYear()}-${String(store.intermediaryNegotiations?.length + 1 || 1).padStart(6, "0")}`,
        listingId: activeListing.id,
        listingTitle: activeListing.title,
        listingPriceAOA: activeListing.priceAOA,
        buyerName: negotiationForm.buyerName,
        buyerPhone: negotiationForm.buyerPhone,
        buyerWhatsapp: negotiationForm.buyerWhatsapp,
        sellerName: activeListing.sellerName,
        sellerPhone: activeListing.sellerPhone,
        offeredPriceAOA: Number(negotiationForm.offeredPriceAOA),
        agreedCommissionAOA,
        commissionPayer: "SPLIT",
        inspectionRequested: negotiationForm.inspectionRequested,
        escrowRequested: negotiationForm.escrowRequested,
        status: "PROPOSTA_INICIADA",
        notes: negotiationForm.notes,
        createdAt: new Date().toISOString(),
      };

      update((s) => ({
        intermediaryNegotiations: [newNeg, ...(s.intermediaryNegotiations || [])],
        intermediaryListings: (s.intermediaryListings || []).map((l) =>
          l.id === activeListing.id
            ? { ...l, intermediationRequestedCount: (l.intermediationRequestedCount || 0) + 1 }
            : l
        ),
      }));

      setShowNegotiationModal(false);
      alert(`Proposta de intermediação ${newNeg.id} registada com sucesso! A equipa da Resolve Express contactará comprador e vendedor para coordenar a vistoria física e garantia.`);
    } finally {
      setNegotiationSubmitting(false);
    }
  };

  // Filtragem dos anúncios
  const filteredListings = useMemo(() => {
    let list = (store.intermediaryListings || []).filter(
      (l) => l.status === "PUBLICADO" || store.currentUser?.role === "SUPER_ADMIN"
    );

    if (selectedCategory !== "TODAS") {
      list = list.filter((l) => l.categoryId === selectedCategory);
    }

    if (selectedCondition !== "TODOS") {
      list = list.filter((l) => l.condition === selectedCondition);
    }

    if (selectedProvince !== "TODAS") {
      list = list.filter((l) => l.province === selectedProvince);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.categoryName.toLowerCase().includes(q) ||
          (l.municipio && l.municipio.toLowerCase().includes(q))
      );
    }

    if (sortBy === "price_asc") {
      list.sort((a, b) => a.priceAOA - b.priceAOA);
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => b.priceAOA - a.priceAOA);
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [store.intermediaryListings, selectedCategory, selectedCondition, selectedProvince, search, sortBy, store.currentUser]);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#071B33] via-[#0E294B] to-[#12365A] py-12 px-4 text-white sm:py-16 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-300 ring-1 ring-orange-400/30">
                <Icon name="Handshake" className="size-4" />
                Intermediação Segura de Bens Materiais
              </span>
              <h1 className="mt-3 font-display text-3xl font-black text-white sm:text-5xl">
                INTERMEDIAÇÃO DE BENS MATERIAIS
              </h1>
              <p className="mt-2 text-sm text-slate-300 sm:text-base leading-relaxed">
                Plataforma de aproximação segura entre compradores, proprietários, empresas e comerciantes no Huambo e em toda Angola. Casas, terrenos, viaturas, máquinas industriais e equipamentos novos e usados.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowPublishModal(true)}
                className="flex items-center gap-2 rounded-2xl bg-[#E6540F] px-6 py-4 text-sm font-bold text-white shadow-xl transition hover:bg-[#cf490a] active:scale-95"
              >
                <Icon name="PlusCircle" className="size-5" />
                Publicar Anúncio de Bem Material
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-4 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
            <div className="sm:col-span-2 relative">
              <Icon name="Search" className="absolute left-3.5 top-3.5 size-4 text-white/60" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar vivenda, terreno, hilux, trator, forno industrial..."
                className="w-full rounded-xl bg-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/60 outline-none focus:bg-white/20"
              />
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl bg-[#071B33] px-3 py-2.5 text-sm text-white outline-none border border-white/20"
              >
                <option value="TODAS">Todas as Categorias</option>
                {store.intermediaryCategories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="w-full rounded-xl bg-[#071B33] px-3 py-2.5 text-sm text-white outline-none border border-white/20"
              >
                <option value="TODAS">Todas as Províncias</option>
                {ANGOLA_PROVINCES.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* Categories Horizontal Carousel */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Categorias de Bens Disponíveis
            </h3>
            <span className="text-xs text-slate-400">{filteredListings.length} anúncios encontrados</span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("TODAS")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === "TODAS"
                  ? "bg-[#071B33] text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Icon name="LayoutGrid" className="size-4" />
              Ver Tudo ({store.intermediaryListings?.length || 0})
            </button>

            {store.intermediaryCategories?.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? "bg-[#071B33] text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Icon name={cat.icon as any || "Package"} className="size-4 text-orange-500" />
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar: Condition & Sort */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Condição:</span>
            {(["TODOS", "NOVO", "USADO"] as const).map((cond) => (
              <button
                key={cond}
                type="button"
                onClick={() => setSelectedCondition(cond)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  selectedCondition === cond
                    ? "bg-orange-100 text-orange-800"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cond === "TODOS" ? "Todos os Bens" : cond === "NOVO" ? "Novos" : "Usados"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700"
            >
              <option value="recent">Mais Recentes</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
            </select>
          </div>
        </div>

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <Icon name="PackageSearch" className="mx-auto size-12 text-slate-300" />
            <h4 className="mt-3 font-display text-lg font-bold text-slate-800">
              Nenhum bem encontrado com estes filtros
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Tente redefinir os filtros de categoria ou província para ver outros anúncios.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("TODAS");
                setSelectedCondition("TODOS");
                setSelectedProvince("TODAS");
                setSearch("");
              }}
              className="mt-4 rounded-xl bg-[#E6540F] px-4 py-2 text-xs font-bold text-white shadow-xs"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((item) => (
              <div
                key={item.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs transition duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl"
              >
                <div>
                  {/* Photo Carousel Preview */}
                  <div className="relative h-56 w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.images?.[0]?.trim() || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"}
                      alt={item.title}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        {item.categoryName}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          item.condition === "NOVO" ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                        }`}
                      >
                        {item.condition}
                      </span>
                    </div>

                    {item.priceNegotiable && (
                      <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 shadow-sm backdrop-blur-xs">
                        Negociável
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Icon name="MapPin" className="size-3.5 text-orange-500" />
                      <span>{item.municipio ? `${item.municipio}, ` : ""}{item.province}</span>
                      {item.bairro && <span className="text-slate-400">({item.bairro})</span>}
                    </div>

                    <h3 className="mt-1 font-display text-base font-bold text-slate-900 group-hover:text-[#E6540F] transition line-clamp-2">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Features Badges */}
                    {item.features && Object.keys(item.features).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(item.features).slice(0, 2).map(([k, v]) => (
                          <span key={k} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                            <strong className="font-semibold">{k}:</strong> {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer and Price */}
                <div className="border-t border-slate-100 p-5 pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Valor Anunciado
                      </span>
                      <p className="font-display text-xl font-black text-slate-900">
                        {kz(item.priceAOA)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveListing(item);
                        setActivePhotoIndex(0);
                      }}
                      className="rounded-xl bg-[#071B33] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0e294b]"
                    >
                      Ver Detalhes
                    </button>
                  </div>

                  <div className="mt-3 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Anunciante: <strong className="text-slate-700">{item.sellerName}</strong></span>
                    <button
                      type="button"
                      onClick={() => handleOpenNegotiation(item)}
                      className="font-bold text-[#E6540F] hover:underline flex items-center gap-1"
                    >
                      <Icon name="Shield" className="size-3" />
                      Pedir Intermediação
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================
          MODAL: DETALHES COMPLETOS DO BEM
      ========================================================= */}
      {activeListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4 sm:px-6">
              <div>
                <span className="text-[11px] font-bold uppercase text-orange-600">
                  {activeListing.categoryName} • Ref: {activeListing.id}
                </span>
                <h3 className="font-display text-lg font-black text-slate-900 sm:text-xl">
                  {activeListing.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveListing(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Photo Gallery */}
              <div>
                <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-slate-100">
                  <img
                    src={activeListing.images?.[activePhotoIndex]?.trim() || activeListing.images?.[0]?.trim() || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"}
                    alt={activeListing.title}
                    className="size-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-xs">
                      {activeListing.condition}
                    </span>
                    {activeListing.priceNegotiable && (
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                        Aceita Negociação
                      </span>
                    )}
                  </div>
                </div>

                {activeListing.images.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {activeListing.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                          activePhotoIndex === idx ? "border-[#E6540F]" : "border-slate-200 opacity-70"
                        }`}
                      >
                        <img src={img?.trim() || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Location */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Preço Anunciado</span>
                  <p className="font-display text-2xl font-black text-[#E6540F]">
                    {kz(activeListing.priceAOA)}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500">Localização do Bem</span>
                  <p className="text-sm font-bold text-slate-900">
                    {activeListing.municipio}, {activeListing.province}
                  </p>
                  {activeListing.bairro && (
                    <p className="text-xs text-slate-500">{activeListing.bairro}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Descrição Detalhada</h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {activeListing.description}
                </p>
              </div>

              {/* Technical Features */}
              {activeListing.features && Object.keys(activeListing.features).length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-2">Especificações Técnicas</h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.entries(activeListing.features).map(([k, v]) => (
                      <div key={k} className="flex justify-between rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100">
                        <span className="font-medium text-slate-500">{k}</span>
                        <span className="font-bold text-slate-900">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Intermediation Protection Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 p-4 border border-orange-200">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#E6540F] text-white">
                    <Icon name="ShieldCheck" className="size-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-orange-950 text-xs">
                      Intermediação & Vistoria Segura RESOLVEEXPRESS
                    </h5>
                    <p className="mt-0.5 text-[11px] text-orange-900 leading-relaxed">
                      Não transfira dinheiro diretamente para desconhecidos. A nossa equipa faz a vistoria física presencial do bem no Huambo, audita a documentação e só liberta o valor ao vendedor após entrega confirmada.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t bg-slate-50 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
              <a
                href={waLink(activeListing.sellerPhone, `Olá! Vi o anúncio "${activeListing.title}" (${activeListing.id}) na plataforma RESOLVEEXPRESS.`) || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <Icon name="MessageSquare" className="size-4 text-emerald-600" />
                Contactar Anunciante (WhatsApp)
              </a>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenNegotiation(activeListing)}
                  className="rounded-xl bg-[#E6540F] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#cf490a]"
                >
                  Solicitar Intermediação Segura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: PUBLICAR NOVO ANÚNCIO DE BEM MATERIAL
      ========================================================= */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b p-4 sm:px-6">
              <div>
                <h3 className="font-display text-lg font-black text-slate-900">
                  Publicar Anúncio de Bem Material
                </h3>
                <p className="text-xs text-slate-500">
                  Anuncie casas, viaturas, máquinas industriais ou equipamentos para milhares de compradores.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Título do Anúncio *</label>
                <input
                  type="text"
                  required
                  value={publishForm.title}
                  onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
                  placeholder="Ex: Vivenda T3 no Bairro da Chiva / Carrinha Toyota Hilux 2020 / Forno de Padaria 200 pães"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Categoria *</label>
                  <select
                    value={publishForm.categoryId}
                    onChange={(e) => setPublishForm({ ...publishForm, categoryId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                  >
                    {store.intermediaryCategories?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Condição *</label>
                  <select
                    value={publishForm.condition}
                    onChange={(e) => setPublishForm({ ...publishForm, condition: e.target.value as any })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                  >
                    <option value="USADO">Usado (Segunda Mão)</option>
                    <option value="NOVO">Novo (Zero KM / Sem Uso)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Valor Pretendido (AOA) *</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="50000"
                    value={publishForm.priceAOA}
                    onChange={(e) => setPublishForm({ ...publishForm, priceAOA: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={publishForm.priceNegotiable}
                    onChange={(e) => setPublishForm({ ...publishForm, priceNegotiable: e.target.checked })}
                    className="size-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Preço aberto a propostas e negociação
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Descrição Completa do Bem *</label>
                <textarea
                  rows={3}
                  required
                  value={publishForm.description}
                  onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                  placeholder="Descreva o estado de conservação, histórico, motivo da venda e o que está incluído..."
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                />
              </div>

              {/* Upload de Fotografias */}
              <div>
                <ImageUploader
                  label="Fotografia Principal do Bem (Upload ou Link Web)"
                  helperText="Envie fotos nítidas do bem. A imagem será adaptada automaticamente."
                  value={publishForm.image1}
                  onChange={(url) => setPublishForm({ ...publishForm, image1: url })}
                  aspectRatio="video"
                />
              </div>

              {/* Localização */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Província *</label>
                  <select
                    value={publishForm.province}
                    onChange={(e) => setPublishForm({ ...publishForm, province: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                  >
                    {ANGOLA_PROVINCES.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Município *</label>
                  <input
                    type="text"
                    required
                    value={publishForm.municipio}
                    onChange={(e) => setPublishForm({ ...publishForm, municipio: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                    placeholder="Ex: Huambo, Caála..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Bairro / Zona</label>
                  <input
                    type="text"
                    value={publishForm.bairro}
                    onChange={(e) => setPublishForm({ ...publishForm, bairro: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                    placeholder="Ex: Chiva, São Pedro..."
                  />
                </div>
              </div>

              {/* Contactos do Anunciante */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Nome do Anunciante *</label>
                  <input
                    type="text"
                    required
                    value={publishForm.sellerName}
                    onChange={(e) => setPublishForm({ ...publishForm, sellerName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Telefone *</label>
                  <input
                    type="tel"
                    required
                    value={publishForm.sellerPhone}
                    onChange={(e) => setPublishForm({ ...publishForm, sellerPhone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700">Tipo de Anunciante</label>
                  <select
                    value={publishForm.sellerType}
                    onChange={(e) => setPublishForm({ ...publishForm, sellerType: e.target.value as any })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                  >
                    <option value="PROPRIETARIO">Proprietário Direto</option>
                    <option value="EMPRESA">Empresa</option>
                    <option value="COMERCIANTE">Comerciante</option>
                    <option value="REVENDEDOR">Revendedor / Agente</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={publishSubmitting}
                  className="rounded-xl bg-[#E6540F] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#cf490a]"
                >
                  {publishSubmitting ? "A publicar..." : "Publicar Anúncio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: SOLICITAR INTERMEDIAÇÃO SEGURA & PROPOSTA
      ========================================================= */}
      {showNegotiationModal && activeListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-display text-lg font-black text-slate-900">
                  Solicitar Intermediação Segura
                </h4>
                <p className="text-xs text-slate-500">
                  A Resolve Express garante a segurança da negociação e vistoria técnica.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNegotiationModal(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            <form onSubmit={handleNegotiationSubmit} className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                <span className="text-slate-500">Bem selecionado:</span>
                <p className="font-bold text-slate-900">{activeListing.title}</p>
                <p className="text-slate-600 mt-0.5">Preço anunciado: <strong className="text-slate-900">{kz(activeListing.priceAOA)}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Seu Nome *</label>
                  <input
                    type="text"
                    required
                    value={negotiationForm.buyerName}
                    onChange={(e) => setNegotiationForm({ ...negotiationForm, buyerName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Telefone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={negotiationForm.buyerPhone}
                    onChange={(e) => setNegotiationForm({ ...negotiationForm, buyerPhone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Valor da Sua Proposta de Compra (AOA) *</label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="50000"
                  value={negotiationForm.offeredPriceAOA}
                  onChange={(e) => setNegotiationForm({ ...negotiationForm, offeredPriceAOA: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={negotiationForm.inspectionRequested}
                    onChange={(e) => setNegotiationForm({ ...negotiationForm, inspectionRequested: e.target.checked })}
                    className="size-4 rounded text-orange-600"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Solicitar vistoria técnica presencial no local pela equipa Resolve Express
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={negotiationForm.escrowRequested}
                    onChange={(e) => setNegotiationForm({ ...negotiationForm, escrowRequested: e.target.checked })}
                    className="size-4 rounded text-orange-600"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Custódia e garantia de pagamento seguro (escrow institucional)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNegotiationModal(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={negotiationSubmitting}
                  className="rounded-xl bg-[#E6540F] px-5 py-2 text-xs font-bold text-white shadow-sm"
                >
                  {negotiationSubmitting ? "A enviar..." : "Submeter Proposta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
