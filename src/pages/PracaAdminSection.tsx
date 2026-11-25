import React, { useEffect, useState } from "react";
import { Icon } from "../ui/kit";
import { useStore, kz, saveAdminStateAsync } from "../lib/store";
import {
  PRODUCT_CATEGORIES,
  PracaCategory,
  Product,
} from "../lib/data";
import {
  deleteSupabaseProductStrict,
  getAuthAccessToken,
  isSupabaseConfigured,
  saveSupabaseProductStrict,
  updateSupabaseProductPatch,
} from "../lib/supabase";
import { buildAssetReference, type AssetReference } from "../lib/supabase/storage";
import { ImageUploader } from "../ui/ImageUploader";

export function PracaAdminSection() {
  const [store] = useStore();
  const [subTab, setSubTab] = useState<
    | "overview"
    | "sellers"
    | "approvals"
    | "products"
    | "categories"
    | "orders"
    | "affiliates"
    | "commissions"
    | "payouts"
  >("overview");

  const [sectionFeedback, setSectionFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const showFeedback = (ok: boolean, message: string) => {
    setSectionFeedback({ ok, message });
    if (ok) {
      setTimeout(() => {
        setSectionFeedback((prev) => (prev?.message === message ? null : prev));
      }, 4500);
    }
  };

  const safeReplaceImage = async (oldUrl?: string, newUrl?: string) => {
    if (!oldUrl || oldUrl === newUrl) return;
    try {
      const token = await getAuthAccessToken();
      await fetch("/api/storage/safe-replace-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ oldUrl, newUrl: newUrl || "" }),
      });
    } catch (err) {
      console.warn("Praca safeReplaceImage warning:", err);
    }
  };

  // Category Editor State
  const [editingCategory, setEditingCategory] = useState<PracaCategory | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("ShoppingBag");
  const [newCatImage, setNewCatImage] = useState(
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80"
  );
  const [newCatCommission, setNewCatCommission] = useState(10);
  const [newCatAffCommission, setNewCatAffCommission] = useState(5);
  const [newCatSubcats, setNewCatSubcats] = useState("");
  const [catAssetRef, setCatAssetRef] = useState<AssetReference | null>(null);
  const [catSaveError, setCatSaveError] = useState<string | null>(null);

  // Praca Product Search, Filter & Modal State
  const [prodSearch, setProdSearch] = useState("");
  const [prodCatFilter, setProdCatFilter] = useState("TODAS");
  const [prodStatusFilter, setProdStatusFilter] = useState<"ALL" | "ATIVO" | "OCULTO">("ALL");
  const [editingPracaProd, setEditingPracaProd] = useState<Product | null>(null);
  const [isCreatingPracaProd, setIsCreatingPracaProd] = useState(false);
  const [pracaProdAssetRef, setPracaProdAssetRef] = useState<AssetReference | null>(null);
  const [savingPracaProd, setSavingPracaProd] = useState(false);
  const [pracaProdError, setPracaProdError] = useState<string | null>(null);

  // Commission Settings State (synced with Realtime platform_settings)
  const [settingsForm, setSettingsForm] = useState({
    defaultPlatformCommission: store.pracaSettings?.defaultPlatformCommission ?? 10,
    defaultAffiliateCommission: store.pracaSettings?.defaultAffiliateCommission ?? 5,
    affiliateCommissionPayer: store.pracaSettings?.affiliateCommissionPayer ?? "SELLER",
    attributionWindowDays: store.pracaSettings?.attributionWindowDays ?? 30,
    minPayoutAmountAOA: store.pracaSettings?.minPayoutAmountAOA ?? 10000,
    autoApproveSellers: !!store.pracaSettings?.autoApproveSellers,
    autoApproveProducts: !!store.pracaSettings?.autoApproveProducts,
  });

  useEffect(() => {
    if (!store.pracaSettings) return;
    setSettingsForm({
      defaultPlatformCommission: store.pracaSettings.defaultPlatformCommission ?? 10,
      defaultAffiliateCommission: store.pracaSettings.defaultAffiliateCommission ?? 5,
      affiliateCommissionPayer: store.pracaSettings.affiliateCommissionPayer ?? "SELLER",
      attributionWindowDays: store.pracaSettings.attributionWindowDays ?? 30,
      minPayoutAmountAOA: store.pracaSettings.minPayoutAmountAOA ?? 10000,
      autoApproveSellers: !!store.pracaSettings.autoApproveSellers,
      autoApproveProducts: !!store.pracaSettings.autoApproveProducts,
    });
  }, [store.pracaSettings]);

  // Calculate Marketplace GMV and Commissions
  const marketplaceOrders = (store.productOrders || []).filter(
    (o) => o.sellerId || o.affiliateCode || o.items?.some((it) => it.product.isPraca)
  );

  const totalGMV = marketplaceOrders
    .filter((o) => o.orderStatus !== "Cancelada")
    .reduce((sum, o) => sum + o.totalAOA, 0);

  const totalPlatformCommissions = marketplaceOrders
    .filter((o) => o.orderStatus !== "Cancelada")
    .reduce((sum, o) => sum + (o.platformCommissionAOA || o.totalAOA * 0.1), 0);

  const totalAffiliateCommissions = marketplaceOrders
    .filter((o) => o.orderStatus !== "Cancelada")
    .reduce((sum, o) => sum + (o.affiliateCommissionAOA || 0), 0);

  const totalSellerNet = marketplaceOrders
    .filter((o) => o.orderStatus !== "Cancelada")
    .reduce(
      (sum, o) =>
        sum +
        (o.sellerNetAOA ||
          o.totalAOA -
            (o.platformCommissionAOA || o.totalAOA * 0.1) -
            (o.affiliateCommissionAOA || 0)),
      0
    );

  const pendingSellers = (store.sellers || []).filter(
    (s) => s.status === "EM_ANALISE" || s.status === "REGISTO_INICIADO"
  );

  const pracaProducts = (store.products || []).filter(
    (p) => p.isPraca || p.sellerType === "PRACA_SELLER"
  );

  const filteredPracaProducts = pracaProducts.filter((p) => {
    const q = prodSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sellerName || "").toLowerCase().includes(q) ||
      (p.sku || p.id).toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q);
    const matchCat =
      prodCatFilter === "TODAS" ||
      p.pracaCategoryId === prodCatFilter ||
      p.category === prodCatFilter;
    const matchStatus =
      prodStatusFilter === "ALL" ||
      (prodStatusFilter === "ATIVO" ? p.available !== false : p.available === false);
    return matchSearch && matchCat && matchStatus;
  });

  // Category Actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatSaveError(null);

    if (editingCategory) {
      if (!editingCategory.name.trim()) {
        setCatSaveError("O nome da categoria é obrigatório.");
        return;
      }
      if (
        Number(editingCategory.defaultCommissionRate) < 1 ||
        Number(editingCategory.defaultCommissionRate) > 50 ||
        Number(editingCategory.affiliateCommissionRate) < 0 ||
        Number(editingCategory.affiliateCommissionRate) > 50
      ) {
        setCatSaveError("As comissões da categoria devem situar-se entre 0% e 50%.");
        return;
      }
      const prevCat = store.pracaCategories.find((c) => c.id === editingCategory.id);
      const oldImage = prevCat?.image;
      setSavingCategory(true);
      const res = await saveAdminStateAsync(
        (s) => {
          const nextRefs = { ...(s.assetRefs || {}) };
          if (catAssetRef) {
            nextRefs[`pracaCat:${editingCategory.id}`] = catAssetRef;
          }
          return {
            pracaCategories: s.pracaCategories.map((c) =>
              c.id === editingCategory.id
                ? { ...editingCategory, name: editingCategory.name.trim() }
                : c
            ),
            assetRefs: nextRefs,
          };
        },
        "Atualização de Categoria da Praça",
        `Categoria ${editingCategory.name}`
      );
      setSavingCategory(false);
      if (!res.ok) {
        setCatSaveError(
          res.error ||
            "Falha ao gravar alterações da categoria no Supabase. Verifique a ligação/permissões."
        );
        return;
      }
      if (oldImage && editingCategory.image && oldImage !== editingCategory.image) {
        await safeReplaceImage(oldImage, editingCategory.image);
      }
      setCatAssetRef(null);
      setEditingCategory(null);
      showFeedback(true, `Categoria "${editingCategory.name}" atualizada e sincronizada no Supabase.`);
    } else {
      if (!newCatName.trim()) {
        setCatSaveError("O nome da categoria é obrigatório.");
        return;
      }
      const newCat: PracaCategory = {
        id: `praca-cat-${Date.now()}`,
        name: newCatName.trim(),
        description: newCatDesc.trim() || `Produtos de ${newCatName.trim()} na Praça`,
        icon: newCatIcon || "ShoppingBag",
        image: newCatImage,
        active: true,
        order: store.pracaCategories.length + 1,
        defaultCommissionRate: Number(newCatCommission),
        affiliateCommissionRate: Number(newCatAffCommission),
        subcategories: newCatSubcats
          .split(",")
          .map((sub) => sub.trim())
          .filter(Boolean),
      };
      setSavingCategory(true);
      const res = await saveAdminStateAsync(
        (s) => {
          const nextRefs = { ...(s.assetRefs || {}) };
          if (catAssetRef) {
            nextRefs[`pracaCat:${newCat.id}`] = catAssetRef;
          }
          return {
            pracaCategories: [...s.pracaCategories, newCat],
            assetRefs: nextRefs,
          };
        },
        "Criação de Categoria da Praça",
        `Nova categoria: ${newCat.name}`
      );
      setSavingCategory(false);
      if (!res.ok) {
        setCatSaveError(
          res.error ||
            "Falha ao criar categoria no Supabase. Verifique a ligação/permissões."
        );
        return;
      }
      setCatAssetRef(null);
      setShowAddCategory(false);
      setNewCatName("");
      setNewCatDesc("");
      setNewCatSubcats("");
      showFeedback(true, `Categoria "${newCat.name}" criada e sincronizada no Supabase.`);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const targetCat = store.pracaCategories.find((c) => c.id === catId);
    const hasProducts = pracaProducts.some(
      (p) => p.category === catId || p.pracaCategoryId === catId
    );
    if (hasProducts) {
      showFeedback(
        false,
        "Não é possível eliminar uma categoria que contenha produtos associados. Reatribua os produtos primeiro."
      );
      return;
    }
    if (!confirm("Tem a certeza que deseja eliminar esta categoria da Praça?")) return;
    setBusyActionId(catId);
    const res = await saveAdminStateAsync(
      (s) => {
        const nextRefs = { ...(s.assetRefs || {}) };
        delete nextRefs[`pracaCat:${catId}`];
        return {
          pracaCategories: s.pracaCategories.filter((c) => c.id !== catId),
          assetRefs: nextRefs,
        };
      },
      "Remoção de Categoria da Praça",
      `Categoria ID: ${catId}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Erro ao eliminar categoria: ${res.error || "Erro desconhecido"}`);
      return;
    }
    if (targetCat?.image) {
      await safeReplaceImage(targetCat.image, "");
    }
    showFeedback(true, "Categoria removida com sucesso.");
  };

  const handleToggleCategoryActive = async (catId: string) => {
    setBusyActionId(catId);
    const res = await saveAdminStateAsync(
      (s) => ({
        pracaCategories: s.pracaCategories.map((c) =>
          c.id === catId ? { ...c, active: !c.active } : c
        ),
      }),
      "Alternar Ativação de Categoria",
      `Categoria ID: ${catId}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Falha ao alterar estado da categoria: ${res.error || "Erro desconhecido"}`);
      return;
    }
    showFeedback(true, "Estado da categoria atualizado e sincronizado no Supabase.");
  };

  // Seller Approval Actions
  const handleApproveSeller = async (sellerId: string) => {
    setBusyActionId(sellerId);
    const res = await saveAdminStateAsync(
      (s) => ({
        sellers: s.sellers.map((sel) =>
          sel.id === sellerId ? { ...sel, status: "APROVADO" } : sel
        ),
      }),
      "Aprovação de Vendedor da Praça",
      `Vendedor ID: ${sellerId}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Erro ao aprovar vendedor: ${res.error || "Erro desconhecido"}`);
      return;
    }
    showFeedback(true, "Vendedor aprovado e sincronizado com o Supabase.");
  };

  const handleRejectSeller = async (sellerId: string) => {
    setBusyActionId(sellerId);
    const res = await saveAdminStateAsync(
      (s) => ({
        sellers: s.sellers.map((sel) =>
          sel.id === sellerId ? { ...sel, status: "REJEITADO" } : sel
        ),
      }),
      "Rejeição de Vendedor da Praça",
      `Vendedor ID: ${sellerId}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Erro ao rejeitar vendedor: ${res.error || "Erro desconhecido"}`);
      return;
    }
    showFeedback(true, "Candidatura rejeitada e registada no Supabase.");
  };

  const handleSuspendSeller = async (sellerId: string) => {
    setBusyActionId(sellerId);
    const res = await saveAdminStateAsync(
      (s) => ({
        sellers: s.sellers.map((sel) =>
          sel.id === sellerId ? { ...sel, status: "SUSPENSO" } : sel
        ),
      }),
      "Suspensão de Vendedor da Praça",
      `Vendedor ID: ${sellerId}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Erro ao suspender vendedor: ${res.error || "Erro desconhecido"}`);
      return;
    }
    showFeedback(true, "Vendedor suspenso e sincronizado no Supabase.");
  };

  // Payout Actions
  const handleApprovePayout = async (payoutId: string) => {
    setBusyActionId(payoutId);
    const res = await saveAdminStateAsync(
      (s) => ({
        pracaPayoutRequests: s.pracaPayoutRequests.map((p) =>
          p.id === payoutId
            ? {
                ...p,
                status: "PAGO",
                processedAt: new Date().toISOString(),
                adminNote: "Transferência confirmada e liquidada pela administração da Resolve Express.",
              }
            : p
        ),
      }),
      "Liquidação de Levantamento da Praça",
      `Pedido de Pagamento ID: ${payoutId}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Erro ao confirmar pagamento: ${res.error || "Erro desconhecido"}`);
      return;
    }
    showFeedback(true, "Levantamento confirmado e sincronizado no Supabase.");
  };

  // Save Settings (Validated + Confirmed against Supabase)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const platComm = Number(settingsForm.defaultPlatformCommission);
    const affComm = Number(settingsForm.defaultAffiliateCommission);
    const attrDays = Number(settingsForm.attributionWindowDays);
    const minPayout = Number(settingsForm.minPayoutAmountAOA);

    if (Number.isNaN(platComm) || platComm < 1 || platComm > 50) {
      showFeedback(false, "A comissão da plataforma deve estar entre 1% e 50%.");
      return;
    }
    if (Number.isNaN(affComm) || affComm < 0 || affComm > 50) {
      showFeedback(false, "A comissão de afiliados deve estar entre 0% e 50%.");
      return;
    }
    if (Number.isNaN(attrDays) || attrDays < 1 || attrDays > 365) {
      showFeedback(false, "A janela de atribuição deve estar entre 1 e 365 dias.");
      return;
    }
    if (Number.isNaN(minPayout) || minPayout < 0) {
      showFeedback(false, "O levantamento mínimo deve ser maior ou igual a 0 Kz.");
      return;
    }

    setSavingSettings(true);
    setSectionFeedback(null);
    const res = await saveAdminStateAsync(
      () => ({
        pracaSettings: {
          defaultPlatformCommission: platComm,
          defaultAffiliateCommission: affComm,
          affiliateCommissionPayer: settingsForm.affiliateCommissionPayer as
            | "SELLER"
            | "PLATFORM"
            | "SPLIT",
          attributionWindowDays: attrDays,
          minPayoutAmountAOA: minPayout,
          autoApproveSellers: settingsForm.autoApproveSellers,
          autoApproveProducts: settingsForm.autoApproveProducts,
        },
      }),
      "Configurações Gerais da Praça",
      `Comissão Plataforma: ${platComm}%, Afiliados: ${affComm}%`
    );
    setSavingSettings(false);

    if (!res.ok) {
      showFeedback(
        false,
        `Falha ao gravar definições da Praça no Supabase: ${res.error || "Erro desconhecido"}`
      );
      return;
    }
    showFeedback(
      true,
      "Definições da Praça gravadas no Supabase e sincronizadas com todos os utilizadores."
    );
  };

  // Praca Product CRUD (persists to public.products + platform_settings)
  const openNewPracaProductModal = () => {
    const firstSeller = store.sellers?.[0];
    const firstPracaCat = store.pracaCategories?.[0];
    setIsCreatingPracaProd(true);
    setPracaProdAssetRef(null);
    setPracaProdError(null);
    setEditingPracaProd({
      id: `PRACA-PROD-${Date.now()}`,
      name: "",
      description: "",
      priceAOA: 5000,
      available: true,
      stock: 15,
      sellerName: firstSeller?.storeName || "Vendedor Oficial Praça",
      sellerId: firstSeller?.id || "seller-admin",
      sellerType: "PRACA_SELLER",
      category: firstPracaCat?.name || PRODUCT_CATEGORIES[1] || "Eletrónicos e Informática",
      image: "",
      imageFit: "cover",
      deliveryLocation: "Huambo e envio nacional",
      estimatedDelivery: "24h a 48h",
      unit: "unidade",
      rating: 5.0,
      reviewsCount: 1,
      isPraca: true,
      pracaCategoryId: firstPracaCat?.id,
      condition: "NOVO",
      platformCommissionRate: settingsForm.defaultPlatformCommission,
      affiliateCommissionRate: settingsForm.defaultAffiliateCommission,
      status: "ATIVO",
    });
  };

  const openEditPracaProductModal = (prod: Product) => {
    setIsCreatingPracaProd(false);
    setPracaProdAssetRef(null);
    setPracaProdError(null);
    setEditingPracaProd({
      ...prod,
      isPraca: true,
      imageFit: prod.imageFit || "cover",
      condition: prod.condition || "NOVO",
      platformCommissionRate:
        prod.platformCommissionRate ?? settingsForm.defaultPlatformCommission,
      affiliateCommissionRate:
        prod.affiliateCommissionRate ?? settingsForm.defaultAffiliateCommission,
    });
  };

  const handleSavePracaProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPracaProd) return;
    if (!editingPracaProd.name.trim()) {
      setPracaProdError("O nome do produto é obrigatório.");
      return;
    }
    if (Number(editingPracaProd.priceAOA) <= 0) {
      setPracaProdError("O preço de venda deve ser superior a 0 AOA.");
      return;
    }
    if (Number(editingPracaProd.stock) < 0) {
      setPracaProdError("O stock não pode ser negativo.");
      return;
    }

    const oldProd = store.products.find((p) => p.id === editingPracaProd.id);
    const oldImg = oldProd?.image;
    const normalizedProd: Product = {
      ...editingPracaProd,
      name: editingPracaProd.name.trim(),
      sellerName: editingPracaProd.sellerName?.trim() || "Vendedor Praça",
      priceAOA: Number(editingPracaProd.priceAOA),
      promotionalPriceAOA:
        editingPracaProd.promotionalPriceAOA && Number(editingPracaProd.promotionalPriceAOA) > 0
          ? Number(editingPracaProd.promotionalPriceAOA)
          : undefined,
      stock: Math.max(0, Math.floor(Number(editingPracaProd.stock || 0))),
      isPraca: true,
      sellerType: editingPracaProd.sellerType || "PRACA_SELLER",
      status: editingPracaProd.available ? "ATIVO" : "OCULTO",
    };

    setSavingPracaProd(true);
    setPracaProdError(null);

    let confirmedProd: Product = normalizedProd;
    if (isSupabaseConfigured()) {
      const sbRes = await saveSupabaseProductStrict(normalizedProd);
      if (!sbRes.ok) {
        setSavingPracaProd(false);
        setPracaProdError(
          `Falha ao gravar produto em public.products: ${sbRes.error || "Erro desconhecido"}`
        );
        return;
      }
      if (sbRes.product) {
        confirmedProd = sbRes.product;
      }
    }

    const res = await saveAdminStateAsync(
      (s) => {
        const nextRefs = { ...(s.assetRefs || {}) };
        if (pracaProdAssetRef) {
          nextRefs[`product:${confirmedProd.id}`] = pracaProdAssetRef;
        }
        const exists = s.products.some((p) => p.id === confirmedProd.id);
        return {
          products: exists
            ? s.products.map((p) => (p.id === confirmedProd.id ? confirmedProd : p))
            : [confirmedProd, ...s.products],
          assetRefs: nextRefs,
        };
      },
      isCreatingPracaProd ? "Criação de Produto da Praça" : "Edição de Produto da Praça",
      `Produto: ${confirmedProd.name} (${confirmedProd.id})`
    );
    setSavingPracaProd(false);

    if (!res.ok) {
      setPracaProdError(`Falha ao sincronizar catálogo: ${res.error || "Erro desconhecido"}`);
      return;
    }

    if (oldImg && normalizedProd.image && oldImg !== normalizedProd.image) {
      await safeReplaceImage(oldImg, normalizedProd.image);
    }

    setPracaProdAssetRef(null);
    setEditingPracaProd(null);
    showFeedback(
      true,
      `Produto "${normalizedProd.name}" ${isCreatingPracaProd ? "publicado" : "atualizado"} no Supabase.`
    );
  };

  const handleTogglePracaProduct = async (prod: Product) => {
    const nextAvailable = !prod.available;
    const nextStatus: Product["status"] = nextAvailable ? "ATIVO" : "OCULTO";
    setBusyActionId(prod.id);

    if (isSupabaseConfigured()) {
      const patchRes = await updateSupabaseProductPatch(prod.id, {
        available: nextAvailable,
        status: nextStatus,
      });
      if (!patchRes.ok) {
        if (patchRes.notFound) {
          const upsertRes = await saveSupabaseProductStrict({
            ...prod,
            available: nextAvailable,
            status: nextStatus,
          });
          if (!upsertRes.ok) {
            setBusyActionId(null);
            showFeedback(false, `Erro ao alterar estado no Supabase: ${upsertRes.error}`);
            return;
          }
        } else {
          setBusyActionId(null);
          showFeedback(false, `Erro ao alterar estado no Supabase: ${patchRes.error}`);
          return;
        }
      }
    }

    const res = await saveAdminStateAsync(
      (s) => ({
        products: s.products.map((p) =>
          p.id === prod.id ? { ...p, available: nextAvailable, status: nextStatus } : p
        ),
      }),
      "Alternar Estado do Produto da Praça",
      `Produto ${prod.name} -> ${nextAvailable ? "Ativo" : "Desativado"}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Falha ao guardar estado: ${res.error || "Erro desconhecido"}`);
      return;
    }
    showFeedback(
      true,
      `Produto "${prod.name}" ${nextAvailable ? "ativado" : "desativado"} com sucesso.`
    );
  };

  const handleUpdatePracaStock = async (prod: Product, delta: number) => {
    const nextStock = Math.max(0, Number(prod.stock || 0) + delta);
    setBusyActionId(prod.id);

    if (isSupabaseConfigured()) {
      const patchRes = await updateSupabaseProductPatch(prod.id, { stock: nextStock });
      if (!patchRes.ok) {
        if (patchRes.notFound) {
          const upsertRes = await saveSupabaseProductStrict({ ...prod, stock: nextStock });
          if (!upsertRes.ok) {
            setBusyActionId(null);
            showFeedback(false, `Erro ao atualizar stock no Supabase: ${upsertRes.error}`);
            return;
          }
        } else {
          setBusyActionId(null);
          showFeedback(false, `Erro ao atualizar stock no Supabase: ${patchRes.error}`);
          return;
        }
      }
    }

    const res = await saveAdminStateAsync(
      (s) => ({
        products: s.products.map((p) => (p.id === prod.id ? { ...p, stock: nextStock } : p)),
      }),
      "Atualização de Stock da Praça",
      `Produto ${prod.name} -> Stock ${nextStock}`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Falha ao atualizar stock: ${res.error || "Erro desconhecido"}`);
      return;
    }
    showFeedback(true, `Stock de "${prod.name}" atualizado para ${nextStock}.`);
  };

  const handleDeletePracaProduct = async (prod: Product) => {
    const hasOrders = (store.productOrders || []).some((ord) =>
      ord.items?.some((it) => it.product?.id === prod.id)
    );
    if (hasOrders) {
      showFeedback(
        false,
        `O produto "${prod.name}" possui encomendas no histórico. Utilize "Desativar" em vez de eliminar para preservar os registos de encomendas.`
      );
      return;
    }
    if (!confirm(`Tem a certeza que deseja eliminar definitivamente o produto "${prod.name}"?`)) {
      return;
    }
    setBusyActionId(prod.id);
    if (isSupabaseConfigured()) {
      const delRes = await deleteSupabaseProductStrict(prod.id);
      if (!delRes.ok) {
        setBusyActionId(null);
        showFeedback(false, `Falha ao eliminar no Supabase: ${delRes.error || "Erro desconhecido"}`);
        return;
      }
    }
    const res = await saveAdminStateAsync(
      (s) => {
        const nextRefs = { ...(s.assetRefs || {}) };
        delete nextRefs[`product:${prod.id}`];
        return {
          products: s.products.filter((p) => p.id !== prod.id),
          featuredProducts: (s.featuredProducts || []).filter((id) => id !== prod.id),
          featuredHomeProducts: (s.featuredHomeProducts || []).filter((id) => id !== prod.id),
          assetRefs: nextRefs,
        };
      },
      "Remoção de Produto da Praça",
      `Produto eliminado: ${prod.name} (${prod.id})`
    );
    setBusyActionId(null);
    if (!res.ok) {
      showFeedback(false, `Falha ao remover produto do catálogo: ${res.error || "Erro desconhecido"}`);
      return;
    }
    if (prod.image) {
      await safeReplaceImage(prod.image, "");
    }
    showFeedback(true, `Produto "${prod.name}" eliminado com sucesso.`);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#071B33] via-[#0E294B] to-[#12365A] p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-orange-500 p-2 text-white shadow-sm">
              <Icon name="Store" className="size-5" />
            </span>
            <h2 className="text-xl font-black text-white sm:text-2xl">
              GESTÃO DA PRAÇA — MARKETPLACE & AFILIADOS
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-300 sm:text-sm">
            Supervisão completa de vendedores, catálogo de 20 categorias, comissões em tempo real, pedidos e levantamentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.open("#/praca", "_blank")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
          >
            <Icon name="ExternalLink" className="size-3.5" />
            Abrir Praça Pública
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: "overview", label: "Visão Geral", icon: "LayoutDashboard", badge: null },
          { id: "sellers", label: `Vendedores (${store.sellers?.length || 0})`, icon: "Store", badge: null },
          { id: "approvals", label: `Aprovações (${pendingSellers.length})`, icon: "UserCheck", badge: pendingSellers.length > 0 ? pendingSellers.length : null },
          { id: "products", label: `Produtos Praça (${pracaProducts.length})`, icon: "Package", badge: null },
          { id: "categories", label: `20 Categorias (${store.pracaCategories?.length || 0})`, icon: "FolderTree", badge: null },
          { id: "orders", label: `Pedidos Marketplace (${marketplaceOrders.length})`, icon: "Receipt", badge: null },
          { id: "affiliates", label: `Afiliados (${store.affiliates?.length || 0})`, icon: "Users", badge: null },
          { id: "commissions", label: "Comissões & Regras", icon: "Percent", badge: null },
          { id: "payouts", label: `Levantamentos (${store.pracaPayoutRequests?.length || 0})`, icon: "Landmark", badge: null },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubTab(item.id as any)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap transition ${
              subTab === item.id
                ? "bg-[#E6540F] text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Icon name={item.icon as any} className="size-4" />
            {item.label}
            {item.badge && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {sectionFeedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-bold ${
            sectionFeedback.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon
              name={sectionFeedback.ok ? "CheckCircle2" : "AlertTriangle"}
              className="size-4 shrink-0"
            />
            <span>{sectionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSectionFeedback(null)}
            className="underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* SUB-TAB: OVERVIEW */}
      {subTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Volume Bruto (GMV)
              </span>
              <p className="mt-2 text-2xl font-black text-slate-900">{kz(totalGMV)}</p>
              <p className="mt-1 text-xs text-slate-500">{marketplaceOrders.length} encomendas</p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                Comissão Resolve Express
              </span>
              <p className="mt-2 text-2xl font-black text-[#E6540F]">{kz(totalPlatformCommissions)}</p>
              <p className="mt-1 text-xs text-orange-600">Receita líquida da plataforma</p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Comissões de Afiliados
              </span>
              <p className="mt-2 text-2xl font-black text-blue-900">{kz(totalAffiliateCommissions)}</p>
              <p className="mt-1 text-xs text-blue-600">Pago aos divulgadores ativos</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Repasse aos Vendedores
              </span>
              <p className="mt-2 text-2xl font-black text-emerald-900">{kz(totalSellerNet)}</p>
              <p className="mt-1 text-xs text-emerald-600">Valor líquido para as lojas</p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Icon name="Store" className="size-4 text-orange-500" />
                Vendedores Registados
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {store.sellers?.length || 0} lojas totais ({pendingSellers.length} a aguardar aprovação).
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab("approvals")}
                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
                >
                  Ver Aprovações ({pendingSellers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("sellers")}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Gerir Lojas
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Icon name="FolderTree" className="size-4 text-orange-500" />
                Catálogo da Praça
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {store.pracaCategories?.length || 0} categorias e {pracaProducts.length} produtos de vendedores.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab("categories")}
                  className="rounded-lg bg-[#071B33] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0e294b]"
                >
                  Gerir 20 Categorias
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("products")}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Moderar Produtos
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Icon name="Percent" className="size-4 text-orange-500" />
                Regras de Comissões
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Taxa padrão: {store.pracaSettings?.defaultPlatformCommission ?? 10}% Plataforma | {store.pracaSettings?.defaultAffiliateCommission ?? 5}% Afiliado.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab("commissions")}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                >
                  Ajustar Regras
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("payouts")}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Levantamentos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: SELLERS */}
      {subTab === "sellers" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">
              Lojas e Vendedores Registados ({store.sellers?.length || 0})
            </h3>
            <span className="text-xs text-slate-500">
              Gerencie o estado e credenciais dos comerciantes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Loja / Vendedor</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Contacto</th>
                  <th className="p-3">Localização</th>
                  <th className="p-3">Vendas (Qtd / Kz)</th>
                  <th className="p-3">Saldo Líquido</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(store.sellers || []).map((seller) => (
                  <tr key={seller.id} className="hover:bg-slate-50/60">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={seller.logo?.trim() || "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=120"}
                          alt={seller.storeName}
                          className="size-9 rounded-lg object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{seller.storeName}</p>
                          <p className="text-[11px] text-slate-500">{seller.ownerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                        {seller.sellerType}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-slate-800">{seller.phone}</p>
                      <p className="text-[11px] text-slate-500">{seller.email}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-slate-800">{seller.municipio}, {seller.province}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{kz(seller.totalGrossAOA)}</p>
                      <p className="text-[11px] text-slate-500">{seller.totalSalesCount} pedidos</p>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-700">
                      {kz(seller.netBalanceAOA)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          seller.status === "APROVADO"
                            ? "bg-emerald-100 text-emerald-700"
                            : seller.status === "EM_ANALISE"
                            ? "bg-amber-100 text-amber-700"
                            : seller.status === "SUSPENSO"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {seller.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {seller.status !== "APROVADO" && (
                          <button
                            type="button"
                            onClick={() => handleApproveSeller(seller.id)}
                            className="rounded-lg bg-emerald-600 px-2 py-1 font-bold text-white hover:bg-emerald-700"
                          >
                            Aprovar
                          </button>
                        )}
                        {seller.status === "APROVADO" && (
                          <button
                            type="button"
                            onClick={() => handleSuspendSeller(seller.id)}
                            className="rounded-lg bg-amber-500 px-2 py-1 font-bold text-white hover:bg-amber-600"
                          >
                            Suspender
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: APPROVALS */}
      {subTab === "approvals" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="text-base font-black text-slate-900">
              Candidaturas de Vendedores Pendentes ({pendingSellers.length})
            </h3>
            <p className="text-xs text-slate-500">
              Analise os comerciantes e aprove a entrada na Praça
            </p>
          </div>

          {pendingSellers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
              <Icon name="CheckCircle" className="mx-auto size-10 text-emerald-500" />
              <h4 className="mt-2 text-sm font-bold text-slate-800">
                Não há candidaturas pendentes no momento
              </h4>
              <p className="text-xs text-slate-500">
                Todas as lojas submetidas já foram analisadas e aprovadas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pendingSellers.map((sel) => (
                <div key={sel.id} className="rounded-2xl border border-slate-200 p-5 bg-slate-50/50">
                  <div className="flex items-start gap-3">
                    <img
                      src={sel.logo?.trim() || "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=120"}
                      alt={sel.storeName}
                      className="size-12 rounded-xl object-cover border border-slate-200"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">{sel.storeName}</h4>
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          {sel.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{sel.ownerName} • {sel.sellerType}</p>
                      <p className="mt-1 text-xs text-slate-500">{sel.address}, {sel.municipio}</p>
                      <p className="mt-2 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                        {sel.description}
                      </p>

                      <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-200">
                        <div className="text-[11px] text-slate-500">
                          Tel: <span className="font-bold text-slate-800">{sel.phone}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleRejectSeller(sel.id)}
                            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            Rejeitar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveSeller(sel.id)}
                            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Aprovar Loja
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: PRODUCTS */}
      {subTab === "products" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Produtos Publicados na Praça ({filteredPracaProducts.length} / {pracaProducts.length})
              </h3>
              <p className="text-xs text-slate-500">
                Criação, edição, imagens, controlo de stock, estado e eliminação sincronizados com o Supabase
              </p>
            </div>
            <button
              type="button"
              onClick={openNewPracaProductModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E6540F] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#cf490a] cursor-pointer"
            >
              <Icon name="Plus" className="size-4" />
              Novo Produto da Praça
            </button>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5 relative">
              <Icon name="Search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                type="text"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder="Pesquisar por nome, vendedor ou SKU..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                value={prodCatFilter}
                onChange={(e) => setProdCatFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
              >
                <option value="TODAS">Todas as Categorias</option>
                {(store.pracaCategories || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-1">
              {(["ALL", "ATIVO", "OCULTO"] as const).map((stFilter) => (
                <button
                  key={stFilter}
                  type="button"
                  onClick={() => setProdStatusFilter(stFilter)}
                  className={`flex-1 rounded-xl px-2 py-2 text-[11px] font-bold transition cursor-pointer ${
                    prodStatusFilter === stFilter
                      ? "bg-[#071B33] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {stFilter === "ALL" ? "Todos" : stFilter === "ATIVO" ? "Ativos" : "Ocultos"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Loja Vendedora</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Condição</th>
                  <th className="p-3">Preço Venda</th>
                  <th className="p-3">Comissões</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPracaProducts.map((p) => {
                  const platRate = p.platformCommissionRate ?? settingsForm.defaultPlatformCommission;
                  const affRate = p.affiliateCommissionRate ?? settingsForm.defaultAffiliateCommission;
                  const isBusy = busyActionId === p.id;
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/60 ${!p.available ? "opacity-65" : ""}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                            alt={p.name}
                            className={`size-10 rounded-lg border border-slate-200 ${
                              p.imageFit === "contain" ? "object-contain bg-slate-100 p-0.5" : "object-cover"
                            }`}
                          />
                          <div>
                            <p className="font-bold text-slate-900">{p.name}</p>
                            <p className="text-[11px] text-slate-500">{p.sku || p.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{p.sellerName || "Vendedor Praça"}</td>
                      <td className="p-3 text-slate-600">{p.category}</td>
                      <td className="p-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${p.condition === "USADO" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {p.condition || "NOVO"}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {kz(p.promotionalPriceAOA || p.priceAOA)}
                        {p.promotionalPriceAOA && (
                          <span className="block text-[10px] text-slate-400 line-through">
                            {kz(p.priceAOA)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[11px]">
                        <span className="block text-orange-600 font-bold">Praça {platRate}%</span>
                        <span className="block text-blue-600 font-bold">Afil. {affRate}%</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 font-mono">
                          <button
                            type="button"
                            disabled={isBusy || p.stock <= 0}
                            onClick={() => handleUpdatePracaStock(p, -1)}
                            className="rounded border border-slate-200 px-1.5 py-0.5 font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            -1
                          </button>
                          <span className="px-1.5 font-bold">{p.stock}</span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUpdatePracaStock(p, 5)}
                            className="rounded border border-slate-200 px-1.5 py-0.5 font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            +5
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleTogglePracaProduct(p)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                            p.available !== false
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          {p.available !== false ? "Ativo" : "Desativado"}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditPracaProductModal(p)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeletePracaProduct(p)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPracaProducts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-xs text-slate-500">
                      Nenhum produto da Praça encontrado para os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Create / Edit Praca Product Modal */}
          {editingPracaProd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-3">
                  <h4 className="text-lg font-black text-slate-900">
                    {isCreatingPracaProd
                      ? "Publicar Novo Produto na Praça"
                      : `Editar Produto da Praça: ${editingPracaProd.name}`}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingPracaProd(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <Icon name="X" className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleSavePracaProduct} className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Nome do Produto *</label>
                      <input
                        type="text"
                        required
                        value={editingPracaProd.name}
                        onChange={(e) =>
                          setEditingPracaProd({ ...editingPracaProd, name: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Loja / Vendedor</label>
                      <input
                        type="text"
                        value={editingPracaProd.sellerName}
                        onChange={(e) =>
                          setEditingPracaProd({ ...editingPracaProd, sellerName: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Categoria da Praça</label>
                      <select
                        value={editingPracaProd.pracaCategoryId || ""}
                        onChange={(e) => {
                          const cat = store.pracaCategories.find((c) => c.id === e.target.value);
                          setEditingPracaProd({
                            ...editingPracaProd,
                            pracaCategoryId: e.target.value || undefined,
                            category: cat?.name || editingPracaProd.category,
                          });
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
                      >
                        <option value="">Personalizada / Outra</option>
                        {(store.pracaCategories || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Condição</label>
                      <select
                        value={editingPracaProd.condition || "NOVO"}
                        onChange={(e) =>
                          setEditingPracaProd({
                            ...editingPracaProd,
                            condition: e.target.value as "NOVO" | "USADO",
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
                      >
                        <option value="NOVO">NOVO</option>
                        <option value="USADO">USADO</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">SKU / Referência</label>
                      <input
                        type="text"
                        value={editingPracaProd.sku || ""}
                        onChange={(e) =>
                          setEditingPracaProd({ ...editingPracaProd, sku: e.target.value })
                        }
                        placeholder="Ex.: PRC-001"
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Preço (AOA) *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={editingPracaProd.priceAOA}
                        onChange={(e) =>
                          setEditingPracaProd({
                            ...editingPracaProd,
                            priceAOA: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Preço Promo (AOA)</label>
                      <input
                        type="number"
                        min={0}
                        value={editingPracaProd.promotionalPriceAOA || ""}
                        onChange={(e) =>
                          setEditingPracaProd({
                            ...editingPracaProd,
                            promotionalPriceAOA: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Stock *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={editingPracaProd.stock}
                        onChange={(e) =>
                          setEditingPracaProd({
                            ...editingPracaProd,
                            stock: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Unidade</label>
                      <input
                        type="text"
                        value={editingPracaProd.unit}
                        onChange={(e) =>
                          setEditingPracaProd({ ...editingPracaProd, unit: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Comissão Praça (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={editingPracaProd.platformCommissionRate ?? 10}
                        onChange={(e) =>
                          setEditingPracaProd({
                            ...editingPracaProd,
                            platformCommissionRate: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Comissão Afiliado (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={editingPracaProd.affiliateCommissionRate ?? 5}
                        onChange={(e) =>
                          setEditingPracaProd({
                            ...editingPracaProd,
                            affiliateCommissionRate: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <ImageUploader
                    label="Fotografia do Produto"
                    value={editingPracaProd.image}
                    onChange={(url) =>
                      setEditingPracaProd((prev) => (prev ? { ...prev, image: url } : null))
                    }
                    fitMode={editingPracaProd.imageFit || "cover"}
                    onFitModeChange={(fit) =>
                      setEditingPracaProd((prev) => (prev ? { ...prev, imageFit: fit } : null))
                    }
                    assetCategory="products"
                    assetTitle={editingPracaProd.name.trim() || undefined}
                    onAssetUploaded={(asset) =>
                      setPracaProdAssetRef(
                        buildAssetReference(asset, asset.public_url || undefined)
                      )
                    }
                  />

                  <div>
                    <label className="text-xs font-bold text-slate-700">Descrição</label>
                    <textarea
                      rows={2}
                      value={editingPracaProd.description}
                      onChange={(e) =>
                        setEditingPracaProd({
                          ...editingPracaProd,
                          description: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPracaProd.available !== false}
                      onChange={(e) =>
                        setEditingPracaProd({
                          ...editingPracaProd,
                          available: e.target.checked,
                        })
                      }
                      className="size-4 accent-[#E6540F]"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Produto ativo e visível para compra pública
                    </span>
                  </label>

                  {pracaProdError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {pracaProdError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      disabled={savingPracaProd}
                      onClick={() => setEditingPracaProd(null)}
                      className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingPracaProd}
                      className="rounded-xl bg-[#E6540F] px-5 py-2 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
                    >
                      {savingPracaProd
                        ? "A guardar no Supabase..."
                        : isCreatingPracaProd
                        ? "Publicar Produto"
                        : "Guardar Alterações"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: CATEGORIES (20 CATEGORIAS) */}
      {subTab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <h3 className="text-base font-black text-slate-900">
                20 Categorias Dinâmicas da Praça
              </h3>
              <p className="text-xs text-slate-500">
                Adicione, edite, reorganize e defina taxas de comissão padrão por categoria
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCatSaveError(null);
                setCatAssetRef(null);
                setEditingCategory(null);
                setShowAddCategory(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E6540F] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#cf490a]"
            >
              <Icon name="Plus" className="size-4" />
              Nova Categoria
            </button>
          </div>

          {/* Add Category Modal */}
          {showAddCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b pb-3">
                  <h4 className="text-lg font-black text-slate-900">Criar Nova Categoria na Praça</h4>
                  <button onClick={() => setShowAddCategory(false)} className="text-slate-400 hover:text-slate-600">
                    <Icon name="X" className="size-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="text-xs font-bold text-slate-700">Nome</label>
                      <input
                        type="text"
                        required
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Ex: Jóias e Relógios"
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Comissão Praça (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={newCatCommission}
                        onChange={(e) => setNewCatCommission(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Comissão Afil. (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={newCatAffCommission}
                        onChange={(e) => setNewCatAffCommission(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Descrição</label>
                    <input
                      type="text"
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      placeholder="Breve descrição dos artigos desta categoria..."
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Subcategorias (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={newCatSubcats}
                      onChange={(e) => setNewCatSubcats(e.target.value)}
                      placeholder="Ex: Anéis, Pulseiras, Relógios Masculinos, Relógios Femininos"
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <ImageUploader
                      label="Fotografia de Capa da Categoria"
                      value={newCatImage}
                      onChange={setNewCatImage}
                      assetCategory="general"
                      assetTitle={newCatName.trim() || undefined}
                      onAssetUploaded={(asset) =>
                        setCatAssetRef(buildAssetReference(asset, asset.public_url || undefined))
                      }
                    />
                  </div>

                  {catSaveError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {catSaveError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      disabled={savingCategory}
                      onClick={() => {
                        setCatSaveError(null);
                        setCatAssetRef(null);
                        setShowAddCategory(false);
                      }}
                      className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingCategory}
                      className="rounded-xl bg-[#E6540F] px-5 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {savingCategory ? "A gravar..." : "Criar Categoria"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Category Modal */}
          {editingCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b pb-3">
                  <h4 className="text-lg font-black text-slate-900">Editar Categoria: {editingCategory.name}</h4>
                  <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-600">
                    <Icon name="X" className="size-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Nome</label>
                      <input
                        type="text"
                        required
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Comissão Praça (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={editingCategory.defaultCommissionRate}
                        onChange={(e) =>
                          setEditingCategory({
                            ...editingCategory,
                            defaultCommissionRate: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Comissão Afil. (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={editingCategory.affiliateCommissionRate}
                        onChange={(e) =>
                          setEditingCategory({
                            ...editingCategory,
                            affiliateCommissionRate: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Subcategorias (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={editingCategory.subcategories.join(", ")}
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          subcategories: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <ImageUploader
                      label="Fotografia de Capa"
                      value={editingCategory.image}
                      onChange={(url) =>
                        setEditingCategory((prev) => (prev ? { ...prev, image: url } : null))
                      }
                      assetCategory="general"
                      assetTitle={editingCategory.name.trim() || undefined}
                      onAssetUploaded={(asset) =>
                        setCatAssetRef(buildAssetReference(asset, asset.public_url || undefined))
                      }
                    />
                  </div>

                  {catSaveError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {catSaveError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      disabled={savingCategory}
                      onClick={() => {
                        setCatSaveError(null);
                        setCatAssetRef(null);
                        setEditingCategory(null);
                      }}
                      className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingCategory}
                      className="rounded-xl bg-[#E6540F] px-5 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {savingCategory ? "A gravar..." : "Guardar Alterações"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Grid of Categories */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {store.pracaCategories.map((c) => (
              <div
                key={c.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-md"
              >
                <div>
                  <div className="relative mb-3 h-28 overflow-hidden rounded-xl">
                    <img
                      src={c.image?.trim() || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600"}
                      alt={c.name}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                      {c.defaultCommissionRate}% Com.
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-900">{c.name}</h4>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                    {c.subcategories.join(", ")}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-2">
                  <button
                    type="button"
                    onClick={() => handleToggleCategoryActive(c.id)}
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      c.active !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {c.active !== false ? "Ativa" : "Desativada"}
                  </button>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCatSaveError(null);
                        setCatAssetRef(null);
                        setShowAddCategory(false);
                        setEditingCategory({ ...c });
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100"
                      title="Editar categoria"
                    >
                      <Icon name="Pencil" className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.id)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      title="Eliminar categoria"
                    >
                      <Icon name="Trash2" className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: ORDERS (SPLIT AUDIT) */}
      {subTab === "orders" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="text-base font-black text-slate-900">
              Auditoria de Pedidos do Marketplace ({marketplaceOrders.length})
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhe a divisão tripartida de cada transação (Valor Bruto = Resolve + Afiliado + Vendedor)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Código Pedido</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Valor Bruto</th>
                  <th className="p-3 text-orange-600">Comissão Resolve</th>
                  <th className="p-3 text-blue-600">Comissão Afiliado</th>
                  <th className="p-3 text-emerald-700">Líquido Vendedor</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketplaceOrders.map((ord) => {
                  const platCut = ord.platformCommissionAOA || Math.round(ord.totalAOA * 0.1);
                  const affCut = ord.affiliateCommissionAOA || 0;
                  const sellerCut = ord.sellerNetAOA || (ord.totalAOA - platCut - affCut);

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/60 font-mono">
                      <td className="p-3 font-bold text-slate-900">{ord.id}</td>
                      <td className="p-3 font-sans text-slate-500">{ord.createdAt?.slice(0, 10)}</td>
                      <td className="p-3 font-sans font-medium text-slate-800">{ord.customerName}</td>
                      <td className="p-3 font-bold text-slate-900">{kz(ord.totalAOA)}</td>
                      <td className="p-3 font-bold text-[#E6540F]">{kz(platCut)}</td>
                      <td className="p-3 font-bold text-blue-700">
                        {affCut > 0 ? `${kz(affCut)} (${ord.affiliateCode})` : "—"}
                      </td>
                      <td className="p-3 font-bold text-emerald-700">{kz(sellerCut)}</td>
                      <td className="p-3 font-sans">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {ord.orderStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: AFFILIATES */}
      {subTab === "affiliates" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Divulgadores & Afiliados Registados ({store.affiliates?.length || 0})
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhe o tráfego gerado, taxa de conversão e comissões acumuladas por cada parceiro
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Afiliado</th>
                  <th className="p-3">Código Ref</th>
                  <th className="p-3">Contacto</th>
                  <th className="p-3">Cliques</th>
                  <th className="p-3">Vendas</th>
                  <th className="p-3">Volume Gerado</th>
                  <th className="p-3">Comissão Ganha</th>
                  <th className="p-3">Saldo Disponível</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(store.affiliates || []).map((aff) => (
                  <tr key={aff.id} className="hover:bg-slate-50/60">
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{aff.name}</p>
                      <p className="text-[11px] text-slate-500">{aff.email}</p>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-orange-100 px-2 py-0.5 font-mono font-bold text-orange-800">
                        {aff.code}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-700">{aff.phone}</td>
                    <td className="p-3 font-mono">{aff.totalClicks}</td>
                    <td className="p-3 font-mono font-bold">{aff.totalOrdersReferred}</td>
                    <td className="p-3 font-bold text-slate-900">{kz(aff.totalSalesVolumeAOA)}</td>
                    <td className="p-3 font-bold text-blue-700">{kz(aff.paidCommissionAOA + aff.availableCommissionAOA + aff.pendingCommissionAOA)}</td>
                    <td className="p-3 font-bold text-emerald-700">{kz(aff.availableCommissionAOA)}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {aff.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: COMMISSIONS & RULES */}
      {subTab === "commissions" && (
        <form onSubmit={handleSaveSettings} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Regras Operacionais e Comissões do Marketplace
            </h3>
            <p className="text-xs text-slate-500">
              Configure as taxas padrão, prazos de pagamento e aprovação de novos vendedores
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Comissão Plataforma RESOLVEEXPRESS (%)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={settingsForm.defaultPlatformCommission}
                onChange={(e) => setSettingsForm({ ...settingsForm, defaultPlatformCommission: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm font-bold"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Cobrado sobre o total de cada produto vendido por terceiros.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Comissão Padrão de Afiliados (%)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={settingsForm.defaultAffiliateCommission}
                onChange={(e) => setSettingsForm({ ...settingsForm, defaultAffiliateCommission: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm font-bold"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Pago a quem divulgar com link ?ref=...
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Quem Custea o Afiliado?
              </label>
              <select
                value={settingsForm.affiliateCommissionPayer}
                onChange={(e) => setSettingsForm({ ...settingsForm, affiliateCommissionPayer: e.target.value as any })}
                className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm bg-white"
              >
                <option value="SELLER">Vendedor (Deduz do líquido da loja)</option>
                <option value="PLATFORM">Plataforma (Deduz da comissão Resolve)</option>
                <option value="SPLIT">Dividido 50% / 50%</option>
              </select>
              <span className="mt-1 block text-[11px] text-slate-500">
                Padrão recomendado em marketplaces: Vendedor custeia a atração do cliente.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Janela de Atribuição de Afiliados (Dias)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={settingsForm.attributionWindowDays}
                onChange={(e) => setSettingsForm({ ...settingsForm, attributionWindowDays: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm font-bold"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Duração da referência após o primeiro clique do utilizador.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Levantamento Mínimo (Kz)
              </label>
              <input
                type="number"
                step="1000"
                value={settingsForm.minPayoutAmountAOA}
                onChange={(e) => setSettingsForm({ ...settingsForm, minPayoutAmountAOA: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm font-bold"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Montante mínimo para solicitar transferência para IBAN.
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.autoApproveSellers}
                onChange={(e) => setSettingsForm({ ...settingsForm, autoApproveSellers: e.target.checked })}
                className="size-4 rounded text-orange-600 focus:ring-orange-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                Aprovar automaticamente candidaturas de novos vendedores (Sem fila de moderação manual)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.autoApproveProducts}
                onChange={(e) => setSettingsForm({ ...settingsForm, autoApproveProducts: e.target.checked })}
                className="size-4 rounded text-orange-600 focus:ring-orange-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                Publicar novos produtos de vendedores imediatamente sem necessidade de aprovação prévia
              </span>
            </label>
          </div>

          <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E6540F] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#cf490a] disabled:opacity-60 cursor-pointer"
            >
              {savingSettings && <Icon name="Loader2" className="size-4 animate-spin" />}
              {savingSettings ? "A gravar no Supabase..." : "Guardar e Aplicar Regras da Praça"}
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB: PAYOUTS */}
      {subTab === "payouts" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="text-base font-black text-slate-900">
              Pedidos de Levantamento para IBAN ({store.pracaPayoutRequests?.length || 0})
            </h3>
            <p className="text-xs text-slate-500">
              Autorize os pagamentos de saldo para as contas bancárias dos vendedores e afiliados
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Beneficiário</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Banco & IBAN</th>
                  <th className="p-3">Titular</th>
                  <th className="p-3">Valor Solicitado</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(store.pracaPayoutRequests || []).map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/60 font-mono">
                    <td className="p-3 font-sans font-bold text-slate-900">
                      {pay.storeOrAffiliateName || pay.requesterName}
                    </td>
                    <td className="p-3 font-sans">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {pay.requesterType}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800 font-sans">{pay.bankName}</p>
                      <p className="text-[11px] text-slate-500">{pay.iban}</p>
                    </td>
                    <td className="p-3 font-sans text-slate-800">{pay.accountHolder}</td>
                    <td className="p-3 font-bold text-slate-900">{kz(pay.amountAOA)}</td>
                    <td className="p-3 font-sans text-slate-500">{pay.createdAt.slice(0, 10)}</td>
                    <td className="p-3 font-sans">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          pay.status === "PAGO"
                            ? "bg-emerald-100 text-emerald-700"
                            : pay.status === "PENDENTE"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {pay.status}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-right">
                      {pay.status === "PENDENTE" && (
                        <button
                          type="button"
                          onClick={() => handleApprovePayout(pay.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Confirmar Pagamento
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
