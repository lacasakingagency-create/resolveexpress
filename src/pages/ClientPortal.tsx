import { useState, useEffect } from "react";
import { Icon, go, Btn, Field, inputCls, Empty } from "../ui/kit";
import { useStore, formatCurrency, kz } from "../lib/store";
import { SUBSCRIPTION_PLANS, CATEGORIES, findService, PAYMENTS, ANGOLA_BANKS } from "../lib/data";
import { StatusPill } from "./Other";
import { PaymentCheckoutModal } from "../ui/PaymentCheckoutModal";

export function ClientPortal({ defaultSection }: { defaultSection?: string }) {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState<string>(defaultSection || "inicio");

  useEffect(() => {
    if (defaultSection) setActiveTab(defaultSection);
  }, [defaultSection]);

  // Portal services filter
  const [selectedPortalCat, setSelectedPortalCat] = useState<string>("todos");
  const [portalServiceSearch, setPortalServiceSearch] = useState<string>("");

  // Address state
  const [newBairro, setNewBairro] = useState("");
  const [newRua, setNewRua] = useState("");
  const [newLabel, setNewLabel] = useState("Casa");

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMsg, setTicketMsg] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState(false);

  // Review modal state
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [reviewText, setReviewText] = useState("");

  // Checkout modal state for pending orders or bookings
  const [checkoutItem, setCheckoutItem] = useState<{
    id: string;
    title: string;
    type: "order" | "booking";
    totalAOA: number;
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
  } | null>(null);

  // Wallet top up modal state
  const [walletTopUpOpen, setWalletTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(20000);

  const activeBookings = store.bookings.filter(
    (b) => !["Concluído", "Cancelado"].includes(b.status)
  );
  const completedBookings = store.bookings.filter(
    (b) => b.status === "Concluído"
  );
  const nextBooking = activeBookings[0];

  const totalSpentServices = store.bookings
    .filter((b) => b.status === "Concluído" && b.total)
    .reduce((sum, b) => sum + (b.total || 0), 0);

  const totalSpentProducts = store.productOrders.reduce(
    (sum, o) => sum + o.totalAOA,
    0
  );

  const currentPlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === store.subscriptionPlan) ||
    SUBSCRIPTION_PLANS[0];

  const handleAddAddress = () => {
    if (!newBairro.trim() || !newRua.trim()) return;
    setStore((st) => ({
      clientAddresses: [
        ...st.clientAddresses,
        {
          id: `addr-${Date.now()}`,
          label: newLabel.trim() || "Morada",
          bairro: newBairro.trim(),
          address: newRua.trim(),
          isDefault: st.clientAddresses.length === 0,
        },
      ],
    }));
    setNewBairro("");
    setNewRua("");
    setNewLabel("Casa");
  };

  const handleOpenTicket = () => {
    if (!ticketSubject.trim() || !ticketMsg.trim()) return;
    const ticket = {
      id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: store.currentUser?.name || "Cliente Resolve",
      customerPhone: store.currentUser?.phone || "923111222",
      subject: ticketSubject.trim(),
      message: ticketMsg.trim(),
      status: "Aberto" as const,
      createdAt: new Date().toISOString(),
    };
    setStore((st) => ({
      supportTickets: [ticket, ...st.supportTickets],
    }));
    setTicketSubject("");
    setTicketMsg("");
    setTicketSuccess(true);
    setTimeout(() => setTicketSuccess(false), 4000);
  };

  const handleSaveReview = () => {
    if (!reviewBookingId) return;
    setStore((st) => ({
      bookings: st.bookings.map((b) =>
        b.id === reviewBookingId
          ? { ...b, rating: ratingStars, reviewComment: reviewText }
          : b
      ),
    }));
    setReviewBookingId(null);
    setReviewText("");
  };

  // The 16 sections as specified in Section 2 of Prompt
  const sections = [
    { id: "inicio", label: "Início", icon: "Home" },
    { id: "servicos", label: "Explorar Serviços", icon: "Search" },
    { id: "loja", label: "Loja de Produtos", icon: "ShoppingBasket" },
    { id: "meus-produtos", label: "Os Meus Produtos", icon: "Package" },
    { id: "pedidos", label: `Os Meus Pedidos (${store.bookings.length})`, icon: "ClipboardList" },
    { id: "agendamentos", label: "Agendamentos", icon: "Calendar" },
    { id: "favoritos", label: "Profissionais Favoritos", icon: "Heart" },
    { id: "enderecos", label: "Endereços", icon: "MapPin" },
    { id: "pagamentos", label: "Pagamentos", icon: "CreditCard" },
    { id: "carteira", label: "Carteira", icon: "Wallet" },
    { id: "promocoes", label: "Promoções e Descontos", icon: "Tag" },
    { id: "compras", label: `Histórico de Compras (${store.productOrders.length})`, icon: "Receipt" },
    { id: "avaliacoes", label: "Avaliações", icon: "Star" },
    { id: "notificacoes", label: "Notificações", icon: "Bell" },
    { id: "apoio", label: "Apoio ao Cliente", icon: "Headset" },
    { id: "perfil", label: "O Meu Perfil", icon: "User" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 @3xl:px-8">
      {/* Top Banner Profile */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-action text-xl font-black text-action-ink">
            {store.currentUser?.name.slice(0, 2).toUpperCase() || "CL"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-black text-primary">
                Portal do Cliente
              </h1>
              <span className="rounded-full bg-mist px-3 py-0.5 text-xs font-bold text-primary">
                Plano {currentPlan.name}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {store.currentUser?.name} · {store.currentUser?.bairro || "Cidade Alta"}, Huambo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Btn kind="ghost" className="min-h-10 text-xs" onClick={() => go("/produtos")}>
            <Icon name="ShoppingBasket" className="size-4 text-action" /> Comprar Produtos
          </Btn>
          <Btn kind="action" className="min-h-10 text-xs" onClick={() => go("/servicos")}>
            Pedir Serviço
          </Btn>
        </div>
      </div>

      <div className="grid gap-8 @5xl:grid-cols-[250px_1fr]">
        {/* Sidebar Nav */}
        <aside className="flex flex-row overflow-x-auto gap-1 @5xl:flex-col @5xl:overflow-visible">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "servicos") go("/servicos");
                else if (item.id === "loja") go("/produtos");
                else setActiveTab(item.id);
              }}
              className={`flex items-center gap-3 rounded-[var(--radius)] px-3.5 py-2.5 text-xs font-bold transition text-left shrink-0 ${
                activeTab === item.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-mist hover:text-foreground"
              }`}
            >
              <Icon name={item.icon} className="size-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <main className="min-w-0">
          {/* 1. Início */}
          {activeTab === "inicio" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
                <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Serviços Ativos
                  </span>
                  <p className="mt-2 font-display text-3xl font-black text-primary">
                    {activeBookings.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Acompanhados em Huambo</p>
                </div>

                <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Encomendas
                  </span>
                  <p className="mt-2 font-display text-3xl font-black text-action">
                    {store.productOrders.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Produtos comprados</p>
                </div>

                <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Despesas Totais
                  </span>
                  <p className="mt-2 font-display text-xl font-black text-primary">
                    {formatCurrency(totalSpentServices + totalSpentProducts, store.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Serviços e marketplace</p>
                </div>

                <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Assinatura
                  </span>
                  <p className="mt-2 font-display text-xl font-black text-primary">
                    {currentPlan.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <button type="button" onClick={() => go("/planos")} className="text-action underline font-bold">
                      Alterar plano
                    </button>
                  </p>
                </div>
              </div>

              {/* Next Booking Banner */}
              {nextBooking ? (
                <div className="rounded-[var(--radius)] border-2 border-action/40 bg-paper p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-2 font-mono text-xs font-bold text-action uppercase tracking-wider">
                      <span className="pulse size-2 rounded-full bg-action" /> Próximo Serviço Agendado
                    </span>
                    <span className="font-mono text-sm font-bold text-muted-foreground">
                      {nextBooking.id}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-primary">
                    {nextBooking.service} ({nextBooking.qty} {nextBooking.unit})
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    📅 {nextBooking.date} às {nextBooking.slot} · 📍 {nextBooking.address}
                  </p>
                  {nextBooking.assignedTo && (
                    <p className="mt-2 text-xs font-semibold text-primary inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1">
                      <Icon name="UserCheck" className="size-3.5 text-ok" /> Profissional: {nextBooking.assignedTo}
                    </p>
                  )}
                  <div className="mt-4 flex gap-3">
                    <Btn kind="action" className="min-h-10 text-xs" onClick={() => setActiveTab("pedidos")}>
                      Ver detalhes do pedido
                    </Btn>
                  </div>
                </div>
              ) : null}

              {/* Quick Products Carousel */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg font-bold">Destaques da Loja de Produtos</h3>
                  <button type="button" onClick={() => go("/produtos")} className="text-xs font-bold text-action underline">
                    Ir para a Loja Completa →
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 @3xl:grid-cols-4">
                  {store.products.slice(0, 4).map((prod) => (
                    <div key={prod.id} className="rounded-[var(--radius)] border border-border bg-paper p-3 text-sm">
                      <img src={prod.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"} alt={prod.name} className="h-28 w-full object-cover rounded mb-2" />
                      <p className="font-bold truncate text-primary">{prod.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{prod.sellerName}</p>
                      <p className="font-black text-primary mt-1">{kz(prod.priceAOA)}</p>
                      <Btn kind="action" className="w-full min-h-8 text-xs mt-2" onClick={() => go("/produtos")}>
                        Comprar
                      </Btn>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. Explorar Serviços */}
          {activeTab === "servicos" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-black text-primary">
                    Explorar Serviços ao Domicílio
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cada serviço acompanhado por profissionais verificados no Huambo com imagens reais e garantia.
                  </p>
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={portalServiceSearch}
                    onChange={(e) => setPortalServiceSearch(e.target.value)}
                    placeholder="Pesquisar serviço..."
                    className={inputCls + " text-xs"}
                  />
                </div>
              </div>

              {/* Categorias */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedPortalCat("todos")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${
                    selectedPortalCat === "todos"
                      ? "bg-primary text-primary-foreground"
                      : "bg-mist text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos os Serviços
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedPortalCat(c.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${
                      selectedPortalCat === c.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-mist text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Grid de Serviços com imagem individual */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.filter((c) => selectedPortalCat === "todos" || c.id === selectedPortalCat)
                  .flatMap((c) => c.services)
                  .filter((s) =>
                    !portalServiceSearch.trim() ||
                    s.name.toLowerCase().includes(portalServiceSearch.toLowerCase()) ||
                    s.description.toLowerCase().includes(portalServiceSearch.toLowerCase())
                  )
                  .map((svc) => (
                    <div
                      key={svc.id}
                      className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-paper shadow-xs transition hover:border-action/40 hover:shadow-md"
                    >
                      <div className="relative h-44 overflow-hidden bg-ink">
                        <img
                          src={svc.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
                          alt={svc.name}
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                        <span className="absolute bottom-2.5 left-3 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs">
                          {CATEGORIES.find((c) => c.id === svc.categoryId)?.name || ""}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <h4 className="font-display font-bold text-primary group-hover:text-action transition-colors">
                            {svc.name}
                          </h4>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {svc.description}
                          </p>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                          <span className="text-xs font-bold text-primary">
                            Por {svc.unit}
                          </span>
                          <Btn
                            kind="action"
                            className="min-h-8 px-3 text-xs"
                            onClick={() => go(`/pedir/${svc.id}`)}
                          >
                            Solicitar
                          </Btn>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 3. Loja de Produtos */}
          {activeTab === "loja" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-black text-primary">
                    Loja de Produtos & Marketplace
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Compre água mineral, botijas de gás, produtos de mercearia e artigos para casa com entrega rápida no Huambo.
                  </p>
                </div>
                <Btn kind="action" onClick={() => go("/produtos")}>
                  Abrir Loja Completa
                </Btn>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {store.products.map((p) => (
                  <div key={p.id} className="rounded-[var(--radius)] border border-border bg-paper p-4 shadow-xs">
                    <img src={p.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"} alt={p.name} className="h-36 w-full object-cover rounded mb-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-action">{p.category}</span>
                    <h4 className="font-display font-bold text-primary truncate">{p.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                      <span className="font-display text-base font-black text-primary">{kz(p.priceAOA)}</span>
                      <Btn kind="action" className="min-h-8 text-xs" onClick={() => go("/produtos")}>
                        Comprar
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Os Meus Produtos */}
          {activeTab === "meus-produtos" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-black text-primary">
                  Os Meus Produtos & Compras Anteriores
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Consulte os produtos que já comprou, garantias ativas e recibos das suas encomendas no Huambo.
                </p>
              </div>

              {store.productOrders.length > 0 ? (
                <div className="space-y-4">
                  {store.productOrders.map((order) => (
                    <div key={order.id} className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-primary">{order.id}</span>
                          <span className="rounded-full bg-ok/10 text-ok px-2.5 py-0.5 text-xs font-bold">
                            {order.orderStatus}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("pt-AO")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-1">
                            <div className="flex items-center gap-3">
                              <img src={item.product?.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"} alt={item.product?.name || "Produto"} className="size-10 rounded object-cover" />
                              <div>
                                <p className="font-bold text-primary">{item.product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Vendedor: {item.product.sellerName} · Quantidade: {item.quantity}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold">{kz(item.product.priceAOA * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 border-t border-border pt-3 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                        <div className="flex items-center gap-2">
                          <span>📍 Entrega: {order.deliveryAddress}</span>
                          <span
                            className={
                              "px-2 py-0.5 rounded font-bold text-[11px] " +
                              (order.paymentStatus === "Pago"
                                ? "bg-ok/15 text-ok"
                                : "bg-warn/20 text-warn")
                            }
                          >
                            {order.paymentMethod} ({order.paymentStatus})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {order.paymentStatus !== "Pago" && (
                            <Btn
                              kind="action"
                              className="min-h-8 text-xs shadow-xs"
                              onClick={() =>
                                setCheckoutItem({
                                  id: order.id,
                                  title: `Pagamento da Encomenda ${order.id}`,
                                  type: "order",
                                  totalAOA: order.totalAOA,
                                  customerName: order.customerName,
                                  customerPhone: order.customerPhone,
                                  deliveryAddress: order.deliveryAddress,
                                })
                              }
                            >
                              <Icon name="CreditCard" className="size-3.5" /> Pagar Agora ({kz(order.totalAOA)})
                            </Btn>
                          )}
                          <Btn kind="ghost" className="min-h-8 text-xs" onClick={() => alert(`Recibo ${order.id} emitido!`)}>
                            Baixar Recibo
                          </Btn>
                          <Btn kind="ink" className="min-h-8 text-xs" onClick={() => go("/produtos")}>
                            Comprar Novamente
                          </Btn>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon="Package"
                  title="Ainda não tem produtos comprados"
                  text="Quando encomendar água, gás ou produtos do marketplace, eles aparecerão aqui."
                >
                  <Btn onClick={() => go("/produtos")}>Visitar a Loja de Produtos</Btn>
                </Empty>
              )}
            </div>
          )}

          {/* 5. Os Meus Pedidos */}
          {activeTab === "pedidos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-black text-primary">
                  Os Meus Pedidos de Serviços
                </h2>
                <Btn kind="action" className="min-h-10 text-xs" onClick={() => go("/servicos")}>
                  Novo Serviço
                </Btn>
              </div>

              {store.bookings.length ? (
                store.bookings.map((b) => (
                  <div key={b.id} className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">{b.id}</span>
                        <StatusPill s={b.status} />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {b.date} às {b.slot}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 @3xl:grid-cols-2">
                      <div className="flex items-start gap-3">
                        {findService(b.serviceId)?.image && (
                          <img
                            src={findService(b.serviceId)!.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
                            alt={b.service}
                            className="size-16 rounded-[var(--radius)] object-cover shrink-0 border border-border shadow-xs"
                          />
                        )}
                        <div>
                          <h4 className="font-display text-lg font-bold text-primary">
                            {b.service} ({b.qty} {b.unit})
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">📍 {b.address}</p>
                          <p className="text-xs italic mt-2 bg-mist p-2.5 rounded-[var(--radius)]">
                            "{b.details}"
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between border-t border-border pt-3 @3xl:border-t-0 @3xl:pt-0 @3xl:border-l @3xl:pl-4">
                        <div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-bold text-primary">
                              {b.total ? formatCurrency(b.total, store.currency) : "Sob Orçamento"}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Pagamento:</span>
                            <span>{b.payment} ({b.paymentStatus})</span>
                          </div>
                          {b.assignedTo && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-muted-foreground">Profissional:</span>
                              <span className="font-semibold">{b.assignedTo}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {b.paymentStatus !== "Pago" && b.total && (
                            <Btn
                              kind="action"
                              className="min-h-9 px-3 text-xs shadow-xs"
                              onClick={() =>
                                setCheckoutItem({
                                  id: b.id,
                                  title: `Pagamento do Serviço: ${b.service}`,
                                  type: "booking",
                                  totalAOA: b.total || 0,
                                  customerName: b.customer,
                                  customerPhone: b.phone,
                                  deliveryAddress: b.address,
                                  })
                              }
                            >
                              <Icon name="CreditCard" className="size-3.5" /> Pagar Agora ({kz(b.total)})
                            </Btn>
                          )}
                          {b.status === "Concluído" && !b.rating && (
                            <Btn
                              kind="ink"
                              className="min-h-9 px-3 text-xs"
                              onClick={() => {
                                setReviewBookingId(b.id);
                                setRatingStars(5);
                                setReviewText("");
                              }}
                            >
                              ⭐ Avaliar Serviço
                            </Btn>
                          )}
                          {b.rating && (
                            <div className="flex items-center gap-1 text-xs text-amber-500 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full">
                              {"★".repeat(b.rating)} Avaliado ({b.rating}/5)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  icon="ClipboardList"
                  title="Ainda não tem pedidos registados"
                  text="Seus pedidos e solicitações em Huambo aparecerão aqui."
                />
              )}
            </div>
          )}

          {/* 6. Agendamentos */}
          {activeTab === "agendamentos" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-black text-primary">
                Agendamentos Futuros
              </h2>
              {activeBookings.length ? (
                activeBookings.map((b) => {
                  const s = findService(b.serviceId);
                  return (
                    <div key={b.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-paper p-4 shadow-xs">
                      {s?.image ? (
                        <img
                          src={s.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
                          alt={b.service}
                          className="size-16 rounded-[var(--radius)] object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-action/10 text-action">
                          <Icon name="Calendar" className="size-6" />
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-primary">{b.service}</span>
                        <p className="text-xs text-action font-semibold">{b.date} às {b.slot}</p>
                        <p className="text-xs text-muted-foreground">{b.address}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty icon="Calendar" title="Sem agendamentos futuros" text="Agende um serviço para vê-lo aqui." />
              )}
            </div>
          )}

          {/* 7. Profissionais favoritos */}
          {activeTab === "favoritos" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-black text-primary">
                Os Meus Profissionais Favoritos
              </h2>
              <div className="grid gap-4 @3xl:grid-cols-2">
                {[
                  { name: "João Baptista", service: "Limpeza & Organização", rating: "4.9 ★", jobs: "82 serviços" },
                  { name: "Carlos Kaputo", service: "Canalização & Eletricidade", rating: "5.0 ★", jobs: "54 serviços" },
                ].map((fav, i) => (
                  <div key={i} className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-paper p-4">
                    <div>
                      <p className="font-bold text-primary">{fav.name}</p>
                      <p className="text-xs text-muted-foreground">{fav.service} · {fav.jobs}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                      {fav.rating}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Endereços */}
          {activeTab === "enderecos" && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-black text-primary">
                Gestão de Endereços no Huambo
              </h2>
              <div className="grid gap-4 @3xl:grid-cols-2">
                {store.clientAddresses.map((addr) => (
                  <div key={addr.id} className="rounded-[var(--radius)] border border-border bg-paper p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1.5 text-primary">
                        <Icon name="MapPin" className="size-4 text-action" /> {addr.label}
                      </span>
                      {addr.isDefault && (
                        <span className="text-xs bg-ok/10 text-ok px-2 py-0.5 rounded font-bold">Padrão</span>
                      )}
                    </div>
                    <p className="text-sm">{addr.address}</p>
                    <p className="text-xs text-muted-foreground">Bairro {addr.bairro}, Huambo</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[var(--radius)] border border-border bg-mist p-5">
                <h3 className="font-bold text-sm text-primary mb-3">Adicionar Morada</h3>
                <div className="grid gap-3 @3xl:grid-cols-3">
                  <Field label="Rótulo (ex: Escritório)">
                    <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Bairro">
                    <input value={newBairro} onChange={(e) => setNewBairro(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Rua / Casa">
                    <input value={newRua} onChange={(e) => setNewRua(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <Btn kind="ink" className="mt-3 min-h-10 text-xs" onClick={handleAddAddress}>
                  Guardar Endereço
                </Btn>
              </div>
            </div>
          )}

          {/* 9. Pagamentos */}
          {activeTab === "pagamentos" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-black text-primary">
                    Canais de Pagamento Oficiais
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Métodos disponíveis em Angola para pagamento de produtos e serviços.
                  </p>
                </div>
                <Btn
                  kind="action"
                  className="min-h-10 text-xs"
                  onClick={() =>
                    setCheckoutItem({
                      id: `TESTE-${Math.floor(1000 + Math.random() * 9000)}`,
                      title: "Demonstração dos Métodos de Pagamento",
                      type: "order",
                      totalAOA: 15000,
                      customerName: store.currentUser?.name || "Cliente Resolve",
                      customerPhone: store.currentUser?.phone || "923111222",
                    })
                  }
                >
                  <Icon name="CreditCard" className="size-4" /> Experimentar Checkout
                </Btn>
              </div>

              {/* Supported Payment Channels */}
              <div className="grid gap-4 sm:grid-cols-2">
                {PAYMENTS.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-9 place-items-center rounded-lg bg-action text-white">
                            <Icon name={p.icon} className="size-5" />
                          </span>
                          <div>
                            <h4 className="font-display font-bold text-sm text-primary">
                              {p.name}
                            </h4>
                            <span className="text-[10px] text-muted-foreground">
                              {p.badge}
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full bg-ok/10 text-ok px-2 py-0.5 text-xs font-bold">
                          Ativo
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {p.note}
                      </p>
                    </div>

                    {p.id === "transfer" && (
                      <div className="mt-2 pt-2 border-t border-border space-y-1.5 text-xs">
                        <span className="font-bold text-primary block">Contas Bancárias Oficiais:</span>
                        {ANGOLA_BANKS.map((b) => (
                          <div key={b.id} className="flex justify-between items-center text-[11px] font-mono bg-mist p-2 rounded">
                            <span><strong>{b.shortName}:</strong> {b.iban}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(b.iban);
                                alert(`IBAN do ${b.shortName} copiado!`);
                              }}
                              className="text-action font-bold hover:underline ml-2 font-sans"
                            >
                              Copiar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. Carteira */}
          {activeTab === "carteira" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-black text-primary">
                    Carteira Digital Resolve Express
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Saldo pré-pago para compras de conveniência e serviços sem fricção.
                  </p>
                </div>
              </div>

              {/* Wallet Balance Card */}
              <div className="rounded-[calc(var(--radius)*1.4)] bg-gradient-to-r from-primary via-primary/95 to-slate-900 text-white p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <span className="text-xs uppercase font-bold text-white/70 block">
                    Saldo Disponível
                  </span>
                  <div className="font-display text-3xl sm:text-4xl font-black text-action mt-1">
                    {kz(store.clientWallet?.balanceAOA ?? 75000)}
                  </div>
                  <p className="text-xs text-white/75 mt-1">
                    Titular: {store.currentUser?.name} · Carteira vinculada a +244 {store.currentUser?.phone || "923111222"}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Btn
                    kind="action"
                    className="min-h-11 shadow-md whitespace-nowrap"
                    onClick={() => {
                      setCheckoutItem({
                        id: `RECARGA-${Math.floor(1000 + Math.random() * 9000)}`,
                        title: "Recarga de Saldo na Carteira",
                        type: "order",
                        totalAOA: topUpAmount,
                        customerName: store.currentUser?.name || "Cliente Resolve",
                        customerPhone: store.currentUser?.phone || "923111222",
                      });
                    }}
                  >
                    <Icon name="Plus" className="size-4" /> Carregar Saldo (+{kz(topUpAmount)})
                  </Btn>
                  <div className="flex gap-1.5 justify-center">
                    {[5000, 10000, 20000, 50000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopUpAmount(amt)}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition ${
                          topUpAmount === amt
                            ? "bg-action text-white"
                            : "bg-white/15 text-white hover:bg-white/25"
                        }`}
                      >
                        {amt / 1000}k
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="space-y-3">
                <h3 className="font-display font-bold text-base text-primary">
                  Histórico de Movimentos da Carteira
                </h3>
                <div className="rounded-[var(--radius)] border border-border bg-paper divide-y divide-border overflow-hidden">
                  {(store.clientWallet?.history || []).map((entry) => (
                    <div key={entry.id} className="p-4 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-8 place-items-center rounded-lg font-bold ${
                            entry.type === "credit"
                              ? "bg-ok/15 text-ok"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          <Icon
                            name={entry.type === "credit" ? "ArrowDownLeft" : "ArrowUpRight"}
                            className="size-4"
                          />
                        </span>
                        <div>
                          <p className="font-bold text-primary">{entry.description}</p>
                          <span className="text-muted-foreground">{entry.date} · Ref: {entry.id}</span>
                        </div>
                      </div>
                      <span
                        className={`font-display font-black text-sm ${
                          entry.type === "credit" ? "text-ok" : "text-destructive"
                        }`}
                      >
                        {entry.type === "credit" ? "+" : "-"}
                        {kz(entry.amountAOA)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 11. Promoções */}
          {activeTab === "promocoes" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-black text-primary">
                Promoções e Cupões Disponíveis
              </h2>
              <div className="grid gap-3 @3xl:grid-cols-2">
                {store.coupons.map((cp) => (
                  <div key={cp.code} className="rounded-[var(--radius)] border border-dashed border-action bg-action/5 p-4">
                    <span className="font-mono text-base font-black text-action bg-action/20 px-2.5 py-1 rounded">
                      {cp.code}
                    </span>
                    <p className="font-bold text-sm mt-2">{cp.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aplique este código no carrinho ou ao agendar um serviço.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. Histórico de compras */}
          {activeTab === "compras" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-black text-primary">
                Histórico de Compras de Produtos
              </h2>
              {store.productOrders.map((o) => (
                <div key={o.id} className="rounded-[var(--radius)] border border-border bg-paper p-4">
                  <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                    <span className="font-mono font-bold text-primary">{o.id}</span>
                    <span className="font-bold text-ok">{kz(o.totalAOA)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {o.items.length} itens · {o.paymentMethod} ({o.orderStatus})
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 13. Avaliações */}
          {activeTab === "avaliacoes" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-black text-primary">
                Minhas Avaliações
              </h2>
              {store.bookings.filter((b) => b.rating).map((b) => (
                <div key={b.id} className="rounded-[var(--radius)] border border-border bg-paper p-4">
                  <div className="flex justify-between">
                    <span className="font-bold text-primary">{b.service}</span>
                    <span className="text-amber-500 font-bold">{"★".repeat(b.rating || 5)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{b.date} · {b.id}</p>
                  {b.reviewComment && <p className="text-sm mt-2 italic">"{b.reviewComment}"</p>}
                </div>
              ))}
            </div>
          )}

          {/* 14. Notificações */}
          {activeTab === "notificacoes" && (
            <div className="space-y-3">
              <h2 className="font-display text-2xl font-black text-primary">
                Notificações
              </h2>
              {[
                "O seu pedido REX-2026-000001 está 'Em curso'. O funcionário já se encontra no domicílio.",
                "Bem-vindo à Resolve Express no Huambo! Use o cupão BEMVINDO10 no seu primeiro pedido.",
              ].map((msg, i) => (
                <div key={i} className="rounded-[var(--radius)] border border-border bg-paper p-3.5 text-sm flex gap-3 items-center">
                  <Icon name="Bell" className="size-4 text-action shrink-0" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* 15. Apoio ao Cliente */}
          {activeTab === "apoio" && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-black text-primary">
                Apoio ao Cliente & Chamados
              </h2>
              <div className="rounded-[var(--radius)] border border-border bg-paper p-5 space-y-3">
                <Field label="Assunto">
                  <input value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Mensagem">
                  <textarea rows={3} value={ticketMsg} onChange={(e) => setTicketMsg(e.target.value)} className={inputCls + " py-2"} />
                </Field>
                <div className="flex items-center gap-3">
                  <Btn kind="action" onClick={handleOpenTicket} disabled={!ticketSubject.trim() || !ticketMsg.trim()}>
                    Enviar Mensagem
                  </Btn>
                  {ticketSuccess && <span className="text-xs font-bold text-ok">Chamado submetido com sucesso!</span>}
                </div>
              </div>
            </div>
          )}

          {/* 16. O Meu Perfil */}
          {activeTab === "perfil" && (
            <div className="space-y-4 max-w-xl">
              <h2 className="font-display text-2xl font-black text-primary">
                O Meu Perfil
              </h2>
              <div className="rounded-[var(--radius)] border border-border bg-paper p-5 space-y-3">
                <Field label="Nome Completo">
                  <input defaultValue={store.currentUser?.name} className={inputCls} />
                </Field>
                <Field label="Telefone">
                  <input defaultValue={store.currentUser?.phone} className={inputCls} />
                </Field>
                <Field label="Email">
                  <input defaultValue={store.currentUser?.email} className={inputCls} />
                </Field>
                <Btn kind="ink" className="mt-2 min-h-10 text-xs" onClick={() => alert("Perfil atualizado!")}>
                  Guardar Dados
                </Btn>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Review Modal */}
      {reviewBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-paper p-6 shadow-xl">
            <h3 className="font-display text-xl font-bold text-primary">
              Avaliar Serviço
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Como foi a sua experiência com a Resolve Express?
            </p>

            <div className="my-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingStars(star)}
                  className={`text-2xl transition ${
                    star <= ratingStars ? "text-amber-500 scale-110" : "text-neutral-3"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <Field label="Comentário da Avaliação">
              <textarea
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Pontualidade, qualidade da limpeza ou atendimento..."
                className={inputCls + " py-2"}
              />
            </Field>

            <div className="mt-5 flex justify-end gap-2">
              <Btn kind="ghost" onClick={() => setReviewBookingId(null)}>
                Cancelar
              </Btn>
              <Btn kind="action" onClick={handleSaveReview}>
                Publicar Avaliação
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal para Pagamentos do Portal e Recargas de Carteira */}
      {checkoutItem && (
        <PaymentCheckoutModal
          open={Boolean(checkoutItem)}
          onClose={() => setCheckoutItem(null)}
          title={checkoutItem.title}
          itemType={checkoutItem.type}
          itemId={checkoutItem.id}
          totalAOA={checkoutItem.totalAOA}
          customerName={checkoutItem.customerName}
          customerPhone={checkoutItem.customerPhone}
          deliveryAddress={checkoutItem.deliveryAddress}
          onPaymentSuccess={(paymentResult) => {
            if (checkoutItem.type === "order") {
              setStore((st) => ({
                productOrders: st.productOrders.map((o) =>
                  o.id === checkoutItem.id
                    ? {
                        ...o,
                        paymentMethod: paymentResult.method,
                        paymentStatus: paymentResult.status,
                        paymentReference: paymentResult.reference,
                        proofOfPayment: paymentResult.proofOfPayment,
                        paymentDetails: paymentResult.paymentDetails,
                      }
                    : o
                ),
              }));
            } else if (checkoutItem.type === "booking") {
              setStore((st) => ({
                bookings: st.bookings.map((b) =>
                  b.id === checkoutItem.id
                    ? {
                        ...b,
                        payment: paymentResult.method,
                        paymentStatus: paymentResult.status,
                        paymentReference: paymentResult.reference,
                        proofOfPayment: paymentResult.proofOfPayment,
                        paymentDetails: paymentResult.paymentDetails,
                      }
                    : b
                ),
              }));
            }

            // If it was a wallet top-up
            if (checkoutItem.id.startsWith("RECARGA-")) {
              setStore((st) => {
                const current = st.clientWallet?.balanceAOA ?? 75000;
                return {
                  clientWallet: {
                    balanceAOA: current + checkoutItem.totalAOA,
                    history: [
                      {
                        id: `CW-${Date.now().toString().slice(-4)}`,
                        date: new Date().toISOString().slice(0, 16).replace("T", " "),
                        amountAOA: checkoutItem.totalAOA,
                        type: "credit" as const,
                        description: `Recarga via ${paymentResult.method} (${paymentResult.reference || "Confirmada"})`,
                      },
                      ...(st.clientWallet?.history || []),
                    ],
                  },
                };
              });
            }

            setCheckoutItem(null);
          }}
        />
      )}
    </div>
  );
}
