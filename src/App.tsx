import { useState, useMemo, useEffect } from "react";
import { useRoute, Icon } from "./ui/kit";
import { Header, Footer } from "./ui/Chrome";
import { findService, findCategory } from "./lib/data";
import { useStore } from "./lib/store";
import { WhatsApp } from "./ui/WhatsApp";
import { ResolveAI } from "./ui/ResolveAI";
import { MobileTabBar } from "./ui/MobileTabBar";
import { Home } from "./pages/Home";
import { Catalog, CategoryPage } from "./pages/Catalog";
import { Booking } from "./pages/Booking";
import { Admin } from "./pages/Admin";
import { ClientPortal } from "./pages/ClientPortal";
import { PartnerPortal } from "./pages/PartnerPortal";
import { EmployeePortal } from "./pages/EmployeePortal";
import { PartnerCompanyPortal } from "./pages/PartnerCompanyPortal";
import { Marketplace } from "./pages/Marketplace";
import { PracaMarketplace } from "./pages/PracaMarketplace";
import { PracaSellerPanel } from "./pages/PracaSellerPanel";
import { PracaAffiliatePanel } from "./pages/PracaAffiliatePanel";
import { PracaRegistration } from "./pages/PracaRegistration";
import { Importacao } from "./pages/Importacao";
import { Intermediario } from "./pages/Intermediario";
import { OperationsPanel } from "./pages/OperationsPanel";
import { CustomerSupportPanel } from "./pages/CustomerSupportPanel";
import { Auth } from "./pages/Auth";
import { Subscriptions } from "./pages/Subscriptions";
import {
  Orders,
  Partner,
  Business,
  About,
  Contacts,
  Legal,
  Account,
} from "./pages/Other";
import { AuthProvider } from "./lib/AuthContext";
import { ProtectedRoute } from "./lib/ProtectedRoute";

function AppContent() {
  const route = useRoute();
  const [store, updateStore] = useStore();
  const [showAI, setShowAI] = useState(false);
  const [path, query] = route.split("?");
  const parts = path.split("/").filter(Boolean);
  const q = new URLSearchParams(query || "").get("q");
  const tab = new URLSearchParams(query || "").get("tab") || undefined;

  // Track referral parameters across any landing link (?ref=... or ?afiliado=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(query || window.location.search || "");
    const refCode = urlParams.get("ref") || urlParams.get("afiliado");
    if (refCode) {
      const normalized = refCode.trim().toUpperCase();
      sessionStorage.setItem("rex_affiliate_ref", normalized);
      updateStore((s) => {
        // Increment clicks for matching affiliate if not already recorded this session
        const hasAff = s.affiliates?.some((a) => a.code === normalized);
        if (hasAff && s.activeAffiliateRef !== normalized) {
          return {
            activeAffiliateRef: normalized,
            affiliates: s.affiliates.map((a) =>
              a.code === normalized ? { ...a, totalClicks: a.totalClicks + 1 } : a
            ),
          };
        }
        return { activeAffiliateRef: normalized };
      });
    }
  }, [query]);

  const waMessage = useMemo(() => {
    if (parts[0] === "pedir") {
      const s = findService(parts[1]);
      if (s)
        return `Olá! Tenho interesse no serviço de ${s.name.toLowerCase()} da Resolve Express.`;
    }
    if (parts[0] === "servicos" && parts[1]) {
      const c = findCategory(parts[1]);
      if (c)
        return `Olá! Tenho interesse no serviço de ${c.name
          .replace("Resolve ", "")
          .toLowerCase()} da Resolve Express.`;
    }
    if (parts[0] === "parceiro")
      return "Olá! Gostaria de me tornar parceiro da Resolve Express.";
    if (parts[0] === "empresas")
      return "Olá! Gostaria de conhecer as soluções empresariais da Resolve Express.";
    return null;
  }, [route, parts]);

  let content;
  switch (parts[0]) {
    case undefined:
      content = <Home />;
      break;
    case "praca":
      if (parts[1] === "vendedor" || parts[1] === "painel-vendedor") {
        content = <PracaSellerPanel />;
      } else if (parts[1] === "afiliado" || parts[1] === "painel-afiliado") {
        content = <PracaAffiliatePanel />;
      } else if (parts[1] === "registo-vendedor" || parts[1] === "cadastrar-vendedor") {
        content = <PracaRegistration mode="seller" />;
      } else if (parts[1] === "registo-afiliado" || parts[1] === "cadastrar-afiliado") {
        content = <PracaRegistration mode="affiliate" />;
      } else {
        content = <PracaMarketplace />;
      }
      break;
    case "vendedor":
    case "painel-vendedor":
      content = <PracaSellerPanel />;
      break;
    case "afiliado":
    case "painel-afiliado":
      content = <PracaAffiliatePanel />;
      break;
    case "registo-vendedor":
      content = <PracaRegistration mode="seller" />;
      break;
    case "registo-afiliado":
      content = <PracaRegistration mode="affiliate" />;
      break;
    case "importacao":
    case "importacoes":
    case "cartoes-virtuais":
      content = <Importacao />;
      break;
    case "intermediario":
    case "intermediacao":
      content = <Intermediario />;
      break;
    case "servicos":
      content = parts[1] ? (
        <CategoryPage id={parts[1]} />
      ) : (
        <Catalog q={q} />
      );
      break;
    case "pedir":
      content = <Booking key={parts[1]} id={parts[1]} />;
      break;
    case "pedidos":
      content = <Orders />;
      break;
    case "produtos":
    case "loja":
    case "marketplace":
    case "carrinho":
      content = <Marketplace initialCategory={parts[1]} />;
      break;
    case "ambientes":
    case "escolha-ambiente":
      content = <Auth initialTab="login" mode="login" />;
      break;
    case "cadastro":
    case "registar":
    case "registo":
    case "entrar":
    case "login":
      content = (
        <Auth
          initialTab={
            parts[0] === "entrar" || parts[0] === "login" ? "login" : "register"
          }
          mode={
            parts[0] === "entrar" || parts[0] === "login" ? "login" : "register"
          }
        />
      );
      break;
    case "portal-cliente":
    case "conta":
      content = (
        <ProtectedRoute
          allowedRoles={["CUSTOMER", "ADMIN", "SUPER_ADMIN", "EMPLOYEE", "BUSINESS_PARTNER", "PARTNER", "PROFESSIONAL", "SELLER", "AFFILIATE", "OPERATIONS", "CUSTOMER_SUPPORT"]}
          roleTitle="Área do Cliente"
        >
          <ClientPortal defaultSection={tab} />
        </ProtectedRoute>
      );
      break;
    case "portal-empresa":
      content = (
        <ProtectedRoute
          allowedRoles={["BUSINESS_PARTNER", "PARTNER", "ADMIN", "SUPER_ADMIN"]}
          roleTitle="Portal da Empresa Parceira"
        >
          <PartnerCompanyPortal initialTab={tab} />
        </ProtectedRoute>
      );
      break;
    case "portal-parceiro":
      content = (
        <ProtectedRoute
          allowedRoles={["PROFESSIONAL", "ADMIN", "SUPER_ADMIN"]}
          roleTitle="Portal do Profissional Independente"
        >
          <PartnerPortal initialTab={tab} />
        </ProtectedRoute>
      );
      break;
    case "portal-funcionario":
      content = (
        <ProtectedRoute
          allowedRoles={["EMPLOYEE", "ADMIN", "SUPER_ADMIN"]}
          roleTitle="Portal do Funcionário de Campo"
        >
          <EmployeePortal initialTab={tab as any} />
        </ProtectedRoute>
      );
      break;
    case "operacao":
    case "painel-operacao":
    case "portal-operacao":
    case "producao":
      content = (
        <ProtectedRoute
          allowedRoles={["OPERATIONS", "ADMIN", "SUPER_ADMIN"]}
          roleTitle="Operação e Produção"
        >
          <OperationsPanel initialTab={tab} />
        </ProtectedRoute>
      );
      break;
    case "apoio":
    case "painel-apoio":
    case "portal-apoio":
    case "suporte":
    case "atendimento":
      content = (
        <ProtectedRoute
          allowedRoles={["CUSTOMER_SUPPORT", "ADMIN", "SUPER_ADMIN"]}
          roleTitle="Apoio ao Cliente"
        >
          <CustomerSupportPanel initialTab={tab} />
        </ProtectedRoute>
      );
      break;
    case "planos":
      content = <Subscriptions />;
      break;
    case "parceiro":
      content = <Partner />;
      break;
    case "empresas":
      content = <Business />;
      break;
    case "sobre":
      content = <About />;
      break;
    case "contactos":
      content = <Contacts />;
      break;
    case "legal":
      content = <Legal k={parts[1]} />;
      break;
    case "admin":
      content = (
        <ProtectedRoute
          allowedRoles={["ADMIN", "SUPER_ADMIN"]}
          roleTitle="Direção Executiva e Administração"
        >
          <Admin initialTab={tab} />
        </ProtectedRoute>
      );
      break;
    default:
      content = <Home />;
  }

  return (
    <div className="@container flex min-h-screen flex-col bg-background font-sans text-foreground overflow-x-clip">
      <Header
        route={"/" + parts.join("/")}
        onOpenAI={() => setShowAI(true)}
      />
      <main className="flex-1 pb-16 sm:pb-0">{content}</main>
      <Footer />

      {/* Floating Buttons: WhatsApp (Right) & Resolve AI (Left - Desktop) */}
      <WhatsApp message={waMessage} />

      {/* Floating Resolve AI Assistant Launcher (Desktop) */}
      <div className="fixed bottom-4 left-4 z-40 hidden sm:block @3xl:bottom-6 @3xl:left-6">
        <button
          type="button"
          onClick={() => setShowAI(true)}
          className="group flex items-center gap-2.5 rounded-full bg-ink px-4 py-3 text-white shadow-[0_12px_32px_oklch(0.2_0.06_258/0.25)] ring-1 ring-white/10 transition hover:scale-105 active:scale-95 hover:shadow-[0_16px_40px_oklch(0.2_0.06_258/0.35)]"
          aria-label="Falar com o assistente Resolve AI"
        >
          <span className="grid size-8 place-items-center rounded-full bg-action text-action-ink">
            <Icon name="Sparkles" className="size-4" />
          </span>
          <div className="text-left hidden sm:block pr-1">
            <span className="block text-xs font-black tracking-tight text-white leading-none">
              RESOLVE AI
            </span>
            <span className="block text-[11px] text-white/70 mt-0.5">
              Ajuda inteligente Huambo
            </span>
          </div>
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar with PWA install support */}
      <MobileTabBar
        currentRoute={"/" + parts.join("/")}
        onOpenAI={() => setShowAI(true)}
      />

      <ResolveAI isOpen={showAI} onClose={() => setShowAI(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
