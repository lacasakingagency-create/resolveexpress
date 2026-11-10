import React, { useState } from "react";
import { Icon, Btn, Field, inputCls, Section } from "../ui/kit";
import { useStore, kz, waLink } from "../lib/store";
import { ImageUploader } from "../ui/ImageUploader";
import { VirtualCardRequest, ImportQuoteRequest, ANGOLA_PROVINCES } from "../lib/data";

export function Importacao() {
  const [store, update] = useStore();
  const [activeTab, setActiveTab] = useState<"importacao" | "cartoes" | "minhas-cotacoes">("importacao");

  // Modalidade A: Solicitação de Assistência para Cartão Virtual
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardForm, setCardForm] = useState({
    name: store.currentUser?.name || "",
    phone: store.currentUser?.phone || "923 111 222",
    whatsapp: store.currentUser?.phone || "923 111 222",
    email: store.currentUser?.email || "",
    province: store.currentUser?.province || "Huambo",
    municipio: store.currentUser?.municipio || "Huambo",
    purpose: "ASSINATURAS_DIGITAIS" as VirtualCardRequest["purpose"],
    preferredProvider: "PYYPL" as VirtualCardRequest["preferredCardProvider"],
    notes: "",
  });
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [cardSuccess, setCardSuccess] = useState(false);

  // Modalidade B: Solicitação de Cotação de Importação
  const [importForm, setImportForm] = useState({
    name: store.currentUser?.name || "",
    phone: store.currentUser?.phone || "923 111 222",
    whatsapp: store.currentUser?.phone || "923 111 222",
    email: store.currentUser?.email || "",
    productName: "",
    productUrl: "",
    photoUrl: "",
    quantity: 1,
    originCountryOrStore: "China / Alibaba",
    province: store.currentUser?.province || "Huambo",
    municipio: store.currentUser?.municipio || "Huambo",
    address: store.currentUser?.address || "",
    specifications: "",
  });
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importSuccessId, setImportSuccessId] = useState<string | null>(null);

  // Submeter Pedido de Cartão Virtual
  const handleSubmitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.name || !cardForm.phone) {
      alert("Por favor preencha o seu nome e telefone para contacto.");
      return;
    }
    setCardSubmitting(true);
    try {
      const newRequest: VirtualCardRequest = {
        id: `VCR-${new Date().getFullYear()}-${String(store.virtualCardRequests?.length + 1 || 1).padStart(4, "0")}`,
        customerName: cardForm.name,
        phone: cardForm.phone,
        whatsapp: cardForm.whatsapp || cardForm.phone,
        email: cardForm.email,
        province: cardForm.province,
        municipio: cardForm.municipio,
        purpose: cardForm.purpose,
        preferredCardProvider: cardForm.preferredProvider,
        notes: cardForm.notes,
        status: "PENDENTE",
        createdAt: new Date().toISOString(),
      };

      update((s) => ({
        virtualCardRequests: [newRequest, ...(s.virtualCardRequests || [])],
      }));

      setCardSuccess(true);
      setShowCardModal(false);
      alert("Solicitação de assistência recebida com sucesso! A nossa equipa de consultoria entrará em contacto nas próximas 2 horas.");
    } finally {
      setCardSubmitting(false);
    }
  };

  // Submeter Cotação de Importação
  const handleSubmitImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.productName || !importForm.phone) {
      alert("Por favor indique o nome do produto e o seu telefone.");
      return;
    }
    setImportSubmitting(true);
    try {
      const newQuote: ImportQuoteRequest = {
        id: `IMP-${new Date().getFullYear()}-${String(store.importQuotes?.length + 1 || 1).padStart(6, "0")}`,
        customerName: importForm.name,
        phone: importForm.phone,
        whatsapp: importForm.whatsapp || importForm.phone,
        email: importForm.email,
        productName: importForm.productName,
        productUrl: importForm.productUrl,
        photoUrl: importForm.photoUrl,
        quantity: Number(importForm.quantity) || 1,
        originCountryOrStore: importForm.originCountryOrStore,
        deliveryProvince: importForm.province,
        deliveryMunicipio: importForm.municipio,
        deliveryAddress: importForm.address,
        specifications: importForm.specifications,
        status: "COTACAO_PENDENTE",
        createdAt: new Date().toISOString(),
      };

      update((s) => ({
        importQuotes: [newQuote, ...(s.importQuotes || [])],
      }));

      setImportSuccessId(newQuote.id);
      setActiveTab("minhas-cotacoes");
      alert(`Pedido de cotação nº ${newQuote.id} registado com sucesso! A equipa da Resolve Express irá analisar fornecedores e emitir a cotação detalhada.`);
    } finally {
      setImportSubmitting(false);
    }
  };

  // Aprovar Cotação
  const handleApproveQuote = (quoteId: string) => {
    update((s) => ({
      importQuotes: (s.importQuotes || []).map((q) =>
        q.id === quoteId
          ? {
              ...q,
              status: "APROVADA_PELO_CLIENTE",
              approvedAt: new Date().toISOString(),
            }
          : q
      ),
    }));
    alert("Cotação aprovada com sucesso! A nossa equipa entrará em contacto para finalizar os detalhes de pagamento e início do transporte.");
  };

  // Lista de cotações para o utilizador atual (ou todas se for admin/cliente demo)
  const myQuotes = (store.importQuotes || []).filter(
    (q) => !store.currentUser || q.phone === store.currentUser.phone || q.email === store.currentUser.email || store.currentUser.role === "SUPER_ADMIN"
  );

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#071B33] via-[#0E294B] to-[#12365A] py-14 px-4 text-white sm:py-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#E6540F_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-300 ring-1 ring-orange-400/30">
            <Icon name="Plane" className="size-4 text-orange-400" />
            Serviço Oficial de Importação & Pagamentos Internacionais
          </div>

          <h1 className="mt-5 font-display text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            IMPORTAMOS O QUE PRECISAS. <br className="hidden sm:inline" />
            <span className="text-[#E6540F]">TU RECEBES SEM COMPLICAÇÕES.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-300 sm:text-base lg:text-lg leading-relaxed">
            Precisas de um produto que não encontras facilmente em Angola? Nós ajudamos-te a encontrar fornecedores, tratar do processo de importação e acompanhar a chegada do teu produto.
          </p>

          {/* Quick Tab Selectors */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("importacao")}
              className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition shadow-md ${
                activeTab === "importacao"
                  ? "bg-[#E6540F] text-white ring-2 ring-orange-300/40"
                  : "bg-white/10 text-white/90 hover:bg-white/20"
              }`}
            >
              <Icon name="PackageCheck" className="size-4" />
              Importação por Encomenda
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("cartoes")}
              className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition shadow-md ${
                activeTab === "cartoes"
                  ? "bg-[#E6540F] text-white ring-2 ring-orange-300/40"
                  : "bg-white/10 text-white/90 hover:bg-white/20"
              }`}
            >
              <Icon name="CreditCard" className="size-4" />
              Cartões Virtuais Internacionais
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("minhas-cotacoes")}
              className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition shadow-md ${
                activeTab === "minhas-cotacoes"
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-white/90 hover:bg-white/20"
              }`}
            >
              <Icon name="Receipt" className="size-4" />
              Acompanhar Cotações ({myQuotes.length})
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
        {/* =========================================================
            ABA 1: IMPORTAÇÃO POR ENCOMENDA
        ========================================================= */}
        {activeTab === "importacao" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Informações e Passos */}
            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                  Modalidade B
                </span>
                <h2 className="mt-1 font-display text-2xl font-black text-slate-900">
                  Fazemos importação de todo tipo de produto para você
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Compre com total segurança nos maiores centros de comércio mundial sem se preocupar com alfândegas, fretes aéreos ou adiantamentos arriscados.
                </p>

                <div className="mt-6 space-y-4">
                  {[
                    {
                      icon: "Link",
                      title: "1. Envie o Link ou Foto",
                      desc: "Indique o artigo que deseja da Amazon, Alibaba, Shein, eBay ou de qualquer fornecedor no exterior.",
                    },
                    {
                      icon: "Calculator",
                      title: "2. Análise e Cotação Transparente",
                      desc: "Calculamos o preço do produto, transporte internacional, taxas alfandegárias e custo de tratamento até à sua porta.",
                    },
                    {
                      icon: "CheckCircle",
                      title: "3. Confirmação Apenas Após Aprovação",
                      desc: "O cliente só confirma e paga a encomenda depois de analisar a cotação detalhada e os prazos reais.",
                    },
                    {
                      icon: "Truck",
                      title: "4. Entrega Segura em Angola",
                      desc: "Desembaraço alfandegário completo e entrega no Huambo, Luanda ou qualquer província.",
                    },
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3.5 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#E6540F]">
                        <Icon name={step.icon as any} className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{step.title}</h4>
                        <p className="mt-0.5 text-[11px] text-slate-500 leading-normal">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl bg-blue-50/70 p-4 border border-blue-200 text-xs text-blue-900">
                  <div className="flex items-center gap-2 font-bold">
                    <Icon name="ShieldCheck" className="size-4 text-blue-600" />
                    Garantia RESOLVEEXPRESS
                  </div>
                  <p className="mt-1 text-[11px] text-blue-800 leading-relaxed">
                    Não inventamos prazos nem taxas alfandegárias. Todos os custos são auditados e transparentes com contrato de encomenda.
                  </p>
                </div>
              </div>
            </div>

            {/* Formulário de Pedido de Cotação */}
            <div className="lg:col-span-7">
              <form onSubmit={handleSubmitImport} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-display text-xl font-black text-slate-900">
                    Solicitar Cotação de Importação
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preencha os dados do artigo pretendido para receber o orçamento oficial.
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        O Seu Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={importForm.name}
                        onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                        placeholder="Ex: João Baptista"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Telefone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={importForm.phone}
                        onChange={(e) => setImportForm({ ...importForm, phone: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                        placeholder="923 111 222"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Nome do Produto ou Equipamento *
                    </label>
                    <input
                      type="text"
                      required
                      value={importForm.productName}
                      onChange={(e) => setImportForm({ ...importForm, productName: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                      placeholder="Ex: Painel Solar 450W, Peça para Toyota Land Cruiser, Forno Industrial..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Link da Loja Internacional (opcional)
                      </label>
                      <input
                        type="url"
                        value={importForm.productUrl}
                        onChange={(e) => setImportForm({ ...importForm, productUrl: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                        placeholder="https://www.alibaba.com/... ou amazon.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={importForm.quantity}
                        onChange={(e) => setImportForm({ ...importForm, quantity: Number(e.target.value) || 1 })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <ImageUploader
                      label="Fotografia do Produto ou Catálogo (Ficheiro ou Link)"
                      helperText="Envie uma imagem do produto para que os nossos compradores localizem exatamente o modelo correto."
                      value={importForm.photoUrl}
                      onChange={(url) => setImportForm({ ...importForm, photoUrl: url })}
                      aspectRatio="video"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Origem Pretendida
                      </label>
                      <select
                        value={importForm.originCountryOrStore}
                        onChange={(e) => setImportForm({ ...importForm, originCountryOrStore: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                      >
                        <option value="China / Alibaba">China / Alibaba / Taobao</option>
                        <option value="EUA / Amazon">EUA / Amazon / eBay</option>
                        <option value="Portugal / Europa">Portugal / Europa</option>
                        <option value="Dubai / EAU">Dubai / EAU</option>
                        <option value="Turquia">Turquia</option>
                        <option value="Outro País">Outro País / Não sei</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Província de Entrega
                      </label>
                      <select
                        value={importForm.province}
                        onChange={(e) => setImportForm({ ...importForm, province: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                      >
                        {ANGOLA_PROVINCES.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Município
                      </label>
                      <input
                        type="text"
                        value={importForm.municipio}
                        onChange={(e) => setImportForm({ ...importForm, municipio: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                        placeholder="Ex: Huambo, Caála..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Observações e Especificações (Marca, Medidas, Voltagem, Cor)
                    </label>
                    <textarea
                      rows={2}
                      value={importForm.specifications}
                      onChange={(e) => setImportForm({ ...importForm, specifications: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                      placeholder="Detalhes adicionais importantes para garantir o produto certo..."
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={importSubmitting}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#E6540F] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#cf490a] active:scale-[0.99] disabled:opacity-50"
                    >
                      <Icon name="Send" className="size-5" />
                      {importSubmitting ? "A enviar cotação..." : "Solicitar Cotação Gratuita"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 2: TRATAMOS DOS CARTÕES VIRTUAIS PARA VOCÊ
        ========================================================= */}
        {activeTab === "cartoes" && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
              <div className="max-w-3xl">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  Modalidade A • Consultoria & Suporte Financeiro Digital
                </span>
                <h2 className="mt-3 font-display text-2xl font-black text-slate-900 sm:text-3xl">
                  Tratamos dos cartões virtuais para você
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Ajudamos clientes e empreendedores em Angola a obter, verificar e carregar cartões virtuais internacionais emitidos por instituições financeiras legalmente autorizadas, facilitando pagamentos em lojas globais, subscrições digitais e plataformas de fornecedores.
                </p>
              </div>

              {/* Princípios de Segurança e Ética Financeira */}
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Icon name="Building2" className="size-5" />
                  </div>
                  <h4 className="mt-3 font-bold text-slate-900 text-sm">Entidades Autorizadas</h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Trabalhamos exclusivamente com fornecedores legalmente habilitados (ex: Wise, Pyypl, RedotPay). Não emitimos cartões próprios clandestinos.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <Icon name="Lock" className="size-5" />
                  </div>
                  <h4 className="mt-3 font-bold text-slate-900 text-sm">Segurança Máxima de Dados</h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Nunca solicitamos nem armazenamos PINs, CVV ou senhas confidenciais. Todo o controlo de saldos permanece sob titularidade do cliente.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-orange-100 text-[#E6540F]">
                    <Icon name="CheckCircle" className="size-5" />
                  </div>
                  <h4 className="mt-3 font-bold text-slate-900 text-sm">Apoio Presencial & Remoto</h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Acompanhamento passo a passo no Huambo para validação de identidade (KYC), carregamento seguro de saldo e testes de compras online.
                  </p>
                </div>
              </div>

              {/* Call to action & Trigger Modal */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#071B33] to-[#12365A] p-6 text-white">
                <div>
                  <h3 className="font-display text-lg font-black text-white">
                    Precisa de apoio para ativar o seu cartão virtual hoje?
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Os nossos especialistas acompanham todo o processo com segurança e clareza de taxas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCardModal(true)}
                  className="rounded-xl bg-[#E6540F] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#cf490a] active:scale-95"
                >
                  SOLICITAR ASSISTÊNCIA
                </button>
              </div>
            </div>

            {/* Modal de Assistência para Cartão */}
            {showCardModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
                <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="font-display text-lg font-black text-slate-900">
                        Solicitar Assistência de Cartão Virtual
                      </h4>
                      <p className="text-xs text-slate-500">
                        Um consultor entrará em contacto para o apoiar na configuração oficial.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCardModal(false)}
                      className="rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                      <Icon name="X" className="size-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitCard} className="mt-4 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={cardForm.name}
                        onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                        placeholder="Seu nome"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Telefone / Chamadas *</label>
                        <input
                          type="tel"
                          required
                          value={cardForm.phone}
                          onChange={(e) => setCardForm({ ...cardForm, phone: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                          placeholder="923 111 222"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">WhatsApp *</label>
                        <input
                          type="tel"
                          required
                          value={cardForm.whatsapp}
                          onChange={(e) => setCardForm({ ...cardForm, whatsapp: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                          placeholder="923 111 222"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">Finalidade Principal</label>
                      <select
                        value={cardForm.purpose}
                        onChange={(e) => setCardForm({ ...cardForm, purpose: e.target.value as any })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                      >
                        <option value="ASSINATURAS_DIGITAIS">Assinaturas Digitais (Netflix, Spotify, Canva, Cursos)</option>
                        <option value="COMERCIO_IMPORTACAO">Compras para Revenda (Shein, AliExpress, Alibaba)</option>
                        <option value="COMPRAS_PESSOAIS">Compras Pessoais e Roupas</option>
                        <option value="VIAGENS">Reservas de Viagem e Hotéis</option>
                        <option value="OUTRO">Outra Necessidade</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">Plataforma Preferida (ou Recomendada)</label>
                      <select
                        value={cardForm.preferredProvider}
                        onChange={(e) => setCardForm({ ...cardForm, preferredProvider: e.target.value as any })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white"
                      >
                        <option value="QUALQUER_RECOMENDADO">Recomendada pelos especialistas da Resolve Express</option>
                        <option value="PYYPL">Pyypl (Fácil recarga e verificação com BI de Angola)</option>
                        <option value="WISE">Wise (Contas multimoeda EUR/USD)</option>
                        <option value="REDOTPAY">RedotPay (Aceita pagamentos internacionais em USD)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">Notas / Dúvidas Específicas</label>
                      <textarea
                        rows={2}
                        value={cardForm.notes}
                        onChange={(e) => setCardForm({ ...cardForm, notes: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900"
                        placeholder="Ex: Não tenho passaporte, tenho apenas Bilhete de Identidade..."
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t">
                      <button
                        type="button"
                        onClick={() => setShowCardModal(false)}
                        className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={cardSubmitting}
                        className="rounded-xl bg-[#E6540F] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#cf490a]"
                      >
                        {cardSubmitting ? "A enviar..." : "Submeter Solicitação"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            ABA 3: ACOMPANHAR MINHAS COTAÇÕES
        ========================================================= */}
        {activeTab === "minhas-cotacoes" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-display text-xl font-black text-slate-900">
                    Cotações de Importação Registadas ({myQuotes.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Acompanhe a decomposição de custos e aprove cotações enviadas pela equipa da Resolve Express.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("importacao")}
                  className="rounded-xl bg-[#E6540F] px-4 py-2 text-xs font-bold text-white shadow-xs"
                >
                  Nova Cotação
                </button>
              </div>

              {myQuotes.length === 0 ? (
                <div className="py-16 text-center">
                  <Icon name="PackageSearch" className="mx-auto size-12 text-slate-300" />
                  <p className="mt-3 font-bold text-slate-800">Ainda não tem cotações de importação</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Envie o link ou foto de qualquer produto que queira importar para receber uma cotação transparente.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("importacao")}
                    className="mt-4 rounded-xl bg-[#071B33] px-5 py-2.5 text-xs font-bold text-white"
                  >
                    Solicitar Minha Primeira Cotação
                  </button>
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {myQuotes.map((q) => {
                    const isQuoted = q.status !== "COTACAO_PENDENTE";
                    return (
                      <div
                        key={q.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 p-5 transition hover:border-slate-300"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                          <div className="flex items-start gap-3">
                            {q.photoUrl && typeof q.photoUrl === "string" && q.photoUrl.trim() ? (
                              <img
                                src={q.photoUrl.trim()}
                                alt={q.productName}
                                className="size-16 rounded-xl object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="flex size-16 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                                <Icon name="Package" className="size-8" />
                              </div>
                            )}
                            <div>
                              <span className="font-mono text-xs font-bold text-slate-400">{q.id}</span>
                              <h4 className="font-display text-base font-bold text-slate-900">{q.productName}</h4>
                              <p className="text-xs text-slate-600">
                                Origem: <span className="font-semibold text-slate-800">{q.originCountryOrStore}</span> • Qtd: <span className="font-semibold">{q.quantity}</span>
                              </p>
                              {q.deliveryMunicipio && (
                                <p className="text-[11px] text-slate-500">
                                  Entrega: {q.deliveryMunicipio}, {q.deliveryProvince}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                q.status === "APROVADA_PELO_CLIENTE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : q.status === "COTACAO_ENVIADA"
                                  ? "bg-blue-100 text-blue-800"
                                  : q.status === "COTACAO_PENDENTE"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {q.status.replace(/_/g, " ")}
                            </span>
                            <p className="mt-1 text-[11px] text-slate-400">
                              Submetido a {q.createdAt.slice(0, 10)}
                            </p>
                          </div>
                        </div>

                        {/* Breakdown de Custos da Cotação */}
                        {isQuoted ? (
                          <div className="mt-4 rounded-xl bg-white p-4 border border-slate-200">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Decomposição Oficial de Custos de Importação
                              </span>
                              {q.estimatedDays && (
                                <span className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">
                                  Prazo Estimado: {q.estimatedDays}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                              <div>
                                <span className="text-slate-500">Preço do Produto:</span>
                                <p className="font-bold text-slate-900">{kz(q.productPriceAOA || 0)}</p>
                                {q.productPriceOriginal && (
                                  <span className="text-[10px] text-slate-400">({q.productPriceOriginal})</span>
                                )}
                              </div>
                              <div>
                                <span className="text-slate-500">Frete Internacional:</span>
                                <p className="font-bold text-slate-900">{kz(q.internationalFreightAOA || 0)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Taxas & Impostos Alfândega:</span>
                                <p className="font-bold text-slate-900">{kz(q.customsAndTaxesAOA || 0)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Taxa de Tratamento:</span>
                                <p className="font-bold text-slate-900">{kz(q.handlingFeeAOA || 0)}</p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                              <div>
                                <span className="text-xs text-slate-500 font-medium">Valor Total Fechado ao Cliente:</span>
                                <p className="font-display text-xl font-black text-[#E6540F]">
                                  {kz(q.totalQuotedAOA || 0)}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                {q.status === "COTACAO_ENVIADA" && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveQuote(q.id)}
                                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                                  >
                                    Aprovar Cotação e Avançar
                                  </button>
                                )}
                                <a
                                  href={waLink("923111222", `Olá! Gostaria de falar sobre a minha cotação de importação ${q.id} (${q.productName}).`) || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  <Icon name="MessageSquare" className="size-3.5 text-emerald-600" />
                                  Tirar Dúvidas WhatsApp
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center justify-between text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
                            <span className="flex items-center gap-2">
                              <Icon name="Clock" className="size-4" />
                              A nossa equipa está a consultar fornecedores internacionais para calcular o frete e taxas aduaneiras deste produto.
                            </span>
                            <span className="font-bold">Tempo estimado: 2 a 6 horas</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
