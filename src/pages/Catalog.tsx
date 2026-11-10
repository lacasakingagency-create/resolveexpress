import { useState, useMemo } from "react";
import { Icon, go, Btn, Section, Empty } from "../ui/kit";
import {
  useStore,
  catActive,
  getStoreCategories,
  getStoreServices,
  findStoreCategory,
  formatCurrency,
} from "../lib/store";
import { Service, Category } from "../lib/data";
import { CategoryCard, ServiceCard } from "./Home";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function Catalog({ q }: { q?: string | null }) {
  const [store] = useStore();
  const [search, setSearch] = useState(q || "");
  const [selectedCatId, setSelectedCatId] = useState<string>("all");

  const categories = useMemo(
    () => getStoreCategories(store).filter((c) => catActive(store, c)),
    [store]
  );

  const allServices = useMemo(() => getStoreServices(store), [store]);

  // Featured services
  const featuredServices = useMemo(() => {
    return allServices.filter((s) => store.featured.includes(s.id));
  }, [allServices, store.featured]);

  // Filtered services based on search and category
  const filteredServices = useMemo(() => {
    let result = allServices;

    if (selectedCatId !== "all") {
      result = result.filter((s) => s.categoryId === selectedCatId);
    }

    if (search.trim()) {
      const qNorm = norm(search.trim());
      result = result.filter(
        (s) =>
          norm(s.name).includes(qNorm) ||
          norm(s.description || "").includes(qNorm) ||
          norm((s.includes || []).join(" ")).includes(qNorm)
      );
    }

    return result;
  }, [allServices, selectedCatId, search]);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="bg-primary text-white py-12 px-4 border-b border-border">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-xs text-action">
            <Icon name="Sparkles" className="size-3.5" /> Catálogo de Serviços Profissionais
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight">
            Serviços Especializados ao Domicílio
          </h1>
          <p className="max-w-2xl text-white/80 text-sm sm:text-base">
            Equipas verificadas para limpezas, reparações, canalização, eletricidade,
            apoio escolar e muito mais no Huambo e províncias de Angola.
          </p>

          {/* Search Bar */}
          <div className="pt-2 max-w-xl">
            <div className="relative">
              <Icon
                name="Search"
                className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar serviço (ex.: canalizador, ar condicionado, explicação, faxina)..."
                className="w-full rounded-[var(--radius)] bg-paper text-foreground pl-12 pr-10 py-3 text-sm shadow-lg border border-border focus:outline-hidden focus:ring-2 focus:ring-action"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon name="X" className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 space-y-8">
        {/* Category Pills/Filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Departamentos & Categorias
            </span>
            <span className="text-xs text-muted-foreground">
              {allServices.length} serviços disponíveis
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCatId("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                selectedCatId === "all"
                  ? "bg-action text-white shadow-xs"
                  : "bg-paper border border-border text-primary hover:border-action/40"
              }`}
            >
              <Icon name="Grid" className="size-3.5" /> Todos os Departamentos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCatId(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                  selectedCatId === c.id
                    ? "bg-action text-white shadow-xs"
                    : "bg-paper border border-border text-primary hover:border-action/40"
                }`}
              >
                <Icon name={c.icon} className="size-3.5" />
                {c.name.replace("Resolve ", "")}
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCatId === c.id ? "bg-white/20 text-white" : "bg-mist text-muted-foreground"
                  }`}
                >
                  {c.services.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Services Shelf (When viewing all and no search query) */}
        {selectedCatId === "all" && !search && featuredServices.length > 0 && (
          <div className="rounded-[calc(var(--radius)*1.2)] border border-action/30 bg-action/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-action text-white shadow-xs">
                  <Icon name="Star" className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-black text-primary">
                    ⭐ Serviços em Destaque
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Os serviços mais requisitados pelos clientes com alta taxa de aprovação
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-action/15 text-action text-xs font-bold px-2.5 py-0.5">
                Populares
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredServices.slice(0, 6).map((s) => (
                <ServiceCard key={s.id} svc={s} />
              ))}
            </div>
          </div>
        )}

        {/* Services Grouped by Category OR Filtered List */}
        {search || selectedCatId !== "all" ? (
          /* Filtered Flat Grid */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-primary">
                {selectedCatId !== "all"
                  ? categories.find((c) => c.id === selectedCatId)?.name
                  : `Resultados da pesquisa`}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredServices.length} serviços encontrados)
                </span>
              </h2>
              {selectedCatId !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedCatId("all")}
                  className="text-xs text-action hover:underline font-bold"
                >
                  Ver todos
                </button>
              )}
            </div>

            {filteredServices.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((s) => (
                  <ServiceCard key={s.id} svc={s} />
                ))}
              </div>
            ) : (
              <Empty
                icon="SearchX"
                title="Nenhum serviço encontrado"
                text="Tente alterar os termos da pesquisa ou selecione outro departamento."
              >
                <Btn
                  kind="ghost"
                  onClick={() => {
                    setSearch("");
                    setSelectedCatId("all");
                  }}
                >
                  Limpar filtros
                </Btn>
              </Empty>
            )}
          </div>
        ) : (
          /* Categorized Shelves for All Services */
          <div className="space-y-10">
            {categories.map((c) => {
              if (c.services.length === 0) return null;
              return (
                <div key={c.id} className="space-y-4">
                  {/* Category Shelf Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-primary text-action shadow-xs">
                        <Icon name={c.icon} className="size-5" />
                      </span>
                      <div>
                        <h3 className="font-display text-lg font-black text-primary">
                          {c.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{c.short}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCatId(c.id)}
                      className="text-xs font-bold text-action hover:underline flex items-center gap-1 self-start sm:self-auto"
                    >
                      Ver todos ({c.services.length}) <Icon name="ArrowRight" className="size-3" />
                    </button>
                  </div>

                  {/* Category Services Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {c.services.slice(0, 3).map((s) => (
                      <ServiceCard key={s.id} svc={s} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CategoryPage({ id }: { id: string }) {
  const [store] = useStore();
  const cat = findStoreCategory(store, id);

  if (!cat || !catActive(store, cat)) {
    return (
      <Section title="Departamento indisponível">
        <Empty
          title="Este departamento não está ativo"
          text="Pode estar temporariamente desativado."
        >
          <Btn onClick={() => go("/servicos")}>Ver serviços</Btn>
        </Empty>
      </Section>
    );
  }

  return (
    <>
      <div className="bg-primary text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 @3xl:px-8">
          <button
            type="button"
            onClick={() => go("/servicos")}
            className="flex w-fit items-center gap-1 text-sm text-white/70 hover:text-white"
          >
            <Icon name="ArrowLeft" className="size-4" /> Todos os serviços
          </button>
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-[12px] bg-action text-white">
              <Icon name={cat.icon} className="size-7" />
            </span>
            <div>
              <h1 className="font-display text-4xl font-black tracking-tight @3xl:text-5xl">
                {cat.name.toUpperCase()}
              </h1>
              <p className="max-w-xl text-base text-white/75 mt-1">{cat.short}</p>
            </div>
          </div>
        </div>
      </div>
      <Section title={`${cat.services.length} serviços disponíveis`}>
        <div className="grid gap-4 @3xl:grid-cols-2 @5xl:grid-cols-3">
          {cat.services.map((s) => (
            <ServiceCard key={s.id} svc={s} />
          ))}
        </div>
      </Section>
    </>
  );
}
