import { useState, useEffect } from "react";
import { Icon, Btn, Field, inputCls, Empty, go } from "../ui/kit";
import {
  PROVIDERS,
  CATEGORIES,
  PRODUCT_CATEGORIES,
  DEFAULT_HERO_BANNERS,
  type Service,
  type Product,
  type Category,
  type HeroBanner,
} from "../lib/data";
import {
  useStore,
  svcConfig,
  kz,
  waLink,
  formatCurrency,
  getStoreCategories,
  getStoreServices,
  saveAdminStateAsync,
} from "../lib/store";
import { StatusPill } from "./Other";
import { saveSupabaseProduct } from "../lib/supabase";
import { ImageUploader } from "../ui/ImageUploader";
import { PracaAdminSection } from "./PracaAdminSection";
import { ImportAdminSection } from "./ImportAdminSection";
import { IntermediarioAdminSection } from "./IntermediarioAdminSection";

const STATUSES: Array<"Recebido" | "Confirmado" | "Em curso" | "Concluído" | "Cancelado"> = [
  "Recebido",
  "Confirmado",
  "Em curso",
  "Concluído",
  "Cancelado",
];

export function Admin({ initialTab }: { initialTab?: string }) {
  const [store, setStore] = useStore();
  const [tab, setTab] = useState<
    | "dashboard"
    | "banners"
    | "config"
    | "catalog"
    | "orders"
    | "productOrders"
    | "products"
    | "partners"
    | "apps"
    | "employees"
    | "contracts"
    | "coupons"
    | "support"
    | "praca"
    | "importacao"
    | "intermediario"
  >(
    initialTab === "praca" || initialTab === "marketplace" || initialTab === "vendedores" || initialTab === "afiliados"
      ? "praca"
      : initialTab === "importacao" || initialTab === "cartoes"
      ? "importacao"
      : initialTab === "intermediario" || initialTab === "intermediacao"
      ? "intermediario"
      : initialTab === "banners" || initialTab === "hero"
      ? "banners"
      : initialTab === "utilizadores" || initialTab === "users"
      ? "partners"
      : initialTab === "operacional"
      ? "orders"
      : initialTab === "financeiro"
      ? "dashboard"
      : initialTab === "configuracoes" || initialTab === "config"
      ? "config"
      : (initialTab as any) || "dashboard"
  );

  // Administrative asynchronous save status (PARTE 1)
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ message: string; ok: boolean } | null>(null);

  const executeAdminSave = async (
    updater: (st: any) => any,
    actionName: string,
    details?: string
  ): Promise<boolean> => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = await saveAdminStateAsync(updater, actionName, details);
      setIsSaving(false);
      if (result.ok) {
        setSaveStatus({
          message: `${actionName} gravado e sincronizado com sucesso com todos os utilizadores!`,
          ok: true,
        });
        setTimeout(() => setSaveStatus(null), 4000);
        return true;
      } else {
        setSaveStatus({
          message: `Falha ao gravar alterações: ${result.error || "Erro desconhecido"}`,
          ok: false,
        });
        return false;
      }
    } catch (e: any) {
      setIsSaving(false);
      setSaveStatus({
        message: `Erro inesperado na gravação: ${e.message}`,
        ok: false,
      });
      return false;
    }
  };

  const executePersistentSave = executeAdminSave;

  // RBAC Access Control
  const isAuthorizedAdmin =
    store.currentUser &&
    (store.currentUser.role === "ADMIN" || store.currentUser.role === "SUPER_ADMIN") &&
    store.currentUser.active;

  if (!isAuthorizedAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-neutral-900 text-white shadow-xl">
          <Icon name="ShieldAlert" className="size-8 text-action" />
        </div>
        <span className="inline-block rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-bold uppercase tracking-wider mb-2">
          Acesso Restrito
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-black text-primary">
          Painel Administrativo Executivo
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Esta área é estritamente reservada aos gestores e administradores autorizados da RESOLVE EXPRESS em Huambo.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Btn kind="action" onClick={() => (window.location.hash = "/entrar/admin")}>
            <Icon name="KeyRound" className="size-4" /> Desbloquear com PIN Administrativo
          </Btn>
          <Btn kind="ghost" onClick={() => (window.location.hash = "/ambientes")}>
            Ver Todos os Ambientes
          </Btn>
        </div>
      </div>
    );
  }

  const [phone, setPhone] = useState(store.whatsapp);
  const [msg, setMsg] = useState(store.whatsappDefault);
  const [commissionInput, setCommissionInput] = useState(store.partnerWallet.commissionRate);
  const [saved, setSaved] = useState(false);
  const [logoInput, setLogoInput] = useState(store.customLogo || "");
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);

  useEffect(() => {
    setLogoInput(store.customLogo || "");
  }, [store.customLogo]);

  const [catId, setCatId] = useState(CATEGORIES[0].id);

  // Marketplace filter, add & edit state
  const [productCatFilter, setProductCatFilter] = useState("Todos");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Mercearia e Despensa");
  const [newProdPrice, setNewProdPrice] = useState(2500);
  const [newProdPromo, setNewProdPromo] = useState<number | undefined>(undefined);
  const [newProdStock, setNewProdStock] = useState(25);
  const [newProdUnit, setNewProdUnit] = useState("unid.");
  const [newProdSeller, setNewProdSeller] = useState("Resolve Express Oficial");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdImg, setNewProdImg] = useState("");
  const [newProdImgFit, setNewProdImgFit] = useState<"cover" | "contain">("cover");
  const [newProdBadge, setNewProdBadge] = useState("");
  const [newProdFeatured, setNewProdFeatured] = useState(false);

  // Hero Banners Management state (Super Admin)
  const currentHeroBanners: HeroBanner[] =
    store.heroBanners && store.heroBanners.length > 0 ? store.heroBanners : DEFAULT_HERO_BANNERS;
  const [editingHeroBanner, setEditingHeroBanner] = useState<HeroBanner | null>(null);
  const [showAddHeroBanner, setShowAddHeroBanner] = useState(false);
  const [heroFormEyebrow, setHeroFormEyebrow] = useState("");
  const [heroFormBadge, setHeroFormBadge] = useState("");
  const [heroFormTitleStart, setHeroFormTitleStart] = useState("");
  const [heroFormTitleHighlight, setHeroFormTitleHighlight] = useState("");
  const [heroFormDesc, setHeroFormDesc] = useState("");
  const [heroFormPrimaryBtn, setHeroFormPrimaryBtn] = useState("");
  const [heroFormPrimaryTo, setHeroFormPrimaryTo] = useState("");
  const [heroFormSecondaryBtn, setHeroFormSecondaryBtn] = useState("");
  const [heroFormSecondaryTo, setHeroFormSecondaryTo] = useState("");
  const [heroFormImage, setHeroFormImage] = useState("");
  const [heroFormImageFit, setHeroFormImageFit] = useState<"cover" | "contain">("cover");
  const [heroFormActive, setHeroFormActive] = useState(true);
  const [heroFormFooterText, setHeroFormFooterText] = useState("");
  const [heroFormShowEyebrow, setHeroFormShowEyebrow] = useState(true);
  const [heroFormShowBadge, setHeroFormShowBadge] = useState(true);
  const [heroFormShowTitle, setHeroFormShowTitle] = useState(true);
  const [heroFormShowDesc, setHeroFormShowDesc] = useState(true);
  const [heroFormShowButtons, setHeroFormShowButtons] = useState(true);
  const [heroFormShowPrimaryBtn, setHeroFormShowPrimaryBtn] = useState(true);
  const [heroFormShowSecondaryBtn, setHeroFormShowSecondaryBtn] = useState(true);
  const [heroFormShowFooterText, setHeroFormShowFooterText] = useState(true);

  const openAddHeroBanner = () => {
    setEditingHeroBanner(null);
    setHeroFormEyebrow("Serviços ao Domicílio");
    setHeroFormBadge("Huambo · Equipa Verificada");
    setHeroFormTitleStart("Cuidamos de tudo para ");
    setHeroFormTitleHighlight("a sua casa e família!");
    setHeroFormDesc("Serviços profissionais e produtos essenciais com rapidez e segurança no Huambo.");
    setHeroFormPrimaryBtn("Explorar Serviços");
    setHeroFormPrimaryTo("/servicos");
    setHeroFormSecondaryBtn("Comprar Produtos");
    setHeroFormSecondaryTo("/produtos");
    setHeroFormFooterText("Atendimento rápido ao domicílio em toda a província do Huambo");
    setHeroFormImage("https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=85&w=1920&auto=format&fit=crop");
    setHeroFormImageFit("cover");
    setHeroFormActive(true);
    setHeroFormShowEyebrow(true);
    setHeroFormShowBadge(true);
    setHeroFormShowTitle(true);
    setHeroFormShowDesc(true);
    setHeroFormShowButtons(true);
    setHeroFormShowPrimaryBtn(true);
    setHeroFormShowSecondaryBtn(true);
    setHeroFormShowFooterText(true);
    setShowAddHeroBanner(true);
  };

  const openEditHeroBanner = (b: HeroBanner) => {
    setEditingHeroBanner(b);
    setHeroFormEyebrow(b.eyebrow || "");
    setHeroFormBadge(b.badge || "");
    setHeroFormTitleStart(b.titleStart || "");
    setHeroFormTitleHighlight(b.titleHighlight || "");
    setHeroFormDesc(b.description || "");
    setHeroFormPrimaryBtn(b.primaryBtn || "");
    setHeroFormPrimaryTo(b.primaryTo || "");
    setHeroFormSecondaryBtn(b.secondaryBtn || "");
    setHeroFormSecondaryTo(b.secondaryTo || "");
    setHeroFormFooterText(b.footerText || "");
    setHeroFormImage(b.image || "");
    setHeroFormImageFit(b.imageFit || "cover");
    setHeroFormActive(b.active !== false);
    setHeroFormShowEyebrow(b.showEyebrow !== false);
    setHeroFormShowBadge(b.showBadge !== false);
    setHeroFormShowTitle(b.showTitle !== false);
    setHeroFormShowDesc(b.showDescription !== false);
    setHeroFormShowButtons(b.showButtons !== false);
    setHeroFormShowPrimaryBtn(b.showPrimaryBtn !== false);
    setHeroFormShowSecondaryBtn(b.showSecondaryBtn !== false);
    setHeroFormShowFooterText(b.showFooterText !== false);
    setShowAddHeroBanner(true);
  };

  const handleSaveHeroBanner = async () => {
    if (!heroFormImage.trim()) {
      alert("Por favor, selecione ou envie uma imagem para o banner.");
      return;
    }

    const bannerPayload = {
      eyebrow: heroFormEyebrow.trim(),
      badge: heroFormBadge.trim(),
      titleStart: heroFormTitleStart.trim(),
      titleHighlight: heroFormTitleHighlight.trim(),
      description: heroFormDesc.trim(),
      primaryBtn: heroFormPrimaryBtn.trim() || "Ver mais",
      primaryTo: heroFormPrimaryTo.trim() || "/servicos",
      secondaryBtn: heroFormSecondaryBtn.trim() || "Contactar",
      secondaryTo: heroFormSecondaryTo.trim() || "/contactos",
      footerText: heroFormFooterText.trim(),
      image: heroFormImage.trim(),
      imageFit: heroFormImageFit,
      active: heroFormActive,
      showEyebrow: heroFormShowEyebrow,
      showBadge: heroFormShowBadge,
      showTitle: heroFormShowTitle,
      showDescription: heroFormShowDesc,
      showButtons: heroFormShowButtons,
      showPrimaryBtn: heroFormShowPrimaryBtn,
      showSecondaryBtn: heroFormShowSecondaryBtn,
      showFooterText: heroFormShowFooterText,
    };

    if (editingHeroBanner) {
      const oldImage = editingHeroBanner.image;
      await executeAdminSave(
        (st) => {
          const list = st.heroBanners && st.heroBanners.length > 0 ? st.heroBanners : DEFAULT_HERO_BANNERS;
          return {
            heroBanners: list.map((b: HeroBanner) =>
              b.id === editingHeroBanner.id
                ? {
                    ...b,
                    ...bannerPayload,
                  }
                : b
            ),
          };
        },
        "Atualização de Banner da Hero",
        `Banner modificado: ${bannerPayload.titleStart} ${bannerPayload.titleHighlight}`
      );
      if (oldImage && oldImage !== bannerPayload.image) {
        try {
          await fetch("/api/storage/safe-replace-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oldUrl: oldImage,
              newUrl: bannerPayload.image,
              role: store.currentUser?.role,
            }),
          });
        } catch (err) {
          console.warn("Safe replace warning:", err);
        }
      }
    } else {
      const newId = `hero-${Date.now()}`;
      const newBanner: HeroBanner = {
        id: newId,
        ...bannerPayload,
      };
      await executeAdminSave(
        (st) => {
          const list = st.heroBanners && st.heroBanners.length > 0 ? st.heroBanners : DEFAULT_HERO_BANNERS;
          return { heroBanners: [...list, newBanner] };
        },
        "Criação de Novo Banner da Hero",
        `Banner adicionado: ${bannerPayload.titleStart} ${bannerPayload.titleHighlight}`
      );
    }

    setShowAddHeroBanner(false);
    setEditingHeroBanner(null);
  };

  const handleDeleteHeroBanner = async (id: string) => {
    const list = store.heroBanners && store.heroBanners.length > 0 ? store.heroBanners : DEFAULT_HERO_BANNERS;
    const targetBanner = list.find((b: HeroBanner) => b.id === id);
    if (confirm("Tem certeza que deseja remover este banner do Hero?")) {
      const ok = await executeAdminSave(
        (st) => {
          const l = st.heroBanners && st.heroBanners.length > 0 ? st.heroBanners : DEFAULT_HERO_BANNERS;
          const filtered = l.filter((b: HeroBanner) => b.id !== id);
          return { heroBanners: filtered.length > 0 ? filtered : DEFAULT_HERO_BANNERS };
        },
        "Remoção de Banner da Hero",
        `Banner removido ID: ${id}`
      );
      if (ok && targetBanner?.image) {
        try {
          await fetch("/api/storage/safe-replace-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oldUrl: targetBanner.image,
              newUrl: "",
              role: store.currentUser?.role,
            }),
          });
        } catch (err) {
          console.warn("Safe replace warning:", err);
        }
      }
    }
  };

  const handleToggleHeroBannerActive = async (id: string) => {
    await executeAdminSave(
      (st) => {
        const list = st.heroBanners && st.heroBanners.length > 0 ? st.heroBanners : DEFAULT_HERO_BANNERS;
        return {
          heroBanners: list.map((b: HeroBanner) =>
            b.id === id ? { ...b, active: b.active === false ? true : false } : b
          ),
        };
      },
      "Alteração de Visibilidade do Banner Hero",
      `Banner ID: ${id}`
    );
  };

  const handleToggleHeroTexts = async (id: string) => {
    await executeAdminSave(
      (st) => {
        const list = st.heroBanners && st.heroBanners.length > 0 ? st.heroBanners : DEFAULT_HERO_BANNERS;
        return {
          heroBanners: list.map((b: HeroBanner) => {
            if (b.id !== id) return b;
            const currentlyVisible = b.showTitle !== false || b.showDescription !== false;
            const nextVal = !currentlyVisible;
            return {
              ...b,
              showTitle: nextVal,
              showDescription: nextVal,
              showEyebrow: nextVal,
              showBadge: nextVal,
              showFooterText: nextVal,
            };
          }),
        };
      },
      "Alternar Textos do Banner Hero",
      `Banner ID: ${id}`
    );
  };

  const handleToggleHeroButtons = async (id: string) => {
    await executeAdminSave(
      (st) => {
        const list = st.heroBanners && st.heroBanners.length > 0 ? st.heroBanners : DEFAULT_HERO_BANNERS;
        return {
          heroBanners: list.map((b: HeroBanner) => {
            if (b.id !== id) return b;
            const currentlyVisible = b.showButtons !== false;
            return {
              ...b,
              showButtons: !currentlyVisible,
              showPrimaryBtn: !currentlyVisible,
              showSecondaryBtn: !currentlyVisible,
            };
          }),
        };
      },
      "Alternar Botões do Banner Hero",
      `Banner ID: ${id}`
    );
  };

  const handleMoveHeroBanner = async (index: number, direction: "up" | "down") => {
    const list = [...(store.heroBanners && store.heroBanners.length > 0 ? store.heroBanners : DEFAULT_HERO_BANNERS)];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    await executeAdminSave(
      () => ({ heroBanners: list }),
      "Reordenação de Banners Hero",
      `Movido índice ${index} para ${targetIndex}`
    );
  };

  const handleResetHeroBanners = async () => {
    if (confirm("Deseja restaurar os banners padrão do sistema?")) {
      await executeAdminSave(
        () => ({ heroBanners: DEFAULT_HERO_BANNERS }),
        "Restauro de Banners Padrão da Hero"
      );
    }
  };

  // Department Management state (Super Admin)
  const [editingDepartment, setEditingDepartment] = useState<{
    id: string;
    name: string;
    short: string;
    icon: string;
    image: string;
    imageFit: "cover" | "contain";
  } | null>(null);

  // Service Management state
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcCategory, setNewSvcCategory] = useState(CATEGORIES[0].id);
  const [newSvcPrice, setNewSvcPrice] = useState(15000);
  const [newSvcUnit, setNewSvcUnit] = useState("divisão");
  const [newSvcDesc, setNewSvcDesc] = useState("");
  const [newSvcImg, setNewSvcImg] = useState("");
  const [newSvcImgFit, setNewSvcImgFit] = useState<"cover" | "contain">("cover");
  const [newSvcProvider, setNewSvcProvider] = useState<
    "COMPANY_OWNED" | "INDEPENDENT_PARTNER" | "BUSINESS_PARTNER"
  >("COMPANY_OWNED");
  const [newSvcFeatured, setNewSvcFeatured] = useState(false);

  // Edit Service modal state
  const [editSvcName, setEditSvcName] = useState("");
  const [editSvcCategory, setEditSvcCategory] = useState("");
  const [editSvcPrice, setEditSvcPrice] = useState<number | null>(null);
  const [editSvcUnit, setEditSvcUnit] = useState("");
  const [editSvcDesc, setEditSvcDesc] = useState("");
  const [editSvcImg, setEditSvcImg] = useState("");
  const [editSvcImgFit, setEditSvcImgFit] = useState<"cover" | "contain">("cover");
  const [editSvcProvider, setEditSvcProvider] = useState<
    "COMPANY_OWNED" | "INDEPENDENT_PARTNER" | "BUSINESS_PARTNER"
  >("COMPANY_OWNED");
  const [editSvcFeatured, setEditSvcFeatured] = useState(false);

  // New Employee state
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpPhone, setNewEmpPhone] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("Técnico de Limpeza & Apoio");

  // New Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(10);
  const [couponDesc, setCouponDesc] = useState("");

  // New Contract state
  const [contractCompany, setContractCompany] = useState("");
  const [contractNif, setContractNif] = useState("");
  const [contractValue, setContractValue] = useState(250000);

  // Ticket reply state
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const validPhone = /^\d{9,15}$/.test(phone.replace(/\D/g, "")) || phone === "";

  const setO = async (id: string, patch: any) =>
    await executeAdminSave(
      (st) => ({
        overrides: { ...st.overrides, [id]: { ...st.overrides[id], ...patch } },
      }),
      "Configuração de Serviço",
      `Tarifa ou disponibilidade alterada para ${id}`
    );

  const setStatus = async (
    id: string,
    status: "Recebido" | "Confirmado" | "Em curso" | "Concluído" | "Cancelado"
  ) =>
    await executeAdminSave(
      (st) => ({
        bookings: st.bookings.map((b: any) =>
          b.id === id
            ? {
                ...b,
                status,
                history: [...b.history, { at: new Date().toISOString(), status }],
              }
            : b
        ),
      }),
      "Atualização de Estado de Pedido",
      `Pedido ${id} -> ${status}`
    );

  const handleAssignBooking = async (bookingId: string, assignee: string) => {
    await executeAdminSave(
      (st) => ({
        bookings: st.bookings.map((b: any) =>
          b.id === bookingId
            ? {
                ...b,
                status: b.status === "Recebido" ? "Confirmado" : b.status,
                assignedTo: assignee,
                history: [
                  ...b.history,
                  { at: new Date().toISOString(), status: b.status, note: `Atribuído a ${assignee}` },
                ],
              }
            : b
        ),
      }),
      "Atribuição Operacional de Técnico",
      `Pedido ${bookingId} atribuído a ${assignee}`
    );
  };

  const handleAddEmployee = async () => {
    if (!newEmpName.trim() || !newEmpPhone.trim()) return;
    const empName = newEmpName.trim();
    const empPhone = newEmpPhone.trim();
    const empRole = newEmpRole.trim();
    await executePersistentSave(
      (st) => ({
        employees: [
          ...st.employees,
          {
            id: `emp-${Date.now()}`,
            name: empName,
            phone: empPhone,
            email: `${empName.toLowerCase().replace(/\s+/g, ".")}@resolveexpress.ao`,
            role: empRole,
            department:
              empRole.includes("Apoio") || empRole.includes("Suporte")
                ? "Apoio ao Cliente"
                : "Operações e Logística",
            city: "Huambo",
            professionalId: `REX-EMP-${Math.floor(100 + Math.random() * 900)}`,
            admissionDate: new Date().toISOString().slice(0, 10),
            active: true,
          },
        ],
      }),
      "Registo de Colaborador",
      `Colaborador ${empName} adicionado à equipa (${empRole})`
    );
    setNewEmpName("");
    setNewEmpPhone("");
  };

  const handleAddCoupon = () => {
    if (!couponCode.trim()) return;
    setStore((st) => ({
      coupons: [
        {
          code: couponCode.trim().toUpperCase(),
          discountPercent: couponDiscount,
          description: couponDesc.trim() || `${couponDiscount}% de desconto`,
          active: true,
        },
        ...st.coupons,
      ],
    }));
    setCouponCode("");
    setCouponDesc("");
  };

  const handleAddContract = () => {
    if (!contractCompany.trim() || !contractNif.trim()) return;
    setStore((st) => ({
      contracts: [
        {
          id: `CTR-B2B-${Math.floor(10 + Math.random() * 90)}`,
          companyName: contractCompany.trim(),
          nif: contractNif.trim(),
          contactName: "Administração",
          phone: "923000000",
          services: ["Limpeza empresarial", "Manutenção comercial"],
          monthlyValueAOA: contractValue,
          status: "Ativo",
          startDate: new Date().toISOString().slice(0, 10),
        },
        ...st.contracts,
      ],
    }));
    setContractCompany("");
    setContractNif("");
  };

  const handleSendTicketReply = () => {
    if (!replyTicketId || !replyText.trim()) return;
    setStore((st) => ({
      supportTickets: st.supportTickets.map((t) =>
        t.id === replyTicketId
          ? { ...t, response: replyText.trim(), status: "Resolvido" }
          : t
      ),
    }));
    setReplyTicketId(null);
    setReplyText("");
  };

  // Product handlers
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || newProdPrice <= 0) return;
    const newProd = {
      id: `PROD-${Date.now()}`,
      name: newProdName.trim(),
      category: newProdCategory,
      priceAOA: Number(newProdPrice),
      promotionalPriceAOA: newProdPromo ? Number(newProdPromo) : undefined,
      description: newProdDesc.trim() || "Produto de alta qualidade entregue ao domicílio pela Resolve Express.",
      sellerName: newProdSeller.trim() || "Resolve Express Oficial",
      sellerId: "seller-admin",
      sellerType: "COMPANY" as const,
      deliveryLocation: "Huambo (Todos os bairros)",
      estimatedDelivery: "30 a 60 minutos",
      stock: Number(newProdStock),
      unit: newProdUnit.trim() || "unidade",
      image: newProdImg.trim() || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
      imageFit: newProdImgFit,
      rating: 5.0,
      reviewsCount: 1,
      badge: newProdBadge.trim() || undefined,
      available: true,
    };
    await executeAdminSave(
      (st) => ({
        products: [newProd, ...st.products],
      }),
      "Criação de Produto",
      `Produto adicionado: ${newProd.name} (${newProd.priceAOA} Kz)`
    );
    saveSupabaseProduct(newProd);
    setShowAddProduct(false);
    setNewProdName("");
    setNewProdDesc("");
    setNewProdImg("");
    setNewProdImgFit("cover");
    setNewProdBadge("");
  };

  const handleToggleProduct = async (id: string) => {
    await executeAdminSave(
      (st) => ({
        products: st.products.map((p: Product) =>
          p.id === id ? { ...p, available: !p.available } : p
        ),
      }),
      "Alternar Disponibilidade do Produto",
      `Produto ID: ${id}`
    );
  };

  const handleUpdateStock = async (id: string, delta: number) => {
    await executeAdminSave(
      (st) => ({
        products: st.products.map((p: Product) =>
          p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p
        ),
      }),
      "Atualização de Estoque de Produto",
      `Produto ID: ${id}, alteração: ${delta}`
    );
  };

  const handleDeleteProduct = async (id: string, name?: string) => {
    const targetProd = store.products.find((p: Product) => p.id === id);
    if (!confirm(`Tem a certeza que deseja eliminar o produto "${name || id}"?`)) return;
    const ok = await executeAdminSave(
      (st) => ({
        products: st.products.filter((p: Product) => p.id !== id),
        featuredProducts: (st.featuredProducts || []).filter((pid: string) => pid !== id),
      }),
      "Remoção de Produto",
      `Produto removido: ${name || id}`
    );
    if (ok && targetProd?.image) {
      try {
        await fetch("/api/storage/safe-replace-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldUrl: targetProd.image,
            newUrl: "",
            role: store.currentUser?.role,
          }),
        });
      } catch (err) {
        console.warn("Safe replace warning:", err);
      }
    }
  };

  const handleToggleFeaturedProduct = async (productId: string) => {
    await executeAdminSave(
      (st) => {
        const feat = st.featuredProducts || [];
        return {
          featuredProducts: feat.includes(productId)
            ? feat.filter((id: string) => id !== productId)
            : [...feat, productId],
        };
      },
      "Alternar Produto em Destaque",
      `Produto ID: ${productId}`
    );
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct({ ...prod, imageFit: prod.imageFit || "cover" });
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name.trim()) return;
    const oldProduct = store.products.find((p: Product) => p.id === editingProduct.id);
    const oldImg = oldProduct?.image;
    const newImg = editingProduct.image;

    await executeAdminSave(
      (st) => ({
        products: st.products.map((p: Product) => (p.id === editingProduct.id ? editingProduct : p)),
      }),
      "Edição de Produto",
      `Produto atualizado: ${editingProduct.name}`
    );
    saveSupabaseProduct(editingProduct);

    if (oldImg && newImg && oldImg !== newImg) {
      try {
        await fetch("/api/storage/safe-replace-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldUrl: oldImg,
            newUrl: newImg,
            role: store.currentUser?.role,
          }),
        });
      } catch (err) {
        console.warn("Safe replace warning:", err);
      }
    }

    setEditingProduct(null);
  };

  // Department / Category Handlers (Super Admin)
  const handleOpenEditDepartment = (category: Category) => {
    setEditingDepartment({
      id: category.id,
      name: category.name,
      short: category.short,
      icon: category.icon,
      image: category.image,
      imageFit: category.imageFit || "cover",
    });
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDepartment || !editingDepartment.name.trim()) return;
    await executeAdminSave(
      (st) => ({
        categoryOverrides: {
          ...st.categoryOverrides,
          [editingDepartment.id]: {
            name: editingDepartment.name.trim(),
            short: editingDepartment.short.trim(),
            icon: editingDepartment.icon.trim(),
            image: editingDepartment.image.trim(),
            imageFit: editingDepartment.imageFit,
          },
        },
      }),
      "Edição de Departamento",
      `Departamento atualizado: ${editingDepartment.name}`
    );
    setEditingDepartment(null);
  };

  const handleResetDepartment = async (id: string) => {
    if (!confirm("Tem a certeza que deseja restaurar as informações e imagem originais deste departamento?")) return;
    await executeAdminSave(
      (st) => {
        const next = { ...st.categoryOverrides };
        delete next[id];
        return { categoryOverrides: next };
      },
      "Restauro de Departamento",
      `Departamento ID: ${id}`
    );
    setEditingDepartment(null);
  };

  // Service CRUD handlers
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSvcName.trim()) return;
    const sId = `${newSvcCategory}--${Date.now()}`;
    const newService: Service = {
      id: sId,
      categoryId: newSvcCategory,
      name: newSvcName.trim(),
      unit: newSvcUnit.trim() || "serviço",
      provider: newSvcProvider,
      includes: ["Avaliação técnica", "Execução profissional", "Garantia de serviço"],
      excludes: ["Materiais extraordinários não orçamentados"],
      description:
        newSvcDesc.trim() ||
        "Serviço profissional de alta qualidade com equipa verificada da Resolve Express.",
      image:
        newSvcImg.trim() ||
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
      imageFit: newSvcImgFit,
    };

    await executeAdminSave(
      (st) => ({
        customServices: [newService, ...(st.customServices || [])],
        overrides: {
          ...st.overrides,
          [sId]: {
            price: newSvcPrice > 0 ? Number(newSvcPrice) : null,
            available: true,
            provider: newSvcProvider,
          },
        },
        featured: newSvcFeatured ? [...st.featured, sId] : st.featured,
      }),
      "Criação de Novo Serviço",
      `Serviço criado: ${newService.name}`
    );

    setShowAddService(false);
    setNewSvcName("");
    setNewSvcDesc("");
    setNewSvcImg("");
    setNewSvcImgFit("cover");
    setNewSvcPrice(15000);
    setNewSvcFeatured(false);
  };

  const handleOpenEditService = (s: Service) => {
    const cfg = svcConfig(store, s);
    setEditingService(s);
    setEditSvcName(s.name);
    setEditSvcCategory(s.categoryId);
    setEditSvcPrice(cfg.price);
    setEditSvcUnit(s.unit);
    setEditSvcDesc(s.description);
    setEditSvcImg(s.image);
    setEditSvcImgFit(s.imageFit || "cover");
    setEditSvcProvider(cfg.provider);
    setEditSvcFeatured(store.featured.includes(s.id));
  };

  const handleSaveEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !editSvcName.trim()) return;
    const sId = editingService.id;

    await executeAdminSave(
      (st) => {
        const isCustom = st.customServices?.some((s: Service) => s.id === sId);
        const updatedCustom = isCustom
          ? st.customServices.map((s: Service) =>
              s.id === sId
                ? {
                    ...s,
                    name: editSvcName.trim(),
                    categoryId: editSvcCategory,
                    unit: editSvcUnit.trim(),
                    description: editSvcDesc.trim(),
                    image: editSvcImg.trim() || s.image,
                    imageFit: editSvcImgFit,
                    provider: editSvcProvider,
                  }
                : s
            )
          : st.customServices || [];

        const newOverrides = {
          ...st.overrides,
          [sId]: {
            ...st.overrides[sId],
            price: editSvcPrice,
            provider: editSvcProvider,
          },
        };

        const newServiceOverrides = {
          ...st.serviceOverrides,
          [sId]: {
            name: editSvcName.trim(),
            description: editSvcDesc.trim(),
            image: editSvcImg.trim(),
            imageFit: editSvcImgFit,
            price: editSvcPrice,
            unit: editSvcUnit.trim(),
            provider: editSvcProvider,
          },
        };

        const newFeatured = editSvcFeatured
          ? st.featured.includes(sId)
            ? st.featured
            : [...st.featured, sId]
          : st.featured.filter((x: string) => x !== sId);

        return {
          customServices: updatedCustom,
          overrides: newOverrides,
          serviceOverrides: newServiceOverrides,
          featured: newFeatured,
        };
      },
      "Edição de Serviço",
      `Serviço atualizado: ${editSvcName}`
    );

    setEditingService(null);
  };

  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Tem a certeza que deseja remover o serviço "${serviceName}"?`)) return;
    await executeAdminSave(
      (st) => ({
        customServices: (st.customServices || []).filter((s: Service) => s.id !== serviceId),
        deletedServices: [...(st.deletedServices || []), serviceId],
        featured: st.featured.filter((id: string) => id !== serviceId),
      }),
      "Remoção de Serviço",
      `Serviço removido: ${serviceName}`
    );
  };

  const handleToggleFeaturedService = async (serviceId: string) => {
    await executeAdminSave(
      (st) => ({
        featured: st.featured.includes(serviceId)
          ? st.featured.filter((id: string) => id !== serviceId)
          : [...st.featured, serviceId],
      }),
      "Alternar Serviço em Destaque",
      `Serviço ID: ${serviceId}`
    );
  };

  // Product Order handlers
  const handleUpdateProductOrderStatus = async (
    orderId: string,
    orderStatus:
      | "Recebida"
      | "Confirmada"
      | "Em preparação"
      | "A caminho"
      | "Entregue"
      | "Cancelada"
  ) => {
    await executeAdminSave(
      (st) => ({
        productOrders: st.productOrders.map((o: any) =>
          o.id === orderId ? { ...o, orderStatus } : o
        ),
      }),
      "Atualização de Encomenda de Produto",
      `Encomenda ${orderId} -> ${orderStatus}`
    );
  };

  // Partner Company handlers
  const handleApprovePartner = async (id: string) => {
    await executeAdminSave(
      (st) => ({
        registeredPartners: st.registeredPartners.map((p: any) =>
          p.id === id ? { ...p, status: "Aprovado" as const } : p
        ),
      }),
      "Aprovação de Parceiro Comercial",
      `Parceiro ID: ${id} aprovado`
    );
  };

  const handleRejectPartner = async (id: string) => {
    await executeAdminSave(
      (st) => ({
        registeredPartners: st.registeredPartners.map((p: any) =>
          p.id === id ? { ...p, status: "Rejeitado" as const } : p
        ),
      }),
      "Rejeição de Parceiro Comercial",
      `Parceiro ID: ${id} rejeitado`
    );
  };

  // Financial calculations
  const totalBookingsRevenue = store.bookings
    .filter((b) => b.status === "Concluído" && b.total)
    .reduce((sum, b) => sum + (b.total || 0), 0);

  const totalCommissionsEarned = Math.round(
    totalBookingsRevenue * (store.partnerWallet.commissionRate / 100)
  );

  const totalContractsMonthly = store.contracts
    .filter((c) => c.status === "Ativo")
    .reduce((sum, c) => sum + c.monthlyValueAOA, 0);

  const totalProductSalesRevenue = store.productOrders
    .filter((o) => o.orderStatus !== "Cancelada")
    .reduce((sum, o) => sum + o.totalAOA, 0);

  const tabs: [string, string, string][] = [
    ["dashboard", "Visão Geral & Finanças", "LayoutDashboard"],
    ["praca", `🏪 Gestão da Praça (${store.sellers?.length || 0})`, "Store"],
    ["importacao", `✈️ Importação & Cartões (${(store.virtualCardRequests?.length || 0) + (store.importQuotes?.length || 0)})`, "Globe"],
    ["intermediario", `🤝 Intermediário (${store.intermediaryListings?.length || 0})`, "Briefcase"],
    ["banners", `Banners Hero (${currentHeroBanners.length})`, "Image"],
    ["orders", `Pedidos Serviços (${store.bookings.length})`, "ClipboardList"],
    ["productOrders", `Encomendas Produtos (${store.productOrders?.length || 0})`, "Package"],
    ["products", `Produtos Marketplace (${store.products?.length || 0})`, "ShoppingBag"],
    ["partners", `Empresas Parceiras (${store.registeredPartners?.length || 0})`, "Building2"],
    ["catalog", "Catálogo Serviços", "LayoutGrid"],
    ["apps", `Candidaturas (${store.applications.length})`, "UserCheck"],
    ["employees", `Funcionários (${store.employees.length})`, "Users"],
    ["contracts", `Contratos B2B (${store.contracts.length})`, "FileText"],
    ["coupons", `Cupons (${store.coupons.length})`, "Tag"],
    ["support", `Suporte (${store.supportTickets.length})`, "Headset"],
    ["config", "Configurações", "Settings"],
  ];

  const storeCategories = getStoreCategories(store);
  const cat = storeCategories.find((c) => c.id === catId) || storeCategories[0];
  const disabled = cat ? !!store.disabledCats[cat.id] : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 @3xl:px-8">
      {/* Top Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-black text-primary">
              Painel Administrativo
            </h1>
            <span className="rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-xs font-bold">
              SUPER_ADMIN
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestão operacional, financeira e de catálogo · Huambo, Angola
          </p>
        </div>

        {/* Global Persistence Status Indicator (PARTE 1) */}
        <div className="flex items-center gap-2">
          {isSaving ? (
            <div className="flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/30 px-3.5 py-1 text-xs font-bold text-blue-700 animate-pulse">
              <span className="size-2 rounded-full bg-blue-600 animate-ping" />
              <span>A sincronizar com a base de dados...</span>
            </div>
          ) : saveStatus ? (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border transition ${
                saveStatus.ok
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800"
                  : "bg-red-500/10 border-red-500/30 text-red-800"
              }`}
            >
              <Icon name={saveStatus.ok ? "Check" : "AlertTriangle"} className="size-3.5" />
              <span>{saveStatus.message}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-500 border border-border">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Sincronização Ativa em Disco</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {tabs.map(([id, label, ic]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as any)}
            className={
              "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition " +
              (tab === id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-mist text-muted-foreground hover:text-foreground")
            }
          >
            <Icon name={ic} className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Receita de Serviços
              </span>
              <p className="mt-2 font-display text-2xl font-black text-primary">
                {formatCurrency(totalBookingsRevenue, store.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total de serviços concluídos</p>
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Comissões da Plataforma
              </span>
              <p className="mt-2 font-display text-2xl font-black text-ok">
                {formatCurrency(totalCommissionsEarned, store.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Margem média retida ({store.partnerWallet.commissionRate}%)</p>
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Faturação Mensal B2B
              </span>
              <p className="mt-2 font-display text-2xl font-black text-action">
                {formatCurrency(totalContractsMonthly, store.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Contratos corporativos ativos</p>
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Total de Pedidos
              </span>
              <p className="mt-2 font-display text-2xl font-black text-primary">
                {store.bookings.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {store.bookings.filter((b) => b.status === "Concluído").length} concluídos
              </p>
            </div>
          </div>

          {/* Quick Operations Overview */}
          <div className="grid gap-6 @3xl:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <h3 className="font-display font-bold text-lg mb-3">
                Distribuição Operacional dos Pedidos
              </h3>
              <div className="space-y-2 text-sm">
                {STATUSES.map((st) => {
                  const count = store.bookings.filter((b) => b.status === st).length;
                  return (
                    <div key={st} className="flex items-center justify-between p-2 rounded hover:bg-mist">
                      <div className="flex items-center gap-2">
                        <StatusPill s={st} />
                        <span className="font-medium">{st}</span>
                      </div>
                      <span className="font-bold font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <h3 className="font-display font-bold text-lg mb-3">
                Equipas e Prestadores no Huambo
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span>Funcionários Próprios da Empresa:</span>
                  <span className="font-bold">{store.employees.length} activos</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span>Candidaturas de Parceiros Pendentes:</span>
                  <span className="font-bold text-action">
                    {store.applications.filter((a) => a.status === "Pendente").length} por rever
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span>Parceiros Credenciados:</span>
                  <span className="font-bold text-ok">
                    {store.applications.filter((a) => a.status === "Aprovado").length} aprovados
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Chamados de Suporte em Aberto:</span>
                  <span className="font-bold text-warn">
                    {store.supportTickets.filter((t) => t.status !== "Resolvido").length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delegação Operacional e Supervisão Estratégica */}
          <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-primary flex items-center gap-2">
                  <Icon name="ShieldCheck" className="size-5 text-action" />
                  Delegação de Funções e Controlo de Supervisão
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A administração mantém a supervisão global e o controlo de emergência, delegando as rotinas nos painéis dedicados.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Btn
                  kind="ghost"
                  onClick={() => go("/operacao")}
                  className="min-h-9 text-xs border border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20"
                >
                  <Icon name="Cog" className="size-3.5 text-amber-600" />
                  Painel Operação & Produção
                </Btn>
                <Btn
                  kind="ghost"
                  onClick={() => go("/apoio")}
                  className="min-h-9 text-xs border border-sky-500/30 text-sky-900 bg-sky-500/10 hover:bg-sky-500/20"
                >
                  <Icon name="Headphones" className="size-3.5 text-sky-600" />
                  Central Apoio ao Cliente
                </Btn>
              </div>
            </div>

            {/* Encaminhamentos que exigem autorização da Administração */}
            {(() => {
              const escalatedTickets = (store.supportTickets || []).filter(
                (t: any) => (t.escalatedTo === "ADMIN" || t.forwardTarget === "ADMIN") && t.status !== "Resolvido"
              );
              const criticalOccurrences = (store.operationalOccurrences || []).filter(
                (o: any) => (o.severity === "CRITICA" || o.status === "ENCAMINHADA_ADMIN") && o.status !== "RESOLVIDA"
              );

              if (!escalatedTickets.length && !criticalOccurrences.length) {
                return (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                      <Icon name="CheckCircle2" className="size-4 text-emerald-600" />
                      <span>Sem ocorrências críticas ou pedidos de reembolso pendentes de decisão executiva.</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-700">Operações e Apoio em conformidade</span>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-action">
                    Atenção Executiva: {escalatedTickets.length + criticalOccurrences.length} processos aguardam decisão da Direção
                  </p>

                  {/* Tickets escalados para Admin */}
                  {escalatedTickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{ticket.id}</span>
                          <span className="rounded bg-action/10 px-2 py-0.5 font-bold text-action">
                            Encaminhado pelo Apoio ao Cliente
                          </span>
                          <span className="font-semibold text-primary">{ticket.customerName}</span>
                        </div>
                        <p className="font-bold text-slate-900">{ticket.subject}</p>
                        <p className="text-muted-foreground">{ticket.message}</p>
                        {ticket.internalNotes && ticket.internalNotes.length > 0 && (
                          <p className="text-[11px] text-slate-700 italic bg-amber-100/70 p-1.5 rounded">
                            Nota de Encaminhamento: {ticket.internalNotes[ticket.internalNotes.length - 1].note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Btn
                          kind="action"
                          className="text-xs min-h-8 px-3"
                          onClick={() => {
                            executePersistentSave(
                              (st: any) => ({
                                supportTickets: (st.supportTickets || []).map((t: any) =>
                                  t.id === ticket.id
                                    ? {
                                        ...t,
                                        status: "Resolvido",
                                        response:
                                          "Decisão executiva da Direção: Pedido deferido e autorizado pela Administração com regularização imediata.",
                                        updatedAt: new Date().toISOString(),
                                      }
                                    : t
                                ),
                              }),
                              "Autorização Executiva de Ticket",
                              `Ticket ${ticket.id} resolvido e autorizado pela Administração`
                            );
                          }}
                        >
                          <Icon name="Check" className="size-3.5" />
                          Autorizar & Resolver
                        </Btn>
                      </div>
                    </div>
                  ))}

                  {/* Ocorrências Críticas da Operação */}
                  {criticalOccurrences.map((occ: any) => (
                    <div
                      key={occ.id}
                      className="rounded-xl border border-red-300 bg-red-50/70 p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-red-900">{occ.id}</span>
                          <span className="rounded bg-red-600 text-white px-2 py-0.5 font-bold text-[10px]">
                            OCORRÊNCIA CRÍTICA
                          </span>
                          <span className="font-semibold text-slate-800">{occ.type}</span>
                        </div>
                        <p className="font-bold text-red-950">{occ.title}</p>
                        <p className="text-muted-foreground">{occ.description}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Btn
                          kind="ink"
                          className="text-xs min-h-8 px-3"
                          onClick={() => {
                            executePersistentSave(
                              (st: any) => ({
                                operationalOccurrences: (st.operationalOccurrences || []).map((o: any) =>
                                  o.id === occ.id
                                    ? {
                                        ...o,
                                        status: "RESOLVIDA",
                                        resolvedAt: new Date().toISOString(),
                                        resolutionNote:
                                          "Incidente tratado e aprovado com diretrizes de emergência da Administração.",
                                      }
                                    : o
                                ),
                              }),
                              "Resolução de Incidente Operacional",
                              `Ocorrência ${occ.id} encerrada pela Administração`
                            );
                          }}
                        >
                          <Icon name="CheckCircle" className="size-3.5" />
                          Aprovar Resolução
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {tab === "banners" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-paper p-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-primary">
                  Banners do Hero (Carrossel da Página Inicial)
                </h2>
                <span className="rounded-full bg-action/10 text-action px-2.5 py-0.5 text-xs font-bold">
                  {currentHeroBanners.length} {currentHeroBanners.length === 1 ? "Slide" : "Slides"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Personalize as imagens, textos, cores de destaque e botões do carrossel principal da plataforma. Você pode adicionar quantos slides desejar, fazer upload de imagens do seu computador ou link da web.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Btn kind="ghost" onClick={handleResetHeroBanners} className="text-xs">
                <Icon name="RotateCcw" className="size-3.5" />
                Restaurar Padrão
              </Btn>
              <Btn kind="action" onClick={openAddHeroBanner} className="text-xs">
                <Icon name="Plus" className="size-4" />
                Adicionar Novo Banner
              </Btn>
            </div>
          </div>

          {/* List of Hero Banners */}
          <div className="grid grid-cols-1 gap-6">
            {currentHeroBanners.map((banner, index) => {
              const isActive = banner.active !== false;
              const showEyebrow = banner.showEyebrow !== false && Boolean(banner.eyebrow);
              const showBadge = banner.showBadge !== false && Boolean(banner.badge);
              const showTitle = banner.showTitle !== false && Boolean(banner.titleStart || banner.titleHighlight);
              const showDesc = banner.showDescription !== false && Boolean(banner.description);
              const showPrimary = banner.showButtons !== false && banner.showPrimaryBtn !== false && Boolean(banner.primaryBtn);
              const showSecondary = banner.showButtons !== false && banner.showSecondaryBtn !== false && Boolean(banner.secondaryBtn);
              const showButtonsContainer = banner.showButtons !== false && (showPrimary || showSecondary);
              const showFooter = banner.showFooterText !== false && Boolean(banner.footerText);
              const hasAny = (showEyebrow || showBadge) || showTitle || showDesc || showButtonsContainer || showFooter;

              return (
                <div
                  key={banner.id}
                  className={`overflow-hidden rounded-2xl border transition-all ${
                    isActive
                      ? "border-border bg-paper shadow-sm hover:shadow-md"
                      : "border-border/60 bg-muted/20 opacity-75"
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                    {/* Live Slide Preview */}
                    <div className="relative lg:col-span-6 xl:col-span-7 bg-neutral-900 min-h-[220px] sm:min-h-[260px] flex items-center overflow-hidden">
                      <img
                        src={banner.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80"}
                        alt={banner.titleStart}
                        className={`absolute inset-0 h-full w-full ${
                          banner.imageFit === "contain"
                            ? "object-contain p-4"
                            : "object-cover object-center"
                        }`}
                      />
                      {hasAny && (
                        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20 pointer-events-none" />
                      )}

                      {hasAny ? (
                        <div className="relative z-10 p-6 sm:p-8 text-white space-y-2">
                          {(showEyebrow || showBadge) && (
                            <div className="flex flex-wrap items-center gap-2">
                              {showEyebrow && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white border border-white/30 backdrop-blur-xs">
                                  <span className="size-1.5 rounded-full bg-action" />
                                  {banner.eyebrow}
                                </span>
                              )}
                              {showBadge && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-action text-white px-2 py-0.5 text-[10px] font-bold">
                                  <Icon name="CheckCircle" className="size-2.5 text-white" />
                                  {banner.badge}
                                </span>
                              )}
                            </div>
                          )}

                          {showTitle && (
                            <h3 className="font-display text-lg sm:text-xl font-black leading-snug drop-shadow-md">
                              {banner.titleStart}{" "}
                              <span className="text-action">{banner.titleHighlight}</span>
                            </h3>
                          )}

                          {showDesc && (
                            <p className="text-xs text-white/80 line-clamp-2 max-w-md font-medium">
                              {banner.description}
                            </p>
                          )}

                          {showButtonsContainer && (
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              {showPrimary && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-action px-3 py-1 text-xs font-bold text-action-ink">
                                  {banner.primaryBtn}
                                </span>
                              )}
                              {showSecondary && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold text-white border border-white/30">
                                  {banner.secondaryBtn}
                                </span>
                              )}
                            </div>
                          )}

                          {showFooter && (
                            <p className="pt-1 text-[10px] sm:text-[11px] text-white/80 font-medium flex items-center gap-1 drop-shadow-xs">
                              <Icon name="ShieldCheck" className="size-3 text-action shrink-0" />
                              <span>{banner.footerText}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="relative z-10 p-6 text-center w-full">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white border border-white/20 backdrop-blur-md">
                            <Icon name="EyeOff" className="size-3.5 text-amber-400" />
                            Modo Imagem Pura (Textos e Botões Ocultos)
                          </span>
                        </div>
                      )}

                      <span className="absolute top-3 right-3 z-10 rounded-full bg-black/70 px-2.5 py-0.5 text-[10px] font-mono font-bold text-white/90 backdrop-blur-xs">
                        Slide #{index + 1}
                      </span>
                    </div>

                    {/* Controls & Details */}
                    <div className="lg:col-span-6 xl:col-span-5 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2.5 rounded-full ${
                                isActive ? "bg-ok" : "bg-neutral-400"
                              }`}
                            />
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                              {isActive ? "Ativo no Carrossel" : "Inativo / Oculto"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            Modo: {banner.imageFit === "contain" ? "Conter (Contain)" : "Cobrir (Cover)"}
                          </span>
                        </div>

                        {/* Visibility Status Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold border ${
                              showTitle
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-neutral-100 text-neutral-600 border-neutral-200"
                            }`}
                          >
                            Textos: {showTitle ? "Visíveis" : "Ocultos"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold border ${
                              showButtonsContainer
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-neutral-100 text-neutral-600 border-neutral-200"
                            }`}
                          >
                            Botões & Links: {showButtonsContainer ? "Visíveis" : "Ocultos"}
                          </span>
                          {banner.footerText && (
                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold border ${
                                showFooter
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-neutral-100 text-neutral-600 border-neutral-200"
                              }`}
                            >
                              Nota: {showFooter ? "Visível" : "Oculta"}
                            </span>
                          )}
                        </div>

                        <div className="text-xs space-y-1.5 text-muted-foreground">
                          {banner.footerText && (
                            <p>
                              <strong className="text-primary font-semibold">Texto entre/abaixo dos botões:</strong>{" "}
                              <span className="text-foreground italic">{banner.footerText}</span>
                            </p>
                          )}
                          <p>
                            <strong className="text-primary font-semibold">Link Botão 1:</strong>{" "}
                            <span className="font-mono bg-mist px-1.5 py-0.5 rounded">{banner.primaryTo}</span>
                          </p>
                          <p>
                            <strong className="text-primary font-semibold">Link Botão 2:</strong>{" "}
                            <span className="font-mono bg-mist px-1.5 py-0.5 rounded">{banner.secondaryTo}</span>
                          </p>
                        </div>

                        {/* Quick In-Card Visibility Toggles */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleToggleHeroTexts(banner.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-mist text-foreground hover:bg-neutral-200 transition cursor-pointer"
                            title="Alternar visibilidade dos textos deste slide"
                          >
                            <Icon name={showTitle ? "EyeOff" : "Eye"} className="size-3.5" />
                            <span>{showTitle ? "Ocultar Textos" : "Mostrar Textos"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHeroButtons(banner.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-mist text-foreground hover:bg-neutral-200 transition cursor-pointer"
                            title="Alternar visibilidade dos botões e links deste slide"
                          >
                            <Icon name={showButtonsContainer ? "EyeOff" : "Eye"} className="size-3.5" />
                            <span>{showButtonsContainer ? "Ocultar Botões" : "Mostrar Botões"}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                        {/* Order Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveHeroBanner(index, "up")}
                            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-mist disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover para cima"
                          >
                            <Icon name="ArrowUp" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === currentHeroBanners.length - 1}
                            onClick={() => handleMoveHeroBanner(index, "down")}
                            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-mist disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover para baixo"
                          >
                            <Icon name="ArrowDown" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHeroBannerActive(banner.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isActive
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            }`}
                          >
                            {isActive ? "Desativar" : "Ativar"}
                          </button>
                        </div>

                        {/* Edit & Delete Buttons */}
                        <div className="flex items-center gap-2">
                          <Btn
                            kind="ghost"
                            className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDeleteHeroBanner(banner.id)}
                          >
                            <Icon name="Trash2" className="size-3.5" />
                            Remover
                          </Btn>
                          <Btn
                            kind="action"
                            className="text-xs"
                            onClick={() => openEditHeroBanner(banner)}
                          >
                            <Icon name="Pencil" className="size-3.5" />
                            Editar Slide
                          </Btn>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-primary">
                Gestão e Atribuição de Pedidos
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supervisão de encomendas e intervenções técnicas em curso.
              </p>
            </div>
            <Btn
              kind="action"
              onClick={() => go("/operacao")}
              className="text-xs min-h-9 px-4"
            >
              <Icon name="Cog" className="size-3.5" />
              Abrir Painel Operacional Completo
            </Btn>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-500 text-white font-bold shrink-0">
                <Icon name="Truck" className="size-5" />
              </span>
              <div>
                <h3 className="font-display font-bold text-sm text-primary">
                  Painel de Operação & Produção Ativo
                </h3>
                <p className="text-xs text-muted-foreground">
                  A equipa de Operação & Produção gerencia a atribuição direta de técnicos, estafetas, rotas no Huambo e controle de SLA no painel independente.
                </p>
              </div>
            </div>
            <Btn
              kind="ghost"
              onClick={() => go("/operacao")}
              className="text-xs min-h-9 px-4 border border-amber-500/30 text-amber-900 bg-paper hover:bg-amber-100"
            >
              Ir para Operação <Icon name="ArrowRight" className="size-3.5" />
            </Btn>
          </div>

          {store.bookings.length ? (
            <div className="flex flex-col gap-3">
              {store.bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        {b.id}
                      </span>
                      <StatusPill s={b.status} />
                      <span className="text-xs text-muted-foreground">
                        [{PROVIDERS[b.provider]}]
                      </span>
                    </div>

                    {/* Assignee control */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-semibold">
                        Atribuído a:
                      </span>
                      <select
                        value={b.assignedTo || ""}
                        onChange={(e) => handleAssignBooking(b.id, e.target.value)}
                        className={inputCls + " min-h-8 py-0 px-2 text-xs w-48"}
                      >
                        <option value="">Não atribuído</option>
                        <optgroup label="Funcionários Próprios">
                          {store.employees.map((emp) => (
                            <option key={emp.id} value={`${emp.name} (Equipa Resolve)`}>
                              {emp.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Parceiros Aprovados">
                          {store.applications
                            .filter((a) => a.status === "Aprovado")
                            .map((p) => (
                              <option key={p.phone} value={`${p.name} (Parceiro)`}>
                                {p.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 @3xl:grid-cols-2">
                    <div>
                      <p className="font-display font-bold text-lg">
                        {b.service} · {b.qty} {b.unit}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cliente: <strong>{b.customer}</strong> (+244 {b.phone})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        📍 {b.address} · 📅 {b.date} às {b.slot}
                      </p>
                      <p className="text-xs italic bg-mist p-2 rounded mt-2">
                        "{b.details}"
                      </p>
                    </div>

                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-sm">
                          Pagamento: <strong>{b.payment}</strong> ({b.paymentStatus}) ·{" "}
                          <span className="font-bold text-primary">
                            {b.total ? formatCurrency(b.total, store.currency) : "Orçamento"}
                          </span>
                        </p>
                        {b.rating && (
                          <p className="text-xs text-amber-500 font-bold mt-1">
                            Avaliação do cliente: {"★".repeat(b.rating)} ({b.rating}/5)
                            {b.reviewComment && ` - "${b.reviewComment}"`}
                          </p>
                        )}
                      </div>

                      {/* Status changer buttons */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground self-center mr-1">
                          Mudar estado:
                        </span>
                        {STATUSES.filter((s) => s !== b.status).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(b.id, s)}
                            className="min-h-8 rounded-full border border-border px-2.5 text-xs font-semibold hover:border-primary transition"
                          >
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon="ClipboardList"
              title="Sem pedidos ainda"
              text="Os pedidos feitos no site aparecem aqui para triagem e atribuição."
            />
          )}
        </div>
      )}

      {tab === "catalog" && (
        <div className="grid gap-4 @5xl:grid-cols-[220px_1fr]">
          <div className="flex gap-2 overflow-x-auto @5xl:flex-col">
            {storeCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatId(c.id)}
                className={
                  "flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-[var(--radius)] px-3 text-left text-sm font-semibold transition " +
                  (catId === c.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-mist")
                }
              >
                <span
                  className={
                    store.disabledCats[c.id] ? "line-through opacity-60" : ""
                  }
                >
                  {c.name.replace("Resolve ", "")}
                </span>
                {store.categoryOverrides?.[c.id] && (
                  <span className="size-1.5 rounded-full bg-amber-400 shrink-0" title="Personalizado" />
                )}
              </button>
            ))}
          </div>

          {cat && (
            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-14 rounded-xl overflow-hidden border border-border shadow-xs shrink-0 ${
                      cat.imageFit === "contain"
                        ? "bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-1"
                        : "bg-mist"
                    }`}
                  >
                    <img
                      src={cat.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
                      alt={cat.name}
                      className={`size-full ${
                        cat.imageFit === "contain" ? "object-contain" : "object-cover object-center"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-lg font-bold">{cat.name}</p>
                      {store.categoryOverrides?.[cat.id] && (
                        <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[10px] font-bold">
                          Personalizado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.short}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Btn
                    kind="ink"
                    className="min-h-10 text-xs flex items-center gap-1.5"
                    onClick={() => handleOpenEditDepartment(cat)}
                  >
                    <Icon name="Edit" className="size-4" /> Editar Departamento
                  </Btn>
                  <Btn
                    kind="action"
                    className="min-h-10 text-xs"
                    onClick={() => {
                      setNewSvcCategory(cat.id);
                      setShowAddService(true);
                    }}
                  >
                    <Icon name="Plus" className="size-4" /> Adicionar Serviço
                  </Btn>
                  <Btn
                    kind="ghost"
                    className="min-h-10 text-xs"
                    onClick={() =>
                      executeAdminSave(
                        (st) => ({
                          disabledCats: {
                            ...st.disabledCats,
                            [cat.id]: !disabled,
                          },
                        }),
                        "Visibilidade do Departamento",
                        `${cat.name} ${!disabled ? "desativado" : "ativado"}`
                      )
                    }
                  >
                    {disabled ? "Ativar departamento" : "Desativar departamento"}
                  </Btn>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="p-3">Serviço</th>
                      <th className="p-3">Preço inicial (Kz)</th>
                      <th className="p-3">Prestador</th>
                      <th className="p-3 text-center">⭐ Destaque</th>
                      <th className="p-3 text-center">Disponível</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.services.map((s) => {
                      const cfg = svcConfig(store, s);
                      const feat = store.featured.includes(s.id);
                      return (
                        <tr key={s.id} className="border-t border-border hover:bg-mist/30 transition">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`size-10 rounded-md overflow-hidden border border-border shrink-0 shadow-2xs ${
                                  s.imageFit === "contain"
                                    ? "bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-0.5"
                                    : "bg-mist"
                                }`}
                              >
                                <img
                                  src={s.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
                                  alt={s.name}
                                  className={`size-full ${
                                    s.imageFit === "contain"
                                      ? "object-contain"
                                      : "object-cover object-center"
                                  }`}
                                />
                              </div>
                              <div>
                                <span className="font-semibold text-primary block">{s.name}</span>
                                <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[240px]">
                                  {s.description}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                placeholder="Orçamento"
                                value={cfg.price ?? ""}
                                onChange={(e) =>
                                  setO(s.id, {
                                    price:
                                      e.target.value === ""
                                        ? null
                                        : Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className={inputCls + " min-h-9 w-28 text-xs font-bold"}
                              />
                              <span className="text-xs text-muted-foreground">/{s.unit}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <select
                              value={cfg.provider}
                              onChange={(e) =>
                                setO(s.id, { provider: e.target.value })
                              }
                              className={inputCls + " min-h-9 text-xs"}
                            >
                              {Object.entries(PROVIDERS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleFeaturedService(s.id)}
                              className={`p-1.5 rounded-full transition ${
                                feat
                                  ? "text-amber-500 bg-amber-500/10"
                                  : "text-neutral-400 hover:text-amber-500"
                              }`}
                              title={feat ? "Remover dos destaques" : "Colocar em destaque"}
                            >
                              <Icon name="Star" className={`size-5 ${feat ? "fill-amber-500" : ""}`} />
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={cfg.available}
                              onClick={() =>
                                setO(s.id, { available: !cfg.available })
                              }
                              className={
                                "relative inline-block h-6 w-11 rounded-full transition align-middle " +
                                (cfg.available ? "bg-ok" : "bg-neutral-300")
                              }
                            >
                              <span
                                className={
                                  "absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-all " +
                                  (cfg.available ? "left-5.5" : "left-0.5")
                                }
                              />
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditService(s)}
                                className="rounded border border-border p-1.5 text-primary hover:bg-mist hover:border-primary transition"
                                title="Editar serviço (título, descrição, foto, preço)"
                              >
                                <Icon name="Pencil" className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteService(s.id, s.name)}
                                className="rounded border border-border p-1.5 text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                                title="Eliminar serviço"
                              >
                                <Icon name="Trash2" className="size-3.5" />
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
        </div>
      )}

      {tab === "apps" && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-primary">
            Candidaturas de Profissionais Parceiros
          </h2>

          {store.applications.length ? (
            <div className="flex flex-col gap-3">
              {store.applications.map((a, idx) => (
                <div
                  key={idx}
                  className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <p className="font-display font-bold text-lg">
                        {a.name}{" "}
                        <span
                          className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                            a.status === "Aprovado"
                              ? "bg-ok/10 text-ok"
                              : a.status === "Rejeitado"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warn/20 text-warn"
                          }`}
                        >
                          {a.status}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        📞 +244 {a.phone} · ✉️ {a.email} · 📍 {a.city}
                      </p>
                    </div>

                    {a.status === "Pendente" && (
                      <div className="flex gap-2">
                        <Btn
                          kind="ink"
                          className="min-h-10"
                          onClick={() =>
                            setStore((s) => ({
                              applications: s.applications.map((item, i) =>
                                i === idx ? { ...item, status: "Aprovado" } : item
                              ),
                            }))
                          }
                        >
                          Aprovar Parceiro
                        </Btn>
                        <Btn
                          kind="ghost"
                          className="min-h-10 text-destructive"
                          onClick={() =>
                            setStore((s) => ({
                              applications: s.applications.map((item, i) =>
                                i === idx ? { ...item, status: "Rejeitado" } : item
                              ),
                            }))
                          }
                        >
                          Rejeitar
                        </Btn>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 text-sm @3xl:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">
                        Especialidades:
                      </p>
                      <p className="font-semibold text-primary">
                        {a.skills
                          .map((sid) =>
                            CATEGORIES.find((c) => c.id === sid)?.name.replace(
                              "Resolve ",
                              ""
                            )
                          )
                          .join(", ")}
                      </p>
                      <p className="text-xs font-bold text-muted-foreground uppercase mt-2">
                        Experiência Comprovada:
                      </p>
                      <p>{a.exp}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">
                        Documentos Submetidos:
                      </p>
                      <ul className="text-xs space-y-1 mt-1 text-muted-foreground">
                        <li>📄 BI / Documento: {a.idDoc || "BI_submetido.pdf"}</li>
                        <li>📷 Fotografia de perfil: {a.photo || "photo.jpg"}</li>
                        {a.certs?.length > 0 && <li>🎓 Certificados: {a.certs.join(", ")}</li>}
                        {a.refs && <li>👥 Referências: {a.refs}</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon="UserCheck"
              title="Sem candidaturas"
              text="As candidaturas enviadas no formulário 'Seja um profissional' aparecerão aqui."
            />
          )}
        </div>
      )}

      {tab === "employees" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold text-primary">
              Corpo de Funcionários Próprios da Resolve Express
            </h2>
          </div>

          {/* Add Employee */}
          <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
            <h3 className="font-display font-bold text-primary mb-3">
              Registar Novo Funcionário
            </h3>
            <div className="grid gap-3 @3xl:grid-cols-3">
              <Field label="Nome do Funcionário">
                <input
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="Ex: Pedro Varela"
                  className={inputCls}
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  placeholder="923 000 000"
                  className={inputCls}
                />
              </Field>
              <Field label="Cargo / Função" hint="Ex: Operações, Apoio ao Cliente, Estafeta, etc.">
                <div className="space-y-1.5">
                  <select
                    value={[
                      "Técnico de Limpeza & Apoio",
                      "Estafeta de Entregas & Logística",
                      "Operador de Logística & Produção",
                      "Agente de Apoio ao Cliente",
                      "Técnico Eletricista",
                      "Supervisor Operacional",
                    ].includes(newEmpRole) ? newEmpRole : "custom"}
                    onChange={(e) => {
                      if (e.target.value !== "custom") {
                        setNewEmpRole(e.target.value);
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="Técnico de Limpeza & Apoio">Técnico de Limpeza & Apoio</option>
                    <option value="Estafeta de Entregas & Logística">Estafeta de Entregas & Logística</option>
                    <option value="Operador de Logística & Produção">Operador de Logística & Produção</option>
                    <option value="Agente de Apoio ao Cliente">Agente de Apoio ao Cliente</option>
                    <option value="Técnico Eletricista">Técnico Eletricista</option>
                    <option value="Supervisor Operacional">Supervisor Operacional</option>
                    <option value="custom">Outro cargo personalizado...</option>
                  </select>
                  <input
                    value={newEmpRole}
                    onChange={(e) => setNewEmpRole(e.target.value)}
                    placeholder="Ou digite o cargo personalizado"
                    className={inputCls}
                  />
                </div>
              </Field>
            </div>
            <Btn
              kind="action"
              className="mt-4 min-h-10"
              onClick={handleAddEmployee}
              disabled={!newEmpName.trim() || !newEmpPhone.trim()}
            >
              Adicionar Funcionário
            </Btn>
          </div>

          {/* Employee list */}
          <div className="grid gap-3 @3xl:grid-cols-3">
            {store.employees.map((emp) => (
              <div
                key={emp.id}
                className="rounded-[var(--radius)] border border-border bg-paper p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground font-black text-sm">
                    {emp.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-bold text-primary">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>📞 +244 {emp.phone}</span>
                  <span className="text-ok font-semibold">Ativo em Huambo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "contracts" && (
        <div className="space-y-6">
          <h2 className="font-display text-xl font-bold text-primary">
            Contratos Empresariais B2B (Resolve Business)
          </h2>

          <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
            <h3 className="font-display font-bold text-primary mb-3">
              Novo Contrato Empresarial
            </h3>
            <div className="grid gap-3 @3xl:grid-cols-3">
              <Field label="Nome da Empresa">
                <input
                  value={contractCompany}
                  onChange={(e) => setContractCompany(e.target.value)}
                  placeholder="Ex: Seguradora Confiança"
                  className={inputCls}
                />
              </Field>
              <Field label="NIF">
                <input
                  value={contractNif}
                  onChange={(e) => setContractNif(e.target.value)}
                  placeholder="5401928391"
                  className={inputCls}
                />
              </Field>
              <Field label="Valor Mensal Acordado (Kz)">
                <input
                  type="number"
                  value={contractValue}
                  onChange={(e) => setContractValue(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>
            <Btn
              kind="action"
              className="mt-4 min-h-10"
              onClick={handleAddContract}
              disabled={!contractCompany.trim() || !contractNif.trim()}
            >
              Criar Contrato
            </Btn>
          </div>

          <div className="space-y-3">
            {store.contracts.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] border border-border bg-paper p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{c.id}</span>
                    <span className="rounded-full bg-ok/10 text-ok px-2.5 py-0.5 text-xs font-bold">
                      {c.status}
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-lg text-primary mt-1">
                    {c.companyName} (NIF: {c.nif})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Contacto: {c.contactName} · Serviços: {c.services.join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Faturação Mensal</span>
                  <span className="font-display text-xl font-black text-primary">
                    {formatCurrency(c.monthlyValueAOA, store.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "coupons" && (
        <div className="space-y-6">
          <h2 className="font-display text-xl font-bold text-primary">
            Gestão de Cupons e Campanhas Promocionais
          </h2>

          <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
            <h3 className="font-display font-bold text-primary mb-3">
              Criar Novo Cupom
            </h3>
            <div className="grid gap-3 @3xl:grid-cols-3">
              <Field label="Código do Cupom">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="EXEMPLO15"
                  className={inputCls}
                />
              </Field>
              <Field label="Desconto (%)">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={couponDiscount}
                  onChange={(e) => setCouponDiscount(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Descrição Curta">
                <input
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  placeholder="Desconto para novos clientes"
                  className={inputCls}
                />
              </Field>
            </div>
            <Btn
              kind="action"
              className="mt-4 min-h-10"
              onClick={handleAddCoupon}
              disabled={!couponCode.trim()}
            >
              Ativar Cupom
            </Btn>
          </div>

          <div className="grid gap-3 @3xl:grid-cols-3">
            {store.coupons.map((cp) => (
              <div
                key={cp.code}
                className="rounded-[var(--radius)] border border-dashed border-border bg-paper p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-black text-action bg-action/10 px-2.5 py-1 rounded">
                    {cp.code}
                  </span>
                  <span className="text-xs font-bold text-ok">Ativo</span>
                </div>
                <p className="text-sm font-semibold mt-2">{cp.description}</p>
                {cp.discountPercent && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {cp.discountPercent}% de desconto em qualquer serviço
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "support" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-primary">
                Chamados de Suporte & Reclamações
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supervisão de atendimentos e aprovação de pedidos de reembolso.
              </p>
            </div>
            <Btn
              kind="action"
              onClick={() => go("/apoio")}
              className="text-xs min-h-9 px-4"
            >
              <Icon name="Headphones" className="size-3.5" />
              Abrir Central Multicanal de Apoio
            </Btn>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-sky-500/30 bg-sky-500/5 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-sky-500 text-white font-bold shrink-0">
                <Icon name="Headphones" className="size-5" />
              </span>
              <div>
                <h3 className="font-display font-bold text-sm text-primary">
                  Central de Apoio ao Cliente Ativa
                </h3>
                <p className="text-xs text-muted-foreground">
                  A equipa de Apoio ao Cliente gerencia a fila de tickets categorizados, notas internas confidenciais, base de conhecimento e WhatsApp no seu painel próprio.
                </p>
              </div>
            </div>
            <Btn
              kind="ghost"
              onClick={() => go("/apoio")}
              className="text-xs min-h-9 px-4 border border-sky-500/30 text-sky-900 bg-paper hover:bg-sky-100"
            >
              Ir para Apoio ao Cliente <Icon name="ArrowRight" className="size-3.5" />
            </Btn>
          </div>

          <div className="space-y-3">
            {store.supportTickets.map((t) => (
              <div
                key={t.id}
                className="rounded-[var(--radius)] border border-border bg-paper p-5"
              >
                <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{t.id}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        t.status === "Resolvido"
                          ? "bg-ok/10 text-ok"
                          : "bg-warn/20 text-warn"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Cliente: {t.customerName} (+244 {t.customerPhone})
                  </span>
                </div>

                <h4 className="font-bold text-base">{t.subject}</h4>
                <p className="text-sm text-muted-foreground mt-1">{t.message}</p>

                {t.response ? (
                  <div className="mt-3 rounded-[var(--radius)] bg-mist p-3 text-sm">
                    <span className="text-xs font-bold text-action block uppercase mb-0.5">
                      Resposta oficial fornecida:
                    </span>
                    {t.response}
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Btn
                      kind="ink"
                      className="min-h-9 text-xs"
                      onClick={() => setReplyTicketId(t.id)}
                    >
                      Responder ao Cliente
                    </Btn>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="grid max-w-3xl gap-6">
          {/* Card 1: Logótipo Oficial & Identidade Visual Dinâmica */}
          <div className="rounded-[var(--radius)] border border-border bg-paper p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
              <div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-action font-mono">
                  IDENTIDADE VISUAL DINÂMICA
                </span>
                <h3 className="font-display text-lg font-black text-primary">
                  Logótipo Oficial da Plataforma
                </h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  store.customLogo?.trim()
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                }`}
              >
                {store.customLogo?.trim() ? "Logótipo Personalizado Ativo" : "Logótipo Padrão da Marca"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              O logótipo configurado aqui é transmitido instantaneamente para a barra de navegação superior em todos os computadores, tablets e telemóveis de todos os utilizadores através da sincronização em tempo real e base de dados Supabase.
            </p>

            {/* Current Active Preview */}
            <div className="rounded-xl border border-border/80 bg-mist/40 p-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-14 shrink-0 rounded-lg bg-white border border-border/80 p-1 flex items-center justify-center overflow-hidden shadow-2xs">
                  <img
                    src={store.customLogo?.trim() || "/assets/aistudio/file_0000000077e8820eae7db33507894d75_a4e26357.png"}
                    alt="Logótipo Ativo da Resolve Express"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    {store.customLogo?.trim() ? "Logótipo Personalizado em Exibição" : "Logótipo Padrão Resolve Express"}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate max-w-xs sm:max-w-md">
                    {store.customLogo?.trim() || "/assets/aistudio/file_0000000077e8820eae7db33507894d75_a4e26357.png"}
                  </p>
                </div>
              </div>

              {store.customLogo?.trim() && (
                <button
                  type="button"
                  disabled={logoDeleting || isSaving}
                  onClick={async () => {
                    const prevLogo = store.customLogo || "";
                    setLogoDeleting(true);
                    const ok = await executeAdminSave(
                      () => ({ customLogo: "" }),
                      "Restauração do Logótipo Original",
                      "Restaurado logótipo padrão original da Resolve Express"
                    );
                    if (ok) {
                      setLogoInput("");
                      // Safe backend orphan cleanup
                      if (prevLogo) {
                        try {
                          await fetch("/api/storage/safe-replace-image", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              oldUrl: prevLogo,
                              newUrl: "",
                              role: store.currentUser?.role,
                            }),
                          });
                        } catch (err) {
                          console.warn("Safe replace warning:", err);
                        }
                      }
                    }
                    setLogoDeleting(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
                  title="Restaurar o logótipo original padrão da plataforma"
                >
                  <Icon name="RotateCcw" className="size-3.5" />
                  {logoDeleting ? "A restaurar..." : "Restaurar Padrão"}
                </button>
              )}
            </div>

            {/* Image Uploader */}
            <ImageUploader
              label="Carregar Novo Logótipo (ou inserir link)"
              value={logoInput}
              onChange={(url) => {
                setLogoInput(url);
                setLogoSaved(false);
              }}
              helperText="Carregue ficheiro PNG transparente, SVG ou JPG. O ficheiro é enviado para o Supabase Storage ou servidor local com sincronização automática global."
              aspectRatio="wide"
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Btn
                kind="action"
                disabled={isSaving || !logoInput.trim() || logoInput.trim() === (store.customLogo || "")}
                onClick={async () => {
                  const prevLogo = store.customLogo || "";
                  const targetUrl = logoInput.trim();
                  const ok = await executeAdminSave(
                    () => ({ customLogo: targetUrl }),
                    "Atualização de Logótipo Oficial",
                    `Logótipo atualizado: ${targetUrl.slice(0, 45)}...`
                  );
                  if (ok) {
                    setLogoSaved(true);
                    setTimeout(() => setLogoSaved(false), 4000);
                    // Safe replacement on backend
                    if (prevLogo && prevLogo !== targetUrl) {
                      try {
                        await fetch("/api/storage/safe-replace-image", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            oldUrl: prevLogo,
                            newUrl: targetUrl,
                            role: store.currentUser?.role,
                          }),
                        });
                      } catch (err) {
                        console.warn("Safe replace warning:", err);
                      }
                    }
                  }
                }}
              >
                <Icon name="Save" className="size-4" />
                Guardar e Sincronizar Logótipo
              </Btn>

              {logoSaved && (
                <span className="flex items-center gap-1 text-xs font-bold text-ok">
                  <Icon name="Check" className="size-4" /> Logótipo atualizado e sincronizado globalmente!
                </span>
              )}
            </div>
          </div>

          {/* Card 2: WhatsApp Business & Operações */}
          <div className="rounded-[var(--radius)] border border-border bg-paper p-6 space-y-5">
            <div className="border-b border-border/80 pb-3">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-action font-mono">
                WHATSAPP_BUSINESS_NUMBER & OPERAÇÕES
              </span>
              <h3 className="font-display text-lg font-black text-primary">
                Configurações Operacionais & Atendimento
              </h3>
            </div>
            <Field
              label="Número de WhatsApp Business"
              error={
                !validPhone && "Use só dígitos com indicativo, ex.: 244923000000."
              }
              hint="Com indicativo do país, sem +. Fica numa única configuração."
            >
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSaved(false);
                }}
                className={inputCls}
                placeholder="244…"
              />
            </Field>
            <Field label="Mensagem inicial">
              <textarea
                rows={3}
                value={msg}
                onChange={(e) => {
                  setMsg(e.target.value);
                  setSaved(false);
                }}
                className={inputCls + " py-3"}
              />
            </Field>
            <Field
              label="Taxa de Comissão Padrão para Parceiros (%)"
              hint="Percentual retido pela Resolve Express nos serviços executados por parceiros independentes."
            >
              <input
                type="number"
                min={5}
                max={50}
                value={commissionInput}
                onChange={(e) => {
                  setCommissionInput(Number(e.target.value));
                  setSaved(false);
                }}
                className={inputCls + " w-32"}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Btn
                kind="ink"
                disabled={!validPhone || msg.trim().length < 5}
                onClick={async () => {
                  await executeAdminSave(
                    (st) => ({
                      whatsapp: phone.replace(/\D/g, ""),
                      whatsappDefault: msg.trim(),
                      partnerWallet: {
                        ...st.partnerWallet,
                        commissionRate: commissionInput,
                      },
                    }),
                    "Atualização de Configurações Globais",
                    `WhatsApp: ${phone}, Comissão: ${commissionInput}%`
                  );
                  setSaved(true);
                }}
              >
                Guardar Configurações
              </Btn>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-ok">
                  <Icon name="Check" className="size-4" /> Guardado
                </span>
              )}
              {store.whatsapp && (
                <a
                  href={waLink(store.whatsapp, store.whatsappDefault) || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary underline"
                >
                  Testar ligação
                </a>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Páginas de serviço e departamento personalizam a mensagem
              automaticamente (ex.: “Olá! Tenho interesse no serviço de lavandaria
              da Resolve Express.”).
            </p>
          </div>
        </div>
      )}

      {/* Encomendas de Produtos Tab */}
      {tab === "productOrders" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-black text-primary">
                Encomendas de Produtos (Marketplace)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhamento e despacho de encomendas com entrega no Huambo
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-mist px-3 py-1 text-xs font-bold text-primary">
                Total Facturado: {formatCurrency(totalProductSalesRevenue, store.currency)}
              </span>
            </div>
          </div>

          {store.productOrders.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-border bg-paper p-12 text-center">
              <Icon name="Package" className="mx-auto size-12 text-muted-foreground/40 mb-3" />
              <p className="font-display font-bold text-lg text-primary">Nenhuma encomenda registada</p>
              <p className="text-sm text-muted-foreground mt-1">
                As encomendas feitas na loja pública de produtos aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {store.productOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs transition hover:border-action/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-primary">
                          {ord.id}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            ord.orderStatus === "Entregue"
                              ? "bg-ok/15 text-ok"
                              : ord.orderStatus === "A caminho"
                              ? "bg-blue-100 text-blue-700"
                              : ord.orderStatus === "Em preparação"
                              ? "bg-amber-100 text-amber-700"
                              : ord.orderStatus === "Cancelada"
                              ? "bg-red-100 text-red-700"
                              : "bg-mist text-primary"
                          }`}
                        >
                          {ord.orderStatus}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Criada em {new Date(ord.createdAt).toLocaleString("pt-PT")} · Previsão: {ord.estimatedDelivery}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-display text-lg font-black text-primary block">
                        {formatCurrency(ord.totalAOA, store.currency)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {ord.paymentMethod} ({ord.paymentStatus})
                      </span>
                    </div>
                  </div>

                  {/* Customer and Delivery info */}
                  <div className="my-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 bg-mist/40 p-3 rounded-[var(--radius)]">
                    <div>
                      <span className="font-bold text-primary block">Cliente:</span>
                      <p className="text-foreground">{ord.customerName}</p>
                      <a
                        href={`https://wa.me/244${ord.customerPhone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-action font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        <Icon name="Phone" className="size-3" />
                        {ord.customerPhone}
                      </a>
                    </div>
                    <div>
                      <span className="font-bold text-primary block">Endereço de Entrega:</span>
                      <p className="text-foreground">{ord.deliveryAddress}</p>
                      <p className="text-muted-foreground">Bairro: {ord.deliveryBairro}, Huambo</p>
                    </div>
                    <div>
                      <span className="font-bold text-primary block">Fornecedor(es):</span>
                      <p className="text-foreground">{ord.sellerNames?.join(", ") || "Resolve Express"}</p>
                      <p className="text-muted-foreground">Taxa de Entrega: {kz(ord.deliveryFeeAOA)}</p>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="my-2 divide-y divide-border/60">
                    {ord.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <img
                            src={item.product?.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                            alt={item.product?.name || "Produto"}
                            className="size-8 rounded object-cover border border-border"
                          />
                          <div>
                            <span className="font-semibold text-primary">{item.product.name}</span>
                            <span className="text-muted-foreground ml-2">× {item.quantity}</span>
                          </div>
                        </div>
                        <span className="font-bold text-foreground">
                          {kz((item.product.promotionalPriceAOA || item.product.priceAOA) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Status changer */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Actualizar Estado da Encomenda:
                      </span>
                      <select
                        value={ord.orderStatus}
                        onChange={(e) =>
                          handleUpdateProductOrderStatus(ord.id, e.target.value as any)
                        }
                        className="rounded border border-border bg-paper px-2.5 py-1 text-xs font-bold text-primary outline-none cursor-pointer"
                      >
                        <option value="Recebida">Recebida</option>
                        <option value="Confirmada">Confirmada</option>
                        <option value="Em preparação">Em preparação</option>
                        <option value="A caminho">A caminho</option>
                        <option value="Entregue">Entregue</option>
                        <option value="Cancelada">Cancelada</option>
                      </select>
                    </div>

                    <a
                      href={`https://wa.me/244${ord.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Olá ${ord.customerName}! Actualização da sua encomenda ${ord.id} na Resolve Express: Estado actual: ${ord.orderStatus}.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition"
                    >
                      <Icon name="MessageSquare" className="size-3.5" />
                      Notificar via WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Produtos do Marketplace Tab */}
      {tab === "products" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-black text-primary">
                Gestão do Catálogo de Produtos
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Controlo de artigos, stock, preços promocionais e vendedores autorizados
              </p>
            </div>
            <Btn kind="action" onClick={() => setShowAddProduct(true)}>
              <Icon name="Plus" className="size-4" />
              Adicionar Produto
            </Btn>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setProductCatFilter("Todos")}
              className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${
                productCatFilter === "Todos"
                  ? "bg-primary text-primary-foreground"
                  : "bg-mist text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({store.products.length})
            </button>
            {PRODUCT_CATEGORIES.filter((c) => c !== "Todos").map((catName) => {
              const count = store.products.filter((p) => p.category === catName).length;
              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setProductCatFilter(catName)}
                  className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${
                    productCatFilter === catName
                      ? "bg-primary text-primary-foreground"
                      : "bg-mist text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {catName} ({count})
                </button>
              );
            })}
          </div>

          {/* Products Table/Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.products
              .filter(
                (p) => productCatFilter === "Todos" || p.category === productCatFilter
              )
              .map((prod) => (
                <div
                  key={prod.id}
                  className={`rounded-[var(--radius)] border bg-paper p-4 transition shadow-xs ${
                    prod.available ? "border-border" : "border-red-200 opacity-60"
                  }`}
                >
                  <div className={`relative mb-3 aspect-video w-full overflow-hidden rounded-[var(--radius)] ${
                    prod.imageFit === "contain"
                      ? "bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-1"
                      : "bg-mist"
                  }`}>
                    <img
                      src={prod.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                      alt={prod.name}
                      className={`size-full ${
                        prod.imageFit === "contain" ? "object-contain" : "object-cover object-center"
                      }`}
                    />
                    {prod.badge && (
                      <span className="absolute top-2 left-2 rounded-full bg-action px-2 py-0.5 text-[10px] font-black text-action-ink">
                        {prod.badge}
                      </span>
                    )}
                    <span
                      className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        prod.stock > 0 ? "bg-ok text-white" : "bg-red-600 text-white"
                      }`}
                    >
                      {prod.stock > 0 ? `Stock: ${prod.stock}` : "Esgotado"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-action">
                      {prod.category}
                    </span>
                    <h3 className="font-display text-sm font-bold text-primary line-clamp-1">
                      {prod.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {prod.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Vendedor: <span className="font-semibold text-foreground">{prod.sellerName}</span>
                    </p>
                  </div>

                  <div className="my-3 flex items-baseline gap-2 border-t border-border pt-2">
                    <span className="font-display text-base font-black text-primary">
                      {kz(prod.promotionalPriceAOA || prod.priceAOA)}
                    </span>
                    {prod.promotionalPriceAOA && (
                      <span className="text-xs text-muted-foreground line-through">
                        {kz(prod.priceAOA)}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">/{prod.unit}</span>
                  </div>

                  {/* Stock, Destaque, Edit and Delete Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateStock(prod.id, -1)}
                        className="rounded border border-border px-1.5 py-0.5 font-bold hover:bg-mist"
                        title="Diminuir stock"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStock(prod.id, 5)}
                        className="rounded border border-border px-1.5 py-0.5 font-bold hover:bg-mist"
                        title="Aumentar stock em 5"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFeaturedProduct(prod.id)}
                        className={`rounded px-1.5 py-0.5 text-[11px] font-bold transition flex items-center gap-0.5 ${
                          (store.featuredProducts || []).includes(prod.id)
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "border border-border text-muted-foreground hover:text-amber-600"
                        }`}
                        title="Destaque no Marketplace e Início"
                      >
                        <Icon
                          name="Star"
                          className={`size-3 ${
                            (store.featuredProducts || []).includes(prod.id)
                              ? "fill-amber-500 text-amber-500"
                              : ""
                          }`}
                        />
                        <span>Destaque</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditProduct(prod)}
                        className="rounded border border-border px-2 py-0.5 text-xs font-bold hover:bg-mist transition flex items-center gap-1"
                        title="Editar produto"
                      >
                        <Icon name="Pencil" className="size-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleProduct(prod.id)}
                        className={`rounded px-2 py-0.5 text-xs font-bold transition ${
                          prod.available
                            ? "bg-mist text-foreground hover:bg-mist/80"
                            : "bg-ok text-white"
                        }`}
                      >
                        {prod.available ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Eliminar produto"
                      >
                        <Icon name="Trash2" className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Add Product Modal */}
          {showAddProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-paper p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-display text-lg font-black text-primary">
                    Adicionar Novo Produto ao Marketplace
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddProduct(false)}
                    className="rounded p-1 hover:bg-mist text-muted-foreground"
                  >
                    <Icon name="X" className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-3 pt-3">
                  <Field label="Nome do Produto">
                    <input
                      type="text"
                      required
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      placeholder="Ex.: Café de Angola Seleccionado 500g"
                      className={inputCls}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Categoria">
                      <select
                        value={newProdCategory}
                        onChange={(e) => setNewProdCategory(e.target.value)}
                        className={inputCls}
                      >
                        {PRODUCT_CATEGORIES.filter((c) => c !== "Todos").map((cName) => (
                          <option key={cName} value={cName}>
                            {cName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Unidade">
                      <input
                        type="text"
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                        placeholder="Ex.: kg, garrafa, unid."
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Preço (AOA)">
                      <input
                        type="number"
                        required
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(Number(e.target.value))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Preço Promo (AOA)">
                      <input
                        type="number"
                        value={newProdPromo || ""}
                        onChange={(e) =>
                          setNewProdPromo(e.target.value ? Number(e.target.value) : undefined)
                        }
                        placeholder="Opcional"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Stock Inicial">
                      <input
                        type="number"
                        value={newProdStock}
                        onChange={(e) => setNewProdStock(Number(e.target.value))}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Vendedor / Loja">
                      <input
                        type="text"
                        value={newProdSeller}
                        onChange={(e) => setNewProdSeller(e.target.value)}
                        placeholder="Nome da empresa parceira"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Etiqueta / Badge">
                      <input
                        type="text"
                        value={newProdBadge}
                        onChange={(e) => setNewProdBadge(e.target.value)}
                        placeholder="Ex.: Novo, Destaque, Oferta"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <ImageUploader
                    value={newProdImg}
                    onChange={setNewProdImg}
                    fitMode={newProdImgFit}
                    onFitModeChange={setNewProdImgFit}
                    label="Imagem do Produto"
                    helperText="Carregue uma foto do telemóvel/computador ou insira um link. O sistema adapta-se automaticamente a fotos verticais ou horizontais."
                  />

                  <Field label="Descrição Detalhada">
                    <textarea
                      rows={2}
                      value={newProdDesc}
                      onChange={(e) => setNewProdDesc(e.target.value)}
                      placeholder="Descrição clara das características do artigo..."
                      className={inputCls + " py-2"}
                    />
                  </Field>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <Btn kind="ghost" type="button" onClick={() => setShowAddProduct(false)}>
                      Cancelar
                    </Btn>
                    <Btn kind="action" type="submit">
                      Publicar Produto
                    </Btn>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Product Modal */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-paper p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-display text-lg font-black text-primary">
                    Editar Produto: {editingProduct.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="rounded p-1 hover:bg-mist text-muted-foreground"
                  >
                    <Icon name="X" className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditProduct} className="space-y-3 pt-3">
                  <Field label="Nome do Produto">
                    <input
                      type="text"
                      required
                      value={editingProduct.name}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, name: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Categoria">
                      <select
                        value={editingProduct.category}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, category: e.target.value })
                        }
                        className={inputCls}
                      >
                        {PRODUCT_CATEGORIES.filter((c) => c !== "Todos").map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Unidade">
                      <input
                        type="text"
                        value={editingProduct.unit}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, unit: e.target.value })
                        }
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Preço Normal (AOA)">
                      <input
                        type="number"
                        required
                        min={1}
                        value={editingProduct.priceAOA}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            priceAOA: Number(e.target.value),
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Preço Promo (AOA)">
                      <input
                        type="number"
                        value={editingProduct.promotionalPriceAOA || ""}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            promotionalPriceAOA: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="Opcional"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Stock Atual">
                      <input
                        type="number"
                        value={editingProduct.stock}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            stock: Number(e.target.value),
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Vendedor / Loja">
                      <input
                        type="text"
                        value={editingProduct.sellerName}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            sellerName: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Etiqueta / Badge">
                      <input
                        type="text"
                        value={editingProduct.badge || ""}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            badge: e.target.value || undefined,
                          })
                        }
                        placeholder="Ex.: Mais Vendido"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <ImageUploader
                    value={editingProduct.image}
                    onChange={(img) =>
                      setEditingProduct({ ...editingProduct, image: img })
                    }
                    fitMode={editingProduct.imageFit || "cover"}
                    onFitModeChange={(fit) =>
                      setEditingProduct({ ...editingProduct, imageFit: fit })
                    }
                    label="Imagem do Produto"
                    helperText="Carregue uma foto do telemóvel/computador ou insira um link. O sistema adapta-se automaticamente a fotos verticais ou horizontais."
                  />

                  <Field label="Descrição">
                    <textarea
                      rows={2}
                      value={editingProduct.description}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          description: e.target.value,
                        })
                      }
                      className={inputCls + " py-2"}
                    />
                  </Field>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="editProdFeat"
                      checked={(store.featuredProducts || []).includes(editingProduct.id)}
                      onChange={() => handleToggleFeaturedProduct(editingProduct.id)}
                      className="size-4 accent-action"
                    />
                    <label htmlFor="editProdFeat" className="text-xs font-bold text-primary cursor-pointer">
                      ⭐ Destacar este produto na página inicial e topo da loja
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <Btn kind="ghost" type="button" onClick={() => setEditingProduct(null)}>
                      Cancelar
                    </Btn>
                    <Btn kind="action" type="submit">
                      Guardar Alterações
                    </Btn>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empresas Parceiras Tab */}
      {tab === "partners" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-black text-primary">
                Registo e Aprovação de Empresas Parceiras
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Validação cadastral de estabelecimentos e fornecedores em Angola
              </p>
            </div>
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-bold text-primary">
              {store.registeredPartners.filter((p) => p.status === "Aprovado").length} Aprovadas ·{" "}
              {store.registeredPartners.filter((p) => p.status === "Pendente").length} Pendentes
            </span>
          </div>

          {store.registeredPartners.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-border bg-paper p-12 text-center">
              <Icon name="Building2" className="mx-auto size-12 text-muted-foreground/40 mb-3" />
              <p className="font-display font-bold text-lg text-primary">Nenhuma empresa parceira registada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Novos registos submetidos em "Sou uma Empresa Parceira" aparecerão aqui para verificação e aprovação.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {store.registeredPartners.map((company) => (
                <div
                  key={company.id}
                  className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs transition hover:border-action/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-black text-primary">
                          {company.commercialName}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            company.status === "Aprovado"
                              ? "bg-ok/15 text-ok"
                              : company.status === "Rejeitado"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {company.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Razão Social: {company.socialReason} · NIF: <span className="font-mono font-bold text-foreground">{company.nif}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-primary">
                        {company.activityCategory}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Registo: {new Date(company.createdAt).toLocaleDateString("pt-PT")}
                      </p>
                    </div>
                  </div>

                  <div className="my-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 bg-mist/30 p-3 rounded-[var(--radius)]">
                    <div>
                      <span className="font-bold text-primary block">Responsável / Gerência:</span>
                      <p className="text-foreground">{company.manager}</p>
                      <a
                        href={`https://wa.me/244${company.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-action font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        <Icon name="Phone" className="size-3" />
                        {company.phone}
                      </a>
                    </div>
                    <div>
                      <span className="font-bold text-primary block">Localização / Sede:</span>
                      <p className="text-foreground">{company.address}</p>
                      <p className="text-muted-foreground">{company.municipio}, {company.province}</p>
                    </div>
                    <div>
                      <span className="font-bold text-primary block">Email Institucional:</span>
                      <p className="text-foreground">{company.email}</p>
                    </div>
                  </div>

                  {company.description && (
                    <p className="my-2 text-xs text-muted-foreground italic">
                      "{company.description}"
                    </p>
                  )}

                  {/* Approval Actions */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      ID do Registo: <span className="font-mono">{company.id}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {company.status !== "Aprovado" && (
                        <Btn
                          kind="action"
                          className="min-h-9 px-3 text-xs"
                          onClick={() => handleApprovePartner(company.id)}
                        >
                          <Icon name="Check" className="size-3.5" />
                          Aprovar Empresa Parceira
                        </Btn>
                      )}
                      {company.status !== "Rejeitado" && (
                        <button
                          type="button"
                          onClick={() => handleRejectPartner(company.id)}
                          className="rounded border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                        >
                          Rejeitar
                        </button>
                      )}
                      <a
                        href={`https://wa.me/244${company.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Olá ${company.manager}! Entramos em contacto da administração da Resolve Express Huambo relativamente ao registo da ${company.commercialName}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-semibold hover:bg-mist transition"
                      >
                        <Icon name="MessageSquare" className="size-3" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ticket Reply Modal */}
      {replyTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-paper p-6 shadow-xl">
            <h3 className="font-display text-xl font-bold text-primary">
              Responder ao Chamado de Suporte
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Ticket {replyTicketId}. A resposta aparecerá no Portal do Cliente.
            </p>

            <div className="my-4">
              <Field label="Mensagem da Resposta">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escreva a resposta e solução para o cliente..."
                  className={inputCls + " py-2"}
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Btn kind="ghost" onClick={() => setReplyTicketId(null)}>
                Cancelar
              </Btn>
              <Btn
                kind="action"
                onClick={handleSendTicketReply}
                disabled={!replyText.trim()}
              >
                Enviar Resposta
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-paper p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-black text-primary">
                Adicionar Novo Serviço ao Catálogo
              </h3>
              <button
                type="button"
                onClick={() => setShowAddService(false)}
                className="rounded p-1 hover:bg-mist text-muted-foreground"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-3 pt-3">
              <Field label="Nome do Serviço">
                <input
                  type="text"
                  required
                  value={newSvcName}
                  onChange={(e) => setNewSvcName(e.target.value)}
                  placeholder="Ex.: Apoio Escolar e Explicação"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Departamento / Categoria">
                  <select
                    value={newSvcCategory}
                    onChange={(e) => setNewSvcCategory(e.target.value)}
                    className={inputCls}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.replace("Resolve ", "")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unidade de Cobrança">
                  <input
                    type="text"
                    value={newSvcUnit}
                    onChange={(e) => setNewSvcUnit(e.target.value)}
                    placeholder="divisão, hora, visita, mês"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço Inicial (AOA)">
                  <input
                    type="number"
                    min={0}
                    value={newSvcPrice}
                    onChange={(e) => setNewSvcPrice(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Prestador Responsável">
                  <select
                    value={newSvcProvider}
                    onChange={(e) => setNewSvcProvider(e.target.value as any)}
                    className={inputCls}
                  >
                    {Object.entries(PROVIDERS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <ImageUploader
                value={newSvcImg}
                onChange={setNewSvcImg}
                fitMode={newSvcImgFit}
                onFitModeChange={setNewSvcImgFit}
                label="Imagem do Serviço"
                helperText="Upload por ficheiro ou link. A imagem adapta-se automaticamente em todos os cartões e cabeçalhos de serviço."
              />

              <Field label="Descrição Detalhada do Serviço">
                <textarea
                  rows={2}
                  value={newSvcDesc}
                  onChange={(e) => setNewSvcDesc(e.target.value)}
                  placeholder="Explique o que inclui o serviço, método de trabalho e garantia..."
                  className={inputCls + " py-2"}
                />
              </Field>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newSvcFeat"
                  checked={newSvcFeatured}
                  onChange={(e) => setNewSvcFeatured(e.target.checked)}
                  className="size-4 accent-action"
                />
                <label htmlFor="newSvcFeat" className="text-xs font-bold text-primary cursor-pointer">
                  ⭐ Destacar este serviço (aparece na secção de Serviços em Destaque)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Btn kind="ghost" type="button" onClick={() => setShowAddService(false)}>
                  Cancelar
                </Btn>
                <Btn kind="action" type="submit">
                  Guardar Serviço
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-paper p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-black text-primary">
                Editar Serviço: {editingService.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="rounded p-1 hover:bg-mist text-muted-foreground"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditService} className="space-y-3 pt-3">
              <Field label="Nome do Serviço">
                <input
                  type="text"
                  required
                  value={editSvcName}
                  onChange={(e) => setEditSvcName(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Departamento">
                  <select
                    value={editSvcCategory}
                    onChange={(e) => setEditSvcCategory(e.target.value)}
                    className={inputCls}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.replace("Resolve ", "")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unidade">
                  <input
                    type="text"
                    value={editSvcUnit}
                    onChange={(e) => setEditSvcUnit(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço Inicial (AOA)">
                  <input
                    type="number"
                    min={0}
                    value={editSvcPrice ?? ""}
                    onChange={(e) =>
                      setEditSvcPrice(e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="Sob orçamento"
                    className={inputCls}
                  />
                </Field>
                <Field label="Prestador">
                  <select
                    value={editSvcProvider}
                    onChange={(e) => setEditSvcProvider(e.target.value as any)}
                    className={inputCls}
                  >
                    {Object.entries(PROVIDERS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <ImageUploader
                value={editSvcImg}
                onChange={setEditSvcImg}
                fitMode={editSvcImgFit}
                onFitModeChange={setEditSvcImgFit}
                label="Imagem do Serviço"
                helperText="Upload por ficheiro ou link. A imagem adapta-se automaticamente em todos os cartões e cabeçalhos de serviço."
              />

              <Field label="Descrição">
                <textarea
                  rows={2}
                  value={editSvcDesc}
                  onChange={(e) => setEditSvcDesc(e.target.value)}
                  className={inputCls + " py-2"}
                />
              </Field>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editSvcFeat"
                  checked={editSvcFeatured}
                  onChange={(e) => setEditSvcFeatured(e.target.checked)}
                  className="size-4 accent-action"
                />
                <label htmlFor="editSvcFeat" className="text-xs font-bold text-primary cursor-pointer">
                  ⭐ Destacar este serviço na página inicial e topo do catálogo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Btn kind="ghost" type="button" onClick={() => setEditingService(null)}>
                  Cancelar
                </Btn>
                <Btn kind="action" type="submit">
                  Guardar Alterações
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gestão da Praça Tab */}
      {tab === "praca" && <PracaAdminSection />}

      {/* Gestão de Importação & Cartões Tab */}
      {tab === "importacao" && <ImportAdminSection />}

      {/* Gestão de Intermediário Tab */}
      {tab === "intermediario" && <IntermediarioAdminSection />}

      {/* Edit Department Modal (Super Admin) */}
      {editingDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-paper p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-action">
                  Super Admin
                </span>
                <h3 className="font-display text-lg font-black text-primary">
                  Editar Departamento: {editingDepartment.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDepartment(null)}
                className="rounded p-1 hover:bg-mist text-muted-foreground"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-4 pt-3">
              <Field label="Nome Oficial do Departamento">
                <input
                  type="text"
                  required
                  value={editingDepartment.name}
                  onChange={(e) =>
                    setEditingDepartment({ ...editingDepartment, name: e.target.value })
                  }
                  placeholder="Ex.: Resolve Casa"
                  className={inputCls}
                />
              </Field>

              <Field label="Descrição Curta / Subtítulo">
                <input
                  type="text"
                  required
                  value={editingDepartment.short}
                  onChange={(e) =>
                    setEditingDepartment({ ...editingDepartment, short: e.target.value })
                  }
                  placeholder="Ex.: Limpeza, engomadoria e organização residencial"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Ícone Lucide">
                  <input
                    type="text"
                    value={editingDepartment.icon}
                    onChange={(e) =>
                      setEditingDepartment({ ...editingDepartment, icon: e.target.value })
                    }
                    placeholder="Ex.: Sparkles, Shirt, Utensils, Wrench"
                    className={inputCls}
                  />
                </Field>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-mist text-xs">
                    <span className="text-muted-foreground">Prévia:</span>
                    <div className="size-7 rounded-md bg-action/10 text-action grid place-items-center">
                      <Icon name={editingDepartment.icon || "Sparkles"} className="size-4" />
                    </div>
                    <span className="font-bold text-primary truncate">
                      {editingDepartment.icon || "Sparkles"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Upload de Imagem por Input e Link com Adaptação de Tamanho */}
              <ImageUploader
                value={editingDepartment.image}
                onChange={(img) =>
                  setEditingDepartment({ ...editingDepartment, image: img })
                }
                fitMode={editingDepartment.imageFit}
                onFitModeChange={(fit) =>
                  setEditingDepartment({ ...editingDepartment, imageFit: fit })
                }
                label="Imagem de Capa do Departamento"
                helperText="O sistema adapta esta imagem automaticamente para cabeçalhos, banners da Home e grelhas de serviços."
              />

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => handleResetDepartment(editingDepartment.id)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <Icon name="RotateCcw" className="size-3.5" />
                  Restaurar Padrão
                </button>
                <div className="flex items-center gap-2">
                  <Btn kind="ghost" type="button" onClick={() => setEditingDepartment(null)}>
                    Cancelar
                  </Btn>
                  <Btn kind="action" type="submit">
                    Guardar Departamento
                  </Btn>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Adicionar / Editar Banner do Hero (Super Admin) */}
      {showAddHeroBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-paper p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-action/10 text-action grid place-items-center">
                  <Icon name="Image" className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    {editingHeroBanner ? "Editar Banner do Hero" : "Adicionar Novo Banner ao Hero"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Altere os textos, imagem e botões de destaque do carrossel principal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddHeroBanner(false);
                  setEditingHeroBanner(null);
                }}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-mist cursor-pointer"
              >
                <Icon name="X" className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveHeroBanner();
              }}
              className="space-y-4"
            >
              {/* Presets Rápidos de Visibilidade */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-mist/60 border border-border">
                <div>
                  <p className="text-xs font-bold text-primary">Predefinições Rápidas de Visibilidade</p>
                  <p className="text-[11px] text-muted-foreground">
                    Escolha se deseja um banner informativo completo ou apenas uma imagem limpa desenhada
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHeroFormShowEyebrow(true);
                      setHeroFormShowBadge(true);
                      setHeroFormShowTitle(true);
                      setHeroFormShowDesc(true);
                      setHeroFormShowButtons(true);
                      setHeroFormShowPrimaryBtn(true);
                      setHeroFormShowSecondaryBtn(true);
                      setHeroFormShowFooterText(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-paper border border-border text-primary hover:bg-white shadow-2xs cursor-pointer"
                  >
                    <Icon name="Eye" className="size-3 text-ok" />
                    Mostrar Tudo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroFormShowEyebrow(false);
                      setHeroFormShowBadge(false);
                      setHeroFormShowTitle(false);
                      setHeroFormShowDesc(false);
                      setHeroFormShowButtons(false);
                      setHeroFormShowPrimaryBtn(false);
                      setHeroFormShowSecondaryBtn(false);
                      setHeroFormShowFooterText(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 shadow-2xs cursor-pointer"
                  >
                    <Icon name="EyeOff" className="size-3 text-amber-600" />
                    Ocultar Todos (Imagem Pura)
                  </button>
                </div>
              </div>

              {/* Interruptores / Checkboxes de Visibilidade Detalhada */}
              <div className="rounded-xl border border-border p-3.5 bg-paper space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Controlo de Visibilidade dos Elementos
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-mist">
                    <input
                      type="checkbox"
                      checked={heroFormShowEyebrow && heroFormShowBadge}
                      onChange={(e) => {
                        setHeroFormShowEyebrow(e.target.checked);
                        setHeroFormShowBadge(e.target.checked);
                      }}
                      className="size-4 rounded text-action focus:ring-action cursor-pointer"
                    />
                    <span className="font-semibold text-foreground">Exibir Tag Superior e Badge</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-mist">
                    <input
                      type="checkbox"
                      checked={heroFormShowTitle}
                      onChange={(e) => setHeroFormShowTitle(e.target.checked)}
                      className="size-4 rounded text-action focus:ring-action cursor-pointer"
                    />
                    <span className="font-semibold text-foreground">Exibir Título Principal</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-mist">
                    <input
                      type="checkbox"
                      checked={heroFormShowDesc}
                      onChange={(e) => setHeroFormShowDesc(e.target.checked)}
                      className="size-4 rounded text-action focus:ring-action cursor-pointer"
                    />
                    <span className="font-semibold text-foreground">Exibir Descrição / Texto Central</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-mist">
                    <input
                      type="checkbox"
                      checked={heroFormShowButtons}
                      onChange={(e) => setHeroFormShowButtons(e.target.checked)}
                      className="size-4 rounded text-action focus:ring-action cursor-pointer"
                    />
                    <span className="font-semibold text-foreground">Exibir Bloco de Botões e Links</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-mist sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={heroFormShowFooterText}
                      onChange={(e) => setHeroFormShowFooterText(e.target.checked)}
                      className="size-4 rounded text-action focus:ring-action cursor-pointer"
                    />
                    <span className="font-semibold text-foreground">
                      Exibir Texto de Apoio entre os botões e links
                    </span>
                  </label>
                </div>
              </div>

              {/* Eyebrow & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Tag Superior (Eyebrow)"
                  hint="Ex: Serviços ao Domicílio, Loja e Produtos"
                >
                  <input
                    type="text"
                    value={heroFormEyebrow}
                    onChange={(e) => setHeroFormEyebrow(e.target.value)}
                    className={inputCls}
                    placeholder="Serviços ao Domicílio"
                  />
                </Field>

                <Field label="Badge de Destaque" hint="Ex: Huambo · Equipa Verificada">
                  <input
                    type="text"
                    value={heroFormBadge}
                    onChange={(e) => setHeroFormBadge(e.target.value)}
                    className={inputCls}
                    placeholder="Huambo · Equipa Verificada"
                  />
                </Field>
              </div>

              {/* Title & Highlight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Início do Título" hint="Parte inicial em texto branco">
                  <input
                    type="text"
                    value={heroFormTitleStart}
                    onChange={(e) => setHeroFormTitleStart(e.target.value)}
                    className={inputCls}
                    placeholder="Tu cuidas da tua vida."
                  />
                </Field>

                <Field label="Texto em Destaque (Laranja)" hint="Parte enfatizada com a cor da marca">
                  <input
                    type="text"
                    value={heroFormTitleHighlight}
                    onChange={(e) => setHeroFormTitleHighlight(e.target.value)}
                    className={inputCls}
                    placeholder="Nós cuidamos do resto!"
                  />
                </Field>
              </div>

              {/* Description */}
              <Field label="Descrição Completa do Banner" hint="Texto explicativo entre o título e os botões">
                <textarea
                  rows={2}
                  value={heroFormDesc}
                  onChange={(e) => setHeroFormDesc(e.target.value)}
                  className={inputCls}
                  placeholder="Serviços de limpeza, canalização, reparações e apoio ao domicílio com rapidez e confiança."
                />
              </Field>

              {/* Primary Button */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Texto do Botão Principal" hint="Ex: Explorar serviços">
                  <input
                    type="text"
                    value={heroFormPrimaryBtn}
                    onChange={(e) => setHeroFormPrimaryBtn(e.target.value)}
                    className={inputCls}
                    placeholder="Explorar serviços"
                  />
                </Field>

                <Field label="Link / Destino do Botão Principal" hint="Ex: /servicos ou /produtos">
                  <input
                    type="text"
                    value={heroFormPrimaryTo}
                    onChange={(e) => setHeroFormPrimaryTo(e.target.value)}
                    className={inputCls}
                    placeholder="/servicos"
                  />
                </Field>
              </div>

              {/* Secondary Button */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Texto do Botão Secundário" hint="Ex: Solicitar um serviço">
                  <input
                    type="text"
                    value={heroFormSecondaryBtn}
                    onChange={(e) => setHeroFormSecondaryBtn(e.target.value)}
                    className={inputCls}
                    placeholder="Solicitar um serviço"
                  />
                </Field>

                <Field label="Link / Destino do Botão Secundário" hint="Ex: /servicos ou /contactos">
                  <input
                    type="text"
                    value={heroFormSecondaryTo}
                    onChange={(e) => setHeroFormSecondaryTo(e.target.value)}
                    className={inputCls}
                    placeholder="/servicos"
                  />
                </Field>
              </div>

              {/* Texto Complementar entre/abaixo dos botões e links */}
              <Field
                label="Texto de Apoio / Detalhe Adicional (entre os botões e links)"
                hint="Frase de confiança exibida junto aos botões. Ex: 'Atendimento rápido ao domicílio em todo o Huambo'"
              >
                <input
                  type="text"
                  value={heroFormFooterText}
                  onChange={(e) => setHeroFormFooterText(e.target.value)}
                  className={inputCls}
                  placeholder="Atendimento rápido ao domicílio em toda a província do Huambo"
                />
              </Field>

              {/* Image Uploader */}
              <ImageUploader
                value={heroFormImage}
                onChange={(img) => setHeroFormImage(img)}
                fitMode={heroFormImageFit}
                onFitModeChange={(fit) => setHeroFormImageFit(fit)}
                label="Imagem do Banner (Upload por Ficheiro ou Link Web)"
                helperText="O sistema adapta automaticamente a imagem ao carrossel de ecrãs de computador e telemóveis."
                aspectRatio="video"
              />

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={heroFormActive}
                  onChange={(e) => setHeroFormActive(e.target.checked)}
                  className="size-4 rounded text-action focus:ring-action cursor-pointer"
                />
                <span className="text-xs font-semibold text-primary">
                  Manter este slide ativo e visível no carrossel da Home
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Btn
                  kind="ghost"
                  type="button"
                  onClick={() => {
                    setShowAddHeroBanner(false);
                    setEditingHeroBanner(null);
                  }}
                >
                  Cancelar
                </Btn>
                <Btn kind="action" type="submit">
                  <Icon name="Check" className="size-4" />
                  {editingHeroBanner ? "Guardar Alterações" : "Adicionar Banner"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
