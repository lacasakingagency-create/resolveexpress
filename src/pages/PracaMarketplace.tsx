import React, { useState, useMemo, useEffect } from "react";
import { Icon, go, Btn, Field, inputCls, Section } from "../ui/kit";
import {
  type Product,
  type PracaCategory,
  type SellerRecord,
} from "../lib/data";
import {
  useStore,
  formatCurrency,
  kz,
  type StoreState,
} from "../lib/store";
import { PaymentCheckoutModal } from "../ui/PaymentCheckoutModal";
import { AuthPromptModal } from "../ui/AuthPromptModal";

const PROVINCES_MAP: Record<string, string[]> = {
  Huambo: ["Huambo (Sede)", "Caála", "Bailundo", "Cachiungo", "Ekunha", "Londuimbali", "Longonjo", "Mungo", "Tchicala Tcholohanga", "Ucuma"],
  Luanda: ["Luanda (Ingombota)", "Talatona", "Viana", "Belas", "Kilamba Kiaxi", "Cazenga", "Cacuaco", "Icolo e Bengo"],
  Benguela: ["Benguela", "Lobito", "Catumbela", "Baía Farta", "Ganda", "Cubal"],
  Huíla: ["Lubango", "Humpata", "Chibia", "Matala", "Quilengues"],
  Cabinda: ["Cabinda", "Cacongo", "Buco-Zau", "Belize"],
  "Cuanza Sul": ["Sumbe", "Porto Amboim", "Gabela", "Waku Kungo", "Libolo"],
};

export function PracaMarketplace({
  initialCategory,
  initialProductModalId,
}: {
  initialCategory?: string;
  initialProductModalId?: string;
}) {
  const [store, setStore] = useStore();
  const [selectedCatId, setSelectedCatId] = useState<string>(initialCategory || "all");
  const [selectedSubcat, setSelectedSubcat] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<"all" | "NOVO" | "USADO">("all");
  const [selectedSort, setSelectedSort] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [selectedPriceRange, setSelectedPriceRange] = useState<"all" | "under10k" | "10k_50k" | "50k_150k" | "above150k">("all");
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>("all");

  // Cascaded Location & Origin Filters (PARTE 5)
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("all");
  const [selectedOrigin, setSelectedOrigin] = useState<string>("all");
  const [selectedAvailability, setSelectedAvailability] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Selected product modal
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showShareToast, setShowShareToast] = useState(false);

  // Affiliate Generator Modal
  const [affiliateModalProduct, setAffiliateModalProduct] = useState<Product | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Intercept auth
  const [authModal, setAuthModal] = useState<{ open: boolean; type: "buy" | "service"; itemName?: string }>({
    open: false,
    type: "buy",
  });

  // Checkout modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // Capture URL parameters (e.g. ?ref=AF1024 or ?prod=PRACA-PROD-01)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const queryIdx = hash.indexOf("?");
      if (queryIdx !== -1) {
        const queryStr = hash.slice(queryIdx + 1);
        const params = new URLSearchParams(queryStr);
        const ref = params.get("ref");
        const prod = params.get("prod");

        if (ref && ref.trim()) {
          const cleanRef = ref.trim().toUpperCase();
          setStore((st) => ({ activeAffiliateRef: cleanRef }));
          try {
            sessionStorage.setItem("rex_affiliate_ref", cleanRef);
          } catch {
            // quiet
          }
        }

        if (prod && prod.trim()) {
          const found = store.products.find((p) => p.id === prod.trim());
          if (found) {
            setActiveProduct(found);
          }
        }
      }
    }
  }, [store.products]);

  // Initial modal id if passed
  useEffect(() => {
    if (initialProductModalId) {
      const found = store.products.find((p) => p.id === initialProductModalId);
      if (found) setActiveProduct(found);
    }
  }, [initialProductModalId, store.products]);

  // Available categories
  const categories: PracaCategory[] = useMemo(() => {
    return (store.pracaCategories || []).filter((c) => c.active);
  }, [store.pracaCategories]);

  // Selected category object
  const currentCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCatId);
  }, [categories, selectedCatId]);

  // Sellers
  const sellers: SellerRecord[] = useMemo(() => {
    return (store.sellers || []).filter((s) => s.status === "APROVADO");
  }, [store.sellers]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = store.products.filter((p) => p.available !== false && p.status !== "OCULTO");

    // Category filter
    if (selectedCatId !== "all") {
      list = list.filter((p) => {
        if (p.pracaCategoryId) return p.pracaCategoryId === selectedCatId;
        const catObj = categories.find((c) => c.id === selectedCatId);
        return catObj && p.category.toLowerCase().includes(catObj.name.toLowerCase());
      });
    }

    // Subcategory filter
    if (selectedSubcat !== "all") {
      list = list.filter((p) => p.subcategory === selectedSubcat);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sellerName.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }

    // Condition filter
    if (selectedCondition !== "all") {
      list = list.filter((p) => p.condition === selectedCondition);
    }

    // Seller filter
    if (selectedSellerFilter !== "all") {
      list = list.filter((p) => p.sellerId === selectedSellerFilter);
    }

    // Cascaded Province filter (PARTE 5)
    if (selectedProvince !== "all") {
      list = list.filter((p) =>
        (p.deliveryLocation || "Huambo").toLowerCase().includes(selectedProvince.toLowerCase())
      );
    }

    // Cascaded Municipality filter (PARTE 5)
    if (selectedMunicipality !== "all") {
      const cleanMuni = selectedMunicipality.split("(")[0].trim().toLowerCase();
      list = list.filter((p) =>
        (p.deliveryLocation || "Huambo").toLowerCase().includes(cleanMuni)
      );
    }

    // Origin filter (PARTE 5)
    if (selectedOrigin !== "all") {
      if (selectedOrigin === "independentes") {
        list = list.filter((p) => p.sellerName && !p.sellerName.toLowerCase().includes("supermercado"));
      } else if (selectedOrigin === "lojas") {
        list = list.filter((p) => p.sellerName && (p.sellerName.toLowerCase().includes("boutique") || p.sellerName.toLowerCase().includes("loja") || p.sellerName.toLowerCase().includes("casa")));
      } else if (selectedOrigin === "mercados") {
        list = list.filter((p) => (p.deliveryLocation || "").toLowerCase().includes("chiva") || (p.deliveryLocation || "").toLowerCase().includes("mercado") || (p.description || "").toLowerCase().includes("mercado"));
      } else if (selectedOrigin === "supermercados") {
        list = list.filter((p) => p.category.toLowerCase().includes("mercearia") || p.category.toLowerCase().includes("alimentação") || (p.sellerName || "").toLowerCase().includes("supermercado"));
      } else if (selectedOrigin === "importados") {
        list = list.filter((p) => (p.description || "").toLowerCase().includes("importad") || (p.badge || "").toLowerCase().includes("import") || (p.name || "").toLowerCase().includes("original"));
      }
    }

    // Availability filter (PARTE 5)
    if (selectedAvailability !== "all") {
      if (selectedAvailability === "imediata") {
        list = list.filter((p) => p.stock > 0 && !(p.estimatedDelivery || "").toLowerCase().includes("encomenda"));
      } else if (selectedAvailability === "encomenda") {
        list = list.filter((p) => (p.estimatedDelivery || "").toLowerCase().includes("encomenda") || p.stock === 0);
      }
    }

    // Price range filter
    if (selectedPriceRange !== "all") {
      list = list.filter((p) => {
        const pr = p.promotionalPriceAOA || p.priceAOA;
        if (selectedPriceRange === "under10k") return pr < 10000;
        if (selectedPriceRange === "10k_50k") return pr >= 10000 && pr <= 50000;
        if (selectedPriceRange === "50k_150k") return pr > 50000 && pr <= 150000;
        if (selectedPriceRange === "above150k") return pr > 150000;
        return true;
      });
    }

    // Sorting
    return [...list].sort((a, b) => {
      const priceA = a.promotionalPriceAOA || a.priceAOA;
      const priceB = b.promotionalPriceAOA || b.priceAOA;
      if (selectedSort === "price_asc") return priceA - priceB;
      if (selectedSort === "price_desc") return priceB - priceA;
      if (selectedSort === "popular") return (b.rating || 5) * (b.reviewsCount || 1) - (a.rating || 5) * (a.reviewsCount || 1);
      return b.id.localeCompare(a.id); // newest
    });
  }, [
    store.products,
    selectedCatId,
    selectedSubcat,
    searchQuery,
    selectedCondition,
    selectedSellerFilter,
    selectedProvince,
    selectedMunicipality,
    selectedOrigin,
    selectedAvailability,
    selectedPriceRange,
    selectedSort,
    categories,
  ]);

  // PARTE 6: Sistema Inteligente de Recomendação "TAMBÉM PODES GOSTAR"
  const recommendedProducts: Product[] = useMemo(() => {
    if (!activeProduct) return [];
    const activePrice = activeProduct.promotionalPriceAOA || activeProduct.priceAOA;
    const minBand = activePrice * 0.65; // ±35% faixa de preço
    const maxBand = activePrice * 1.35;

    return store.products
      .filter((p) => p.id !== activeProduct.id && p.available !== false && p.status !== "OCULTO")
      .map((p) => {
        let score = 0;
        const pPrice = p.promotionalPriceAOA || p.priceAOA;

        // 1. Mesma Categoria ou Subcategoria (+40 pts)
        if (p.category === activeProduct.category || p.pracaCategoryId === activeProduct.pracaCategoryId) {
          score += 40;
        }
        if (p.subcategory && activeProduct.subcategory && p.subcategory === activeProduct.subcategory) {
          score += 25;
        }

        // 2. Faixa de Preço Semelhante ±35% (+25 pts)
        if (pPrice >= minBand && pPrice <= maxBand) {
          score += 25;
        }

        // 3. Mesma Condição (Novo vs Usado) (+15 pts)
        if (p.condition === activeProduct.condition) {
          score += 15;
        }

        // 4. Proximidade Geográfica / Província (+10 pts)
        const activeProv = (activeProduct.deliveryLocation || "Huambo").split("·")[0].trim().toLowerCase();
        const pProv = (p.deliveryLocation || "Huambo").split("·")[0].trim().toLowerCase();
        if (activeProv === pProv) {
          score += 10;
        }

        // 5. Diversidade de Vendedores (para não monopolizar recomendações)
        if (p.sellerId !== activeProduct.sellerId) {
          score += 5;
        }

        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.product);
  }, [activeProduct, store.products]);

  // Cart summary
  const cartCount = store.cart.reduce((sum, item) => sum + item.quantity, 0);

  // Add to cart
  const handleAddToCart = (product: Product, qty: number = 1) => {
    if (!store.currentUser) {
      setAuthModal({ open: true, type: "buy", itemName: product.name });
      return;
    }
    setStore((st) => {
      const existing = st.cart.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          cart: st.cart.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
          ),
        };
      }
      return { cart: [...st.cart, { product, quantity: qty }] };
    });
  };

  // Open Affiliate Generator Modal
  const handleOpenAffiliateGenerator = (product: Product) => {
    setAffiliateModalProduct(product);
    setCopiedLink(false);
  };

  // Generate affiliate link URL
  const userAffiliateCode =
    store.currentUser?.affiliateCode ||
    (store.affiliates.find((a) => a.userId === store.currentUser?.id)?.code || "AF_RESOLVE");

  const generatedAffiliateUrl = affiliateModalProduct
    ? `${window.location.origin}/#praca?prod=${affiliateModalProduct.id}&ref=${userAffiliateCode}`
    : "";

  const handleCopyAffiliateLink = () => {
    if (!generatedAffiliateUrl) return;
    navigator.clipboard?.writeText(generatedAffiliateUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* 1. HERO DO MARKETPLACE A PRAÇA */}
      <div className="relative bg-gradient-to-br from-primary via-slate-900 to-[#12365A] text-white pt-8 pb-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-action/20 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-20 size-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-2xl text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-action backdrop-blur-md border border-white/15 mb-3">
                <Icon name="Store" className="size-3.5 text-action" />
                <span>O Grande Mercado Online de Angola</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                A PRAÇA <span className="text-action">RESOLVEEXPRESS</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
                Compre com entrega rápida no Huambo e em Angola. Venda os seus produtos com comissão transparente ou ganhe comissões divulgando como afiliado.
              </p>

              {/* CTAs de Vendedor e Afiliado */}
              <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <button
                  type="button"
                  onClick={() => go("/praca/registo-vendedor")}
                  className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2.5 text-xs sm:text-sm font-black text-white hover:brightness-110 shadow-lg shadow-action/30 transition transform active:scale-95 cursor-pointer"
                >
                  <Icon name="Store" className="size-4" />
                  <span>Quero Vender na Praça</span>
                </button>
                <button
                  type="button"
                  onClick={() => go("/praca/registo-afiliado")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/25 border border-white/20 backdrop-blur-md transition transform active:scale-95 cursor-pointer"
                >
                  <Icon name="Award" className="size-4 text-action" />
                  <span>Programa de Afiliados</span>
                </button>
                <button
                  type="button"
                  onClick={() => go("/praca/painel-vendedor")}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
                  title="Aceder ao Painel de Vendedor já registado"
                >
                  <Icon name="LayoutDashboard" className="size-3.5" />
                  <span>Área do Vendedor</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Badge Card */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto shrink-0">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5 text-center">
                <p className="text-2xl font-black text-white">20</p>
                <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">Categorias</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5 text-center">
                <p className="text-2xl font-black text-action">{sellers.length + 15}+</p>
                <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">Lojas Verificadas</p>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5 text-center">
                <p className="text-2xl font-black text-emerald-400">100%</p>
                <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">Entregas Seguras</p>
              </div>
            </div>
          </div>

          {/* Instant Search Bar */}
          <div className="mt-8 max-w-3xl mx-auto">
            <div className="relative flex items-center">
              <Icon
                name="Search"
                className="absolute left-4 size-5 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquise por roupas, computadores, sapatilhas, comida, móveis, ferramentas..."
                className="w-full rounded-2xl border-2 border-white/20 bg-white/95 text-slate-900 py-3.5 pl-12 pr-28 text-sm sm:text-base font-medium shadow-2xl focus:border-action focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-24 text-slate-400 hover:text-slate-600 p-1"
                >
                  <Icon name="X" className="size-4" />
                </button>
              )}
              <button
                type="button"
                className="absolute right-2 rounded-xl bg-action px-4 py-2 text-xs sm:text-sm font-bold text-white hover:brightness-105"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE NAVEGAÇÃO DE CATEGORIAS (20 Categorias da Praça) */}
      <div className="sticky top-16 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setSelectedCatId("all");
                setSelectedSubcat("all");
              }}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                selectedCatId === "all"
                  ? "bg-action text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Icon name="Layers" className="size-3.5" />
              <span>Todas as Categorias</span>
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCatId(cat.id);
                    setSelectedSubcat("all");
                  }}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    isSelected
                      ? "bg-action text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  <Icon name={cat.icon || "ShoppingBag"} className="size-3.5" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Subcategories pill bar when a specific category is selected */}
          {currentCategory && currentCategory.subcategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 pt-1 border-t border-slate-100 dark:border-slate-800 no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Subcategorias:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSubcat("all")}
                className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  selectedSubcat === "all"
                    ? "bg-primary text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                }`}
              >
                Todas
              </button>
              {currentCategory.subcategories.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubcat(sub)}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                    selectedSubcat === sub
                      ? "bg-primary text-white"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL: FILTROS + CATÁLOGO + VENDEDORES */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Barra de Filtros e Ordenação */}
        <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <Icon name="SlidersHorizontal" className="size-3.5 text-action" />
                Filtros:
              </span>

              {/* Condição: Novo vs Usado */}
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedCondition("all")}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    selectedCondition === "all" ? "bg-white dark:bg-slate-700 text-primary shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCondition("NOVO")}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    selectedCondition === "NOVO" ? "bg-white dark:bg-slate-700 text-emerald-700 shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Novos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCondition("USADO")}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    selectedCondition === "USADO" ? "bg-white dark:bg-slate-700 text-amber-700 shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Usados / Recondicionados
                </button>
              </div>

              {/* Faixa de Preço */}
              <select
                value={selectedPriceRange}
                onChange={(e: any) => setSelectedPriceRange(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="all">Todas as Faixas de Preço</option>
                <option value="under10k">Até 10.000 Kz</option>
                <option value="10k_50k">10.000 Kz a 50.000 Kz</option>
                <option value="50k_150k">50.000 Kz a 150.000 Kz</option>
                <option value="above150k">Mais de 150.000 Kz</option>
              </select>

              {/* Botão para alternar Filtros Avançados (Localização em Cascata, Origem, Disponibilidade) */}
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                  showAdvancedFilters || selectedProvince !== "all" || selectedOrigin !== "all" || selectedAvailability !== "all"
                    ? "bg-action text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <Icon name="MapPin" className="size-3.5" />
                <span>Localização & Origem</span>
                {(selectedProvince !== "all" || selectedOrigin !== "all" || selectedAvailability !== "all") && (
                  <span className="size-2 rounded-full bg-white" />
                )}
              </button>

              {/* Loja / Vendedor */}
              {sellers.length > 0 && (
                <select
                  value={selectedSellerFilter}
                  onChange={(e) => setSelectedSellerFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 outline-none max-w-[180px] truncate"
                >
                  <option value="all">Todas as Lojas</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">Ordenar:</span>
              <select
                value={selectedSort}
                onChange={(e: any) => setSelectedSort(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="popular">Mais Populares</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
                <option value="newest">Novidades</option>
              </select>
            </div>
          </div>

          {/* PAINEL DE FILTROS AVANÇADOS EXPANSÍVEL (PARTE 5: Província -> Município, Origem, Disponibilidade) */}
          {showAdvancedFilters && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in duration-150">
              {/* Província */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  1. Província:
                </label>
                <select
                  value={selectedProvince}
                  onChange={(e) => {
                    setSelectedProvince(e.target.value);
                    setSelectedMunicipality("all");
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                >
                  <option value="all">Todas as Províncias</option>
                  {Object.keys(PROVINCES_MAP).map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>

              {/* Município (Cascata da Província) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  2. Município:
                </label>
                <select
                  value={selectedMunicipality}
                  onChange={(e) => setSelectedMunicipality(e.target.value)}
                  disabled={selectedProvince === "all"}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none disabled:opacity-50"
                >
                  <option value="all">
                    {selectedProvince === "all" ? "Escolha uma província primeiro" : "Todos os Municípios"}
                  </option>
                  {selectedProvince !== "all" &&
                    PROVINCES_MAP[selectedProvince]?.map((muni) => (
                      <option key={muni} value={muni}>
                        {muni}
                      </option>
                    ))}
                </select>
              </div>

              {/* Origem do Produto */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  3. Origem do Produto:
                </label>
                <select
                  value={selectedOrigin}
                  onChange={(e) => setSelectedOrigin(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                >
                  <option value="all">Todas as Origens</option>
                  <option value="independentes">Vendedores Independentes</option>
                  <option value="lojas">Lojas Locais & Boutiques</option>
                  <option value="mercados">Mercados Populares (Chiva, Alemanha...)</option>
                  <option value="supermercados">Supermercados Parceiros</option>
                  <option value="importados">Produtos Importados</option>
                </select>
              </div>

              {/* Disponibilidade */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  4. Disponibilidade:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedAvailability}
                    onChange={(e) => setSelectedAvailability(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                  >
                    <option value="all">Todas</option>
                    <option value="imediata">Pronta Entrega</option>
                    <option value="encomenda">Sob Encomenda</option>
                  </select>

                  {(selectedProvince !== "all" || selectedMunicipality !== "all" || selectedOrigin !== "all" || selectedAvailability !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProvince("all");
                        setSelectedMunicipality("all");
                        setSelectedOrigin("all");
                        setSelectedAvailability("all");
                      }}
                      className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 whitespace-nowrap"
                      title="Limpar filtros avançados"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Informações da Categoria Ativa (se selecionada) */}
        {currentCategory && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary/10 via-action/5 to-transparent border border-action/20 p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="size-12 rounded-2xl bg-action text-white grid place-items-center shadow-md shadow-action/20">
                <Icon name={currentCategory.icon || "ShoppingBag"} className="size-6" />
              </div>
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-primary dark:text-white">
                  {currentCategory.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                  {currentCategory.description}
                </p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-action bg-action/10 px-3 py-1 rounded-full border border-action/20">
                {filteredProducts.length} {filteredProducts.length === 1 ? "produto" : "produtos"} disponíveis
              </span>
            </div>
          </div>
        )}

        {/* 4. GRELHA DE PRODUTOS DA PRAÇA */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900">
            <div className="size-16 rounded-full bg-action/10 text-action grid place-items-center mx-auto mb-3">
              <Icon name="SearchX" className="size-8" />
            </div>
            <h3 className="font-display text-lg font-bold text-primary dark:text-white">
              Nenhum produto encontrado
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              Não encontramos produtos com os filtros selecionados. Tente alterar os termos da pesquisa ou ver outra categoria.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCatId("all");
                  setSelectedSubcat("all");
                  setSelectedCondition("all");
                  setSelectedPriceRange("all");
                }}
                className="rounded-xl bg-action px-4 py-2 text-xs font-bold text-white hover:brightness-105"
              >
                Limpar Todos os Filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {filteredProducts.map((prod) => {
              const currentPrice = prod.promotionalPriceAOA || prod.priceAOA;
              const hasDiscount = Boolean(prod.promotionalPriceAOA && prod.promotionalPriceAOA < prod.priceAOA);
              const discountPercent = hasDiscount
                ? Math.round(((prod.priceAOA - prod.promotionalPriceAOA!) / prod.priceAOA) * 100)
                : 0;

              return (
                <div
                  key={prod.id}
                  onClick={() => setActiveProduct(prod)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-xs hover:shadow-xl hover:border-action/50 transition duration-200 cursor-pointer"
                >
                  <div>
                    {/* Imagem do Produto com Badges */}
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 mb-3 flex items-center justify-center">
                      <img
                        src={prod.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                        alt={prod.name}
                        className={`h-full w-full transition duration-300 group-hover:scale-105 ${
                          prod.imageFit === "contain" ? "object-contain p-2" : "object-cover"
                        }`}
                        loading="lazy"
                      />

                      {/* Discount Badge */}
                      {hasDiscount && (
                        <span className="absolute top-2 left-2 rounded-lg bg-red-600 text-white font-black text-[10px] sm:text-xs px-2 py-0.5 shadow-sm">
                          -{discountPercent}%
                        </span>
                      )}

                      {/* Condition Badge (Novo vs Usado) */}
                      {prod.condition && (
                        <span
                          className={`absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            prod.condition === "NOVO"
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-600 text-white"
                          }`}
                        >
                          {prod.condition}
                        </span>
                      )}

                      {/* Praça Seller Badge */}
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white max-w-[90%] truncate">
                        <Icon name="Store" className="size-2.5 text-action shrink-0" />
                        <span className="truncate">{prod.sellerName}</span>
                      </div>
                    </div>

                    {/* Categoria & Subcategoria */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span className="truncate font-semibold text-action uppercase tracking-wide">
                        {prod.category}
                      </span>
                      {prod.rating && (
                        <span className="flex items-center gap-0.5 font-bold text-amber-500">
                          <Icon name="Star" className="size-3 fill-amber-500 text-amber-500" />
                          {prod.rating.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Nome do Produto */}
                    <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-action transition">
                      {prod.name}
                    </h3>
                  </div>

                  {/* Preços e Ações */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="mb-2">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-display text-sm sm:text-base font-black text-primary dark:text-white">
                          {kz(currentPrice)}
                        </span>
                        {hasDiscount && (
                          <span className="text-[11px] text-slate-400 line-through font-medium">
                            {kz(prod.priceAOA)}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {prod.estimatedDelivery || "Entrega em minutos"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(prod, 1);
                        }}
                        className="flex items-center justify-center gap-1 rounded-xl bg-action py-2 text-xs font-bold text-white hover:brightness-105 active:scale-95 transition"
                        title="Adicionar ao Carrinho"
                      >
                        <Icon name="ShoppingCart" className="size-3.5" />
                        <span className="hidden sm:inline">Comprar</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAffiliateGenerator(prod);
                        }}
                        className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 active:scale-95 transition"
                        title="Gerar Link de Afiliado com Comissão"
                      >
                        <Icon name="Award" className="size-3.5 text-action" />
                        <span className="hidden sm:inline">Afiliado</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. SECÇÃO: LOJAS E VENDEDORES VERIFICADOS NA PRAÇA */}
        <div className="mt-14 pt-10 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold text-action uppercase tracking-wider">
                Comerciantes Verificados
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-black text-primary dark:text-white">
                Lojas em Destaque na Praça
              </h2>
            </div>
            <button
              type="button"
              onClick={() => go("/praca/registo-vendedor")}
              className="text-xs font-bold text-action hover:underline flex items-center gap-1"
            >
              <span>Abrir Minha Loja</span>
              <Icon name="ArrowRight" className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellers.map((seller) => (
              <div
                key={seller.id}
                onClick={() => setSelectedSellerFilter(seller.id)}
                className="flex items-center gap-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-action/60 hover:shadow-md transition cursor-pointer"
              >
                <div className="size-14 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 shrink-0">
                  <img
                    src={seller.logo?.trim() || "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=120"}
                    alt={seller.storeName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display text-sm font-bold text-primary dark:text-white truncate">
                      {seller.storeName}
                    </h3>
                    <Icon name="CheckCircle2" className="size-3.5 text-action shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{seller.address}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-0.5 text-amber-500">
                      <Icon name="Star" className="size-3 fill-amber-500" />
                      {seller.rating.toFixed(1)}
                    </span>
                    <span>{seller.totalSalesCount} vendas</span>
                    <span className="text-action hover:underline font-bold">Ver produtos →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. BANNER DE AFILIADOS — GANHE DINHEIRO DIVULGANDO */}
        <div className="mt-14 rounded-3xl bg-gradient-to-r from-[#071B33] to-[#12365A] text-white p-6 sm:p-10 relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 size-72 bg-action/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold text-action backdrop-blur-md mb-2">
              <Icon name="Award" className="size-3.5 text-action" />
              Programa Oficial de Afiliados
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-white">
              Ganhe Comissões por Cada Venda ou Serviço Concluído
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
              Gere links únicos para qualquer produto da PRAÇA ou serviço da RESOLVEEXPRESS (como limpeza, canalização ou entregas). Quando alguém compra através do seu link, você recebe até 10% do valor da transação diretamente na sua carteira!
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => go("/praca/registo-afiliado")}
                className="rounded-xl bg-action px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:brightness-110 shadow-md transition"
              >
                Registar-me como Afiliado
              </button>
              <button
                type="button"
                onClick={() => go("/praca/painel-afiliado")}
                className="rounded-xl bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/25 border border-white/20 transition"
              >
                Aceder ao Painel de Afiliado
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7. MODAL DETALHE DO PRODUTO (Galeria, Vendedor, Entrega, Carrinho, Link de Afiliado) */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <button
              type="button"
              onClick={() => setActiveProduct(null)}
              className="absolute right-4 top-4 size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 grid place-items-center transition"
            >
              <Icon name="X" className="size-4" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Galeria de Fotos */}
              <div>
                <div className="aspect-square w-full rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700">
                  <img
                    src={activeProduct.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                    alt={activeProduct.name}
                    className={`h-full w-full ${
                      activeProduct.imageFit === "contain" ? "object-contain p-4" : "object-cover"
                    }`}
                  />
                </div>
                {activeProduct.images && activeProduct.images.length > 1 && (
                  <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                    {activeProduct.images.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActivePhotoIndex(i)}
                        className="size-14 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-action shrink-0"
                      >
                        <img src={img?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Detalhes do Produto */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold text-action uppercase tracking-wide">
                      {activeProduct.category}
                    </span>
                    {activeProduct.condition && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {activeProduct.condition}
                      </span>
                    )}
                    {activeProduct.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {activeProduct.badge}
                      </span>
                    )}
                  </div>

                  <h2 className="font-display text-xl sm:text-2xl font-black text-primary dark:text-white leading-tight">
                    {activeProduct.name}
                  </h2>

                  {/* Preço */}
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-black text-primary dark:text-white">
                      {kz(activeProduct.promotionalPriceAOA || activeProduct.priceAOA)}
                    </span>
                    {activeProduct.promotionalPriceAOA && (
                      <span className="text-sm text-slate-400 line-through">
                        {kz(activeProduct.priceAOA)}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {activeProduct.description}
                  </p>

                  {/* Vendedor Info Box */}
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Vendido e Entregue por:</p>
                      <p className="text-xs font-bold text-primary dark:text-white flex items-center gap-1">
                        <Icon name="Store" className="size-3 text-action" />
                        {activeProduct.sellerName}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Verificado
                    </span>
                  </div>

                  {/* Entrega e Stock */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <p className="flex items-center gap-2">
                      <Icon name="Truck" className="size-3.5 text-action shrink-0" />
                      <span>{activeProduct.deliveryLocation} · {activeProduct.estimatedDelivery}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Icon name="CheckCircle" className="size-3.5 text-emerald-600 shrink-0" />
                      <span>Stock disponível: <strong>{activeProduct.stock} unidades</strong></span>
                    </p>
                    {activeProduct.warranty && (
                      <p className="flex items-center gap-2">
                        <Icon name="ShieldCheck" className="size-3.5 text-blue-600 shrink-0" />
                        <span>Garantia: {activeProduct.warranty}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações: Quantidade, Comprar, e Gerar Link Afiliado */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-200 text-sm font-bold"
                      >
                        -
                      </button>
                      <span className="px-3 py-2 text-xs font-bold text-primary dark:text-white min-w-[2.5rem] text-center">
                        {modalQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalQty(Math.min(activeProduct.stock, modalQty + 1))}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-200 text-sm font-bold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleAddToCart(activeProduct, modalQty);
                        setActiveProduct(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-action px-5 py-3 text-xs sm:text-sm font-bold text-white hover:brightness-105 active:scale-95 shadow-md shadow-action/20 transition"
                    >
                      <Icon name="ShoppingCart" className="size-4" />
                      <span>Adicionar ao Carrinho ({kz((activeProduct.promotionalPriceAOA || activeProduct.priceAOA) * modalQty)})</span>
                    </button>
                  </div>

                  {/* Botão de Afiliado Dentro do Modal do Produto */}
                  <button
                    type="button"
                    onClick={() => {
                      const p = activeProduct;
                      setActiveProduct(null);
                      handleOpenAffiliateGenerator(p);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-action/40 bg-action/5 hover:bg-action/10 py-2.5 text-xs font-bold text-action transition"
                  >
                    <Icon name="Award" className="size-4 text-action" />
                    <span>Gerar Link de Afiliado para este Produto (Ganhe comissão)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* PARTE 6: SISTEMA INTELIGENTE DE RECOMENDAÇÃO "TAMBÉM PODES GOSTAR" */}
            {recommendedProducts.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-primary dark:text-white flex items-center gap-2">
                      <Icon name="Sparkles" className="size-4 text-action" />
                      <span>TAMBÉM PODES GOSTAR</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Sugestões na mesma faixa de preço (±35%) ou categoria semelhante
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-action bg-action/10 px-2.5 py-0.5 rounded-full">
                    Recomendação Inteligente
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {recommendedProducts.map((rec) => {
                    const recPrice = rec.promotionalPriceAOA || rec.priceAOA;
                    const isNovo = rec.condition === "NOVO" || !rec.condition;
                    return (
                      <div
                        key={rec.id}
                        onClick={() => {
                          setActiveProduct(rec);
                          setModalQty(1);
                        }}
                        className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2.5 hover:border-action/60 hover:shadow-md transition cursor-pointer"
                      >
                        <div>
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-2">
                            <img
                              src={rec.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                              alt={rec.name}
                              className={`h-full w-full ${
                                rec.imageFit === "contain" ? "object-contain p-2" : "object-cover"
                              } transition duration-300 group-hover:scale-105`}
                            />
                            <span
                              className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                isNovo ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                              }`}
                            >
                              {isNovo ? "Novo" : "Usado"}
                            </span>
                          </div>

                          <p className="text-[10px] text-muted-foreground truncate font-medium">
                            {rec.sellerName}
                          </p>
                          <h4 className="font-display text-xs font-bold text-primary dark:text-white line-clamp-1 group-hover:text-action transition">
                            {rec.name}
                          </h4>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                          <span className="font-display text-xs font-black text-primary dark:text-white">
                            {kz(recPrice)}
                          </span>
                          <span className="text-[10px] font-bold text-action group-hover:underline">
                            Ver →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. MODAL GERADOR DE LINK DE AFILIADO COM CALCULADORA EM TEMPO REAL */}
      {affiliateModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setAffiliateModalProduct(null)}
              className="absolute right-4 top-4 size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 grid place-items-center transition"
            >
              <Icon name="X" className="size-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="size-10 rounded-xl bg-action text-white grid place-items-center shadow-xs">
                <Icon name="Award" className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-primary dark:text-white">
                  Gerar Link de Afiliado
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ganhe comissão por cada venda confirmada através do seu link
                </p>
              </div>
            </div>

            {/* Informações do Produto Selecionado */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 mb-4 flex items-center gap-3">
              <img
                src={affiliateModalProduct.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                alt={affiliateModalProduct.name}
                className="size-14 rounded-xl object-cover shrink-0 border"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-primary dark:text-white truncate">
                  {affiliateModalProduct.name}
                </p>
                <p className="text-xs font-black text-action">
                  {kz(affiliateModalProduct.promotionalPriceAOA || affiliateModalProduct.priceAOA)}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  Loja: {affiliateModalProduct.sellerName}
                </p>
              </div>
            </div>

            {/* CALCULADORA DE COMISSÃO DO AFILIADO EM TEMPO REAL */}
            {(() => {
              const price = affiliateModalProduct.promotionalPriceAOA || affiliateModalProduct.priceAOA;
              const rate = affiliateModalProduct.affiliateCommissionRate || store.pracaSettings?.defaultAffiliateCommission || 5;
              const commissionAmount = Math.round((price * rate) / 100);
              const platformRate = affiliateModalProduct.platformCommissionRate || store.pracaSettings?.defaultPlatformCommission || 10;
              const platformAmount = Math.round((price * platformRate) / 100);
              const sellerNet = price - commissionAmount - platformAmount;

              return (
                <div className="rounded-2xl border border-action/30 bg-action/5 p-4 mb-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-primary dark:text-white pb-1.5 border-b border-action/20">
                    <span className="flex items-center gap-1.5">
                      <Icon name="Calculator" className="size-4 text-action" />
                      Calculadora de Comissão do Afiliado:
                    </span>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                      +{rate}% Comissão
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">Preço de Venda:</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{kz(price)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sua Comissão Estimada:</p>
                      <p className="font-black text-emerald-600 text-sm">{kz(commissionAmount)}</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 pt-1 leading-snug">
                    Por cada cliente que comprar este produto através do seu link exclusivo, você receberá <strong>{kz(commissionAmount)}</strong> creditados na sua carteira de afiliado assim que a encomenda for entregue.
                  </p>
                </div>
              );
            })()}

            {/* Link Gerado com Código Único */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                O Seu Link Personalizado de Afiliado:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedAffiliateUrl}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyAffiliateLink}
                  className="shrink-0 rounded-xl bg-action px-3.5 py-2 text-xs font-bold text-white hover:brightness-105 active:scale-95 transition"
                >
                  {copiedLink ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            {/* Botões de Partilha com 1 clique (WhatsApp, Facebook, etc.) */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-bold text-slate-500 mb-2">Partilhar Imediatamente:</p>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Olha este produto incrível na ResolveExpress: ${affiliateModalProduct.name} por apenas ${kz(
                      affiliateModalProduct.promotionalPriceAOA || affiliateModalProduct.priceAOA
                    )}! Clica aqui: ${generatedAffiliateUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-bold transition"
                >
                  <Icon name="MessageCircle" className="size-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(generatedAffiliateUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold transition"
                >
                  <Icon name="Share2" className="size-3.5" />
                  <span>Facebook</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyAffiliateLink}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white py-2 text-xs font-bold transition"
                >
                  <Icon name="Copy" className="size-3.5" />
                  <span>Copiar Link</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Intercept Modal */}
      {authModal.open && (
        <AuthPromptModal
          open={authModal.open}
          onClose={() => setAuthModal({ open: false, type: "buy" })}
          actionType={authModal.type}
          itemName={authModal.itemName}
        />
      )}
    </div>
  );
}
