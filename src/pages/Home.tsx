import { useState, useMemo, useEffect, useRef } from "react";
import { Icon, go, Btn, Section } from "../ui/kit";
import { LocationPicker } from "../ui/Chrome";
import { AuthPromptModal } from "../ui/AuthPromptModal";
import {
  PROVIDERS,
  CATEGORIES,
  LOCATIONS,
  allServices,
  findCategory,
  DEFAULT_HERO_BANNERS,
  type Category,
  type Service,
  type Product,
  type HeroBanner,
} from "../lib/data";
import {
  useStore,
  svcConfig,
  catActive,
  countAvailable,
  formatCurrency,
  getStoreCategories,
  getStoreServices,
  findStoreCategory,
} from "../lib/store";
import { useI18n } from "../lib/i18n";

const HERO_IMG =
  "https://t1200430000013113.p.clickup-attachments.com/t1200430000013113/984a4a2d-7064-50db-9294-be979c44e90d/asset-b8be4764e030ef88.webp?view=open";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function SearchBox({ onPick }: { onPick: (s: Service) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [store] = useStore();
  const { t } = useI18n();

  const results = useMemo(
    () =>
      q.trim()
        ? allServices()
            .filter((s) => {
              const cat = findCategory(s.categoryId);
              return (
                cat &&
                catActive(store, cat) &&
                (norm(s.name).includes(norm(q)) || norm(cat.name).includes(norm(q)))
              );
            })
            .slice(0, 6)
        : [],
    [q, store]
  );

  const submit = () => {
    if (results[0]) onPick(results[0]);
    else go(`/servicos?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="relative">
      <div className="flex min-h-14 items-center gap-3 rounded-[var(--radius)] border border-border bg-paper px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Icon name="Search" className="size-5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("search_placeholder")}
          aria-label="Pesquisar serviço"
          className="w-full bg-transparent text-base outline-none"
        />
      </div>
      {open && q && (
        <ul className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[var(--radius)] border border-border bg-paper shadow-xl">
          {results.length ? (
            results.map((s) => {
              const av = svcConfig(store, s).available;
              const cat = findCategory(s.categoryId);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={() => onPick(s)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-mist"
                  >
                    <span>
                      <span className="font-semibold">{s.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {cat?.name}
                      </span>
                    </span>
                    {!av && (
                      <span className="text-sm text-muted-foreground">
                        Indisponível
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-4 py-3 text-muted-foreground">
              Nenhum serviço com “{q}”. Fale connosco no WhatsApp.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function Ticket({
  picked,
  onContinue,
}: {
  picked: Service | null;
  onContinue?: (svc: Service) => void;
}) {
  const [store] = useStore();
  const loc = LOCATIONS.find((l) => l.id === (store.location || "huambo"));
  const cfg = picked ? svcConfig(store, picked) : null;
  const cat = picked ? findCategory(picked.categoryId) : null;

  return (
    <div className="ticket relative w-72 rounded-[var(--radius)] bg-paper p-5 shadow-[0_24px_60px_oklch(0.2_0.06_258/0.25)]">
      <div className="flex items-center justify-between font-mono text-sm text-muted-foreground">
        <span>SEU PEDIDO</span>
        <span>REX-{new Date().getFullYear()}-······</span>
      </div>
      <div className="my-4 border-t-2 border-dashed border-border" />
      {picked && (
        <div className="mb-3 h-28 w-full overflow-hidden rounded-[var(--radius)] border border-border shadow-xs">
          <img
            src={picked.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
            alt={picked.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <p className="font-display text-xl leading-tight font-bold">
        {picked ? picked.name : "Escolha um serviço"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {cat ? cat.name : "Pesquise ao lado ↖"}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Local</dt>
        <dd className="text-right font-semibold">{loc?.name}</dd>
        <dt className="text-muted-foreground">Preço</dt>
        <dd className="text-right font-semibold">
          {cfg ? (cfg.price ? `desde ${formatCurrency(cfg.price, store.currency)}` : "Orçamento") : "·"}
        </dd>
        <dt className="text-muted-foreground">Por</dt>
        <dd className="text-right font-semibold">
          {cfg ? PROVIDERS[cfg.provider] : "·"}
        </dd>
      </dl>
      {picked && (
        <Btn
          className="mt-5 w-full"
          onClick={() => (onContinue ? onContinue(picked) : go(`/pedir/${picked.id}`))}
        >
          Continuar pedido
        </Btn>
      )}
    </div>
  );
}

export function CategoryCard({ c }: { c: Category }) {
  const [store] = useStore();
  const n = countAvailable(store, c);
  const isCustom = Boolean(store.categoryOverrides?.[c.id]);

  return (
    <button
      type="button"
      onClick={() => go(`/servicos/${c.id}`)}
      className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-paper text-left transition hover:-translate-y-1 hover:border-action/40 hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-action cursor-pointer"
    >
      {/* Department Image Showcase - Full container presence */}
      <div className="relative w-full h-48 sm:h-52 overflow-hidden rounded-t-[var(--radius)] bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 border-b border-border/60">
        <img
          src={c.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
          alt={c.name}
          className={`w-full h-full transition-transform duration-500 group-hover:scale-105 ${
            c.imageFit === "contain" ? "object-contain p-2" : "object-cover object-center"
          }`}
          loading="lazy"
        />

        {/* Floating Category Icon Badge */}
        <span className="absolute top-2.5 left-2.5 grid size-8 place-items-center rounded-lg bg-action text-action-ink shadow-xs backdrop-blur-xs">
          <Icon name={c.icon || "Sparkles"} className="size-4" />
        </span>

        {isCustom && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-2xs backdrop-blur-xs">
            Personalizado
          </span>
        )}
      </div>

      {/* Information Body */}
      <div className="flex flex-1 flex-col p-4 justify-between space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-primary group-hover:text-action transition-colors truncate">
              {c.name.replace("Resolve ", "")}
            </h3>
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground bg-mist px-2 py-0.5 rounded-full">
              {n} {n === 1 ? "serviço" : "serviços"}
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground mt-1.5 leading-relaxed">
            {c.short}
          </p>
        </div>

        <div className="flex w-full items-center justify-between text-xs border-t border-border/70 pt-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Equipa Verificada
          </span>
          <span className="flex items-center gap-1 font-bold text-action group-hover:translate-x-0.5 transition-transform">
            Ver Serviços
            <Icon name="ArrowRight" className="size-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

export function ServiceCard({
  svc,
  onRequest,
}: {
  svc: Service;
  onRequest?: (svc: Service) => void;
}) {
  const [store] = useStore();
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const cfg = svcConfig(store, svc);
  const cat = findCategory(svc.categoryId);
  if (!cat) return null;

  const handleClick = () => {
    if (onRequest) {
      onRequest(svc);
    } else if (!store.currentUser) {
      setAuthPromptOpen(true);
    } else {
      go(`/pedir/${svc.id}`);
    }
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-paper shadow-xs transition hover:border-action/40 hover:shadow-md">
      <div
        className={`relative h-48 sm:h-52 overflow-hidden ${
          svc.imageFit === "contain"
            ? "bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-2"
            : "bg-ink text-white"
        }`}
      >
        <img
          src={(svc.image?.trim() || cat.image?.trim()) || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
          alt={svc.name}
          className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${
            svc.imageFit === "contain" ? "object-contain" : "object-cover object-center"
          }`}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
        <span className="absolute top-3 left-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-xs text-white">
          {cat.name.replace("Resolve ", "")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="font-display text-lg font-bold text-primary group-hover:text-action transition-colors">
            {svc.name}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {svc.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-primary">
            {cfg.price ? `desde ${formatCurrency(cfg.price, store.currency)}` : "Sob orçamento"}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            <Icon name="Star" className="size-3.5 text-amber-500 fill-amber-500" /> 4.9 (Verificado)
          </span>
          <span
            className={
              "flex items-center gap-1 text-xs " +
              (cfg.available ? "text-ok" : "text-muted-foreground")
            }
          >
            <span
              className={
                "size-2 rounded-full " + (cfg.available ? "bg-ok" : "bg-neutral-5")
              }
            />
            {cfg.available ? "Disponível" : "Indisponível"}
          </span>
        </div>
        <Btn
          className="mt-auto min-h-10 text-xs"
          disabled={!cfg.available}
          onClick={handleClick}
        >
          {cfg.available ? "Solicitar" : "Indisponível"}
        </Btn>
      </div>

      {authPromptOpen && (
        <AuthPromptModal
          open={authPromptOpen}
          onClose={() => setAuthPromptOpen(false)}
          actionType="service"
          itemName={svc.name}
        />
      )}
    </div>
  );
}

export function Home() {
  const [picked, setPicked] = useState<Service | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const [store, setStore] = useStore();
  const [addedId, setAddedId] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    type: "buy" | "service";
    itemName?: string;
  }>({ open: false, type: "service" });
  const cats = useMemo(
    () => getStoreCategories(store).filter((c) => catActive(store, c)),
    [store]
  );
  const featured = useMemo(() => {
    const all = getStoreServices(store);
    return store.featured
      .map((id) => all.find((s) => s.id === id))
      .filter((s): s is Service => Boolean(s));
  }, [store]);

  const [pracaFilter, setPracaFilter] = useState<"ALL" | "NOVO" | "USADO">("ALL");

  const homeFeaturedProducts = useMemo(() => {
    const list = store.products.filter((p) => (store.featuredProducts || []).includes(p.id));
    return list.length > 0 ? list.slice(0, 4) : store.products.slice(0, 4);
  }, [store.products, store.featuredProducts]);

  const pracaHomeProducts = useMemo(() => {
    const featuredIds = store.featuredHomeProducts || [];
    let list = store.products.filter(
      (p) => p.isPraca || p.sellerName !== "Resolve Express Oficial" || p.pracaCategoryId
    );
    if (featuredIds.length > 0) {
      const explicit = featuredIds
        .map((id) => store.products.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p));
      if (explicit.length > 0) {
        list = explicit;
      }
    }
    if (pracaFilter !== "ALL") {
      list = list.filter((p) => p.condition === pracaFilter);
    }
    return list.slice(0, 8);
  }, [store.products, store.featuredHomeProducts, pracaFilter]);

  const { t } = useI18n();

  const heroBanners: HeroBanner[] = useMemo(() => {
    const list = store.heroBanners && store.heroBanners.length > 0 ? store.heroBanners : DEFAULT_HERO_BANNERS;
    const active = list.filter((b) => b.active !== false);
    return active.length > 0 ? active : DEFAULT_HERO_BANNERS;
  }, [store.heroBanners]);

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!store.currentUser) {
      setAuthModal({ open: true, type: "buy", itemName: product.name });
      return;
    }
    setStore((st) => {
      const existing = st.cart.find((i) => i.product.id === product.id);
      const newCart = existing
        ? st.cart.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...st.cart, { product, quantity: 1 }];
      return { cart: newCart };
    });
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1800);
  };

  // Auto rotation every 6 seconds (6000ms), paused on user interaction
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, heroBanners.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? heroBanners.length - 1 : prev - 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const distance = touchStartX.current - touchEndX.current;
      if (distance > 40) {
        nextSlide();
      } else if (distance < -40) {
        prevSlide();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
    setTimeout(() => setIsPaused(false), 2500);
  };

  return (
    <>
      {/* HERO SECTION COM CARROSSEL DE DOIS BANNERS */}
      <section className="relative px-3 pt-4 pb-6 sm:px-6 @3xl:px-8 max-w-7xl mx-auto">
        <div
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-neutral-900 shadow-xl min-h-[420px] sm:min-h-[460px] md:min-h-[490px] flex items-center"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Banner Slides */}
          {heroBanners.map((banner, index) => {
            const isActive = index === currentSlide;
            return (
              <div
                key={banner.id}
                className={
                  "absolute inset-0 h-full w-full transition-opacity duration-700 ease-in-out " +
                  (isActive ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none")
                }
                aria-hidden={!isActive}
              >
                {/* Background Image - Clearly Visible */}
                <img
                  src={banner.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80"}
                  alt={banner.titleStart + " " + banner.titleHighlight}
                  className={`absolute inset-0 h-full w-full transition-transform duration-1000 ease-out ${
                    banner.imageFit === "contain" ? "object-contain p-4" : "object-cover object-center"
                  }`}
                  loading={index === 0 ? "eager" : "lazy"}
                />

                {/* Soft directional gradient preserving image visibility while ensuring high text contrast */}
                {(() => {
                  const showEyebrow = banner.showEyebrow !== false && Boolean(banner.eyebrow);
                  const showBadge = banner.showBadge !== false && Boolean(banner.badge);
                  const showEyebrowBadge = showEyebrow || showBadge;
                  const showTitle = banner.showTitle !== false && Boolean(banner.titleStart || banner.titleHighlight);
                  const showDescription = banner.showDescription !== false && Boolean(banner.description);
                  const showPrimary = banner.showButtons !== false && banner.showPrimaryBtn !== false && Boolean(banner.primaryBtn);
                  const showSecondary = banner.showButtons !== false && banner.showSecondaryBtn !== false && Boolean(banner.secondaryBtn);
                  const showButtonsContainer = banner.showButtons !== false && (showPrimary || showSecondary);
                  const showFooterText = banner.showFooterText !== false && Boolean(banner.footerText);
                  const hasAnyContent = showEyebrowBadge || showTitle || showDescription || showButtonsContainer || showFooterText;

                  return (
                    <>
                      {hasAnyContent && (
                        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15 pointer-events-none" />
                      )}

                      {hasAnyContent && (
                        <div className="relative z-10 flex h-full items-center px-6 py-8 sm:px-12 md:px-16">
                          <div className="max-w-lg text-white space-y-3">
                            {/* Eyebrow & Badge */}
                            {showEyebrowBadge && (
                              <div className="flex flex-wrap items-center gap-2">
                                {showEyebrow && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white border border-white/30 backdrop-blur-xs">
                                    <span className="size-2 rounded-full bg-action animate-pulse" />
                                    {banner.eyebrow}
                                  </span>
                                )}
                                {showBadge && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-action text-white px-2.5 py-0.5 text-xs font-bold shadow-xs">
                                    <Icon name="CheckCircle" className="size-3 text-white" />
                                    {banner.badge}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Short, Punchy Title */}
                            {showTitle && (
                              <h1 className="font-display text-2xl sm:text-3xl md:text-[2.2rem] font-black tracking-tight leading-tight text-white drop-shadow-md">
                                {banner.titleStart}{" "}
                                <span className="text-action">
                                  {banner.titleHighlight}
                                </span>
                              </h1>
                            )}

                            {/* Concise Copy / Description */}
                            {showDescription && (
                              <p className="text-xs sm:text-sm text-white/90 leading-relaxed max-w-md drop-shadow-sm font-medium">
                                {banner.description}
                              </p>
                            )}

                            {/* Action Buttons & Links */}
                            {showButtonsContainer && (
                              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                                {showPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => go(banner.primaryTo)}
                                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] bg-action px-5 py-2.5 text-xs sm:text-sm font-black text-action-ink shadow-lg shadow-action/30 transition hover:bg-action-hover active:scale-95 cursor-pointer"
                                  >
                                    <span>{banner.primaryBtn}</span>
                                    <Icon name="ArrowRight" className="size-4" />
                                  </button>
                                )}

                                {showSecondary && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (banner.secondaryTo.startsWith("/pedir") && !store.currentUser) {
                                        setAuthModal({ open: true, type: "service" });
                                      } else {
                                        go(banner.secondaryTo || "/servicos");
                                      }
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] bg-white/20 px-4 py-2.5 text-xs sm:text-sm font-bold text-white border border-white/30 backdrop-blur-sm transition hover:bg-white/30 active:scale-95 cursor-pointer shadow-md"
                                  >
                                    <span>{banner.secondaryBtn}</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Texto complementar entre os botões e links (editável pelo Super Admin) */}
                            {showFooterText && (
                              <p className="pt-1 text-[11px] sm:text-xs text-white/80 font-medium flex items-center gap-1.5 drop-shadow-xs">
                                <Icon name="ShieldCheck" className="size-3.5 text-action shrink-0" />
                                <span>{banner.footerText}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })}

          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={() => {
              setIsPaused(true);
              prevSlide();
            }}
            aria-label="Banner anterior"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 grid size-10 sm:size-11 place-items-center rounded-full bg-black/50 text-white border border-white/25 backdrop-blur-md transition hover:bg-action hover:border-action active:scale-90 cursor-pointer shadow-lg"
          >
            <Icon name="ChevronLeft" className="size-5 sm:size-6" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPaused(true);
              nextSlide();
            }}
            aria-label="Próximo banner"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 grid size-10 sm:size-11 place-items-center rounded-full bg-black/50 text-white border border-white/25 backdrop-blur-md transition hover:bg-action hover:border-action active:scale-90 cursor-pointer shadow-lg"
          >
            <Icon name="ChevronRight" className="size-5 sm:size-6" />
          </button>

          {/* Indicators / Dots */}
          <div className="absolute bottom-3 sm:bottom-4 inset-x-0 z-20 flex justify-center">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md">
              {heroBanners.map((banner, index) => {
                const isActive = index === currentSlide;
                return (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => {
                      setIsPaused(true);
                      setCurrentSlide(index);
                    }}
                    aria-label={`Ir para banner ${index + 1}: ${banner.eyebrow}`}
                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive ? "w-8 sm:w-10 bg-action" : "w-2.5 bg-white/50 hover:bg-white/80"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Search & Location Bar beneath the Hero Carousel */}
        <div className="mt-4 grid gap-3 @3xl:grid-cols-[1fr_220px_auto] items-center bg-paper border border-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm">
          <SearchBox onPick={setPicked} />
          <LocationPicker />
          <Btn
            className="min-h-12 px-6 whitespace-nowrap"
            onClick={() => {
              if (picked) {
                if (!store.currentUser) {
                  setAuthModal({ open: true, type: "service", itemName: picked.name });
                } else {
                  go(`/pedir/${picked.id}`);
                }
              } else {
                go("/servicos");
              }
            }}
          >
            {picked ? t("search_continue") : t("search_find")} <Icon name="ArrowRight" className="size-4" />
          </Btn>
        </div>

        {/* Selected Service Ticket Preview if picked via Search */}
        {picked && (
          <div className="mt-4 flex justify-center">
            <div className="w-full max-w-md">
              <Ticket
                picked={picked}
                onContinue={(svc) => {
                  if (!store.currentUser) {
                    setAuthModal({ open: true, type: "service", itemName: svc.name });
                  } else {
                    go(`/pedir/${svc.id}`);
                  }
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* 12 Categorias com Fotos */}
      <Section
        eyebrow={t("section_cats_eyebrow")}
        title={t("section_cats_title")}
        action={
          <Btn kind="ghost" onClick={() => go("/servicos")}>
            {t("section_cats_view_all")}
          </Btn>
        }
      >
        <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
          {cats.map((c) => (
            <CategoryCard key={c.id} c={c} />
          ))}
        </div>
      </Section>

      {/* Loja de Produtos / Marketplace em Destaque */}
      <div className="border-y border-border bg-gradient-to-b from-paper to-mist/40">
        <Section
          eyebrow={t("section_market_eyebrow")}
          title={t("section_market_title")}
          action={
            <Btn kind="action" onClick={() => go("/produtos")}>
              <Icon name="ShoppingBag" className="size-4" />
              <span>{t("section_market_view_all")}</span>
            </Btn>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {homeFeaturedProducts.map((p) => {
              const currentPrice = p.promotionalPriceAOA || p.priceAOA;
              const isAdded = addedId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => go("/produtos")}
                  className="group flex flex-col justify-between overflow-hidden rounded-[var(--radius)] border border-border bg-paper transition hover:-translate-y-1 hover:border-action/40 hover:shadow-lg cursor-pointer"
                >
                  <div>
                    <div
                      className={`relative h-44 w-full overflow-hidden ${
                        p.imageFit === "contain"
                          ? "bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-2"
                          : "bg-neutral-100"
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
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        {p.category}
                      </span>
                      {p.promotionalPriceAOA && (
                        <span className="absolute top-2.5 right-2.5 rounded-full bg-action px-2 py-0.5 text-[10px] font-black text-action-ink">
                          PROMOÇÃO
                        </span>
                      )}
                    </div>

                    <div className="p-4 pb-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {p.sellerName}
                      </p>
                      <h3 className="font-display text-base font-bold text-primary group-hover:text-action transition line-clamp-2 mt-0.5">
                        {p.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {p.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border p-4 pt-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Preço por {p.unit}</p>
                      <p className="font-display text-lg font-black text-primary">
                        {formatCurrency(currentPrice, store.currency)}
                      </p>
                      {p.promotionalPriceAOA && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatCurrency(p.priceAOA, store.currency)}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(p, e)}
                      className={
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer " +
                        (isAdded
                          ? "bg-ok text-white"
                          : "bg-action text-action-ink hover:bg-action-hover active:scale-95")
                      }
                      title="Adicionar ao carrinho"
                    >
                      <Icon name={isAdded ? "Check" : "ShoppingCart"} className="size-3.5" />
                      <span>{isAdded ? "Adicionado!" : "Comprar"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* SECÇÃO: PRODUTOS DA NOSSA PRAÇA (PARTE 4) */}
      <div className="border-b border-border bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 py-4">
        <Section
          eyebrow="COMÉRCIO LOCAL & INDEPENDENTE"
          title={
            <div className="flex flex-col gap-1">
              <span className="font-display text-2xl sm:text-3xl font-black text-primary dark:text-white">
                PRODUTOS DA NOSSA PRAÇA
              </span>
              <p className="text-xs sm:text-sm font-normal text-muted-foreground max-w-2xl">
                Descobre o que está disponível perto de ti. Encontra produtos novos e usados, compara preços e compra sem complicações.
              </p>
            </div>
          }
          action={
            <div className="flex items-center gap-2">
              <Btn kind="action" onClick={() => go("/praca")}>
                <Icon name="Store" className="size-4" />
                <span>Explorar Toda a Praça</span>
              </Btn>
            </div>
          }
        >
          {/* Quick Filter Chips: Todos / Novos / Usados */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPracaFilter("ALL")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  pracaFilter === "ALL"
                    ? "bg-action text-white shadow-xs"
                    : "bg-paper text-muted-foreground border border-border hover:border-action/50"
                }`}
              >
                Todos os Produtos
              </button>
              <button
                type="button"
                onClick={() => setPracaFilter("NOVO")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  pracaFilter === "NOVO"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-paper text-muted-foreground border border-border hover:border-emerald-500/50"
                }`}
              >
                <span className="size-2 rounded-full bg-emerald-400" />
                <span>Apenas Novos</span>
              </button>
              <button
                type="button"
                onClick={() => setPracaFilter("USADO")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  pracaFilter === "USADO"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-paper text-muted-foreground border border-border hover:border-amber-500/50"
                }`}
              >
                <span className="size-2 rounded-full bg-amber-400" />
                <span>Artigos Usados</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => go("/praca/registo-vendedor")}
              className="text-xs font-bold text-action hover:underline flex items-center gap-1"
            >
              <span>Vender na Praça →</span>
            </button>
          </div>

          {/* Grid of Praça Products */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pracaHomeProducts.map((p) => {
              const currentPrice = p.promotionalPriceAOA || p.priceAOA;
              const isAdded = addedId === p.id;
              const isNovo = p.condition === "NOVO" || !p.condition;
              return (
                <div
                  key={p.id}
                  onClick={() => go(`/praca?prod=${p.id}`)}
                  className="group flex flex-col justify-between overflow-hidden rounded-[var(--radius)] border border-border bg-paper transition hover:-translate-y-1 hover:border-action hover:shadow-xl cursor-pointer"
                >
                  <div>
                    {/* Imagem do Produto com Tag de Condição e Promoção */}
                    <div
                      className={`relative h-48 w-full overflow-hidden ${
                        p.imageFit === "contain"
                          ? "bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-3"
                          : "bg-slate-100 dark:bg-slate-800"
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

                      {/* Tag de Condição: Novo ou Usado */}
                      <span
                        className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xs ${
                          isNovo
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        {isNovo ? "Novo" : "Usado"}
                      </span>

                      {/* Tag de Promoção se houver */}
                      {p.promotionalPriceAOA && (
                        <span className="absolute top-2.5 right-2.5 rounded-full bg-action px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                          PROMO
                        </span>
                      )}

                      {/* Vendedor Verificado Badge */}
                      <span className="absolute bottom-2 left-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs flex items-center gap-1">
                        <Icon name="CheckCircle2" className="size-3 text-action" />
                        <span>Verificado</span>
                      </span>
                    </div>

                    {/* Informações: Vendedor, Localização, Nome e Descrição */}
                    <div className="p-4 pb-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate font-medium flex items-center gap-1">
                          <Icon name="Store" className="size-3 text-action shrink-0" />
                          <strong className="text-slate-700 dark:text-slate-300">{p.sellerName}</strong>
                        </span>
                        <span className="truncate text-[10px] font-semibold text-action uppercase tracking-wide">
                          {p.category}
                        </span>
                      </div>

                      <h3 className="font-display text-sm sm:text-base font-bold text-primary dark:text-white group-hover:text-action transition line-clamp-2 mt-1">
                        {p.name}
                      </h3>

                      {/* Localização do Produto: Província / Município / Bairro */}
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <Icon name="MapPin" className="size-3 text-action shrink-0" />
                        <span className="truncate">{p.deliveryLocation || "Huambo · Cidade Alta"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Preço e Botão de Ação Direta para a Praça */}
                  <div className="border-t border-border p-4 pt-3 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Preço</p>
                      <p className="font-display text-base sm:text-lg font-black text-primary dark:text-white">
                        {formatCurrency(currentPrice, store.currency)}
                      </p>
                      {p.promotionalPriceAOA && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatCurrency(p.priceAOA, store.currency)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          go(`/praca?prod=${p.id}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-action px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-action-hover active:scale-95 transition cursor-pointer"
                        title="Ver detalhes na Praça"
                      >
                        <span>Ver na Praça</span>
                        <Icon name="ArrowRight" className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => go("/praca")}
              className="inline-flex items-center gap-2 rounded-xl border border-action/40 bg-action/5 hover:bg-action/10 px-5 py-2.5 text-xs sm:text-sm font-bold text-action transition"
            >
              <Icon name="Store" className="size-4" />
              <span>Ver todos os produtos no Catálogo da Praça ({store.products.length})</span>
            </button>
          </div>
        </Section>
      </div>

      {/* Serviços em Destaque */}
      <div className="bg-mist">
        <Section
          eyebrow={t("section_feat_eyebrow")}
          title={t("section_feat_title")}
        >
          <div className="grid gap-4 @3xl:grid-cols-2 @5xl:grid-cols-3">
            {featured.map((s) => (
              <ServiceCard key={s.id} svc={s} />
            ))}
          </div>
        </Section>
      </div>

      <Section
        eyebrow={t("why_eyebrow")}
        title={t("why_title")}
      >
        <div className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border @3xl:grid-cols-5">
          {[
            [
              "BadgeCheck",
              "Profissionais verificados",
              "Documentos e referências validados antes do primeiro serviço.",
            ],
            [
              "ClipboardList",
              "Atendimento organizado",
              "Cada pedido tem número, estado e histórico.",
            ],
            [
              "Receipt",
              "Preços transparentes",
              "Preço fixo ou orçamento antes de confirmar.",
            ],
            [
              "CalendarCheck",
              "Agendamento fácil",
              "Hoje, amanhã ou todas as semanas.",
            ],
            [
              "Headset",
              "Suporte ao cliente",
              "Uma pessoa real no WhatsApp.",
            ],
          ].map(([ic, title, text]) => (
            <div key={title} className="flex flex-col gap-3 bg-paper p-6">
              <Icon name={ic} className="size-6 text-action" />
              <p className="font-display font-bold">{title}</p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <div id="como" className="bg-ink text-white">
        <Section
          dark
          eyebrow={t("how_eyebrow")}
          title={<span className="text-white">{t("how_title")}</span>}
        >
          <ol className="grid gap-8 @3xl:grid-cols-4">
            {[
              t("how_step1"),
              t("how_step2"),
              t("how_step3"),
              t("how_step4"),
            ].map((step, idx) => (
              <li
                key={step}
                className="flex flex-col gap-3 border-t-2 border-action pt-4"
              >
                <span className="font-mono text-sm text-white/80">
                  PASSO {idx + 1}
                </span>
                <span className="font-display text-2xl leading-tight font-bold">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-16 @3xl:grid-cols-2 @3xl:px-8 @3xl:py-24">
        <div className="flex flex-col items-start gap-6 rounded-[calc(var(--radius)*1.5)] bg-action p-8 text-action-ink @3xl:p-12">
          <Icon name="Hammer" className="size-8" />
          <h2 className="font-display text-3xl leading-tight font-bold">
            {t("partner_banner_title")}
          </h2>
          <Btn kind="ink" onClick={() => go("/parceiro")}>
            {t("partner_banner_btn")}
          </Btn>
        </div>
        <div className="flex flex-col items-start gap-6 rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-8 @3xl:p-12">
          <Icon name="Building2" className="size-8 text-primary" />
          <h2 className="font-display text-3xl leading-tight font-bold text-primary">
            {t("b2b_banner_title")}
          </h2>
          <Btn kind="ink" onClick={() => go("/empresas")}>
            {t("b2b_banner_btn")}
          </Btn>
        </div>
      </section>

      {/* Modal de Aviso Obrigatório para Criar Conta / Iniciar Sessão */}
      <AuthPromptModal
        open={authModal.open}
        onClose={() => setAuthModal((m) => ({ ...m, open: false }))}
        actionType={authModal.type}
        itemName={authModal.itemName}
      />
    </>
  );
}
