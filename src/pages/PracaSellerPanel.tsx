import React, { useState, useMemo } from "react";
import { Icon, go, Btn, Field, inputCls, Section } from "../ui/kit";
import {
  type Product,
  type SellerRecord,
  type PracaCategory,
  type PracaPayoutRequest,
  ANGOLA_BANKS,
  ANGOLA_PROVINCES,
} from "../lib/data";
import {
  useStore,
  formatCurrency,
  kz,
  type StoreState,
  type ProductOrderRecord,
} from "../lib/store";
import { ImageUploader } from "../ui/ImageUploader";

export function PracaSellerPanel({ initialTab = "overview" }: { initialTab?: string }) {
  const [store, setStore] = useStore();
  const [tab, setTab] = useState<"overview" | "products" | "orders" | "finances" | "calculadora" | "settings">(
    (initialTab as any) || "overview"
  );

  // Current logged in seller profile or fallback to demo seller
  const currentSeller: SellerRecord = useMemo(() => {
    if (store.currentUser) {
      const match = store.sellers.find(
        (s) => s.userId === store.currentUser?.id || s.email === store.currentUser?.email
      );
      if (match) return match;
    }
    // Default to the first demo seller
    return store.sellers[0];
  }, [store.currentUser, store.sellers]);

  // Seller's products
  const sellerProducts = useMemo(() => {
    return store.products.filter(
      (p) => p.sellerId === currentSeller.id || p.sellerName === currentSeller.storeName
    );
  }, [store.products, currentSeller]);

  // Seller's orders
  const sellerOrders = useMemo(() => {
    return store.productOrders.filter(
      (o) =>
        o.sellerId === currentSeller.id ||
        o.sellerNames?.includes(currentSeller.storeName) ||
        o.items.some(
          (item) => item.product.sellerId === currentSeller.id || item.product.sellerName === currentSeller.storeName
        )
    );
  }, [store.productOrders, currentSeller]);

  // Product Add/Edit Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Form Fields
  const [pName, setPName] = useState("");
  const [pCategory, setPCategory] = useState("Moda e Vestuário");
  const [pSubcategory, setPSubcategory] = useState("");
  const [pShortDesc, setPShortDesc] = useState("");
  const [pDescription, setPDescription] = useState("");
  const [pPrice, setPPrice] = useState<number>(10000);
  const [pPromoPrice, setPPromoPrice] = useState<number | undefined>(undefined);
  const [pStock, setPStock] = useState<number>(10);
  const [pSku, setPSku] = useState("");
  const [pBrand, setPBrand] = useState("");
  const [pCondition, setPCondition] = useState<"NOVO" | "USADO">("NOVO");
  const [pImage, setPImage] = useState("");
  const [pImageFit, setPImageFit] = useState<"cover" | "contain">("cover");
  const [pUnit, setPUnit] = useState("unidade");
  const [pDeliveryLocation, setPDeliveryLocation] = useState("Huambo (Todos os bairros)");
  const [pEstimatedDelivery, setPEstimatedDelivery] = useState("30 a 60 minutos");
  const [pDeliveryOption, setPDeliveryOption] = useState<"DELIVERY" | "PICKUP" | "BOTH">("BOTH");
  const [pWarranty, setPWarranty] = useState("");

  // Commission calculations state
  const platformRate = currentSeller.commissionRate || store.pracaSettings?.defaultPlatformCommission || 10;
  const affiliateRate = currentSeller.affiliateCommissionRate || store.pracaSettings?.defaultAffiliateCommission || 5;

  // Real-time Calculator Helpers
  const calcPlatformFee = Math.max(0, Math.round((Number(pPrice || 0) * platformRate) / 100));
  const calcAffiliateFee = Math.max(0, Math.round((Number(pPrice || 0) * affiliateRate) / 100));
  const calcSellerNet = Math.max(0, Number(pPrice || 0) - calcPlatformFee - calcAffiliateFee);

  // Reset & Open Create Product
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setPName("");
    setPCategory("Moda e Vestuário");
    setPSubcategory("");
    setPShortDesc("");
    setPDescription("");
    setPPrice(10000);
    setPPromoPrice(undefined);
    setPStock(10);
    setPSku(`SKU-${Date.now().toString().slice(-6)}`);
    setPBrand("");
    setPCondition("NOVO");
    setPImage("https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80");
    setPImageFit("cover");
    setPUnit("unidade");
    setPDeliveryLocation("Huambo");
    setPEstimatedDelivery("30 a 60 minutos");
    setPDeliveryOption("BOTH");
    setPWarranty("");
    setShowProductModal(true);
  };

  // Open Edit Product
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setPName(prod.name);
    setPCategory(prod.category);
    setPSubcategory(prod.subcategory || "");
    setPShortDesc(prod.badge || "");
    setPDescription(prod.description);
    setPPrice(prod.priceAOA);
    setPPromoPrice(prod.promotionalPriceAOA);
    setPStock(prod.stock);
    setPSku(prod.sku || `SKU-${prod.id}`);
    setPBrand(prod.brand || "");
    setPCondition(prod.condition || "NOVO");
    setPImage(prod.image);
    setPImageFit(prod.imageFit || "cover");
    setPUnit(prod.unit || "unidade");
    setPDeliveryLocation(prod.deliveryLocation || "Huambo");
    setPEstimatedDelivery(prod.estimatedDelivery || "30 a 60 minutos");
    setPDeliveryOption(prod.deliveryOption || "BOTH");
    setPWarranty(prod.warranty || "");
    setShowProductModal(true);
  };

  // Save Product (Create or Edit)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || pPrice <= 0) return;

    const matchedCat = store.pracaCategories?.find(
      (c) => c.name.toLowerCase() === pCategory.toLowerCase()
    );

    if (editingProduct && editingProduct.id) {
      // Edit existing
      setStore((st) => ({
        products: st.products.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: pName.trim(),
                category: pCategory,
                pracaCategoryId: matchedCat?.id || p.pracaCategoryId,
                subcategory: pSubcategory.trim() || undefined,
                description: pDescription.trim(),
                priceAOA: Number(pPrice),
                promotionalPriceAOA: pPromoPrice ? Number(pPromoPrice) : undefined,
                stock: Number(pStock),
                sku: pSku.trim(),
                brand: pBrand.trim(),
                condition: pCondition,
                image: pImage.trim(),
                imageFit: pImageFit,
                unit: pUnit.trim(),
                deliveryLocation: pDeliveryLocation.trim(),
                estimatedDelivery: pEstimatedDelivery.trim(),
                deliveryOption: pDeliveryOption,
                warranty: pWarranty.trim() || undefined,
                badge: pShortDesc.trim() || undefined,
                platformCommissionRate: platformRate,
                affiliateCommissionRate: affiliateRate,
              }
            : p
        ),
      }));
    } else {
      // Create new
      const newProd: Product = {
        id: `PRACA-PROD-${Date.now()}`,
        name: pName.trim(),
        category: pCategory,
        pracaCategoryId: matchedCat?.id,
        subcategory: pSubcategory.trim() || undefined,
        description: pDescription.trim(),
        priceAOA: Number(pPrice),
        promotionalPriceAOA: pPromoPrice ? Number(pPromoPrice) : undefined,
        available: true,
        stock: Number(pStock),
        sellerName: currentSeller.storeName,
        sellerId: currentSeller.id,
        sellerType: "PRACA_SELLER",
        image: pImage.trim(),
        imageFit: pImageFit,
        sku: pSku.trim(),
        brand: pBrand.trim(),
        condition: pCondition,
        unit: pUnit.trim(),
        deliveryLocation: pDeliveryLocation.trim(),
        estimatedDelivery: pEstimatedDelivery.trim(),
        deliveryOption: pDeliveryOption,
        warranty: pWarranty.trim() || undefined,
        badge: pShortDesc.trim() || undefined,
        isPraca: true,
        rating: 5.0,
        reviewsCount: 1,
        platformCommissionRate: platformRate,
        affiliateCommissionRate: affiliateRate,
        status: "ATIVO",
      };

      setStore((st) => ({
        products: [newProd, ...st.products],
      }));
    }

    setShowProductModal(false);
  };

  // Toggle Product Visibility
  const handleToggleProduct = (prodId: string) => {
    setStore((st) => ({
      products: st.products.map((p) =>
        p.id === prodId ? { ...p, available: !p.available } : p
      ),
    }));
  };

  // Archive Product (does not delete sales history)
  const handleArchiveProduct = (prodId: string) => {
    setStore((st) => ({
      products: st.products.map((p) =>
        p.id === prodId ? { ...p, status: "ARQUIVADO" as const, available: false } : p
      ),
    }));
  };

  // Update Stock Delta
  const handleUpdateStock = (prodId: string, delta: number) => {
    setStore((st) => ({
      products: st.products.map((p) =>
        p.id === prodId ? { ...p, stock: Math.max(0, p.stock + delta) } : p
      ),
    }));
  };

  // Update Order Status
  const handleUpdateOrderStatus = (
    orderId: string,
    newStatus: ProductOrderRecord["orderStatus"]
  ) => {
    setStore((st) => ({
      productOrders: st.productOrders.map((o) =>
        o.id === orderId ? { ...o, orderStatus: newStatus } : o
      ),
    }));
  };

  // Payout request modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<number>(currentSeller.netBalanceAOA || 50000);
  const [payoutMethod, setPayoutMethod] = useState<"TRANSFERENCIA_BANCARIA" | "MULTICAIXA_EXPRESS">("TRANSFERENCIA_BANCARIA");
  const [payoutBank, setPayoutBank] = useState("Banco BAI");
  const [payoutIban, setPayoutIban] = useState(currentSeller.bankAccount?.iban || "AO06.0040.0000.1234.5678.9012.3");
  const [payoutHolder, setPayoutHolder] = useState(currentSeller.ownerName || currentSeller.storeName);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutAmount <= 0 || payoutAmount > currentSeller.netBalanceAOA) return;

    const newRequest: PracaPayoutRequest = {
      id: `PAY-PRACA-${Date.now().toString().slice(-6)}`,
      requesterType: "SELLER",
      requesterId: currentSeller.id,
      requesterName: currentSeller.ownerName,
      storeOrAffiliateName: currentSeller.storeName,
      amountAOA: Number(payoutAmount),
      method: payoutMethod,
      bankName: payoutBank,
      iban: payoutIban,
      accountHolder: payoutHolder,
      status: "PENDENTE",
      createdAt: new Date().toISOString(),
    };

    setStore((st) => ({
      pracaPayoutRequests: [newRequest, ...st.pracaPayoutRequests],
      sellers: st.sellers.map((s) =>
        s.id === currentSeller.id
          ? {
              ...s,
              netBalanceAOA: Math.max(0, s.netBalanceAOA - Number(payoutAmount)),
              pendingBalanceAOA: s.pendingBalanceAOA + Number(payoutAmount),
            }
          : s
      ),
    }));

    setPayoutSuccess(true);
    setTimeout(() => {
      setPayoutSuccess(false);
      setShowPayoutModal(false);
    }, 2000);
  };

  // Performance chart period filter
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month" | "year">("month");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header do Painel */}
      <div className="bg-gradient-to-r from-primary via-slate-900 to-[#12365A] text-white pt-6 pb-12 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="size-14 rounded-2xl overflow-hidden bg-white p-0.5 border-2 border-action shadow-md">
                <img
                  src={currentSeller.logo?.trim() || "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=120"}
                  alt={currentSeller.storeName}
                  className="h-full w-full object-cover rounded-xl"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-xl sm:text-2xl font-black text-white">
                    {currentSeller.storeName}
                  </h1>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    Vendedor Verificado
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Gerido por: <strong className="text-white">{currentSeller.ownerName}</strong> · {currentSeller.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCreateProduct}
                className="inline-flex items-center gap-1.5 rounded-xl bg-action px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:brightness-110 shadow-md transition"
              >
                <Icon name="PlusCircle" className="size-4" />
                <span>Adicionar Produto</span>
              </button>
              <button
                type="button"
                onClick={() => go("/praca")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:text-white border border-white/20 transition"
              >
                <Icon name="ExternalLink" className="size-3.5" />
                <span className="hidden sm:inline">Ver Loja na Praça</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Navegação do Painel */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => setTab("overview")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "overview"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon name="LayoutDashboard" className="size-4" />
              <span>Visão Geral</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("products")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "products"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon name="Package" className="size-4" />
              <span>Meus Produtos ({sellerProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "orders"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon name="ShoppingBasket" className="size-4" />
              <span>Pedidos da Loja ({sellerOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("finances")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "finances"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon name="Wallet" className="size-4" />
              <span>Finanças & Levantamentos</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("calculadora")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                tab === "calculadora"
                  ? "bg-action text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon name="Calculator" className="size-4" />
              <span>Calculadora de Margem</span>
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
                  <span>Receita Bruta Total</span>
                  <Icon name="TrendingUp" className="size-4 text-emerald-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-primary dark:text-white">
                  {kz(currentSeller.totalGrossAOA)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">{currentSeller.totalSalesCount} vendas realizadas</p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                  <span>Saldo Disponível</span>
                  <Icon name="CheckCircle2" className="size-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-600">
                  {kz(currentSeller.netBalanceAOA)}
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
                  <span>Saldo Pendente</span>
                  <Icon name="Clock" className="size-4 text-amber-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-amber-600">
                  {kz(currentSeller.pendingBalanceAOA)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Liquidação em 24h a 48h</p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                  <span>Comissão ResolveExpress</span>
                  <Icon name="Percent" className="size-4 text-action" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-200">
                  {kz(currentSeller.totalPlatformCommissionAOA)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Taxa média de {platformRate}%</p>
              </div>
            </div>

            {/* Performance Chart Simulation (Day, Week, Month, Year) */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-primary dark:text-white">
                    Desempenho de Vendas da Loja
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Acompanhamento de receita bruta e comissões deduzidas
                  </p>
                </div>

                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChartPeriod("day")}
                    className={`px-3 py-1 rounded-lg transition ${
                      chartPeriod === "day" ? "bg-white dark:bg-slate-700 text-primary shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Dia
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartPeriod("week")}
                    className={`px-3 py-1 rounded-lg transition ${
                      chartPeriod === "week" ? "bg-white dark:bg-slate-700 text-primary shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartPeriod("month")}
                    className={`px-3 py-1 rounded-lg transition ${
                      chartPeriod === "month" ? "bg-white dark:bg-slate-700 text-primary shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartPeriod("year")}
                    className={`px-3 py-1 rounded-lg transition ${
                      chartPeriod === "year" ? "bg-white dark:bg-slate-700 text-primary shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Ano
                  </button>
                </div>
              </div>

              {/* Gráfico Visual em Barras Responsivas */}
              <div className="h-48 sm:h-56 w-full flex items-end gap-2 sm:gap-4 pt-4 border-b border-slate-100 dark:border-slate-800">
                {[
                  { label: "Seg", val: 45000, height: "45%" },
                  { label: "Ter", val: 78000, height: "70%" },
                  { label: "Qua", val: 32000, height: "35%" },
                  { label: "Qui", val: 110000, height: "95%" },
                  { label: "Sex", val: 92000, height: "82%" },
                  { label: "Sáb", val: 125000, height: "100%" },
                  { label: "Dom", val: 54000, height: "50%" },
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-action transition opacity-0 group-hover:opacity-100">
                      {kz(item.val)}
                    </span>
                    <div
                      style={{ height: item.height }}
                      className="w-full rounded-t-xl bg-gradient-to-t from-primary to-action group-hover:brightness-110 transition-all duration-300"
                    />
                    <span className="text-xs font-bold text-slate-500 mt-1">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-action" />
                    Receita Bruta (Vendas)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                    Valor Líquido Recebido
                  </span>
                </div>
                <span>Total no período: <strong>{kz(536000)}</strong></span>
              </div>
            </div>

            {/* Produtos Mais Vendidos da Loja */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <h3 className="font-display text-base font-bold text-primary dark:text-white mb-4">
                Top Produtos Mais Vendidos
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sellerProducts.slice(0, 4).map((prod) => (
                  <div key={prod.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={prod.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                        alt={prod.name}
                        className="size-12 rounded-xl object-cover shrink-0 border"
                      />
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-primary dark:text-white">
                          {prod.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {prod.category} · Stock: {prod.stock} {prod.unit}s
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm text-primary dark:text-white">
                        {kz(prod.promotionalPriceAOA || prod.priceAOA)}
                      </p>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Alta Procura
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GESTÃO DE PRODUTOS */}
        {tab === "products" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-primary dark:text-white">
                  Catálogo de Produtos da Loja
                </h2>
                <p className="text-xs text-muted-foreground">
                  Adicione, edite preços, ajuste stocks e calcule as margens da sua loja
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateProduct}
                className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:brightness-105 shadow-md"
              >
                <Icon name="PlusCircle" className="size-4" />
                <span>Adicionar Novo Produto</span>
              </button>
            </div>

            {/* Tabela de Produtos */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Produto</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3">Preço</th>
                    <th className="py-3 px-3">Comissão Plataforma</th>
                    <th className="py-3 px-3">Líquido Vendedor</th>
                    <th className="py-3 px-3 text-center">Stock</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sellerProducts.map((prod) => {
                    const price = prod.promotionalPriceAOA || prod.priceAOA;
                    const fee = Math.round((price * platformRate) / 100);
                    const net = price - fee;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={prod.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                              alt={prod.name}
                              className="size-10 rounded-lg object-cover shrink-0 border"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-primary dark:text-white truncate max-w-[200px]">
                                {prod.name}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                SKU: {prod.sku || prod.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate block max-w-[130px]">
                            {prod.category}
                          </span>
                          {prod.subcategory && (
                            <span className="text-[10px] text-muted-foreground">
                              {prod.subcategory}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          {kz(price)}
                        </td>

                        <td className="py-3 px-3 text-action font-semibold">
                          {kz(fee)} ({platformRate}%)
                        </td>

                        <td className="py-3 px-3 font-black text-emerald-600">
                          {kz(net)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateStock(prod.id, -1)}
                              className="text-slate-400 hover:text-slate-600 px-1 font-bold"
                            >
                              -
                            </button>
                            <span className="font-bold min-w-[20px] text-center">{prod.stock}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateStock(prod.id, 1)}
                              className="text-slate-400 hover:text-slate-600 px-1 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleProduct(prod.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                              prod.available
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {prod.available ? "Ativo" : "Oculto"}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(prod)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-action transition"
                              title="Editar Produto"
                            >
                              <Icon name="Edit" className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchiveProduct(prod.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                              title="Arquivar Produto"
                            >
                              <Icon name="Archive" className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: GESTÃO DE PEDIDOS */}
        {tab === "orders" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-primary dark:text-white">
                Encomendas Recebidas
              </h2>
              <p className="text-xs text-muted-foreground">
                Acompanhe o estado de preparação e entrega dos pedidos dos seus clientes
              </p>
            </div>

            {sellerOrders.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-300 p-12 text-center bg-white dark:bg-slate-900">
                <Icon name="ShoppingBasket" className="size-12 text-slate-400 mx-auto mb-2" />
                <h3 className="font-bold text-base text-primary dark:text-white">Sem pedidos pendentes</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Os novos pedidos dos clientes aparecerão aqui com notificações automáticas.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-action">
                            {order.id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {new Date(order.createdAt).toLocaleString("pt-AO")}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-primary dark:text-white mt-0.5">
                          Cliente: {order.customerName} ({order.customerPhone})
                        </p>
                        <p className="text-xs text-slate-500">
                          Entrega: {order.deliveryAddress}, {order.deliveryBairro}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">Estado do Pedido:</span>
                        <select
                          value={order.orderStatus}
                          onChange={(e: any) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-primary dark:text-white outline-none"
                        >
                          <option value="Recebida">Recebida</option>
                          <option value="Confirmada">Confirmada</option>
                          <option value="Em preparação">Em preparação</option>
                          <option value="A caminho">A caminho / Em entrega</option>
                          <option value="Entregue">Entregue / Concluída</option>
                          <option value="Cancelada">Cancelada</option>
                        </select>
                      </div>
                    </div>

                    {/* Itens do Pedido */}
                    <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-action">{item.quantity}x</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.product.name}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {kz((item.product.promotionalPriceAOA || item.product.priceAOA) * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Pagamento: <strong>{order.paymentMethod}</strong> ({order.paymentStatus})
                      </span>
                      <div className="text-right">
                        <span className="text-muted-foreground mr-2">Total da Encomenda:</span>
                        <span className="font-display text-base font-black text-primary dark:text-white">
                          {kz(order.totalAOA)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FINANÇAS & LEVANTAMENTOS */}
        {tab === "finances" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-primary dark:text-white">
                  Carteira e Liquidações
                </h2>
                <p className="text-xs text-muted-foreground">
                  Livro de liquidações transparente com transferências bancárias reais
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

            {/* Balanço de Contas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Saldo Disponível para Levantamento</p>
                <p className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-300">
                  {kz(currentSeller.netBalanceAOA)}
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">Livre de encargos e pronto a transferir</p>
              </div>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Pendente de Liquidação</p>
                <p className="mt-2 text-3xl font-black text-amber-700 dark:text-amber-300">
                  {kz(currentSeller.pendingBalanceAOA)}
                </p>
                <p className="text-[11px] text-amber-600 mt-1">Aguardando entrega de encomendas</p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <p className="text-xs font-bold text-slate-500">Total Já Transferido</p>
                <p className="mt-2 text-3xl font-black text-primary dark:text-white">
                  {kz(345000 - currentSeller.netBalanceAOA - currentSeller.pendingBalanceAOA)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Concluído via BAI / BFA</p>
              </div>
            </div>

            {/* Histórico de Pedidos de Levantamento */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <h3 className="font-display text-base font-bold text-primary dark:text-white mb-4">
                Histórico de Pedidos de Levantamento
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Método & Conta</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Comprovativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {store.pracaPayoutRequests
                      .filter((p) => p.requesterId === currentSeller.id)
                      .map((req) => (
                        <tr key={req.id}>
                          <td className="py-3 px-3 font-mono font-bold text-action">{req.id}</td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{kz(req.amountAOA)}</td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{req.bankName}</span>
                            <span className="block text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">{req.iban}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{new Date(req.createdAt).toLocaleDateString("pt-AO")}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                req.status === "PAGO"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : req.status === "PENDENTE"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {req.status === "PAGO" ? (
                              <span className="text-[11px] font-bold text-action hover:underline cursor-pointer flex items-center justify-end gap-1">
                                <Icon name="FileText" className="size-3.5" /> Recibo BAI
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Em validação</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CALCULADORA DEDICADA DE COMISSÃO E MARGEM */}
        {tab === "calculadora" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-primary dark:text-white flex items-center gap-2">
                <Icon name="Calculator" className="size-5 text-action" />
                Calculadora Automática de Comissões e Margem
              </h2>
              <p className="text-xs text-muted-foreground">
                Simule preços de venda e visualize exatamente quanto fica para a sua loja e para a plataforma
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Preço de Venda do Produto (Kz):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-sm font-black text-slate-400">Kz</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={pPrice}
                    onChange={(e) => setPPrice(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-3 pl-10 pr-4 text-lg font-black text-primary dark:text-white outline-none focus:border-action"
                  />
                </div>
              </div>

              {/* Resultado Detalhado */}
              <div className="rounded-2xl border border-action/30 bg-action/5 p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-action/20">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Preço do Produto:</span>
                  <span className="font-display text-base font-black text-primary dark:text-white">{kz(pPrice)}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Comissão RESOLVEEXPRESS ({platformRate}%):
                  </span>
                  <span className="font-bold text-action">-{kz(calcPlatformFee)}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Comissão de Afiliados ({affiliateRate}%):
                  </span>
                  <span className="font-bold text-slate-600 dark:text-slate-300">-{kz(calcAffiliateFee)}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t-2 border-dashed border-action/30 text-sm">
                  <span className="font-bold text-primary dark:text-white">Valor Líquido Estimado do Vendedor:</span>
                  <span className="font-display text-xl font-black text-emerald-600">{kz(calcSellerNet)}</span>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-100 dark:bg-slate-800/60 p-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
                <p className="font-bold text-primary dark:text-white flex items-center gap-1.5">
                  <Icon name="Info" className="size-4 text-action" />
                  Transparência Contratual ResolveExpress:
                </p>
                <p>
                  "Por cada venda concluída por este preço, a RESOLVEEXPRESS receberá {kz(calcPlatformFee)} de comissão. O valor restante de {kz(calcSellerNet)} será destinado ao vendedor, sujeito a eventuais custos de devolução acordados previamente."
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL ADICIONAR / EDITAR PRODUTO (Com Calculadora em Tempo Real e ImageUploader) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <button
              type="button"
              onClick={() => setShowProductModal(false)}
              className="absolute right-4 top-4 size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 grid place-items-center"
            >
              <Icon name="X" className="size-4" />
            </button>

            <h3 className="font-display text-xl font-black text-primary dark:text-white mb-1">
              {editingProduct ? "Editar Produto da Praça" : "Publicar Novo Produto na Praça"}
            </h3>
            <p className="text-xs text-muted-foreground mb-5">
              Preencha os detalhes e acompanhe a calculadora automática de comissões em tempo real.
            </p>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-foreground mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Ex: Vestido Samakaka Tradicional Elegante"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Categoria Principal *</label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    className={inputCls}
                  >
                    {store.pracaCategories?.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Subcategoria</label>
                  <input
                    type="text"
                    value={pSubcategory}
                    onChange={(e) => setPSubcategory(e.target.value)}
                    placeholder="Ex: Mulher, Roupas, Sneakers..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Preço Normal de Venda (Kz) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="100"
                    value={pPrice}
                    onChange={(e) => setPPrice(Math.max(0, Number(e.target.value)))}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Preço Promocional (Opcional)</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={pPromoPrice || ""}
                    onChange={(e) => setPPromoPrice(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Ex: 8500"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Quantidade em Stock *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={pStock}
                    onChange={(e) => setPStock(Math.max(0, Number(e.target.value)))}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Condição do Produto</label>
                  <select
                    value={pCondition}
                    onChange={(e: any) => setPCondition(e.target.value)}
                    className={inputCls}
                  >
                    <option value="NOVO">Novo (Em embalagem selada)</option>
                    <option value="USADO">Usado / Recondicionado com garantia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Código / SKU</label>
                  <input
                    type="text"
                    value={pSku}
                    onChange={(e) => setPSku(e.target.value)}
                    placeholder="Ex: MOD-SAM-001"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Marca / Fabricante</label>
                  <input
                    type="text"
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                    placeholder="Ex: Samakaka Design, HP, Nike..."
                    className={inputCls}
                  />
                </div>
              </div>

              {/* UPLOAD DE IMAGEM COM SERVIDOR E REDIMENSIONAMENTO */}
              <div>
                <ImageUploader
                  label="Fotografia Principal do Produto *"
                  value={pImage}
                  onChange={(url) => setPImage(url)}
                  fitMode={pImageFit}
                  onFitModeChange={(f) => setPImageFit(f)}
                  helperText="Faça upload direto do seu dispositivo ou cole um link da web. O sistema adapta a imagem automaticamente."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Descrição Completa *</label>
                <textarea
                  required
                  rows={3}
                  value={pDescription}
                  onChange={(e) => setPDescription(e.target.value)}
                  placeholder="Descreva as características, materiais, garantia e condições de entrega..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs outline-none focus:border-action"
                />
              </div>

              {/* CALCULADORA OBRIGATÓRIA EM TEMPO REAL DENTRO DO FORMULÁRIO */}
              <div className="rounded-2xl border-2 border-action/30 bg-action/5 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-primary dark:text-white pb-1.5 border-b border-action/20">
                  <span className="flex items-center gap-1.5">
                    <Icon name="Calculator" className="size-4 text-action" />
                    Cálculo Automático da Venda:
                  </span>
                  <span className="text-[11px] text-action font-black">Preço: {kz(pPrice)}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Comissão Resolve</p>
                    <p className="font-black text-action mt-0.5">{kz(calcPlatformFee)} ({platformRate}%)</p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Comissão Afiliado</p>
                    <p className="font-black text-slate-700 dark:text-slate-300 mt-0.5">{kz(calcAffiliateFee)} ({affiliateRate}%)</p>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300">
                    <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-bold">Líquido Vendedor</p>
                    <p className="font-black text-emerald-600 text-sm mt-0.5">{kz(calcSellerNet)}</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 pt-1">
                  "Por cada venda concluída por este preço, a RESOLVEEXPRESS receberá {kz(calcPlatformFee)} de comissão. O valor restante de {kz(calcSellerNet)} será destinado ao vendedor."
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-action px-6 py-2.5 text-xs font-bold text-white hover:brightness-105 shadow-md"
                >
                  {editingProduct ? "Salvar Alterações" : "Publicar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SOLICITAR LEVANTAMENTO */}
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
              Solicitar Levantamento de Saldo
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Transfira o saldo disponível da sua loja para a sua conta bancária angolana.
            </p>

            {payoutSuccess ? (
              <div className="p-6 text-center space-y-2">
                <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto">
                  <Icon name="CheckCircle2" className="size-6" />
                </div>
                <h4 className="font-bold text-emerald-700 text-base">Pedido Submetido com Sucesso!</h4>
                <p className="text-xs text-slate-500">
                  O departamento financeiro processará a transferência nas próximas 24 horas.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Valor a Levantar (Saldo Disponível: {kz(currentSeller.netBalanceAOA)})
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    max={currentSeller.netBalanceAOA}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Método de Levantamento</label>
                  <select
                    value={payoutMethod}
                    onChange={(e: any) => setPayoutMethod(e.target.value)}
                    className={inputCls}
                  >
                    <option value="TRANSFERENCIA_BANCARIA">Transferência Bancária (IBAN)</option>
                    <option value="MULTICAIXA_EXPRESS">Multicaixa Express (Número de Telemóvel)</option>
                  </select>
                </div>

                {payoutMethod === "TRANSFERENCIA_BANCARIA" ? (
                  <>
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
                      <label className="block text-xs font-bold text-foreground mb-1">IBAN da Conta</label>
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
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">Telemóvel Multicaixa Express</label>
                    <input
                      type="text"
                      required
                      value={currentSeller.phone}
                      readOnly
                      className={inputCls}
                    />
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-action py-3 text-xs font-bold text-white hover:brightness-105 shadow-md"
                  >
                    Confirmar Pedido de Levantamento ({kz(payoutAmount)})
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
