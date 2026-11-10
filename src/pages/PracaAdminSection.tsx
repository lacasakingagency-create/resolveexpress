import React, { useState } from "react";
import { Icon } from "../ui/kit";
import { useStore, kz, saveAdminStateAsync } from "../lib/store";
import {
  PracaCategory,
  SellerRecord,
  AffiliateRecord,
  PracaPayoutRequest,
} from "../lib/data";
import { ImageUploader } from "../ui/ImageUploader";

export function PracaAdminSection() {
  const [store, update] = useStore();
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

  // Commission Settings State
  const [settingsForm, setSettingsForm] = useState({
    defaultPlatformCommission: store.pracaSettings?.defaultPlatformCommission ?? 10,
    defaultAffiliateCommission: store.pracaSettings?.defaultAffiliateCommission ?? 5,
    affiliateCommissionPayer: store.pracaSettings?.affiliateCommissionPayer ?? "SELLER",
    attributionWindowDays: store.pracaSettings?.attributionWindowDays ?? 30,
    minPayoutAmountAOA: store.pracaSettings?.minPayoutAmountAOA ?? 10000,
    autoApproveSellers: !!store.pracaSettings?.autoApproveSellers,
    autoApproveProducts: !!store.pracaSettings?.autoApproveProducts,
  });

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

  const pracaProducts = (store.products || []).filter((p) => p.isPraca);

  // Category Actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      await saveAdminStateAsync(
        (s) => ({
          pracaCategories: s.pracaCategories.map((c) =>
            c.id === editingCategory.id ? editingCategory : c
          ),
        }),
        "Atualização de Categoria da Praça",
        `Categoria ${editingCategory.name}`
      );
      setEditingCategory(null);
    } else {
      if (!newCatName.trim()) return;
      const newCat: PracaCategory = {
        id: `praca-cat-${Date.now()}`,
        name: newCatName.trim(),
        description: newCatDesc.trim() || `Produtos de ${newCatName.trim()} na Praça`,
        icon: newCatIcon || "ShoppingBag",
        image: newCatImage,
        active: true,
        order: store.pracaCategories.length + 1,
        defaultCommissionRate: newCatCommission,
        affiliateCommissionRate: newCatAffCommission,
        subcategories: newCatSubcats
          .split(",")
          .map((sub) => sub.trim())
          .filter(Boolean),
      };
      await saveAdminStateAsync(
        (s) => ({
          pracaCategories: [...s.pracaCategories, newCat],
        }),
        "Criação de Categoria da Praça",
        `Nova categoria: ${newCat.name}`
      );
      setShowAddCategory(false);
      setNewCatName("");
      setNewCatDesc("");
      setNewCatSubcats("");
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const hasProducts = pracaProducts.some((p) => p.category === catId || p.pracaCategoryId === catId);
    if (hasProducts) {
      alert("Não é possível eliminar uma categoria que contenha produtos ativos. Mova os produtos primeiro.");
      return;
    }
    if (!confirm("Tem a certeza que deseja eliminar esta categoria da Praça?")) return;
    await saveAdminStateAsync(
      (s) => ({
        pracaCategories: s.pracaCategories.filter((c) => c.id !== catId),
      }),
      "Remoção de Categoria da Praça",
      `Categoria ID: ${catId}`
    );
  };

  const handleToggleCategoryActive = async (catId: string) => {
    await saveAdminStateAsync(
      (s) => ({
        pracaCategories: s.pracaCategories.map((c) =>
          c.id === catId ? { ...c, active: !c.active } : c
        ),
      }),
      "Alternar Ativação de Categoria",
      `Categoria ID: ${catId}`
    );
  };

  // Seller Approval Actions
  const handleApproveSeller = async (sellerId: string) => {
    await saveAdminStateAsync(
      (s) => ({
        sellers: s.sellers.map((sel) =>
          sel.id === sellerId ? { ...sel, status: "APROVADO" } : sel
        ),
      }),
      "Aprovação de Vendedor da Praça",
      `Vendedor ID: ${sellerId}`
    );
  };

  const handleRejectSeller = async (sellerId: string) => {
    await saveAdminStateAsync(
      (s) => ({
        sellers: s.sellers.map((sel) =>
          sel.id === sellerId ? { ...sel, status: "REJEITADO" } : sel
        ),
      }),
      "Rejeição de Vendedor da Praça",
      `Vendedor ID: ${sellerId}`
    );
  };

  const handleSuspendSeller = async (sellerId: string) => {
    await saveAdminStateAsync(
      (s) => ({
        sellers: s.sellers.map((sel) =>
          sel.id === sellerId ? { ...sel, status: "SUSPENSO" } : sel
        ),
      }),
      "Suspensão de Vendedor da Praça",
      `Vendedor ID: ${sellerId}`
    );
  };

  // Payout Actions
  const handleApprovePayout = async (payoutId: string) => {
    await saveAdminStateAsync(
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
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAdminStateAsync(
      () => ({
        pracaSettings: {
          defaultPlatformCommission: Number(settingsForm.defaultPlatformCommission),
          defaultAffiliateCommission: Number(settingsForm.defaultAffiliateCommission),
          affiliateCommissionPayer: settingsForm.affiliateCommissionPayer as "SELLER" | "PLATFORM" | "SPLIT",
          attributionWindowDays: Number(settingsForm.attributionWindowDays),
          minPayoutAmountAOA: Number(settingsForm.minPayoutAmountAOA),
          autoApproveSellers: settingsForm.autoApproveSellers,
          autoApproveProducts: settingsForm.autoApproveProducts,
        },
      }),
      "Configurações Gerais da Praça",
      `Comissão Plataforma: ${settingsForm.defaultPlatformCommission}%, Afiliados: ${settingsForm.defaultAffiliateCommission}%`
    );
    alert("Definições da Praça gravadas com sucesso e sincronizadas permanentemente com todos os utilizadores!");
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Produtos Publicados na Praça ({pracaProducts.length})
              </h3>
              <p className="text-xs text-slate-500">
                Supervisão de anúncios de terceiros, controlo de preços e conformidade
              </p>
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
                  <th className="p-3">Comissão Praça</th>
                  <th className="p-3">Comissão Afil.</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pracaProducts.map((p) => {
                  const platRate = (p.platformCommissionRate || 10) / 100;
                  const affRate = (p.affiliateCommissionRate || 5) / 100;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.image?.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"}
                            alt={p.name}
                            className="size-9 rounded-lg object-cover border border-slate-200"
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
                      <td className="p-3 font-bold text-slate-900">{kz(p.priceAOA)}</td>
                      <td className="p-3 text-orange-600 font-bold">
                        {Math.round(platRate * 100)}% ({kz(p.priceAOA * platRate)})
                      </td>
                      <td className="p-3 text-blue-600 font-bold">
                        {Math.round(affRate * 100)}% ({kz(p.priceAOA * affRate)})
                      </td>
                      <td className="p-3 font-mono">{p.stock}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remover produto "${p.name}" da Praça?`)) {
                              update((s) => ({
                                products: s.products.filter((prod) => prod.id !== p.id),
                              }));
                            }
                          }}
                          className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              onClick={() => setShowAddCategory(true)}
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
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddCategory(false)}
                      className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#E6540F] px-5 py-2 text-xs font-bold text-white"
                    >
                      Criar Categoria
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
                      onChange={(url) => setEditingCategory({ ...editingCategory, image: url })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#E6540F] px-5 py-2 text-xs font-bold text-white"
                    >
                      Guardar Alterações
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
                      onClick={() => setEditingCategory(c)}
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

          <div className="pt-3 border-t">
            <button
              type="submit"
              className="rounded-xl bg-[#E6540F] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#cf490a]"
            >
              Guardar e Aplicar Regras da Praça
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
