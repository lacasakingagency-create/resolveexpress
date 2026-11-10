import { useState } from "react";
import { Icon, go, Btn, Field, inputCls, Empty } from "../ui/kit";
import { useStore, formatCurrency, kz } from "../lib/store";
import { PRODUCT_CATEGORIES, type Product } from "../lib/data";
import { ImageUploader } from "../ui/ImageUploader";

export function PartnerCompanyPortal({ initialTab }: { initialTab?: any }) {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState<
    | "painel"
    | "perfil"
    | "produtos"
    | "cadastrar-produto"
    | "servicos"
    | "encomendas"
    | "pedidos"
    | "financeiro"
    | "levantamentos"
    | "avaliacoes"
    | "equipa"
    | "apoio"
  >(initialTab || "painel");

  // RBAC Access Control
  const isAuthorizedCompany =
    store.currentUser &&
    (store.currentUser.role === "PARTNER" ||
      store.currentUser.role === "BUSINESS_PARTNER" ||
      store.currentUser.role === "ADMIN" ||
      store.currentUser.role === "SUPER_ADMIN") &&
    store.currentUser.active;

  if (!isAuthorizedCompany) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-xl">
          <Icon name="Building2" className="size-8" />
        </div>
        <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold uppercase tracking-wider mb-2">
          Empresas Parceiras B2B
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-black text-primary">
          Portal da Empresa Parceira
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Área de gestão comercial para lojistas e fornecedores parceiros em Huambo. Inicie sessão com as credenciais da sua empresa ou submeta o seu registo para aprovação.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Btn kind="ink" onClick={() => (window.location.hash = "/entrar/empresa")}>
            <Icon name="KeyRound" className="size-4" /> Iniciar Sessão de Empresa
          </Btn>
          <Btn kind="ghost" onClick={() => (window.location.hash = "/cadastro/empresa")}>
            Registar Nova Empresa Parceira
          </Btn>
        </div>
      </div>
    );
  }

  // Partner company for demo
  const partner =
    store.registeredPartners.find((p) => p.commercialName === store.currentUser?.companyName) ||
    store.registeredPartners[0] || {
      id: "partner-comp-1",
    commercialName: "Distribuidora Águas do Huambo",
    socialReason: "Águas Puras do Planalto Central, Lda.",
    nif: "5401928392",
    manager: "Eng. Paulo Vissapa",
    phone: "923444888",
    email: "comercial@aguashuambo.ao",
    address: "Zona Industrial do Huambo, Lote 4B",
    activityCategory: "Água e Gás",
    description: "Distribuição autorizada de água mineral e garrafões.",
    status: "Aprovado" as const,
  };

  // Partner's products
  const companyProducts = store.products.filter(
    (p) => p.sellerName === partner.commercialName || p.sellerId === partner.id
  );

  // Partner's product orders
  const companyOrders = store.productOrders.filter((o) =>
    o.sellerNames.includes(partner.commercialName)
  );

  // New product form
  const [newProdName, setNewProdName] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdPrice, setNewProdPrice] = useState(2500);
  const [newProdPromo, setNewProdPromo] = useState<number | undefined>(undefined);
  const [newProdStock, setNewProdStock] = useState(50);
  const [newProdCat, setNewProdCat] = useState("Água e gás");
  const [newProdImg, setNewProdImg] = useState(
    "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80"
  );
  const [newProdImgFit, setNewProdImgFit] = useState<"cover" | "contain">("cover");
  const [newProdSuccess, setNewProdSuccess] = useState(false);

  // New service form
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcDesc, setNewSvcDesc] = useState("");
  const [newSvcPrice, setNewSvcPrice] = useState(15000);

  // Payout request
  const [payoutAmount, setPayoutAmount] = useState(30000);
  const [payoutIban, setPayoutIban] = useState("AO06 0040 0000 5555 4444 3333 1");
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || newProdPrice <= 0) return;

    const newProduct: Product = {
      id: `PROD-${Date.now()}`,
      name: newProdName.trim(),
      description: newProdDesc.trim() || "Produto fornecido por parceiro oficial no Huambo.",
      priceAOA: Number(newProdPrice),
      promotionalPriceAOA: newProdPromo ? Number(newProdPromo) : undefined,
      available: true,
      stock: Number(newProdStock),
      sellerName: partner.commercialName,
      sellerId: partner.id,
      sellerType: "PARTNER",
      category: newProdCat,
      image: newProdImg,
      imageFit: newProdImgFit,
      deliveryLocation: "Huambo e Arredores",
      estimatedDelivery: "30 a 60 minutos",
      unit: "unidade",
    };

    setStore((st) => ({
      products: [newProduct, ...st.products],
    }));

    setNewProdSuccess(true);
    setNewProdName("");
    setNewProdDesc("");
    setTimeout(() => {
      setNewProdSuccess(false);
      setActiveTab("produtos");
    }, 1500);
  };

  const handleUpdateStock = (productId: string, newStock: number) => {
    setStore((st) => ({
      products: st.products.map((p) =>
        p.id === productId ? { ...p, stock: Math.max(0, newStock) } : p
      ),
    }));
  };

  const handleUpdateOrderStatus = (
    orderId: string,
    newStatus: "Em preparação" | "A caminho" | "Entregue" | "Cancelada"
  ) => {
    setStore((st) => ({
      productOrders: st.productOrders.map((o) =>
        o.id === orderId ? { ...o, orderStatus: newStatus } : o
      ),
    }));
  };

  const handleRequestPayout = () => {
    if (payoutAmount <= 0) return;
    setStore((st) => ({
      partnerWallet: {
        ...st.partnerWallet,
        balanceAOA: Math.max(0, st.partnerWallet.balanceAOA - payoutAmount),
        pendingPayoutAOA: st.partnerWallet.pendingPayoutAOA + payoutAmount,
        payoutHistory: [
          {
            date: new Date().toISOString().slice(0, 10),
            amountAOA: payoutAmount,
            status: "Em processamento",
            iban: payoutIban,
          },
          ...st.partnerWallet.payoutHistory,
        ],
      },
    }));
    setPayoutSuccess(true);
    setTimeout(() => setPayoutSuccess(false), 3000);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 @3xl:px-8">
      {/* Company Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-ok text-xl font-black text-white">
            {partner.commercialName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-black text-primary">
                Portal da Empresa Parceira
              </h1>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  partner.status === "Aprovado"
                    ? "bg-ok/10 text-ok"
                    : "bg-warn/20 text-warn"
                }`}
              >
                {partner.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {partner.commercialName} · NIF: {partner.nif} · Huambo, Angola
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Btn kind="action" className="min-h-10 text-xs" onClick={() => setActiveTab("cadastrar-produto")}>
            <Icon name="Plus" className="size-4" /> Cadastrar Produto
          </Btn>
          <Btn kind="ink" className="min-h-10 text-xs" onClick={() => setActiveTab("financeiro")}>
            Ver Finanças
          </Btn>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-2 border-b border-border">
        {[
          { id: "painel", label: "Painel Empresarial", icon: "LayoutDashboard" },
          { id: "produtos", label: `Os Meus Produtos (${companyProducts.length})`, icon: "Package" },
          { id: "cadastrar-produto", label: "Cadastrar Produto", icon: "PlusCircle" },
          { id: "encomendas", label: `Encomendas Recebidas (${companyOrders.length})`, icon: "Receipt" },
          { id: "financeiro", label: "Financeiro & Comissões", icon: "Banknote" },
          { id: "levantamentos", label: "Levantamentos", icon: "ArrowUpRight" },
          { id: "perfil", label: "Perfil da Empresa", icon: "Building2" },
          { id: "avaliacoes", label: "Avaliações", icon: "Star" },
          { id: "apoio", label: "Apoio ao Parceiro", icon: "Headset" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition whitespace-nowrap shrink-0 ${
              activeTab === t.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-mist text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name={t.icon} className="size-3.5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-w-0">
        {activeTab === "painel" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
              <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Produtos no Catálogo
                </span>
                <p className="mt-2 font-display text-3xl font-black text-primary">
                  {companyProducts.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Disponíveis para venda</p>
              </div>

              <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Encomendas Recebidas
                </span>
                <p className="mt-2 font-display text-3xl font-black text-action">
                  {companyOrders.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Vendas realizadas</p>
              </div>

              <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Saldo Disponível
                </span>
                <p className="mt-2 font-display text-2xl font-black text-ok">
                  {formatCurrency(store.partnerWallet.balanceAOA, store.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Após comissão de 15%</p>
              </div>

              <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Classificação Média
                </span>
                <p className="mt-2 font-display text-2xl font-black text-amber-500">
                  4.9 ★
                </p>
                <p className="text-xs text-muted-foreground mt-1">Excelente reputação</p>
              </div>
            </div>

            {/* Recent Orders for this partner */}
            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <h3 className="font-display font-bold text-lg text-primary mb-3">
                Últimas Encomendas de Produtos
              </h3>
              {companyOrders.length > 0 ? (
                companyOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-3 text-sm last:border-b-0"
                  >
                    <div>
                      <span className="font-mono font-bold text-primary">{ord.id}</span>
                      <p className="font-bold">{ord.customerName} (+244 {ord.customerPhone})</p>
                      <p className="text-xs text-muted-foreground">📍 {ord.deliveryAddress}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-primary block">{kz(ord.totalAOA)}</span>
                      <span className="text-xs font-semibold text-action">{ord.orderStatus}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma encomenda registada ainda.</p>
              )}
            </div>
          </div>
        )}

        {/* Os Meus Produtos */}
        {activeTab === "produtos" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-primary">
                Gestão de Produtos & Stock
              </h2>
              <Btn kind="action" className="min-h-9 text-xs" onClick={() => setActiveTab("cadastrar-produto")}>
                Novo Produto
              </Btn>
            </div>

            <div className="grid gap-4 @3xl:grid-cols-2">
              {companyProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="flex gap-4 rounded-[var(--radius)] border border-border bg-paper p-4"
                >
                  <img src={prod.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"} alt={prod.name} className="size-20 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground block">{prod.category}</span>
                    <h4 className="font-bold text-primary truncate">{prod.name}</h4>
                    <p className="font-black text-lg text-primary mt-1">{kz(prod.priceAOA)}</p>
                    
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Stock:</span>
                        <input
                          type="number"
                          value={prod.stock}
                          onChange={(e) => handleUpdateStock(prod.id, Number(e.target.value))}
                          className="w-16 rounded border border-border px-2 py-0.5 font-bold text-center"
                        />
                      </div>
                      <span className={prod.stock > 0 ? "text-ok font-bold" : "text-destructive font-bold"}>
                        {prod.stock > 0 ? "Em Stock" : "Esgotado"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cadastrar Produto */}
        {activeTab === "cadastrar-produto" && (
          <div className="max-w-2xl rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-6 shadow-xs">
            <h2 className="font-display text-2xl font-black text-primary mb-1">
              Cadastrar Produto no Marketplace
            </h2>
            <p className="text-xs text-muted-foreground mb-6">
              O seu produto ficará visível imediatamente para todos os clientes em Huambo.
            </p>

            {newProdSuccess && (
              <div className="mb-4 rounded bg-ok/10 p-3 text-ok font-bold text-sm flex items-center gap-2">
                <Icon name="CheckCircle" className="size-5" /> Produto adicionado com sucesso!
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <Field label="Nome do Produto *">
                <input
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Ex: Garrafão de Água 20L / Frango no Churrasco"
                  className={inputCls}
                />
              </Field>

              <div className="grid gap-4 @3xl:grid-cols-2">
                <Field label="Categoria do Marketplace">
                  <select
                    value={newProdCat}
                    onChange={(e) => setNewProdCat(e.target.value)}
                    className={inputCls}
                  >
                    {PRODUCT_CATEGORIES.filter((c) => c !== "Todos").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Quantidade em Stock Inicial *">
                  <input
                    type="number"
                    min={1}
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid gap-4 @3xl:grid-cols-2">
                <Field label="Preço Normal em Kwanzas (Kz) *">
                  <input
                    type="number"
                    min={100}
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>

                <Field label="Preço Promocional (Opcional)">
                  <input
                    type="number"
                    min={100}
                    value={newProdPromo || ""}
                    onChange={(e) =>
                      setNewProdPromo(e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="Ex: 2200"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Descrição Detalhada do Produto">
                <textarea
                  rows={3}
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  placeholder="Volume, especificações, modo de conservação ou garantia..."
                  className={inputCls + " py-2.5"}
                />
              </Field>

              <ImageUploader
                value={newProdImg}
                onChange={setNewProdImg}
                fitMode={newProdImgFit}
                onFitModeChange={setNewProdImgFit}
                label="Fotografia do Produto"
                helperText="Upload de imagem local ou link web com adaptação de tamanho para o Marketplace."
              />

              <Btn kind="action" type="submit" className="w-full">
                Publicar Produto no Marketplace
              </Btn>
            </form>
          </div>
        )}

        {/* Gestão de Encomendas Recebidas */}
        {activeTab === "encomendas" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-primary">
              Gestão de Encomendas Recebidas
            </h2>

            {companyOrders.length > 0 ? (
              companyOrders.map((ord) => (
                <div key={ord.id} className="rounded-[var(--radius)] border border-border bg-paper p-5">
                  <div className="flex flex-wrap items-center justify-between border-b border-border pb-3 mb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">{ord.id}</span>
                      <h4 className="font-bold text-lg text-primary">{ord.customerName}</h4>
                      <p className="text-xs text-muted-foreground">📞 +244 {ord.customerPhone} · 📍 {ord.deliveryAddress}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Mudar Estado:</span>
                      <select
                        value={ord.orderStatus}
                        onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value as any)}
                        className={inputCls + " min-h-8 py-0 px-2 text-xs w-40"}
                      >
                        <option value="Recebida">Recebida</option>
                        <option value="Confirmada">Confirmada</option>
                        <option value="Em preparação">Em preparação</option>
                        <option value="A caminho">A caminho</option>
                        <option value="Entregue">Entregue</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.quantity}x {it.product.name}</span>
                        <span className="font-bold">{kz(it.product.priceAOA * it.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-sm">
                    <span className="text-xs text-muted-foreground">Pagamento: {ord.paymentMethod}</span>
                    <span className="font-display font-black text-lg text-primary">{kz(ord.totalAOA)}</span>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                icon="Receipt"
                title="Sem encomendas recebidas"
                text="Quando clientes comprarem produtos da sua empresa no marketplace, aparecerão aqui para despacho."
              />
            )}
          </div>
        )}

        {/* Financeiro */}
        {activeTab === "financeiro" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-3">
              <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Saldo Disponível
                </span>
                <p className="mt-2 font-display text-3xl font-black text-ok">
                  {formatCurrency(store.partnerWallet.balanceAOA, store.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Líquido de comissões</p>
              </div>

              <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Levantamentos em Curso
                </span>
                <p className="mt-2 font-display text-3xl font-black text-primary">
                  {formatCurrency(store.partnerWallet.pendingPayoutAOA, store.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Aguardando liquidação bancária</p>
              </div>

              <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Comissão Resolve Express
                </span>
                <p className="mt-2 font-display text-3xl font-black text-primary">
                  {store.partnerWallet.commissionRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Retida automaticamente nas vendas</p>
              </div>
            </div>

            {/* Request Payout */}
            <div className="rounded-[var(--radius)] border border-border bg-paper p-6 max-w-xl">
              <h3 className="font-display font-bold text-lg text-primary mb-3">
                Solicitar Levantamento para Conta Bancária
              </h3>
              <div className="space-y-3">
                <Field label="Valor a Transferir (Kz)">
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(Number(e.target.value))}
                    max={store.partnerWallet.balanceAOA}
                    className={inputCls}
                  />
                </Field>
                <Field label="IBAN da Empresa Parceira (Bancos de Angola)">
                  <input
                    value={payoutIban}
                    onChange={(e) => setPayoutIban(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <div className="pt-2">
                  <Btn kind="action" onClick={handleRequestPayout}>
                    Solicitar Transferência
                  </Btn>
                  {payoutSuccess && (
                    <span className="text-xs text-ok font-bold block mt-2">
                      Pedido de levantamento submetido com sucesso!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Perfil da empresa */}
        {activeTab === "perfil" && (
          <div className="max-w-2xl rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-6 space-y-4">
            <h2 className="font-display text-2xl font-black text-primary">
              Dados da Empresa Parceira
            </h2>
            <div className="grid gap-3 @3xl:grid-cols-2">
              <Field label="Nome Comercial">
                <input defaultValue={partner.commercialName} className={inputCls} />
              </Field>
              <Field label="Razão Social">
                <input defaultValue={partner.socialReason} className={inputCls} />
              </Field>
              <Field label="NIF">
                <input defaultValue={partner.nif} readOnly className={inputCls + " opacity-80"} />
              </Field>
              <Field label="Gerente Responsável">
                <input defaultValue={partner.manager} className={inputCls} />
              </Field>
              <Field label="Telefone">
                <input defaultValue={partner.phone} className={inputCls} />
              </Field>
              <Field label="Email">
                <input defaultValue={partner.email} className={inputCls} />
              </Field>
            </div>
            <Btn kind="ink" className="min-h-10 text-xs">
              Atualizar Dados da Empresa
            </Btn>
          </div>
        )}

        {/* Apoio */}
        {activeTab === "apoio" && (
          <div className="max-w-xl rounded-[var(--radius)] border border-border bg-paper p-5 space-y-4">
            <h2 className="font-display text-xl font-bold text-primary">
              Linha Direta de Apoio a Parceiros
            </h2>
            <p className="text-sm text-muted-foreground">
              A equipa de suporte a parceiros empresariais da Resolve Express em Huambo auxilia na integração de catálogo, logística de estafetas e liquidação de comissões.
            </p>
            <div className="rounded bg-mist p-3.5 text-sm space-y-1 font-semibold">
              <p>📞 Suporte B2B: +244 923 888 777</p>
              <p>✉️ Email: parceiros@resolveexpress.ao</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
