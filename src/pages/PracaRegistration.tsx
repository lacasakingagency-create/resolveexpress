import React, { useState } from "react";
import { Icon, go } from "../ui/kit";
import { useStore } from "../lib/store";
import { ImageUploader } from "../ui/ImageUploader";
import { SellerRecord, AffiliateRecord } from "../lib/data";

interface PracaRegistrationProps {
  mode?: "seller" | "affiliate";
}

export function PracaRegistration({ mode = "seller" }: PracaRegistrationProps) {
  const [store, update] = useStore();
  const [activeTab, setActiveTab] = useState<"seller" | "affiliate">(mode);
  const [submitted, setSubmitted] = useState<"seller" | "affiliate" | null>(null);

  // Seller Form State
  const [sellerForm, setSellerForm] = useState({
    storeName: "",
    legalName: store.currentUser?.name || "",
    email: store.currentUser?.email || "",
    phone: store.currentUser?.phone || "923 000 000",
    whatsapp: store.currentUser?.phone || "923 000 000",
    sellerType: "INDIVIDUAL" as "INDIVIDUAL" | "COMERCIANTE" | "EMPRESA",
    province: store.currentUser?.province || "Huambo",
    municipio: store.currentUser?.municipio || "Huambo",
    address: store.currentUser?.address || "",
    nifOrBi: "",
    description: "",
    logoUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&auto=format&fit=crop&q=80",
    termsAccepted: true,
  });

  // Affiliate Form State
  const [affiliateForm, setAffiliateForm] = useState({
    name: store.currentUser?.name || "",
    email: store.currentUser?.email || "",
    phone: store.currentUser?.phone || "923 000 000",
    whatsapp: store.currentUser?.phone || "923 000 000",
    province: store.currentUser?.province || "Huambo",
    municipio: store.currentUser?.municipio || "Huambo",
    desiredCode: (store.currentUser?.name?.split(" ")[0] || "PROMO").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
    channel: "WhatsApp e Redes Sociais",
    bankName: "BAI",
    iban: "AO06 0040 0000 1234 5678 9012 3",
    accountHolder: store.currentUser?.name || "",
    termsAccepted: true,
  });

  const handleSellerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerForm.storeName || !sellerForm.legalName || !sellerForm.phone) {
      alert("Por favor preencha os campos obrigatórios da sua loja.");
      return;
    }

    const sellerId = `sel-${Date.now()}`;
    const newSeller: SellerRecord = {
      id: sellerId,
      userId: store.currentUser?.id || `usr-sel-${Date.now()}`,
      storeName: sellerForm.storeName,
      ownerName: sellerForm.legalName,
      sellerType: sellerForm.sellerType === "COMERCIANTE" ? "MERCHANT" : sellerForm.sellerType === "EMPRESA" ? "COMPANY" : "INDIVIDUAL",
      email: sellerForm.email,
      phone: sellerForm.phone,
      whatsapp: sellerForm.whatsapp,
      province: sellerForm.province,
      municipio: sellerForm.municipio,
      address: sellerForm.address || `${sellerForm.municipio}, ${sellerForm.province}`,
      nifOrBi: sellerForm.nifOrBi || "000000000LA000",
      description: sellerForm.description || "Loja oficial na PRAÇA RESOLVEEXPRESS.",
      logo: sellerForm.logoUrl,
      status: store.pracaSettings?.autoApproveSellers ? "APROVADO" : "EM_ANALISE",
      rating: 5.0,
      totalSalesCount: 0,
      totalGrossAOA: 0,
      totalPlatformCommissionAOA: 0,
      totalAffiliateCommissionAOA: 0,
      netBalanceAOA: 0,
      pendingBalanceAOA: 0,
      createdAt: new Date().toISOString(),
    };

    update((s) => ({
      sellers: [newSeller, ...s.sellers.filter((x) => x.id !== sellerId)],
      currentUser: s.currentUser
        ? {
            ...s.currentUser,
            isSeller: true,
            sellerId: sellerId,
            role: s.currentUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "SELLER",
          }
        : {
            id: newSeller.userId,
            name: sellerForm.legalName,
            email: sellerForm.email,
            phone: sellerForm.phone,
            role: "SELLER",
            isSeller: true,
            sellerId: sellerId,
            province: sellerForm.province,
            municipio: sellerForm.municipio,
            active: true,
          },
    }));

    setSubmitted("seller");
  };

  const handleAffiliateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliateForm.name || !affiliateForm.phone) {
      alert("Por favor preencha os campos obrigatórios.");
      return;
    }

    const code = (affiliateForm.desiredCode || `AF${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
    const affiliateId = `aff-${Date.now()}`;

    const newAffiliate: AffiliateRecord = {
      id: affiliateId,
      userId: store.currentUser?.id || `usr-aff-${Date.now()}`,
      name: affiliateForm.name,
      code: code,
      email: affiliateForm.email,
      phone: affiliateForm.phone,
      whatsapp: affiliateForm.whatsapp,
      status: "ATIVO",
      defaultCommissionRate: store.pracaSettings?.defaultAffiliateCommission || 5,
      totalClicks: 0,
      uniqueClicks: 0,
      totalOrdersReferred: 0,
      totalSalesVolumeAOA: 0,
      pendingCommissionAOA: 0,
      availableCommissionAOA: 0,
      paidCommissionAOA: 0,
      bankAccount: {
        bankName: affiliateForm.bankName,
        iban: affiliateForm.iban,
        holder: affiliateForm.accountHolder || affiliateForm.name,
      },
      createdAt: new Date().toISOString(),
    };

    update((s) => ({
      affiliates: [newAffiliate, ...s.affiliates.filter((a) => a.id !== affiliateId)],
      currentUser: s.currentUser
        ? {
            ...s.currentUser,
            isAffiliate: true,
            affiliateCode: code,
            role: s.currentUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "AFFILIATE",
          }
        : {
            id: newAffiliate.userId,
            name: affiliateForm.name,
            email: affiliateForm.email,
            phone: affiliateForm.phone,
            role: "AFFILIATE",
            isAffiliate: true,
            affiliateCode: code,
            province: affiliateForm.province,
            municipio: affiliateForm.municipio,
            active: true,
          },
    }));

    setSubmitted("affiliate");
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-6">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => go("/praca")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <Icon name="ArrowLeft" className="size-4" />
            Voltar à Praça
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              <Icon name="Store" className="size-3.5" />
              RESOLVEEXPRESS • A PRAÇA
            </span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#071B33] via-[#0E294B] to-[#12365A] p-6 text-white shadow-xl sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block rounded-full bg-orange-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-300 ring-1 ring-orange-500/30">
              Expansão & Crescimento
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Faça Parte da Maior Praça Digital de Angola
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Venda os seus produtos para milhares de clientes ou ganhe comissões automáticas divulgando produtos e serviços com links personalizados.
            </p>

            {/* Mode Selector Tabs */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("seller");
                  setSubmitted(null);
                }}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${
                  activeTab === "seller"
                    ? "bg-[#E6540F] text-white shadow-lg ring-2 ring-orange-300/40"
                    : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                }`}
              >
                <Icon name="Store" className="size-4" />
                Quero Vender na Praça
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("affiliate");
                  setSubmitted(null);
                }}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${
                  activeTab === "affiliate"
                    ? "bg-[#E6540F] text-white shadow-lg ring-2 ring-orange-300/40"
                    : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                }`}
              >
                <Icon name="Users" className="size-4" />
                Quero Ser Afiliado
              </button>
            </div>
          </div>
        </div>

        {/* Success States */}
        {submitted === "seller" && (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-lg sm:p-12">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Icon name="CheckCircle" className="size-8" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-900">
              Registo de Vendedor Concluído com Sucesso!
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
              A sua loja <span className="font-bold text-slate-900">{sellerForm.storeName}</span> já foi registada na plataforma.
              Pode agora aceder ao Painel do Vendedor para cadastrar produtos, definir preços, gerir encomendas e acompanhar os seus rendimentos.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => go("/praca/painel-vendedor")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E6540F] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#cf490a]"
              >
                <Icon name="LayoutDashboard" className="size-4" />
                Aceder ao Painel do Vendedor
              </button>
              <button
                type="button"
                onClick={() => go("/praca")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Ver Catálogo da Praça
              </button>
            </div>
          </div>
        )}

        {submitted === "affiliate" && (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-lg sm:p-12">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Icon name="CheckCircle" className="size-8" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-900">
              Bem-vindo ao Programa de Afiliados RESOLVEEXPRESS!
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
              O seu código oficial de afiliado é <span className="rounded bg-orange-100 px-2.5 py-1 font-mono font-bold text-orange-800">{affiliateForm.desiredCode.toUpperCase()}</span>.
              Pode agora gerar links para qualquer produto da Praça ou serviço da Resolve Express e receber até 15% de comissão por cada venda confirmada.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => go("/praca/painel-afiliado")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#071B33] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#0e294b]"
              >
                <Icon name="LayoutDashboard" className="size-4" />
                Aceder ao Painel do Afiliado
              </button>
              <button
                type="button"
                onClick={() => go("/praca")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Explorar Produtos para Divulgar
              </button>
            </div>
          </div>
        )}

        {/* Form: Vendedor */}
        {!submitted && activeTab === "seller" && (
          <form onSubmit={handleSellerSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                Candidatura de Vendedor na Praça
              </h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Cadastre a sua loja, comércio ou atividade para começar a vender para milhares de angolanos.
              </p>
            </div>

            <div className="mt-6 space-y-6">
              {/* Tipo de Vendedor */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tipo de Vendedor *
                </label>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { id: "INDIVIDUAL", title: "Pessoa Individual", desc: "Artesãos, produtores e autônomos" },
                    { id: "COMERCIANTE", title: "Comerciante / Loja", desc: "Negócio local com loja física ou online" },
                    { id: "EMPRESA", title: "Empresa / Coletiva", desc: "Sociedades unipessoais ou Ltdas" },
                  ].map((t) => (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer flex-col rounded-2xl border p-4 transition ${
                        sellerForm.sellerType === t.id
                          ? "border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="sellerType"
                        value={t.id}
                        checked={sellerForm.sellerType === t.id}
                        onChange={() => setSellerForm({ ...sellerForm, sellerType: t.id as any })}
                        className="sr-only"
                      />
                      <span className="font-bold text-slate-900">{t.title}</span>
                      <span className="mt-1 text-xs text-slate-500">{t.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Informações da Loja */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nome da Loja / Marca *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Luanda Tech Hub, Boutique Huambo..."
                    value={sellerForm.storeName}
                    onChange={(e) => setSellerForm({ ...sellerForm, storeName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nome Completo do Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={sellerForm.legalName}
                    onChange={(e) => setSellerForm({ ...sellerForm, legalName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* Contatos */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Telefone de Chamadas *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="923 111 222"
                    value={sellerForm.phone}
                    onChange={(e) => setSellerForm({ ...sellerForm, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    WhatsApp para Pedidos *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="923 111 222"
                    value={sellerForm.whatsapp}
                    onChange={(e) => setSellerForm({ ...sellerForm, whatsapp: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    E-mail Comercial
                  </label>
                  <input
                    type="email"
                    value={sellerForm.email}
                    onChange={(e) => setSellerForm({ ...sellerForm, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Localização */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Província *
                  </label>
                  <select
                    value={sellerForm.province}
                    onChange={(e) => setSellerForm({ ...sellerForm, province: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="Huambo">Huambo</option>
                    <option value="Luanda">Luanda</option>
                    <option value="Benguela">Benguela</option>
                    <option value="Huíla">Huíla</option>
                    <option value="Bié">Bié</option>
                    <option value="Cabinda">Cabinda</option>
                    <option value="Outra">Outra Província</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Município *
                  </label>
                  <input
                    type="text"
                    required
                    value={sellerForm.municipio}
                    onChange={(e) => setSellerForm({ ...sellerForm, municipio: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    BI / NIF / Documento
                  </label>
                  <input
                    type="text"
                    placeholder="NIF ou Nº de Bilhete"
                    value={sellerForm.nifOrBi}
                    onChange={(e) => setSellerForm({ ...sellerForm, nifOrBi: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Endereço detalhado */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Endereço Físico / Ponto de Referência
                </label>
                <input
                  type="text"
                  placeholder="Rua, Bairro ou ponto de referência para recolha de encomendas"
                  value={sellerForm.address}
                  onChange={(e) => setSellerForm({ ...sellerForm, address: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Logotipo / Imagem da Loja */}
              <div>
                <ImageUploader
                  label="Logótipo ou Fotografia da Loja"
                  helperText="Faça upload da imagem oficial ou cole o link direto. A imagem será adaptada automaticamente."
                  value={sellerForm.logoUrl}
                  onChange={(url) => setSellerForm({ ...sellerForm, logoUrl: url })}
                  aspectRatio="square"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Apresentação da Loja & Produtos que Vende
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva brevemente que tipo de artigos comercializa, garantia e prazos de entrega..."
                  value={sellerForm.description}
                  onChange={(e) => setSellerForm({ ...sellerForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Divisão Financeira e Termos */}
              <div className="rounded-2xl bg-orange-50/60 p-4 border border-orange-200">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-900">
                  <Icon name="Info" className="size-4 text-orange-600" />
                  Transparência de Comissões da Praça
                </h4>
                <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                  A inscrição na Praça é gratuita. A RESOLVEEXPRESS cobra apenas uma comissão operacional padrão sobre vendas concretizadas (geralmente 10%), e afiliados recebem comissão (padrão 5%) quando impulsionam as suas vendas. O seu saldo líquido é depositado diretamente na sua conta bancária após confirmação de entrega ao cliente.
                </p>
                <label className="mt-3 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={sellerForm.termsAccepted}
                    onChange={(e) => setSellerForm({ ...sellerForm, termsAccepted: e.target.checked })}
                    className="size-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Concordo com os Termos de Vendedor da RESOLVEEXPRESS e Política de Qualidade
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#E6540F] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#cf490a] active:scale-[0.99]"
                >
                  <Icon name="CheckCircle" className="size-5" />
                  Submeter Candidatura de Vendedor
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Form: Afiliado */}
        {!submitted && activeTab === "affiliate" && (
          <form onSubmit={handleAffiliateSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                Registo no Programa de Afiliados
              </h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Divulgue produtos da Praça ou serviços da RESOLVEEXPRESS através de links exclusivos e receba até 15% de comissão por cada venda paga.
              </p>
            </div>

            <div className="mt-6 space-y-6">
              {/* Informações Pessoais */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={affiliateForm.name}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Código de Afiliado Desejado *
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      required
                      placeholder="Ex: SILVA, TECH, PROMOHUAMBO"
                      value={affiliateForm.desiredCode}
                      onChange={(e) => setAffiliateForm({ ...affiliateForm, desiredCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm uppercase text-slate-900 focus:border-orange-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                      ?ref={affiliateForm.desiredCode || "SEUCODIGO"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Este código fará parte de todos os seus links e botões de partilha no WhatsApp.
                  </span>
                </div>
              </div>

              {/* Contatos */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={affiliateForm.phone}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={affiliateForm.whatsapp}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, whatsapp: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={affiliateForm.email}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Onde planeia divulgar */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Canais Principais de Divulgação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Grupos de WhatsApp de Angola, Instagram, TikTok, amigos e familiares..."
                  value={affiliateForm.channel}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, channel: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Dados Bancários */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                  <Icon name="Landmark" className="size-4 text-slate-600" />
                  Conta Bancária para Recebimento de Comissões
                </h4>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600">
                      Banco
                    </label>
                    <select
                      value={affiliateForm.bankName}
                      onChange={(e) => setAffiliateForm({ ...affiliateForm, bankName: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                    >
                      <option value="BAI">BAI</option>
                      <option value="BFA">BFA</option>
                      <option value="BIC">Banco BIC</option>
                      <option value="SOL">Banco Sol</option>
                      <option value="BPC">BPC</option>
                      <option value="MILLENNIUM">Millennium Atlântico</option>
                      <option value="OUTRO">Outro Banco</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-slate-600">
                      IBAN Angolano (21 Dígitos)
                    </label>
                    <input
                      type="text"
                      placeholder="AO06 0000 0000 0000 0000 0000 0"
                      value={affiliateForm.iban}
                      onChange={(e) => setAffiliateForm({ ...affiliateForm, iban: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Termos */}
              <div className="rounded-2xl bg-blue-50/60 p-4 border border-blue-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={affiliateForm.termsAccepted}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, termsAccepted: e.target.checked })}
                    className="size-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Aceito os Termos do Programa de Afiliados da RESOLVEEXPRESS e confirmo a veracidade dos dados bancários.
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#071B33] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#0e294b] active:scale-[0.99]"
                >
                  <Icon name="Sparkles" className="size-5 text-orange-400" />
                  Ativar Minha Conta de Afiliado
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
