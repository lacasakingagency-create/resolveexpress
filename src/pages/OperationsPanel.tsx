import { useState, useMemo } from "react";
import { Icon, Btn, Field, inputCls, selectCls } from "../ui/kit";
import {
  useStore,
  saveAdminStateAsync,
  type BookingRecord,
  type ProductOrderRecord,
  type OperationalOccurrence,
  type OperationalOccurrenceType,
  type ImportQuoteRequest,
  type IntermediaryListing,
  type SupportTicket,
} from "../lib/store";
import { formatCurrency, kz } from "../lib/store";

export function OperationsPanel({ initialTab }: { initialTab?: string }) {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState<
    "visao" | "servicos" | "logistica" | "praca" | "importacoes" | "intermediario" | "ocorrencias"
  >(
    (initialTab as any) || "visao"
  );

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State for New Occurrence
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
  const [newOccurrence, setNewOccurrence] = useState<{
    type: OperationalOccurrenceType;
    title: string;
    description: string;
    relatedType: "BOOKING" | "ORDER" | "IMPORT" | "INTERMEDIARY" | "FLEET";
    relatedId: string;
    severity: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
    driverOrTechName: string;
  }>({
    type: "ATRASO_ENTREGA",
    title: "",
    description: "",
    relatedType: "ORDER",
    relatedId: "",
    severity: "MEDIA",
    driverOrTechName: "",
  });

  // Modal State for Technician / Driver Assignment
  const [assignModal, setAssignModal] = useState<{
    targetType: "BOOKING" | "ORDER";
    id: string;
    currentAssigned?: string;
  } | null>(null);
  const [selectedStaff, setSelectedStaff] = useState("");

  // Modal State for Forwarding to Support or Admin
  const [forwardModal, setForwardModal] = useState<{
    type: "BOOKING" | "ORDER" | "OCCURRENCE";
    id: string;
    target: "CUSTOMER_SUPPORT" | "ADMIN";
    reason: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const pendingBookings = store.bookings.filter(
      (b) => b.status === "Recebido" || b.status === "Confirmado"
    ).length;
    const inProgressBookings = store.bookings.filter((b) => b.status === "Em curso").length;
    const completedBookings = store.bookings.filter((b) => b.status === "Concluído").length;

    const pendingOrders = store.productOrders.filter(
      (o) => o.orderStatus === "Recebida" || o.orderStatus === "Confirmada" || o.orderStatus === "Em preparação"
    ).length;
    const deliveringOrders = store.productOrders.filter((o) => o.orderStatus === "A caminho").length;

    const openOccurrences = (store.operationalOccurrences || []).filter(
      (o) => o.status === "ABERTA" || o.status === "EM_RESOLUCAO"
    ).length;

    const importPending = store.importQuotes.filter((q) => q.status !== "ENTREGUE" && q.status !== "CANCELADA").length;
    const intermediaryInspections = store.intermediaryListings.filter(
      (l) => l.verifiedBadge || l.status === "PUBLICADO"
    ).length;

    return {
      pendingBookings,
      inProgressBookings,
      completedBookings,
      pendingOrders,
      deliveringOrders,
      openOccurrences,
      importPending,
      intermediaryInspections,
      activeDrivers: 6,
      punctualityRate: "98.2%",
    };
  }, [store.bookings, store.productOrders, store.operationalOccurrences, store.importQuotes, store.intermediaryListings]);

  // Actions
  const handleUpdateBookingStatus = async (
    bookingId: string,
    newStatus: BookingRecord["status"],
    note?: string
  ) => {
    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        bookings: st.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: newStatus,
                history: [
                  ...b.history,
                  {
                    at: new Date().toISOString(),
                    status: newStatus,
                    note: note || `Estado operacional atualizado pela equipa de Operação & Produção.`,
                  },
                ],
              }
            : b
        ),
      }),
      "UPDATE_BOOKING_STATUS_OPS",
      `Serviço ${bookingId} alterado para ${newStatus}`
    );
    setIsSaving(false);
    showToast(`Estado do serviço ${bookingId} atualizado para ${newStatus}.`);
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: ProductOrderRecord["orderStatus"]
  ) => {
    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        productOrders: st.productOrders.map((o) =>
          o.id === orderId ? { ...o, orderStatus: newStatus } : o
        ),
      }),
      "UPDATE_ORDER_STATUS_OPS",
      `Encomenda ${orderId} atualizada para ${newStatus}`
    );
    setIsSaving(false);
    showToast(`Encomenda ${orderId} atualizada para ${newStatus}.`);
  };

  const handleAssignStaff = async () => {
    if (!assignModal || !selectedStaff) return;
    setIsSaving(true);

    if (assignModal.targetType === "BOOKING") {
      await saveAdminStateAsync(
        (st) => ({
          bookings: st.bookings.map((b) =>
            b.id === assignModal.id
              ? {
                  ...b,
                  assignedTo: selectedStaff,
                  status: b.status === "Recebido" ? "Confirmado" : b.status,
                  history: [
                    ...b.history,
                    {
                      at: new Date().toISOString(),
                      status: b.status,
                      note: `Técnico responsável atribuído: ${selectedStaff}`,
                    },
                  ],
                }
              : b
          ),
        }),
        "ASSIGN_BOOKING_STAFF",
        `Técnico ${selectedStaff} alocado a ${assignModal.id}`
      );
    } else {
      showToast(`Estafeta ${selectedStaff} alocado à entrega ${assignModal.id}.`);
    }

    setIsSaving(false);
    setAssignModal(null);
    setSelectedStaff("");
    showToast("Atribuição técnica guardada com sucesso.");
  };

  const handleCreateOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOccurrence.title.trim()) return;

    const occId = `OC-${Math.floor(100 + Math.random() * 900)}`;
    const occ: OperationalOccurrence = {
      id: occId,
      type: newOccurrence.type,
      title: newOccurrence.title.trim(),
      description: newOccurrence.description.trim(),
      relatedType: newOccurrence.relatedType,
      relatedId: newOccurrence.relatedId.trim() || "N/A",
      severity: newOccurrence.severity,
      status: "ABERTA",
      assignedStaff: store.currentUser?.name || "Eng. Marcos Baptista",
      driverOrTechName: newOccurrence.driverOrTechName.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        operationalOccurrences: [occ, ...(st.operationalOccurrences || [])],
      }),
      "CREATE_OPERATIONAL_OCCURRENCE",
      `Ocorrência ${occId} criada: ${occ.title}`
    );
    setIsSaving(false);
    setShowOccurrenceModal(false);
    setNewOccurrence({
      type: "ATRASO_ENTREGA",
      title: "",
      description: "",
      relatedType: "ORDER",
      relatedId: "",
      severity: "MEDIA",
      driverOrTechName: "",
    });
    showToast(`Ocorrência ${occId} registada com sucesso.`);
  };

  const handleUpdateOccurrenceStatus = async (
    occId: string,
    newStatus: OperationalOccurrence["status"],
    resNote?: string
  ) => {
    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        operationalOccurrences: (st.operationalOccurrences || []).map((o) =>
          o.id === occId
            ? {
                ...o,
                status: newStatus,
                resolutionNote: resNote || o.resolutionNote,
                resolvedAt: newStatus === "RESOLVIDA" ? new Date().toISOString() : o.resolvedAt,
              }
            : o
        ),
      }),
      "UPDATE_OCCURRENCE_STATUS",
      `Ocorrência ${occId} -> ${newStatus}`
    );
    setIsSaving(false);
    showToast(`Ocorrência ${occId} atualizada para ${newStatus}.`);
  };

  const handleForward = async () => {
    if (!forwardModal || !forwardModal.reason.trim()) return;
    setIsSaving(true);

    if (forwardModal.target === "CUSTOMER_SUPPORT") {
      // Create or update ticket in Customer Support queue
      const ticketId = `TK-OP-${Math.floor(1000 + Math.random() * 9000)}`;
      const newTicket: SupportTicket = {
        id: ticketId,
        customerName: "Cliente (Via Operação)",
        customerPhone: "923111222",
        category: "Atrasos nas entregas",
        subject: `[Encaminhado por Operação] ${forwardModal.type} #${forwardModal.id}`,
        message: forwardModal.reason,
        status: "Encaminhado para operação",
        priority: "Alta",
        assignedTo: "Teresa Cambinda",
        orderId: forwardModal.type === "ORDER" ? forwardModal.id : undefined,
        bookingId: forwardModal.type === "BOOKING" ? forwardModal.id : undefined,
        createdAt: new Date().toISOString(),
        forwardReason: forwardModal.reason,
        forwardTarget: "OPERATIONS",
      };

      await saveAdminStateAsync(
        (st) => ({
          supportTickets: [newTicket, ...st.supportTickets],
        }),
        "FORWARD_OPS_TO_SUPPORT",
        `Caso ${forwardModal.id} encaminhado para Apoio ao Cliente`
      );
      showToast(`Encaminhado para o Apoio ao Cliente (Ticket ${ticketId}).`);
    } else {
      // Forward to Executive Admin
      await saveAdminStateAsync(
        (st) => ({
          auditLogs: [
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              user: store.currentUser?.name || "Operação & Produção",
              role: "OPERATIONS",
              action: `ENCAMINHAMENTO_OPERACAO_ADMIN: ${forwardModal.type} #${forwardModal.id}`,
              details: forwardModal.reason,
            },
            ...st.auditLogs,
          ],
        }),
        "FORWARD_OPS_TO_ADMIN",
        `Caso ${forwardModal.id} encaminhado para Administração`
      );
      showToast(`Encaminhado para a Direção / Administração Executiva.`);
    }

    setIsSaving(false);
    setForwardModal(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 rounded-2xl bg-slate-900 text-white px-5 py-3 shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <Icon name="CheckCircle2" className="size-5 text-emerald-400" />
          <span className="text-sm font-bold">{toastMsg}</span>
        </div>
      )}

      {/* Banner Principal Operacional */}
      <div className="bg-gradient-to-r from-[#071B33] via-slate-900 to-[#12365A] text-white pt-8 pb-10 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-black text-blue-300 border border-blue-400/30">
                  <Icon name="Workflow" className="size-3.5" />
                  PORTAL OPERAÇÃO E PRODUÇÃO
                </span>
                <span className="text-xs text-slate-400">Huambo · Base Logística Central</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                Controlo Operacional, Frotas & Execução Técnica
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Supervisão de escala técnica, atribuição de equipas, rastreio de estafetas, pipeline aduaneiro de importações e controlo de qualidade.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOccurrenceModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-action hover:bg-action-hover text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-lg transition"
              >
                <Icon name="AlertTriangle" className="size-4" />
                Registar Ocorrência
              </button>
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Serviços em Execução</span>
              <p className="font-display text-xl sm:text-2xl font-black text-white mt-1">
                {metrics.inProgressBookings}
              </p>
              <span className="text-[10px] text-blue-400 font-semibold">Técnicos no terreno</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Serviços a Atribuir</span>
              <p className="font-display text-xl sm:text-2xl font-black text-amber-400 mt-1">
                {metrics.pendingBookings}
              </p>
              <span className="text-[10px] text-slate-400">Aguardam alocação</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Entregas em Rota</span>
              <p className="font-display text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                {metrics.deliveringOrders}
              </p>
              <span className="text-[10px] text-emerald-400 font-semibold">{metrics.activeDrivers} estafetas ativos</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Cargas em Trânsito</span>
              <p className="font-display text-xl sm:text-2xl font-black text-sky-400 mt-1">
                {metrics.importPending}
              </p>
              <span className="text-[10px] text-slate-400">Importação internacional</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Ocorrências Abertas</span>
              <p className="font-display text-xl sm:text-2xl font-black text-red-400 mt-1">
                {metrics.openOccurrences}
              </p>
              <span className="text-[10px] text-red-400 font-semibold">Necessitam intervenção</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Pontualidade (SLA)</span>
              <p className="font-display text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                {metrics.punctualityRate}
              </p>
              <span className="text-[10px] text-slate-400">Média geral Huambo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas Operacionais */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-lg border border-slate-200 dark:border-slate-800">
          {[
            { id: "visao", label: "Visão Geral & SLA", icon: "LayoutDashboard" },
            { id: "servicos", label: "Serviços & Equipa Técnica", icon: "CheckSquare" },
            { id: "logistica", label: "Logística & Entregas", icon: "Truck" },
            { id: "praca", label: "Monitorização da Praça", icon: "Store" },
            { id: "importacoes", label: "Acompanhamento Importações", icon: "Globe" },
            { id: "intermediario", label: "Intermediário & Vistorias", icon: "ShieldCheck" },
            { id: "ocorrencias", label: "Ocorrências & Qualidade", icon: "AlertTriangle" },
          ].map((tabItem) => {
            const isActive = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setActiveTab(tabItem.id as any)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? "bg-[#071B33] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon name={tabItem.icon as any} className="size-4" />
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Dinâmico por Aba */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        {/* ================= ABA 1: VISÃO GERAL & SLA ================= */}
        {activeTab === "visao" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cobertura de Rotas Huambo */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-blue-100 text-blue-700 grid place-items-center">
                      <Icon name="MapPin" className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-primary dark:text-white">
                        Zonas Operacionais no Huambo
                      </h3>
                      <p className="text-xs text-muted-foreground">Estado do tráfego e distribuição de estafetas em tempo real</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold px-3 py-1">
                    Rede 100% Operacional
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { zone: "Zona 1 · Cidade Alta & Centro", status: "Fluido", couriers: "3 estafetas", delay: "0 min" },
                    { zone: "Zona 2 · São Pedro & Santo António", status: "Moderado", couriers: "2 estafetas", delay: "+5 min" },
                    { zone: "Zona 3 · Kapango & Benfica", status: "Fluido", couriers: "2 estafetas", delay: "0 min" },
                    { zone: "Zona 4 · Ferrovia, Av. Norton & Canata", status: "Atenção (Obras)", couriers: "1 estafeta", delay: "+15 min" },
                  ].map((z, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3.5 bg-slate-50/60 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-primary dark:text-white">{z.zone}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                          z.status.includes("Atenção") ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>{z.status}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Capacidade: {z.couriers}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Atraso médio: {z.delay}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Avisos Técnicos de Campo */}
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="Info" className="size-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                        Protocolo de Contingência Operacional
                      </h4>
                      <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                        Qualquer atraso superior a 45 minutos no atendimento deve ser sinalizado imediatamente como Ocorrência e reencaminhado para a fila de apoio ao cliente para contacto preventivo com o utilizador.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas da Operação */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                <h3 className="font-display text-base font-bold text-primary dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                  Atalhos da Central de Produção
                </h3>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("servicos")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-action/60 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon name="Wrench" className="size-4 text-action" />
                      <span className="text-xs font-bold text-primary dark:text-white">Alocar Técnicos a Serviços</span>
                    </div>
                    <span className="text-xs font-black text-amber-600">{metrics.pendingBookings} pendentes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("logistica")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-action/60 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon name="Truck" className="size-4 text-emerald-600" />
                      <span className="text-xs font-bold text-primary dark:text-white">Despacho de Encomendas</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600">{metrics.pendingOrders} para rota</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("importacoes")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-action/60 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon name="Globe" className="size-4 text-sky-600" />
                      <span className="text-xs font-bold text-primary dark:text-white">Atualizar Trânsito Internacional</span>
                    </div>
                    <span className="text-xs font-black text-sky-600">{metrics.importPending} cargas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOccurrenceModal(true)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 hover:bg-red-50 transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon name="AlertCircle" className="size-4 text-red-600" />
                      <span className="text-xs font-bold text-red-800">Registar Incidente de Campo</span>
                    </div>
                    <span className="text-xs font-black text-red-600">+ Criar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 2: SERVIÇOS & EQUIPA TÉCNICA ================= */}
        {activeTab === "servicos" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                    Gestão Operacional de Serviços & Agendamentos
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Atribuição de profissionais e técnicos, avanço de estados operacionais e registo de intervenções técnicas.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Filtrar por cliente, serviço ou ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-primary dark:text-white outline-none w-full sm:w-64"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {store.bookings
                  .filter(
                    (b) =>
                      !searchQuery ||
                      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      b.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      b.customer.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((b) => (
                    <div key={b.id} className="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{b.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            b.status === "Concluído"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.status === "Em curso"
                              ? "bg-blue-100 text-blue-800"
                              : b.status === "Cancelado"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {b.status}
                          </span>
                          <span className="text-xs text-muted-foreground">• {b.category}</span>
                        </div>

                        <h4 className="font-display text-sm font-bold text-primary dark:text-white">
                          {b.service} ({b.qty} {b.unit})
                        </h4>

                        <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>👤 Cliente: <strong>{b.customer}</strong> ({b.phone})</span>
                          <span>📍 Local: <strong>{b.address}</strong></span>
                          <span>📅 Agendado: <strong>{b.date} às {b.slot}</strong></span>
                          <span>🛠️ Técnico Alocado: <strong className={b.assignedTo ? "text-primary dark:text-white" : "text-amber-600"}>{b.assignedTo || "Nenhum (Pendente)"}</strong></span>
                        </div>
                      </div>

                      {/* Ações Operacionais */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignModal({
                              targetType: "BOOKING",
                              id: b.id,
                              currentAssigned: b.assignedTo,
                            });
                          }}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-primary dark:text-white hover:bg-slate-50"
                        >
                          <Icon name="UserCheck" className="size-3.5 inline mr-1" />
                          {b.assignedTo ? "Reatribuir" : "Alocar Técnico"}
                        </button>

                        <select
                          value={b.status}
                          onChange={(e) => handleUpdateBookingStatus(b.id, e.target.value as any)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-primary dark:text-white cursor-pointer"
                        >
                          <option value="Recebido">Recebido</option>
                          <option value="Confirmado">Confirmado</option>
                          <option value="Em curso">Em curso</option>
                          <option value="Concluído">Concluído</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setForwardModal({
                              type: "BOOKING",
                              id: b.id,
                              target: "CUSTOMER_SUPPORT",
                              reason: "",
                            });
                          }}
                          className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
                          title="Encaminhar para Apoio ao Cliente"
                        >
                          <Icon name="Headphones" className="size-3.5 inline mr-1" />
                          Apoio
                        </button>

                        <a
                          href={`https://wa.me/244${b.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                            `Olá ${b.customer}, aqui é da equipa técnica de Operação da Resolve Express Huambo sobre o seu agendamento ${b.id} (${b.service}).`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-700"
                          title="Contactar Cliente via WhatsApp"
                        >
                          <Icon name="MessageSquare" className="size-3.5 inline" />
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 3: LOGÍSTICA & ENTREGAS ================= */}
        {activeTab === "logistica" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                    Despacho de Encomendas & Rotas de Distribuição
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controlo de estafetas, rotas de entrega e confirmação de chegada no Huambo.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {store.productOrders.map((ord) => (
                  <div key={ord.id} className="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{ord.id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          ord.orderStatus === "Entregue"
                            ? "bg-emerald-100 text-emerald-800"
                            : ord.orderStatus === "A caminho"
                            ? "bg-blue-100 text-blue-800"
                            : ord.orderStatus === "Cancelada"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {ord.orderStatus}
                        </span>
                        <span className="text-xs text-muted-foreground">• {ord.items.length} itens</span>
                      </div>

                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        Destinatário: <strong>{ord.customerName}</strong> ({ord.customerPhone}) · Bairro: <strong>{ord.deliveryBairro}</strong> · Morada: {ord.deliveryAddress}
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        Lojas Fornecedoras: {ord.sellerNames?.join(", ") || "Armazém Central"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        value={ord.orderStatus}
                        onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value as any)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-primary dark:text-white cursor-pointer"
                      >
                        <option value="Recebida">Recebida</option>
                        <option value="Confirmada">Confirmada</option>
                        <option value="Em preparação">Em preparação</option>
                        <option value="A caminho">A caminho (Despachada)</option>
                        <option value="Entregue">Entregue</option>
                        <option value="Cancelada">Cancelada</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setForwardModal({
                            type: "ORDER",
                            id: ord.id,
                            target: "CUSTOMER_SUPPORT",
                            reason: `Dificuldade operacional na entrega da encomenda ${ord.id}. Morada: ${ord.deliveryAddress}`,
                          });
                        }}
                        className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
                        title="Encaminhar para Apoio ao Cliente"
                      >
                        <Icon name="Headphones" className="size-3.5 inline mr-1" />
                        Apoio
                      </button>

                      <a
                        href={`https://wa.me/244${ord.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Olá ${ord.customerName}! Aqui é da equipa de estafetas da Resolve Express Huambo. A sua encomenda ${ord.id} encontra-se com estado: ${ord.orderStatus}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-700"
                      >
                        <Icon name="MessageSquare" className="size-3.5 inline mr-1" />
                        Estafeta WhatsApp
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 4: MONITORIZAÇÃO DA PRAÇA ================= */}
        {activeTab === "praca" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                  Supervisão de Lojas & Vendedores na Praça
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monitorização de cumprimento de prazos de expedição e verificação de integridade de catálogo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {store.sellers.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg overflow-hidden bg-white border shrink-0">
                        <img src={s.logo?.trim() || "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=120"} alt="" className="size-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-primary dark:text-white truncate">{s.storeName}</h4>
                        <span className="text-[11px] text-muted-foreground block">{s.municipio} · {s.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700">
                      <span className="text-slate-500">Expedição Média:</span>
                      <span className="font-bold text-emerald-600">~2h40 (Dentro do SLA)</span>
                    </div>

                    <a
                      href={`https://wa.me/244${s.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Olá ${s.storeName}, aqui é da equipa de Operações da Resolve Express referente aos pedidos da PRAÇA no Huambo.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 text-xs font-bold text-primary dark:text-white hover:bg-slate-50 transition"
                    >
                      <Icon name="PhoneCall" className="size-3.5 text-emerald-600" />
                      Contactar Responsável Loja
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 5: ACOMPANHAMENTO DE IMPORTAÇÕES ================= */}
        {activeTab === "importacoes" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                  Pipeline Logístico de Importações Internacionais
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rastreio aduaneiro, desembaraço em Luanda e transferência rodoviária para o armazém do Huambo.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {store.importQuotes.map((q) => (
                  <div key={q.id} className="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{q.id}</span>
                        <span className="rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2.5 py-0.5">
                          {q.status}
                        </span>
                        <span className="text-xs text-muted-foreground">• Origem: {q.originCountryOrStore}</span>
                      </div>

                      <h4 className="font-display text-sm font-bold text-primary dark:text-white">
                        {q.productName} (Qtd: {q.quantity})
                      </h4>

                      <p className="text-xs text-muted-foreground">
                        Solicitante: {q.customerName} ({q.phone || q.whatsapp}) · Destino: {q.deliveryProvince}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={q.status}
                        onChange={async (e) => {
                          const val = e.target.value as any;
                          await saveAdminStateAsync(
                            (st) => ({
                              importQuotes: st.importQuotes.map((item) =>
                                item.id === q.id ? { ...item, status: val } : item
                              ),
                            }),
                            "UPDATE_IMPORT_STATUS",
                            `Cotação ${q.id} -> ${val}`
                          );
                          showToast(`Estado logístico de ${q.id} atualizado para ${val}.`);
                        }}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-primary dark:text-white cursor-pointer"
                      >
                        <option value="COTACAO_PENDENTE">Em cotação com agentes</option>
                        <option value="COTACAO_ENVIADA">Orçamento formulado</option>
                        <option value="APROVADA_PELO_CLIENTE">Aprovada pelo cliente</option>
                        <option value="ENCOMENDA_PAGA">Encomenda paga</option>
                        <option value="EM_TRANSITO_INTERNACIONAL">Em trânsito internacional</option>
                        <option value="NA_ALFANDEGA">Na Alfândega</option>
                        <option value="ENTREGUE">Entregue ao cliente</option>
                        <option value="CANCELADA">Cancelada</option>
                      </select>

                      <a
                        href={`https://wa.me/244${(q.phone || q.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Olá ${q.customerName}, atualização operacional da sua importação ${q.id} (${q.productName}): Estado logístico: ${q.status}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-700"
                      >
                        <Icon name="MessageSquare" className="size-3.5 inline mr-1" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 6: INTERMEDIÁRIO & VISTORIAS ================= */}
        {activeTab === "intermediario" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                  Vistorias Técnicas & Verificação de Bens Materiais
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inspeção física presencial de viaturas, imóveis e equipamentos para selo de garantia Resolve Express.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {store.intermediaryListings.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40 flex gap-3.5 items-start">
                    <img
                      src={item.images?.[0]?.trim() || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"}
                      alt=""
                      className="size-20 rounded-xl object-cover border shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-500">{item.id}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          item.verifiedBadge ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {item.verifiedBadge ? "Vistoriado & Certificado" : "Vistoria Pendente"}
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-bold text-primary dark:text-white truncate">{item.title}</h4>
                      <p className="text-xs font-semibold text-action">{kz(item.priceAOA)}</p>
                      <p className="text-[11px] text-muted-foreground">Vendedor: {item.sellerName} · {item.sellerPhone}</p>

                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const newBadge = !item.verifiedBadge;
                            await saveAdminStateAsync(
                              (st) => ({
                                intermediaryListings: st.intermediaryListings.map((l) =>
                                  l.id === item.id ? { ...l, verifiedBadge: newBadge } : l
                                ),
                              }),
                              "TOGGLE_INTERMEDIARY_VERIFICATION",
                              `Vistoria ${item.id} -> ${newBadge}`
                            );
                            showToast(`Vistoria técnica de ${item.id} atualizada.`);
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                            item.verifiedBadge
                              ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {item.verifiedBadge ? "Revogar Laudo" : "Emitir Laudo Aprovado"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 7: OCORRÊNCIAS & QUALIDADE ================= */}
        {activeTab === "ocorrencias" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                    Registo de Ocorrências & Auditoria de Qualidade
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Incidentes de campo, atrasos de estafetas, falhas técnicas e desvios de conformidade no Huambo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOccurrenceModal(true)}
                  className="rounded-xl bg-action hover:bg-action-hover text-white px-3.5 py-2 text-xs font-bold shadow-md"
                >
                  <Icon name="Plus" className="size-3.5 inline mr-1" />
                  Nova Ocorrência
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {(store.operationalOccurrences || []).map((occ) => (
                  <div key={occ.id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{occ.id}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          occ.severity === "CRITICA"
                            ? "bg-red-600 text-white"
                            : occ.severity === "ALTA"
                            ? "bg-amber-600 text-white"
                            : "bg-blue-600 text-white"
                        }`}>
                          {occ.severity}
                        </span>
                        <span className="rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5">
                          {occ.type}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          occ.status === "RESOLVIDA"
                            ? "bg-emerald-100 text-emerald-800"
                            : occ.status === "ENCAMINHADA_ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {occ.status}
                        </span>
                      </div>

                      <span className="text-[11px] text-muted-foreground">
                        {new Date(occ.createdAt).toLocaleString("pt-AO")}
                      </span>
                    </div>

                    <h4 className="font-display text-sm font-bold text-primary dark:text-white">
                      {occ.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      {occ.description}
                    </p>

                    {occ.resolutionNote && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                        <strong>Nota de Resolução:</strong> {occ.resolutionNote}
                      </p>
                    )}

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] text-slate-500">
                        Responsável: <strong>{occ.assignedStaff || "Operação REX"}</strong>
                        {occ.driverOrTechName && ` · Técnico/Estafeta: ${occ.driverOrTechName}`}
                      </div>

                      <div className="flex items-center gap-2">
                        {occ.status !== "RESOLVIDA" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateOccurrenceStatus(occ.id, "RESOLVIDA", "Situação regularizada no terreno pela equipa técnica.")}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-xs font-bold"
                          >
                            Marcar Resolvida
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setForwardModal({
                              type: "OCCURRENCE",
                              id: occ.id,
                              target: "ADMIN",
                              reason: `Ocorrência ${occ.id} (${occ.title}) com severidade ${occ.severity} requer deliberação executiva da Direção.`,
                            });
                          }}
                          className="rounded-lg border border-purple-200 bg-purple-50 text-purple-800 px-3 py-1 text-xs font-bold hover:bg-purple-100"
                        >
                          Encaminhar Direção
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: REGISTAR OCORRÊNCIA ================= */}
      {showOccurrenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Icon name="AlertTriangle" className="size-5 text-action" />
                <h3 className="font-display text-base font-bold text-primary dark:text-white">
                  Registar Ocorrência de Campo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOccurrenceModal(false)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-600 hover:bg-slate-200"
              >
                <Icon name="X" className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOccurrence} className="space-y-3.5">
              <Field label="Tipo de Ocorrência *">
                <select
                  value={newOccurrence.type}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, type: e.target.value as any })}
                  className={selectCls}
                >
                  <option value="ATRASO_ENTREGA">Atraso na Entrega</option>
                  <option value="AVARIA_TECNICA">Avaria Técnica de Equipamento/Viatura</option>
                  <option value="CLIENTE_AUSENTE">Cliente Ausente na Morada</option>
                  <option value="MORADA_INCORRETA">Morada Incorreta ou Difícil Acesso</option>
                  <option value="DIVERGENCIA_STOCK">Divergência de Stock com Vendedor</option>
                  <option value="FALHA_PARCEIRO">Falha de Parceiro Independente</option>
                  <option value="VISTORIA_IRREGULAR">Irregularidade em Vistoria Técnica</option>
                  <option value="RECLAMACAO_CAMPO">Reclamação Presencial no Terreno</option>
                  <option value="OUTRO">Outro Incidente Operacional</option>
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Severidade *">
                  <select
                    value={newOccurrence.severity}
                    onChange={(e) => setNewOccurrence({ ...newOccurrence, severity: e.target.value as any })}
                    className={selectCls}
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica (Intervenção Imediata)</option>
                  </select>
                </Field>

                <Field label="ID Relacionado (Opcional)">
                  <input
                    type="text"
                    placeholder="Ex: REX-2026-000001"
                    value={newOccurrence.relatedId}
                    onChange={(e) => setNewOccurrence({ ...newOccurrence, relatedId: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Título Resumido *">
                <input
                  type="text"
                  placeholder="Ex: Mota avariada na Av. Norton de Matos"
                  value={newOccurrence.title}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, title: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Técnico ou Estafeta no Terreno">
                <input
                  type="text"
                  placeholder="Ex: Manuel Bento / Carlos Mendes"
                  value={newOccurrence.driverOrTechName}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, driverOrTechName: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Descrição Detalhada do Incidente *">
                <textarea
                  rows={3}
                  placeholder="Descreva o que ocorreu, localidade exata e medida preventiva aplicada..."
                  value={newOccurrence.description}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, description: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <Btn kind="ghost" type="button" onClick={() => setShowOccurrenceModal(false)}>
                  Cancelar
                </Btn>
                <Btn kind="action" type="submit" disabled={isSaving}>
                  {isSaving ? "A guardar..." : "Registar Ocorrência"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ALOCAÇÃO DE TÉCNICO ================= */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-base font-bold text-primary dark:text-white mb-2">
              Atribuir Profissional Responsável
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Selecione o funcionário ou parceiro credenciado para assumir o serviço #{assignModal.id}.
            </p>

            <div className="space-y-3">
              <Field label="Escolha o Técnico / Equipa *">
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Selecione um profissional disponível...</option>
                  <optgroup label="Equipa Própria Resolve Express">
                    {store.employees.map((em) => (
                      <option key={em.id} value={`${em.name} (${em.role})`}>
                        {em.name} · {em.role}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Parceiros Independentes Credenciados">
                    <option value="João Baptista (Eletricista Certificado)">João Baptista · Eletricista</option>
                    <option value="Nelson Paiva (Mecânico Perito)">Nelson Paiva · Peritagem Automóvel</option>
                    <option value="Manuel Bento (Estafeta Rápido)">Manuel Bento · Estafeta Rápido</option>
                  </optgroup>
                </select>
              </Field>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <Btn kind="ghost" onClick={() => setAssignModal(null)}>
                  Cancelar
                </Btn>
                <Btn kind="action" onClick={handleAssignStaff} disabled={!selectedStaff || isSaving}>
                  Confirmar Atribuição
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ENCAMINHAMENTO ================= */}
      {forwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-base font-bold text-primary dark:text-white mb-1">
              Encaminhar Caso {forwardModal.id}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Destino: <strong>{forwardModal.target === "CUSTOMER_SUPPORT" ? "Apoio ao Cliente (Atendimento)" : "Direção / Administração Executiva"}</strong>
            </p>

            <Field label="Motivo do Encaminhamento *">
              <textarea
                rows={3}
                placeholder="Indique o motivo pelo qual este caso deve ser gerido pelo destino selecionado..."
                value={forwardModal.reason}
                onChange={(e) => setForwardModal({ ...forwardModal, reason: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 mt-4">
              <Btn kind="ghost" onClick={() => setForwardModal(null)}>
                Cancelar
              </Btn>
              <Btn kind="action" onClick={handleForward} disabled={!forwardModal.reason.trim() || isSaving}>
                Confirmar Encaminhamento
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
