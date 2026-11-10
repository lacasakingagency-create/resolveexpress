import { useState, useRef, useEffect } from "react";
import { Icon, go, Btn } from "./kit";
import { LOCATIONS, LEGAL_DOCS } from "../lib/data";
import { useStore, type CurrencyCode, type LanguageCode } from "../lib/store";
import { useI18n } from "../lib/i18n";

const NAV_ITEMS: [string, string][] = [
  ["Início", "/"],
  ["Serviços", "/servicos"],
  ["PRAÇA", "/praca"],
  ["Importação", "/importacao"],
  ["Intermediário", "/intermediario"],
  ["Loja de Produtos", "/produtos"],
  ["Planos", "/planos"],
  ["Como funciona", "/#como"],
  ["Seja um profissional", "/parceiro"],
  ["Empresas", "/empresas"],
  ["Sobre nós", "/sobre"],
  ["Contactos", "/contactos"],
];

export const Wordmark = ({ light }: { light?: boolean }) => {
  const [store] = useStore();
  const logoSrc =
    store.customLogo && store.customLogo.trim()
      ? store.customLogo.trim()
      : "/assets/aistudio/file_0000000077e8820eae7db33507894d75_a4e26357.png";

  return (
    <button
      type="button"
      onClick={() => go("/")}
      className="flex items-center gap-2 text-left group transition-transform active:scale-95 cursor-pointer"
      aria-label="Resolve Express, início"
    >
      <img
        src={logoSrc}
        alt="RESOLVE EXPRESS"
        className={
          "h-10 sm:h-12 w-auto max-w-[210px] sm:max-w-[260px] object-contain transition-opacity group-hover:opacity-95 " +
          (light ? "bg-white px-2.5 py-1.5 rounded-xl shadow-xs" : "")
        }
      />
    </button>
  );
};

export function LocationPicker({ compact }: { compact?: boolean }) {
  const [store, setStore] = useStore();
  const loc = store.location || "huambo";
  return (
    <label
      className={
        "relative flex items-center gap-2 border pr-2 pl-3 " +
        (compact
          ? "min-h-9 rounded-full border-white/30 bg-white text-primary shadow-xs"
          : "min-h-12 rounded-[var(--radius)] border-border bg-paper text-foreground")
      }
    >
      <Icon name="MapPin" className="size-4 shrink-0 text-action" />
      <span className="sr-only">Localização</span>
      <select
        value={loc}
        onChange={(e) => setStore(() => ({ location: e.target.value }))}
        className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-xs sm:text-sm font-bold text-primary outline-none"
      >
        {LOCATIONS.map((l) => (
          <option key={l.id} value={l.id} disabled={!l.active} className="text-primary bg-white font-medium">
            {l.name}
            {l.active ? "" : " · em breve"}
          </option>
        ))}
      </select>
      <Icon
        name="ChevronDown"
        className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground"
      />
    </label>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-mist hover:text-action transition cursor-pointer text-left"
    >
      <Icon name={icon} className="size-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ProfileMenu({ onNav }: { onNav?: (path: string) => void }) {
  const [store, setStore] = useStore();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const user = store.currentUser;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 250);
  };

  const navigate = (path: string) => {
    setOpen(false);
    if (onNav) onNav(path);
    else go(path);
  };

  const handleLogout = () => {
    setOpen(false);
    setStore(() => ({ currentUser: null }));
    go("/");
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "RX";

  const getRoleBadge = () => {
    if (!user) return null;
    switch (user.role) {
      case "CUSTOMER":
        return { label: "Cliente", color: "bg-action/20 text-action-text border-action/30" };
      case "SELLER":
        return { label: "Vendedor da Praça", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
      case "AFFILIATE":
        return { label: "Afiliado Oficial", color: "bg-indigo-100 text-indigo-800 border-indigo-300" };
      case "EMPLOYEE":
        return { label: "Funcionário", color: "bg-blue-100 text-blue-700 border-blue-200" };
      case "PARTNER":
      case "BUSINESS_PARTNER":
        return { label: "Empresa Parceira", color: "bg-amber-100 text-amber-700 border-amber-200" };
      case "PROFESSIONAL":
        return { label: "Profissional Independente", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      case "OPERATIONS":
        return { label: "Operação e Produção", color: "bg-blue-100 text-blue-800 border-blue-300" };
      case "CUSTOMER_SUPPORT":
        return { label: "Apoio ao Cliente", color: "bg-teal-100 text-teal-800 border-teal-300" };
      case "ADMIN":
        return { label: "Administrador", color: "bg-red-100 text-red-700 border-red-200" };
      case "SUPER_ADMIN":
        return { label: "Super Administrador", color: "bg-purple-100 text-purple-700 border-purple-200" };
      default:
        return { label: "Utilizador", color: "bg-mist text-primary border-border" };
    }
  };

  const badge = getRoleBadge();

  if (!user) return null;

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Botão de Perfil no Canto Superior Direito */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Menu de perfil do utilizador"
        className="flex items-center gap-1.5 rounded-full p-0.5 transition hover:opacity-95 cursor-pointer focus:outline-none"
      >
        <div
          className={
            "relative flex size-10 items-center justify-center rounded-full border-2 border-white transition-all shadow-sm " +
            (user
              ? user.role === "CUSTOMER"
                ? "bg-primary text-white"
                : user.role === "EMPLOYEE"
                ? "bg-blue-700 text-white"
                : user.role === "PARTNER" || user.role === "BUSINESS_PARTNER"
                ? "bg-amber-700 text-white"
                : user.role === "PROFESSIONAL"
                ? "bg-emerald-700 text-white"
                : user.role === "OPERATIONS"
                ? "bg-sky-700 text-white"
                : user.role === "CUSTOMER_SUPPORT"
                ? "bg-teal-700 text-white"
                : "bg-red-700 text-white"
              : "bg-white/20 text-white")
          }
        >
          {user?.avatar && typeof user.avatar === "string" && user.avatar.trim() ? (
            <img
              src={user.avatar.trim()}
              alt={user.name || "Utilizador"}
              className="size-full rounded-full object-cover"
            />
          ) : user ? (
            <span className="text-xs font-black tracking-tight">{initials}</span>
          ) : (
            <Icon name="User" className="size-5 text-primary" />
          )}

          {/* Indicador de estado ativo */}
          {user && (
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-ok border-2 border-paper" />
          )}
        </div>
      </button>

      {/* Menu Suspenso */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-border bg-paper p-3 shadow-2xl text-left animate-in fade-in slide-in-from-top-2 duration-150">
          {user ? (
            <>
              {/* Cabeçalho com dados do Utilizador */}
              <div className="flex items-center gap-3 border-b border-border pb-3 mb-2 px-1">
                <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary font-black text-sm">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-primary">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.email || user.phone}</p>
                  {badge && (
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Opções estritamente autorizadas para o papel */}
              <div className="space-y-0.5 text-xs font-semibold">
                {user.role === "CUSTOMER" && (
                  <>
                    <MenuItem icon="User" label="1. Minha conta" onClick={() => navigate("/portal-cliente?tab=perfil")} />
                    <MenuItem icon="ShoppingBag" label="2. Minhas compras" onClick={() => navigate("/portal-cliente?tab=compras")} />
                    <MenuItem icon="ClipboardList" label="3. Meus pedidos" onClick={() => navigate("/pedidos")} />
                    <MenuItem icon="Wrench" label="4. Meus serviços" onClick={() => navigate("/portal-cliente?tab=servicos")} />
                    <MenuItem icon="MapPin" label="5. Endereços guardados" onClick={() => navigate("/portal-cliente?tab=enderecos")} />
                    <MenuItem icon="Heart" label="6. Favoritos" onClick={() => navigate("/portal-cliente?tab=favoritos")} />
                    <MenuItem icon="Headphones" label="7. Ajuda e suporte" onClick={() => navigate("/portal-cliente?tab=apoio")} />
                  </>
                )}

                {user.role === "EMPLOYEE" && (
                  <>
                    <MenuItem icon="User" label="1. Meu perfil" onClick={() => navigate("/portal-funcionario?tab=perfil")} />
                    <MenuItem icon="LayoutDashboard" label="2. Meu painel de trabalho" onClick={() => navigate("/portal-funcionario")} />
                    <MenuItem icon="CheckSquare" label="3. Minhas tarefas" onClick={() => navigate("/portal-funcionario?tab=agenda")} />
                    <MenuItem icon="Calendar" label="4. Minha agenda" onClick={() => navigate("/portal-funcionario?tab=agenda")} />
                    <MenuItem icon="CreditCard" label="5. Meus pagamentos" onClick={() => navigate("/portal-funcionario?tab=supervision")} />
                    <MenuItem icon="HelpCircle" label="6. Ajuda e suporte" onClick={() => navigate("/contactos")} />
                  </>
                )}

                {(user.role === "PARTNER" || user.role === "BUSINESS_PARTNER") && (
                  <>
                    <MenuItem icon="Building2" label="1. Perfil da empresa" onClick={() => navigate("/portal-empresa?tab=perfil")} />
                    <MenuItem icon="LayoutDashboard" label="2. Painel da empresa" onClick={() => navigate("/portal-empresa?tab=painel")} />
                    <MenuItem icon="Package" label="3. Meus produtos" onClick={() => navigate("/portal-empresa?tab=produtos")} />
                    <MenuItem icon="Wrench" label="4. Meus serviços" onClick={() => navigate("/portal-empresa?tab=servicos")} />
                    <MenuItem icon="ShoppingBasket" label="5. Minhas encomendas" onClick={() => navigate("/portal-empresa?tab=encomendas")} />
                    <MenuItem icon="TrendingUp" label="6. Vendas e receitas" onClick={() => navigate("/portal-empresa?tab=financeiro")} />
                    <MenuItem icon="FileCheck" label="7. Documentos e aprovação" onClick={() => navigate("/portal-empresa?tab=perfil")} />
                  </>
                )}

                {user.role === "PROFESSIONAL" && (
                  <>
                    <MenuItem icon="UserCheck" label="1. Meu perfil profissional" onClick={() => navigate("/portal-parceiro?tab=perfil")} />
                    <MenuItem icon="LayoutDashboard" label="2. Meu painel" onClick={() => navigate("/portal-parceiro")} />
                    <MenuItem icon="Inbox" label="3. Pedidos recebidos" onClick={() => navigate("/portal-parceiro?tab=jobs")} />
                    <MenuItem icon="Briefcase" label="4. Serviços publicados" onClick={() => navigate("/portal-parceiro?tab=availability")} />
                    <MenuItem icon="Calendar" label="5. Minha agenda" onClick={() => navigate("/portal-parceiro?tab=availability")} />
                    <MenuItem icon="Wallet" label="6. Meus ganhos" onClick={() => navigate("/portal-parceiro?tab=wallet")} />
                    <MenuItem icon="Star" label="7. Avaliações" onClick={() => navigate("/portal-parceiro?tab=reviews")} />
                  </>
                )}

                {user.role === "SELLER" && (
                  <>
                    <MenuItem icon="Store" label="1. Painel do Vendedor" onClick={() => navigate("/praca/painel-vendedor")} />
                    <MenuItem icon="Package" label="2. Meus Produtos na Praça" onClick={() => navigate("/praca/painel-vendedor?tab=produtos")} />
                    <MenuItem icon="ShoppingBasket" label="3. Pedidos da Loja" onClick={() => navigate("/praca/painel-vendedor?tab=pedidos")} />
                    <MenuItem icon="Wallet" label="4. Finanças & Saldo" onClick={() => navigate("/praca/painel-vendedor?tab=financas")} />
                    <MenuItem icon="Calculator" label="5. Calculadora de Comissões" onClick={() => navigate("/praca/painel-vendedor?tab=calculadora")} />
                    <MenuItem icon="ShoppingBag" label="6. Catálogo da Praça" onClick={() => navigate("/praca")} />
                  </>
                )}

                {user.role === "AFFILIATE" && (
                  <>
                    <MenuItem icon="TrendingUp" label="1. Painel de Afiliado" onClick={() => navigate("/praca/painel-afiliado")} />
                    <MenuItem icon="Link" label="2. Gerar Links de Afiliado" onClick={() => navigate("/praca/painel-afiliado?tab=links")} />
                    <MenuItem icon="Calculator" label="3. Calculadora de Comissões" onClick={() => navigate("/praca/painel-afiliado?tab=calculadora")} />
                    <MenuItem icon="DollarSign" label="4. Minhas Vendas & Comissões" onClick={() => navigate("/praca/painel-afiliado?tab=vendas")} />
                    <MenuItem icon="CreditCard" label="5. Solicitar Levantamento" onClick={() => navigate("/praca/painel-afiliado?tab=levantamento")} />
                  </>
                )}

                {user.role === "OPERATIONS" && (
                  <>
                    <MenuItem icon="Workflow" label="1. Painel Operacional Geral" onClick={() => navigate("/operacao")} />
                    <MenuItem icon="CheckSquare" label="2. Pedidos & Serviços em Curso" onClick={() => navigate("/operacao?tab=servicos")} />
                    <MenuItem icon="Truck" label="3. Logística & Rotas no Huambo" onClick={() => navigate("/operacao?tab=logistica")} />
                    <MenuItem icon="Store" label="4. Monitorização da Praça" onClick={() => navigate("/operacao?tab=praca")} />
                    <MenuItem icon="Globe" label="5. Acompanhamento de Importações" onClick={() => navigate("/operacao?tab=importacoes")} />
                    <MenuItem icon="ShieldCheck" label="6. Vistorias & Intermediação" onClick={() => navigate("/operacao?tab=intermediario")} />
                    <MenuItem icon="AlertTriangle" label="7. Ocorrências & SLA de Campo" onClick={() => navigate("/operacao?tab=ocorrencias")} />
                  </>
                )}

                {user.role === "CUSTOMER_SUPPORT" && (
                  <>
                    <MenuItem icon="Headphones" label="1. Painel de Atendimento Geral" onClick={() => navigate("/apoio")} />
                    <MenuItem icon="Inbox" label="2. Central de Tickets & Fila" onClick={() => navigate("/apoio?tab=tickets")} />
                    <MenuItem icon="PlusCircle" label="3. Registar Novo Atendimento" onClick={() => navigate("/apoio?tab=novo")} />
                    <MenuItem icon="MessageCircle" label="4. Contactar Clientes (WhatsApp)" onClick={() => navigate("/apoio?tab=whatsapp")} />
                    <MenuItem icon="RefreshCw" label="5. Reclamações & Devoluções" onClick={() => navigate("/apoio?tab=reclamacoes")} />
                    <MenuItem icon="BookOpen" label="6. Base de Conhecimento & FAQs" onClick={() => navigate("/apoio?tab=base")} />
                  </>
                )}

                {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                  <>
                    <MenuItem icon="Shield" label="1. Perfil administrativo" onClick={() => navigate("/admin?tab=config")} />
                    <MenuItem icon="LayoutDashboard" label="2. Painel executivo" onClick={() => navigate("/admin?tab=dashboard")} />
                    <MenuItem icon="Store" label="3. Gestão da Praça (Marketplace)" onClick={() => navigate("/admin?tab=praca")} />
                    <MenuItem icon="Users" label="4. Gestão de utilizadores" onClick={() => navigate("/admin?tab=partners")} />
                    <MenuItem icon="Settings" label="5. Gestão operacional" onClick={() => navigate("/admin?tab=orders")} />
                    <MenuItem icon="TrendingUp" label="6. Gestão financeira" onClick={() => navigate("/admin?tab=dashboard")} />
                    <MenuItem icon="Sliders" label="7. Configurações" onClick={() => navigate("/admin?tab=config")} />
                  </>
                )}

                {/* Atalhos para qualquer utilizador aderir à Praça */}
                {user.role !== "SELLER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && (
                  <div className="border-t border-border pt-1.5 my-1">
                    <MenuItem icon="Store" label="🛍️ Quero Vender na Praça" onClick={() => navigate("/praca/registo-vendedor")} />
                  </div>
                )}
                {user.role !== "AFFILIATE" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && (
                  <div className="pt-0.5">
                    <MenuItem icon="Award" label="🔗 Quero Ser Afiliado" onClick={() => navigate("/praca/registo-afiliado")} />
                  </div>
                )}

                <div className="border-t border-border pt-2 mt-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
                  >
                    <Icon name="LogOut" className="size-4" />
                    <span>8. Sair da Conta</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="px-2 py-2 mb-2 border-b border-border">
                <p className="font-display text-sm font-bold text-primary">Conta Resolve Express</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aceda à sua conta para gerir pedidos, serviços e produtos no Huambo.
                </p>
              </div>

              <div className="space-y-1.5 p-1">
                <Btn kind="action" className="w-full text-xs" onClick={() => navigate("/entrar")}>
                  <Icon name="LogIn" className="size-3.5" /> Iniciar Sessão
                </Btn>
                <Btn kind="ghost" className="w-full text-xs" onClick={() => navigate("/cadastro")}>
                  <Icon name="UserPlus" className="size-3.5" /> Criar Conta de Cliente
                </Btn>
                <button
                  type="button"
                  onClick={() => navigate("/ambientes")}
                  className="mt-2 w-full text-center text-xs font-bold text-action hover:underline py-1"
                >
                  🏢 Escolha o seu ambiente (5 Portais)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({
  route,
  onOpenAI,
}: {
  route: string;
  onOpenAI?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [store, setStore] = useStore();
  const { t } = useI18n();
  const isAdmin = store.currentUser?.role === "ADMIN" || store.currentUser?.role === "SUPER_ADMIN";

  const navItems: [string, string][] = [
    [t("nav_home"), "/"],
    [t("nav_services"), "/servicos"],
    [t("nav_praca"), "/praca"],
    ["Importação", "/importacao"],
    ["Intermediário", "/intermediario"],
    [t("nav_products"), "/produtos"],
    [t("nav_plans"), "/planos"],
    [t("nav_how_it_works"), "/#como"],
    [t("nav_be_partner"), "/parceiro"],
    [t("nav_companies"), "/empresas"],
    [t("nav_about"), "/sobre"],
    [t("nav_contacts"), "/contactos"],
  ];

  const nav = (path: string) => {
    setOpen(false);
    if (path === "/#como") {
      if (route !== "/") go("/");
      setTimeout(
        () => document.getElementById("como")?.scrollIntoView({ behavior: "smooth" }),
        60
      );
    } else {
      go(path);
    }
  };

  const active = (path: string) =>
    path === "/" ? route === "/" : route.startsWith(path) && path !== "/#como";

  return (
    <header className="sticky top-0 z-40 shadow-md w-full overflow-x-clip bg-action">
      {/* Upper micro-bar: Cor azul do sistema */}
      <div className="border-b border-white/10 bg-primary text-white text-xs w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-1.5">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white/90 hidden sm:inline">
              🇦🇴 Angola
            </span>
            <div className="flex items-center gap-1">
              <span className="text-white/70">{t("nav_currency")}</span>
              <select
                value={store.currency}
                onChange={(e) =>
                  setStore(() => ({ currency: e.target.value as CurrencyCode }))
                }
                className="bg-transparent font-bold text-white cursor-pointer outline-none"
              >
                <option value="AOA" className="text-primary bg-white font-medium">AOA (Kz)</option>
                <option value="USD" className="text-primary bg-white font-medium">USD ($)</option>
                <option value="EUR" className="text-primary bg-white font-medium">EUR (€)</option>
              </select>
            </div>
            <div className="flex items-center gap-1 border-l border-white/20 pl-3">
              <span className="text-white/70">{t("nav_language")}</span>
              <select
                value={store.language}
                onChange={(e) =>
                  setStore(() => ({ language: e.target.value as LanguageCode }))
                }
                className="bg-transparent font-bold text-white cursor-pointer outline-none"
              >
                <option value="PT" className="text-primary bg-white font-medium">Português</option>
                <option value="EN" className="text-primary bg-white font-medium">English</option>
                <option value="ES" className="text-primary bg-white font-medium">Español</option>
                <option value="FR" className="text-primary bg-white font-medium">Français</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-white/80 font-medium">
            <span className="hidden sm:inline">{t("nav_support")} <strong className="text-white font-bold">+244 923 111 222</strong></span>
            <span className="hidden md:inline border-l border-white/20 pl-3">{t("nav_hours")} <strong className="text-white font-bold">Seg - Sáb 07h às 19h</strong></span>
          </div>
        </div>
      </div>

      {/* Main Header: Cor laranja do sistema */}
      <div className="bg-action text-white shadow-sm w-full">
        <div className="mx-auto flex h-16 sm:h-20 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Wordmark light />
          </div>

          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map(([label, path]) => (
              <button
                key={path}
                type="button"
                onClick={() => nav(path)}
                className={
                  "rounded-full px-2.5 py-1 2xl:px-3 2xl:py-1.5 text-xs 2xl:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 " +
                  (active(path)
                    ? "bg-white text-action shadow-xs"
                    : "text-white/95 hover:text-white hover:bg-white/15")
                }
              >
                <span>{label}</span>
                {path === "/praca" && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition ${
                      active(path)
                        ? "bg-action text-white"
                        : "bg-white text-action shadow-2xs"
                    }`}
                  >
                    Marketplace
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Resolve AI Header Button */}
            {onOpenAI && (
              <button
                type="button"
                onClick={onOpenAI}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white hover:text-action border border-white/30 backdrop-blur-xs shrink-0 cursor-pointer"
                title="Abrir assistente Resolve AI"
              >
                <Icon name="Sparkles" className="size-3.5 text-white" />
                <span className="hidden sm:inline">Resolve AI</span>
              </button>
            )}

            {/* Shopping Cart button with counter badge */}
            <button
              type="button"
              onClick={() => nav("/produtos")}
              className="relative inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white hover:text-action border border-white/30 backdrop-blur-xs shrink-0 cursor-pointer"
              title="Ver catálogo de produtos e carrinho"
            >
              <Icon name="ShoppingCart" className="size-3.5 text-white" />
              <span className="hidden md:inline">{t("nav_cart")}</span>
              {store.cart.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-white text-[10px] font-black text-action">
                  {store.cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>

            <div className="hidden 2xl:block w-36 shrink-0">
              <LocationPicker compact />
            </div>

            {/* Botão de Perfil (se autenticado) ou Entrar (se deslogado) */}
            <div className="shrink-0">
              {store.currentUser ? (
                <ProfileMenu onNav={nav} />
              ) : (
                <button
                  type="button"
                  onClick={() => nav("/entrar")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-action transition cursor-pointer border border-white/30 whitespace-nowrap"
                >
                  <Icon name="LogIn" className="size-4" />
                  <span>{t("nav_login")}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="grid size-10 place-items-center rounded-xl text-white hover:bg-white/15 xl:hidden shrink-0 cursor-pointer"
            >
              <Icon name={open ? "X" : "Menu"} className="size-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="menu-in border-t border-border bg-background px-4 pt-2 pb-6 xl:hidden">
          {/* Mobile Profile Card */}
          {store.currentUser ? (
            <div className="mb-3 rounded-xl border border-border bg-paper p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-full bg-primary text-white text-xs font-black">
                    {store.currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-primary truncate max-w-[170px]">
                      {store.currentUser.name}
                    </p>
                    <span className="text-[10px] font-semibold text-action uppercase tracking-wider">
                      {store.currentUser.role}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStore(() => ({ currentUser: null }));
                    nav("/");
                  }}
                  className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                >
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2">
              <Btn kind="action" className="flex-1 text-xs min-h-10" onClick={() => nav("/entrar")}>
                Iniciar Sessão
              </Btn>
              <Btn kind="ghost" className="flex-1 text-xs min-h-10" onClick={() => nav("/cadastro")}>
                Criar Conta
              </Btn>
            </div>
          )}

          <div className="mb-3 @5xl:hidden">
            <LocationPicker />
          </div>
          {NAV_ITEMS.map(([label, path]) => (
            <button
              key={path}
              type="button"
              onClick={() => nav(path)}
              className="flex min-h-12 w-full items-center justify-between border-b border-border text-left font-display text-lg font-bold"
            >
              {label}
              <Icon name="ArrowRight" className="size-4 text-action" />
            </button>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Btn kind="action" className="col-span-2 min-h-11" onClick={() => nav("/praca")}>
              🏪 A PRAÇA — Marketplace
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/importacao")}>
              ✈️ Importação
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/intermediario")}>
              🤝 Intermediário
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/praca/painel-vendedor")}>
              📦 Painel Vendedor
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/praca/painel-afiliado")}>
              🚀 Painel Afiliado
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/produtos")}>
              🛍️ Loja Produtos
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/servicos")}>
              🔍 Serviços
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/portal-cliente")}>
              Portal Cliente
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/portal-funcionario")}>
              Portal Funcionário
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/portal-empresa")}>
              Portal Empresa
            </Btn>
            <Btn kind="ghost" onClick={() => nav("/portal-parceiro")}>
              Profissional
            </Btn>
            {isAdmin && (
              <Btn kind="ink" className="col-span-2" onClick={() => nav("/admin?tab=praca")}>
                🔒 Gestão da Praça (Admin)
              </Btn>
            )}
            <Btn className="col-span-2" onClick={() => nav("/servicos")}>
              {t("nav_services")}
            </Btn>
          </div>
        </div>
      )}
    </header>
  );
}

const L = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <button type="button" onClick={() => go(to)} className="text-left hover:text-white transition-colors">
    {children}
  </button>
);

export function Footer() {
  const [store] = useStore();
  const { t } = useI18n();
  const colCls = "flex flex-col gap-2 text-sm text-white/70";
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-28 @3xl:grid-cols-[1.4fr_1fr_1fr_1fr] @3xl:px-8">
        <div className="flex flex-col gap-4">
          <Wordmark light />
          <p className="max-w-xs font-display text-2xl leading-tight font-bold">
            {t("footer_tagline_1")}
            <br />
            <span className="text-action">{t("footer_tagline_2")}</span>
          </p>
          <p className="text-sm text-white/75">
            {t("footer_desc")}
          </p>
        </div>
        <div className={colCls}>
          <p className="mb-1 font-display font-bold text-white">{t("footer_col_market")}</p>
          <L to="/servicos">{t("nav_services")}</L>
          <L to="/praca">A PRAÇA Marketplace</L>
          <L to="/importacao">Importação & Cartões</L>
          <L to="/intermediario">Intermediário</L>
          <L to="/produtos">{t("nav_products")}</L>
          <L to="/planos">{t("nav_plans")}</L>
          <L to="/parceiro">{t("nav_be_partner")}</L>
          <L to="/empresas">{t("nav_companies")}</L>
          <L to="/cadastro">{t("nav_register")}</L>
          <L to="/contactos">{t("nav_contacts")}</L>
        </div>
        <div className={colCls}>
          <p className="mb-1 font-display font-bold text-white">{t("footer_col_portals")}</p>
          <L to="/portal-cliente">{t("footer_client_portal")}</L>
          <L to="/portal-funcionario">{t("footer_employee_portal")}</L>
          <L to="/portal-empresa">{t("footer_partner_company")}</L>
          <L to="/portal-parceiro">{t("footer_independent_portal")}</L>
          <L to="/pedidos">{t("footer_my_orders")}</L>
          <L to="/produtos">{t("nav_cart")}</L>
        </div>
        <div className={colCls}>
          <p className="mb-1 font-display font-bold text-white">{t("footer_col_legal")}</p>
          {Object.entries(LEGAL_DOCS)
            .slice(0, 4)
            .map(([k, v]) => (
              <L key={k} to={`/legal/${k}`}>
                {v}
              </L>
            ))}
          <span>
            WhatsApp:{" "}
            {store.whatsapp
              ? `+${store.whatsapp.replace(/\D/g, "")}`
              : "+244 923 000 000"}
          </span>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-6 text-center text-sm text-white/70">
        © {new Date().getFullYear()} Resolve Express. {t("footer_rights")}
      </div>
    </footer>
  );
}
