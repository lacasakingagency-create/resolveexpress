import { useState } from "react";
import { Icon, go, Btn, Field, inputCls, Section, Empty } from "../ui/kit";
import { PRODUCT_CATEGORIES, ANGOLA_PROVINCES, type Product } from "../lib/data";
import { useStore, formatCurrency, nextOrderId, kz } from "../lib/store";
import { AuthPromptModal } from "../ui/AuthPromptModal";
import { PaymentCheckoutModal } from "../ui/PaymentCheckoutModal";
import { isSupabaseConfigured, syncOrderToSupabaseStrict } from "../lib/supabase";

export function Marketplace({ initialCategory }: { initialCategory?: string }) {
  const [store, setStore] = useStore();
  const [selectedCat, setSelectedCat] = useState<string>(initialCategory || "Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; percent?: number; amount?: number } | null>(null);

  // Authentication intercept modal
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    type: "buy" | "service";
    itemName?: string;
  }>({ open: false, type: "buy" });

  // Product Detail & Recommendation Modal state
  const [selectedProductModal, setSelectedProductModal] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);

  // Checkout modal com suporte para as 18 províncias e municípios de Angola
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<{
    id: string;
    address: string;
    bairro: string;
    sellers: string[];
  } | null>(null);

  const [deliveryProvince, setDeliveryProvince] = useState(store.currentUser?.province || "Huambo");
  const [deliveryMunicipio, setDeliveryMunicipio] = useState(store.currentUser?.municipio || "Huambo");
  const [deliveryBairro, setDeliveryBairro] = useState(store.currentUser?.bairro || "Cidade Alta");
  const [deliveryRua, setDeliveryRua] = useState(store.currentUser?.address || "Rua do Comércio nº 45");
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const currentDeliveryMunicipalities =
    ANGOLA_PROVINCES.find((p) => p.name.toLowerCase() === deliveryProvince.toLowerCase())
      ?.municipalities || ANGOLA_PROVINCES[0].municipalities;

  const filteredProducts = store.products.filter((p) => {
    const matchCat = selectedCat === "Todos" || p.category === selectedCat;
    const matchSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch && p.available;
  });

  const cartCount = store.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalAOA = store.cart.reduce((sum, item) => {
    const price = item.product.promotionalPriceAOA || item.product.priceAOA;
    return sum + price * item.quantity;
  }, 0);

  const deliveryFeeAOA = store.cart.length > 0 ? 1500 : 0;

  let discountAOA = 0;
  if (appliedCoupon) {
    if (appliedCoupon.percent) {
      discountAOA = Math.round(subtotalAOA * (appliedCoupon.percent / 100));
    } else if (appliedCoupon.amount) {
      discountAOA = Math.min(subtotalAOA, appliedCoupon.amount);
    }
  }

  // Plan discounts on products
  if (store.subscriptionPlan === "premium") {
    const planDisc = Math.round(subtotalAOA * 0.15);
    if (planDisc > discountAOA) discountAOA = planDisc;
  }

  const finalTotalAOA = Math.max(0, subtotalAOA - discountAOA + deliveryFeeAOA);

  const handleAddToCart = (product: Product, qty: number = 1) => {
    if (!store.currentUser) {
      setAuthModal({ open: true, type: "buy", itemName: product.name });
      return;
    }
    setOrderError(null);
    if (!product.available || product.stock <= 0) {
      setOrderError(`O produto "${product.name}" encontra-se esgotado ou indisponível.`);
      return;
    }
    const existingItem = store.cart.find((i) => i.product.id === product.id);
    const nextQty = (existingItem?.quantity || 0) + qty;
    if (nextQty > product.stock) {
      setOrderError(
        `Stock insuficiente para "${product.name}". Disponível: ${product.stock} ${product.unit}.`
      );
      return;
    }

    setStore((st) => {
      const existing = st.cart.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          cart: st.cart.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: Math.min(product.stock, i.quantity + qty) }
              : i
          ),
        };
      }
      return { cart: [...st.cart, { product, quantity: Math.min(product.stock, qty) }] };
    });
  };

  const getSuggestedProducts = (product: Product): Product[] => {
    const list = store.products.filter((p) => p.available && p.id !== product.id);
    const sameCat = list.filter((p) => p.category === product.category);
    const other = list.filter((p) => p.category !== product.category);
    return [...sameCat, ...other].slice(0, 3);
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setOrderError(null);
    const item = store.cart.find((i) => i.product.id === productId);
    if (item && delta > 0 && item.quantity + delta > item.product.stock) {
      setOrderError(
        `Quantidade máxima disponível para "${item.product.name}": ${item.product.stock}.`
      );
      return;
    }
    setStore((st) => ({
      cart: st.cart
        .map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    }));
  };

  const handleRemoveFromCart = (productId: string) => {
    setStore((st) => ({
      cart: st.cart.filter((i) => i.product.id !== productId),
    }));
  };

  const handleApplyCoupon = () => {
    const found = store.coupons.find(
      (c) => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.active
    );
    if (found) {
      setAppliedCoupon({
        code: found.code,
        percent: found.discountPercent,
        amount: found.discountAOA,
      });
      setCouponMsg({ text: `Cupom ${found.code} ativado!`, ok: true });
    } else {
      setCouponMsg({ text: "Cupom inválido ou expirado.", ok: false });
    }
  };

  const handleBuyNow = (product: Product) => {
    if (!store.currentUser) {
      setAuthModal({ open: true, type: "buy", itemName: product.name });
      return;
    }
    handleAddToCart(product);
    setCartDrawerOpen(true);
  };

  const handleProceedToPayment = () => {
    setOrderError(null);
    if (store.cart.length === 0) return;
    if (!store.currentUser) {
      setCheckoutModalOpen(false);
      setAuthModal({ open: true, type: "buy" });
      return;
    }

    const invalidItem = store.cart.find(
      (i) => !i.product.available || i.quantity <= 0 || i.quantity > i.product.stock
    );
    if (invalidItem) {
      setOrderError(
        `O item "${invalidItem.product.name}" não tem stock suficiente (${invalidItem.product.stock} disponíveis).`
      );
      return;
    }

    const orderSeq = store.orderSeq + 1;
    const newOrderCode = nextOrderId(orderSeq);
    const sellers = Array.from(new Set(store.cart.map((i) => i.product.sellerName)));
    const fullDeliveryAddress = `${deliveryRua}, ${deliveryBairro}, ${deliveryMunicipio}, ${deliveryProvince}`;

    setPendingOrderData({
      id: newOrderCode,
      address: fullDeliveryAddress,
      bairro: `${deliveryBairro} (${deliveryMunicipio})`,
      sellers,
    });
    setCheckoutModalOpen(false);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = async (paymentResult: {
    method: string;
    status: string;
    reference?: string;
    proofOfPayment?: string;
    paymentDetails: Record<string, any>;
  }): Promise<boolean> => {
    if (!pendingOrderData) return false;
    setOrderError(null);

    // Case 1: Re-opening payment modal for an already-created completedOrder
    if (completedOrder && pendingOrderData.id === completedOrder.id) {
      const isConfirmedPaid =
        paymentResult.status === "Pago" || paymentResult.status === "Confirmado";
      const updatedOrder = {
        ...completedOrder,
        paymentMethod: paymentResult.method,
        paymentStatus: paymentResult.status,
        paymentReference: paymentResult.reference,
        proofOfPayment: paymentResult.proofOfPayment,
        paymentDetails: paymentResult.paymentDetails,
        orderStatus: isConfirmedPaid ? ("Confirmada" as const) : completedOrder.orderStatus,
      };

      if (isSupabaseConfigured()) {
        const res = await syncOrderToSupabaseStrict(updatedOrder, "update_payment");
        if (!res.ok) {
          const msg = res.error || "Falha ao atualizar os dados de pagamento no Supabase.";
          setOrderError(msg);
          throw new Error(msg);
        }
      }

      setStore((st) => ({
        productOrders: st.productOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
      }));
      setCompletedOrder(updatedOrder);
      setPaymentModalOpen(false);
      return true;
    }

    // Case 2: New order creation
    const orderSeq = store.orderSeq + 1;
    const affCode =
      store.activeAffiliateRef ||
      (typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("rex_affiliate_ref")
        : null) ||
      undefined;

    const defaultPlatRate = (store.pracaSettings?.defaultPlatformCommission || 10) / 100;
    const defaultAffRate = (store.pracaSettings?.defaultAffiliateCommission || 5) / 100;
    const platformCommissionAOA = Math.round(finalTotalAOA * defaultPlatRate);
    const affiliateCommissionAOA = affCode ? Math.round(finalTotalAOA * defaultAffRate) : 0;
    const sellerNetAOA = Math.max(0, finalTotalAOA - platformCommissionAOA - affiliateCommissionAOA);

    const sellerIds = Array.from(
      new Set(
        store.cart
          .map((it) => it.product.sellerId)
          .filter((sid): sid is string => Boolean(sid && sid.trim()))
      )
    );
    const primarySellerId = sellerIds[0];
    const matchedAffiliate = affCode ? store.affiliates?.find((a) => a.code === affCode) : undefined;
    const isConfirmedPaid =
      paymentResult.status === "Pago" || paymentResult.status === "Confirmado";

    let newOrder = {
      id: pendingOrderData.id,
      userId: store.currentUser?.id,
      customerName: store.currentUser?.name || "Cliente Resolve",
      customerPhone: store.currentUser?.phone || "923111222",
      items: [...store.cart],
      subtotalAOA,
      deliveryFeeAOA,
      discountAOA,
      totalAOA: finalTotalAOA,
      deliveryAddress: pendingOrderData.address,
      deliveryBairro: pendingOrderData.bairro,
      deliveryProvince,
      deliveryMunicipio,
      paymentMethod: paymentResult.method,
      paymentStatus: paymentResult.status,
      paymentReference: paymentResult.reference,
      proofOfPayment: paymentResult.proofOfPayment,
      paymentDetails: paymentResult.paymentDetails,
      orderStatus: (isConfirmedPaid ? "Confirmada" : "Recebida") as "Confirmada" | "Recebida",
      createdAt: new Date().toISOString(),
      estimatedDelivery: "30 a 60 minutos",
      sellerNames: pendingOrderData.sellers,
      sellerIds,
      sellerId: primarySellerId,
      affiliateCode: affCode,
      platformCommissionAOA,
      affiliateCommissionAOA,
      sellerNetAOA,
    };

    if (isSupabaseConfigured()) {
      const res = await syncOrderToSupabaseStrict(newOrder, "insert");
      if (!res.ok) {
        const msg =
          res.error || "Não foi possível gravar a encomenda no servidor. Tente novamente.";
        setOrderError(msg);
        throw new Error(msg);
      }

      if (res.data) {
        newOrder = {
          ...newOrder,
          subtotalAOA: Number(res.data.subtotal_aoa ?? newOrder.subtotalAOA),
          deliveryFeeAOA: Number(res.data.delivery_fee_aoa ?? newOrder.deliveryFeeAOA),
          discountAOA: Number(res.data.discount_aoa ?? newOrder.discountAOA),
          totalAOA: Number(res.data.total_aoa ?? newOrder.totalAOA),
          platformCommissionAOA: Number(
            res.data.commission_amount_aoa ?? newOrder.platformCommissionAOA
          ),
          sellerNetAOA: Number(res.data.seller_payout_amount_aoa ?? newOrder.sellerNetAOA),
        };
      }
    }

    setStore((st) => {
      const newConversions = affCode
        ? [
            {
              id: `conv-${Date.now()}`,
              affiliateId: matchedAffiliate?.id || `aff-${affCode}`,
              affiliateCode: affCode,
              orderId: newOrder.id,
              itemType: "PRODUCT" as const,
              itemId: newOrder.items[0]?.product.id || "item-general",
              itemName: newOrder.items.map((it) => it.product.name).join(", "),
              saleAmountAOA: newOrder.totalAOA,
              affiliateCommissionPercent: Math.round(defaultAffRate * 100),
              commissionAmountAOA: affiliateCommissionAOA,
              platformCommissionAOA: newOrder.platformCommissionAOA,
              sellerId: primarySellerId,
              sellerNetAOA: newOrder.sellerNetAOA,
              status: "PENDENTE" as const,
              createdAt: new Date().toISOString(),
            },
            ...(st.affiliateConversions || []),
          ]
        : st.affiliateConversions || [];

      const updatedAffiliates = affCode
        ? (st.affiliates || []).map((a) =>
            a.code === affCode
              ? {
                  ...a,
                  totalOrdersReferred: a.totalOrdersReferred + 1,
                  totalSalesVolumeAOA: a.totalSalesVolumeAOA + newOrder.totalAOA,
                  pendingCommissionAOA: a.pendingCommissionAOA + affiliateCommissionAOA,
                }
              : a
          )
        : st.affiliates;

      const updatedSellers = (st.sellers || []).map((sel) => {
        if (sellerIds.includes(sel.id)) {
          return {
            ...sel,
            totalSalesCount: sel.totalSalesCount + 1,
            totalGrossAOA: sel.totalGrossAOA + newOrder.totalAOA,
            pendingBalanceAOA: sel.pendingBalanceAOA + newOrder.sellerNetAOA,
          };
        }
        return sel;
      });

      return {
        orderSeq,
        productOrders: [newOrder, ...st.productOrders],
        cart: [],
        affiliateConversions: newConversions,
        affiliates: updatedAffiliates,
        sellers: updatedSellers,
      };
    });

    setCompletedOrder(newOrder);
    setPaymentModalOpen(false);
    setCartDrawerOpen(false);
    return true;
  };

  const lojaHero = store.sectionHeroes?.loja;
  const hasLojaHeroImg = Boolean(lojaHero?.active !== false && lojaHero?.image?.trim());

  return (
    <div className="min-h-screen bg-slate-50/40">
      {/* Hero Banner — Loja Oficial de Produtos */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#071B33] via-[#0E294B] to-[#12365A] py-10 px-4 text-white sm:py-14 sm:px-6 lg:px-8">
        {hasLojaHeroImg && (
          <>
            <img
              src={lojaHero!.image.trim()}
              alt="Loja Oficial Resolve Express"
              className={`absolute inset-0 h-full w-full pointer-events-none ${
                lojaHero?.imageFit === "contain" ? "object-contain bg-[#071B33]" : "object-cover"
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#071B33]/85 via-[#0E294B]/75 to-[#12365A]/85 pointer-events-none" />
          </>
        )}
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-[#E6540F]/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-300 ring-1 ring-orange-400/30">
              <Icon name="ShoppingBag" className="size-3.5 text-[#E6540F]" />
              Loja Oficial Resolve Express
            </span>
            <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              Produtos essenciais com <span className="text-[#E6540F]">entrega rápida ao domicílio.</span>
            </h1>
            <p className="mt-2 text-sm text-slate-200 sm:text-base leading-relaxed">
              Água, gás, mercearia, eletrónica e kits essenciais com garantia de entrega no Huambo e em Angola.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-[#E6540F] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              <Icon name="ShoppingBasket" className="size-5" />
              <span>Ver Carrinho</span>
              {cartCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-white text-xs font-black text-[#E6540F]">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <Section
        eyebrow="Catálogo de Produtos"
        title="Escolha e receba à sua porta"
      >
      {/* Top Error Alert */}
      {orderError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive flex items-center justify-between gap-2">
          <span>{orderError}</span>
          <button type="button" onClick={() => setOrderError(null)} className="font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* Top Search & Cart trigger */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Icon name="Search" className="absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar água, gás, frango, mercearia, kit limpeza..."
            className={inputCls + " pl-10 text-sm"}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="relative flex items-center gap-2.5 rounded-[var(--radius)] border border-border bg-paper px-4 py-2.5 text-sm font-bold text-primary shadow-xs transition hover:border-action"
          >
            <Icon name="ShoppingBasket" className="size-5 text-action" />
            <span>Carrinho</span>
            {cartCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-action text-xs text-action-ink">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {PRODUCT_CATEGORIES.map((cat) => {
          const count =
            cat === "Todos"
              ? store.products.filter((p) => p.available).length
              : store.products.filter((p) => p.available && p.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCat(cat)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                selectedCat === cat
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-paper text-muted-foreground border border-border hover:text-foreground hover:bg-mist"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  selectedCat === cat ? "bg-white/20 text-white" : "bg-mist text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Render Product Card Component */}
      {(() => {
        const renderProductCard = (p: Product) => {
          const hasPromo = p.promotionalPriceAOA && p.promotionalPriceAOA < p.priceAOA;
          const effectivePrice = hasPromo ? p.promotionalPriceAOA! : p.priceAOA;
          const isFeat = (store.featuredProducts || []).includes(p.id);

          return (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProductModal(p);
                setModalQty(1);
              }}
              className="group flex flex-col overflow-hidden rounded-[calc(var(--radius)*1.2)] border border-border bg-paper shadow-xs transition hover:-translate-y-1 hover:border-action/40 hover:shadow-md cursor-pointer"
            >
              {/* Photo container */}
              <div
                className={`relative h-44 w-full overflow-hidden ${
                  p.imageFit === "contain"
                    ? "bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-2"
                    : "bg-mist"
                }`}
              >
                <img
                  src={p.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                  alt={p.name}
                  className={`w-full h-full transition duration-300 group-hover:scale-105 ${
                    p.imageFit === "contain" ? "object-contain" : "object-cover object-center"
                  }`}
                  loading="lazy"
                />
                {hasPromo && (
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-destructive text-white px-2.5 py-0.5 text-[11px] font-bold shadow-xs">
                    PROMOÇÃO
                  </span>
                )}
                {isFeat && (
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-amber-500 text-amber-950 px-2 py-0.5 text-[10px] font-black shadow-xs flex items-center gap-0.5">
                    <Icon name="Star" className="size-3 fill-amber-950" /> DESTAQUE
                  </span>
                )}
                <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/60 text-white backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold">
                  {p.category}
                </span>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col p-4 justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    Vendido por: <strong>{p.sellerName}</strong>
                  </span>
                  <h3 className="font-display font-bold text-base text-primary mt-1 leading-snug line-clamp-1 group-hover:text-action transition-colors">
                    {p.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground min-h-[32px]">
                    {p.description}
                  </p>

                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                    <p className="flex items-center gap-1">
                      <Icon name="Truck" className="size-3 text-action" />
                      <span>{p.estimatedDelivery}</span>
                    </p>
                    <p className="flex items-center gap-1">
                      <Icon name="MapPin" className="size-3 text-muted-foreground" />
                      <span>{p.deliveryLocation}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      {hasPromo && (
                        <span className="text-xs line-through text-muted-foreground block">
                          {formatCurrency(p.priceAOA, store.currency)}
                        </span>
                      )}
                      <span className="font-display text-xl font-black text-primary">
                        {formatCurrency(effectivePrice, store.currency)}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-ok bg-ok/10 px-2 py-0.5 rounded">
                      {p.stock} em stock
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <Btn
                      kind="ghost"
                      className="min-h-9 px-2 text-xs"
                      onClick={() => handleAddToCart(p)}
                    >
                      <Icon name="Plus" className="size-3.5" /> Carrinho
                    </Btn>
                    <Btn
                      kind="action"
                      className="min-h-9 px-2 text-xs"
                      onClick={() => handleBuyNow(p)}
                    >
                      Comprar Já
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          );
        };

        // If "Todos" and no search: show Featured Shelf + Category Shelves
        if (selectedCat === "Todos" && !searchQuery.trim()) {
          const featuredIds = new Set(store.featuredProducts || []);
          const featuredList = store.products.filter((p) => p.available && featuredIds.has(p.id));
          const categoriesWithProducts = PRODUCT_CATEGORIES.filter(
            (c) => c !== "Todos" && store.products.some((p) => p.available && p.category === c)
          );

          return (
            <div className="space-y-12">
              {/* Featured Shelf */}
              {featuredList.length > 0 && (
                <div className="rounded-[calc(var(--radius)*1.4)] border border-action/30 bg-gradient-to-r from-orange-50/60 via-paper to-amber-50/40 p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4 border-b border-action/20 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-xl bg-action text-white shadow-xs">
                        <Icon name="Sparkles" className="size-4" />
                      </span>
                      <div>
                        <h2 className="font-display text-xl font-black text-primary">
                          Produtos em Destaque
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Os artigos mais procurados e com entrega expressa prioritária em Angola
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 @3xl:grid-cols-4">
                    {featuredList.map(renderProductCard)}
                  </div>
                </div>
              )}

              {/* Grouped by Category Shelves */}
              {categoriesWithProducts.map((catName) => {
                const catProducts = store.products.filter(
                  (p) => p.available && p.category === catName
                );
                return (
                  <div key={catName} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-action" />
                        <h2 className="font-display text-lg sm:text-xl font-bold text-primary">
                          {catName}
                        </h2>
                        <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          {catProducts.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCat(catName)}
                        className="text-xs font-bold text-action hover:underline flex items-center gap-1"
                      >
                        Ver todos da categoria <Icon name="ArrowRight" className="size-3" />
                      </button>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
                      {catProducts.map(renderProductCard)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }

        // Filtered view (Specific category or search query)
        return filteredProducts.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                A apresentar <strong>{filteredProducts.length}</strong> produtos em{" "}
                <strong>{selectedCat}</strong>
                {searchQuery ? ` com o termo "${searchQuery}"` : ""}
              </p>
              {selectedCat !== "Todos" && (
                <button
                  type="button"
                  onClick={() => setSelectedCat("Todos")}
                  className="text-xs font-bold text-action hover:underline"
                >
                  ← Ver todas as categorias
                </button>
              )}
            </div>
            <div className="grid gap-6 sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
              {filteredProducts.map(renderProductCard)}
            </div>
          </div>
        ) : (
          <Empty
            icon="Package"
            title="Nenhum produto encontrado"
            text="Não existem produtos nesta categoria ou com os termos pesquisados."
          >
            <Btn
              kind="ghost"
              onClick={() => {
                setSelectedCat("Todos");
                setSearchQuery("");
              }}
            >
              Ver todos os produtos
            </Btn>
          </Empty>
        );
      })()}

      {/* Product Detail & Recommendation Modal */}
      {selectedProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-[calc(var(--radius)*1.4)] border border-border bg-paper p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-action">
                  {selectedProductModal.category}
                </span>
                <h2 className="font-display text-2xl font-black text-primary mt-0.5">
                  {selectedProductModal.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fornecido por <strong>{selectedProductModal.sellerName}</strong> · Huambo, Angola
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductModal(null)}
                className="rounded-full p-2 text-muted-foreground hover:bg-mist hover:text-foreground"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid gap-6 py-4 sm:grid-cols-2">
              {/* Product Photo */}
              <div
                className={`relative aspect-square overflow-hidden rounded-[var(--radius)] border border-border ${
                  selectedProductModal.imageFit === "contain"
                    ? "bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-3"
                    : "bg-mist"
                }`}
              >
                <img
                  src={selectedProductModal.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                  alt={selectedProductModal.name}
                  className={`size-full ${
                    selectedProductModal.imageFit === "contain"
                      ? "object-contain"
                      : "object-cover object-center"
                  }`}
                />
                {selectedProductModal.promotionalPriceAOA &&
                  selectedProductModal.promotionalPriceAOA < selectedProductModal.priceAOA && (
                    <span className="absolute top-3 left-3 rounded-full bg-destructive text-white px-3 py-1 text-xs font-bold shadow-md">
                      OFERTA ESPECIAL
                    </span>
                  )}
              </div>

              {/* Product Info & Action */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-black text-primary">
                      {formatCurrency(
                        selectedProductModal.promotionalPriceAOA || selectedProductModal.priceAOA,
                        store.currency
                      )}
                    </span>
                    {selectedProductModal.promotionalPriceAOA && (
                      <span className="text-sm line-through text-muted-foreground">
                        {formatCurrency(selectedProductModal.priceAOA, store.currency)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      /{selectedProductModal.unit}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="rounded bg-ok/15 text-ok px-2 py-0.5 font-bold">
                      ✓ {selectedProductModal.stock} unidades disponíveis
                    </span>
                    <span className="text-muted-foreground">
                      Entrega: <strong>{selectedProductModal.estimatedDelivery}</strong>
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                    {selectedProductModal.description}
                  </p>

                  <div className="mt-3 rounded-[var(--radius)] bg-mist/60 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Icon name="ShieldCheck" className="size-4 text-ok" />
                      Garantia de Qualidade Resolve Express
                    </p>
                    <p className="flex items-center gap-1.5 font-medium">
                      <Icon name="Truck" className="size-4 text-action" />
                      Entrega rápida ao domicílio
                    </p>
                  </div>
                </div>

                {/* Quantity & Buy buttons */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">Quantidade:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                        className="size-8 rounded border border-border grid place-items-center font-bold hover:bg-mist"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-sm">
                        {modalQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalQty(modalQty + 1)}
                        className="size-8 rounded border border-border grid place-items-center font-bold hover:bg-mist"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Btn
                      kind="ghost"
                      className="min-h-11"
                      onClick={() => {
                        handleAddToCart(selectedProductModal, modalQty);
                        setSelectedProductModal(null);
                      }}
                    >
                      <Icon name="Plus" className="size-4" /> Carrinho
                    </Btn>
                    <Btn
                      kind="action"
                      className="min-h-11"
                      onClick={() => {
                        handleAddToCart(selectedProductModal, modalQty);
                        setSelectedProductModal(null);
                        setCheckoutModalOpen(true);
                      }}
                    >
                      Comprar Já
                    </Btn>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Suggestions / Recomendações */}
            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="grid size-6 place-items-center rounded-full bg-action/20 text-action">
                  <Icon name="Sparkles" className="size-3.5" />
                </span>
                <h3 className="font-display text-base font-bold text-primary">
                  Sugestões para Si · Produtos Relacionados
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {getSuggestedProducts(selectedProductModal).map((sugg) => (
                  <div
                    key={sugg.id}
                    onClick={() => {
                      setSelectedProductModal(sugg);
                      setModalQty(1);
                    }}
                    className="group flex flex-col justify-between rounded-[var(--radius)] border border-border bg-paper p-3 text-left transition hover:border-action/40 hover:shadow-xs cursor-pointer"
                  >
                    <div className="flex gap-2.5 items-center">
                      <img
                        src={sugg.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                        alt={sugg.name}
                        className="size-12 rounded object-cover border border-border shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-action font-bold uppercase truncate block">
                          {sugg.category}
                        </span>
                        <h4 className="text-xs font-bold text-primary truncate group-hover:text-action transition-colors">
                          {sugg.name}
                        </h4>
                        <span className="font-display font-black text-xs text-primary mt-0.5 block">
                          {kz(sugg.promotionalPriceAOA || sugg.priceAOA)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(sugg, 1);
                      }}
                      className="mt-2 w-full rounded bg-mist hover:bg-primary hover:text-white py-1 text-[11px] font-bold text-primary transition flex items-center justify-center gap-1"
                    >
                      <Icon name="Plus" className="size-3" /> + Carrinho
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-md flex-col bg-paper p-6 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Icon name="ShoppingBasket" className="size-6 text-action" />
                <h3 className="font-display text-xl font-black text-primary">
                  O Seu Carrinho ({cartCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-mist"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            {store.cart.length > 0 ? (
              <div className="flex-1 space-y-4 py-4">
                {store.cart.map(({ product, quantity }) => {
                  const unitPrice = product.promotionalPriceAOA || product.priceAOA;
                  return (
                    <div
                      key={product.id}
                      className="flex gap-3 rounded-[var(--radius)] border border-border p-3"
                    >
                      <img
                        src={product.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                        alt={product.name}
                        className="size-16 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-primary truncate">
                          {product.name}
                        </h4>
                        <span className="text-xs text-muted-foreground block truncate">
                          {product.sellerName}
                        </span>
                        <span className="font-bold text-sm text-primary mt-1 block">
                          {formatCurrency(unitPrice * quantity, store.currency)}
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(product.id, -1)}
                            className="grid size-6 place-items-center rounded border border-border text-sm font-bold hover:bg-mist"
                          >
                            -
                          </button>
                          <span className="text-sm font-bold w-4 text-center">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(product.id, 1)}
                            className="grid size-6 place-items-center rounded border border-border text-sm font-bold hover:bg-mist"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(product.id)}
                            className="ml-auto text-xs text-destructive hover:underline"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Coupon in cart */}
                <div className="border-t border-border pt-4">
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Cupão (ex: BEMVINDO10)"
                      className={inputCls + " min-h-9 text-xs flex-1"}
                    />
                    <Btn
                      kind="ink"
                      className="min-h-9 px-3 text-xs"
                      onClick={handleApplyCoupon}
                    >
                      Aplicar
                    </Btn>
                  </div>
                  {couponMsg && (
                    <p
                      className={`text-xs mt-1 font-semibold ${
                        couponMsg.ok ? "text-ok" : "text-destructive"
                      }`}
                    >
                      {couponMsg.text}
                    </p>
                  )}
                </div>

                {/* Totals */}
                <div className="rounded-[var(--radius)] bg-mist p-4 text-sm space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal produtos:</span>
                    <span>{formatCurrency(subtotalAOA, store.currency)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa de entrega no Huambo:</span>
                    <span>{formatCurrency(deliveryFeeAOA, store.currency)}</span>
                  </div>
                  {discountAOA > 0 && (
                    <div className="flex justify-between text-ok font-semibold">
                      <span>Desconto aplicado:</span>
                      <span>-{formatCurrency(discountAOA, store.currency)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-base text-primary">
                    <span>Total da Encomenda:</span>
                    <span className="font-display font-black text-xl text-action">
                      {formatCurrency(finalTotalAOA, store.currency)}
                    </span>
                  </div>
                </div>

                <Btn
                  kind="action"
                  className="w-full mt-4"
                  onClick={() => {
                    if (!store.currentUser) {
                      setAuthModal({ open: true, type: "buy" });
                      return;
                    }
                    setCheckoutModalOpen(true);
                  }}
                >
                  Finalizar Compra
                </Btn>
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <Icon name="ShoppingBasket" className="mx-auto size-12 opacity-40 mb-3" />
                <p className="font-bold text-primary">O seu carrinho está vazio</p>
                <p className="text-xs mt-1">Adicione produtos do catálogo acima para encomendar.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal com Suporte para Todas as Províncias de Angola */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-6 shadow-2xl">
            <h3 className="font-display text-2xl font-black text-primary">
              Finalizar Encomenda de Produtos
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Confirme a província, município e morada de entrega em Angola.
            </p>

            <div className="my-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Província (Angola)">
                  <select
                    value={deliveryProvince}
                    onChange={(e) => {
                      const newProv = e.target.value;
                      setDeliveryProvince(newProv);
                      const munList = ANGOLA_PROVINCES.find((p) => p.name.toLowerCase() === newProv.toLowerCase())?.municipalities;
                      if (munList && munList.length > 0) {
                        setDeliveryMunicipio(munList[0]);
                      }
                    }}
                    className={inputCls}
                  >
                    {ANGOLA_PROVINCES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Município">
                  <select
                    value={deliveryMunicipio}
                    onChange={(e) => setDeliveryMunicipio(e.target.value)}
                    className={inputCls}
                  >
                    {currentDeliveryMunicipalities.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Bairro">
                <input
                  value={deliveryBairro}
                  onChange={(e) => setDeliveryBairro(e.target.value)}
                  placeholder="Ex: Cidade Alta, São João, Maianga..."
                  className={inputCls}
                />
              </Field>

              <Field label="Rua / Número / Referência">
                <input
                  value={deliveryRua}
                  onChange={(e) => setDeliveryRua(e.target.value)}
                  placeholder="Ex: Rua do Comércio nº 45, próximo à agência..."
                  className={inputCls}
                />
              </Field>

              <div className="rounded-[var(--radius)] bg-mist p-3.5 text-sm flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Icon name="CreditCard" className="size-4 text-action" />
                  <span className="font-bold text-xs text-primary">Total com Entrega:</span>
                </div>
                <span className="font-display font-black text-xl text-primary">
                  {formatCurrency(finalTotalAOA, store.currency)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Btn kind="ghost" onClick={() => setCheckoutModalOpen(false)}>
                Voltar
              </Btn>
              <Btn kind="action" onClick={handleProceedToPayment}>
                <Icon name="ArrowRight" className="size-4" /> Avançar para Pagamento
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Interativo para Todos os Métodos de Pagamento */}
      <PaymentCheckoutModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Pagamento da Encomenda"
        itemType="order"
        itemId={pendingOrderData?.id || nextOrderId(store.orderSeq + 1)}
        totalAOA={finalTotalAOA}
        customerName={store.currentUser?.name || "Cliente Resolve"}
        customerPhone={store.currentUser?.phone || "923111222"}
        deliveryAddress={pendingOrderData?.address}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Completed Order Confirmation */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-ok text-white">
              <Icon name="Check" className="size-8" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-action block mb-1">
              ENCOMENDA REGISTADA COM SUCESSO
            </span>
            <h3 className="font-display text-2xl font-black text-primary">
              {completedOrder.id}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A sua encomenda foi enviada aos vendedores e estafetas da Resolve Express.
            </p>

            <div className="my-4 rounded-[var(--radius)] bg-mist p-4 text-left text-xs space-y-1.5">
              <p>📍 <strong>Entrega:</strong> {completedOrder.deliveryAddress}</p>
              <p>⏰ <strong>Prazo:</strong> {completedOrder.estimatedDelivery}</p>
              <p>💳 <strong>Método:</strong> {completedOrder.paymentMethod}</p>
              <p>
                📊 <strong>Estado do Pagamento:</strong>{" "}
                <span
                  className={
                    "px-2 py-0.5 rounded font-bold " +
                    (completedOrder.paymentStatus === "Pago"
                      ? "bg-ok/15 text-ok"
                      : "bg-warn/20 text-warn")
                  }
                >
                  {completedOrder.paymentStatus}
                </span>
              </p>
              {completedOrder.paymentReference && (
                <p>
                  🔖 <strong>Referência:</strong>{" "}
                  <span className="font-mono font-bold text-primary">
                    {completedOrder.paymentReference}
                  </span>
                </p>
              )}
              <p>💰 <strong>Total:</strong> {kz(completedOrder.totalAOA)}</p>
            </div>

            <div className="flex flex-col gap-2">
              {completedOrder.paymentStatus !== "Pago" && (
                <Btn
                  kind="action"
                  onClick={() => {
                    setPendingOrderData({
                      id: completedOrder.id,
                      address: completedOrder.deliveryAddress,
                      bairro: completedOrder.deliveryBairro,
                      sellers: completedOrder.sellerNames,
                    });
                    setPaymentModalOpen(true);
                  }}
                >
                  <Icon name="CreditCard" className="size-4" /> Reabrir Dados / Pagar Agora
                </Btn>
              )}
              <Btn
                kind="ink"
                onClick={() => {
                  setCompletedOrder(null);
                  go("/portal-cliente");
                }}
              >
                Acompanhar no Portal do Cliente
              </Btn>
              <Btn
                kind="ghost"
                onClick={() => setCompletedOrder(null)}
              >
                Continuar a Comprar
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso Obrigatório para Criar Conta / Iniciar Sessão */}
      <AuthPromptModal
        open={authModal.open}
        onClose={() => setAuthModal((m) => ({ ...m, open: false }))}
        actionType={authModal.type}
        itemName={authModal.itemName}
      />
      </Section>
    </div>
  );
}
