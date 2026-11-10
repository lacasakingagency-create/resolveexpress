import { useState, useMemo } from "react";
import { Icon, Btn, Field, inputCls, selectCls } from "../ui/kit";
import {
  useStore,
  saveAdminStateAsync,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketStatus,
  type SupportTicketPriority,
  type TicketMessage,
  type TicketInternalNote,
} from "../lib/store";
import { formatCurrency, kz } from "../lib/store";

const TICKET_CATEGORIES: SupportTicketCategory[] = [
  "Dúvidas gerais",
  "Problemas com pedidos",
  "Problemas com pagamentos",
  "Atrasos nas entregas",
  "Reclamações de serviços",
  "Problemas com produtos",
  "Importação",
  "Intermediário",
  "Problemas com vendedores",
  "Problemas com profissionais",
  "Acesso à conta",
  "Cancelamentos",
  "Reembolsos",
  "Outros",
];

const TICKET_STATUSES: SupportTicketStatus[] = [
  "Novo",
  "Em atendimento",
  "A aguardar cliente",
  "Encaminhado para operação",
  "Encaminhado para administração",
  "Resolvido",
  "Encerrado",
];

export function CustomerSupportPanel({ initialTab }: { initialTab?: string }) {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState<"tickets" | "novo" | "reclamacoes" | "base">(
    (initialTab as any) || "tickets"
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");
  const [selectedPriority, setSelectedPriority] = useState<string>("TODAS");

  // Selected Ticket for Drawer / Detail
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);

  // Quick Action States inside Detail
  const [replyText, setReplyText] = useState("");
  const [newInternalNote, setNewInternalNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Forward Modal
  const [forwardModal, setForwardModal] = useState<{
    ticketId: string;
    target: "OPERATIONS" | "ADMIN";
    reason: string;
  } | null>(null);

  // New Ticket Form State
  const [newTicketForm, setNewTicketForm] = useState<{
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    subject: string;
    description: string;
    relatedEntityId: string;
  }>({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    category: "Dúvidas gerais",
    priority: "Média",
    subject: "",
    description: "",
    relatedEntityId: "",
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // KPIs
  const metrics = useMemo(() => {
    const list = store.supportTickets || [];
    const openTickets = list.filter((t) => t.status !== "Resolvido" && t.status !== "Encerrado").length;
    const awaitingCustomer = list.filter((t) => t.status === "A aguardar cliente").length;
    const forwardedOps = list.filter((t) => t.status === "Encaminhado para operação").length;
    const forwardedAdmin = list.filter((t) => t.status === "Encaminhado para administração").length;
    const resolvedToday = list.filter((t) => t.status === "Resolvido" || t.status === "Encerrado").length;
    const complaints = list.filter(
      (t) => t.category === "Reclamações de serviços" || t.category === "Reembolsos" || t.category === "Cancelamentos"
    ).length;

    return {
      openTickets,
      awaitingCustomer,
      forwardedOps,
      forwardedAdmin,
      resolvedToday,
      complaints,
      avgResponseTime: "12 min",
      csatRate: "98.4%",
    };
  }, [store.supportTickets]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return (store.supportTickets || []).filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerPhone.includes(searchQuery) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCat = selectedCategory === "TODAS" || t.category === selectedCategory;
      const matchStatus = selectedStatus === "TODOS" || t.status === selectedStatus;
      const matchPriority = selectedPriority === "TODAS" || t.priority === selectedPriority;

      return matchSearch && matchCat && matchStatus && matchPriority;
    });
  }, [store.supportTickets, searchQuery, selectedCategory, selectedStatus, selectedPriority]);

  // Send Reply to Customer
  const handleSendReply = async () => {
    if (!activeTicket || !replyText.trim()) return;

    const newMsg: TicketMessage = {
      id: `msg-${Date.now()}`,
      sender: "SUPPORT",
      senderName: store.currentUser?.name || "Teresa Cambinda",
      text: replyText.trim(),
      at: new Date().toISOString(),
    };

    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        supportTickets: st.supportTickets.map((t) =>
          t.id === activeTicket.id
            ? {
                ...t,
                status: "A aguardar cliente",
                updatedAt: new Date().toISOString(),
                response: replyText.trim(),
                messages: [...(t.messages || []), newMsg],
              }
            : t
        ),
      }),
      "SEND_SUPPORT_REPLY",
      `Resposta enviada ao ticket ${activeTicket.id}`
    );

    setActiveTicket((prev) =>
      prev
        ? {
            ...prev,
            status: "A aguardar cliente",
            updatedAt: new Date().toISOString(),
            response: replyText.trim(),
            messages: [...(prev.messages || []), newMsg],
          }
        : null
    );

    setReplyText("");
    setIsSaving(false);
    showToast(`Resposta enviada ao cliente com sucesso.`);
  };

  // Add Internal Note
  const handleAddInternalNote = async () => {
    if (!activeTicket || !newInternalNote.trim()) return;

    const note: TicketInternalNote = {
      id: `note-${Date.now()}`,
      author: store.currentUser?.name || "Apoio ao Cliente REX",
      note: newInternalNote.trim(),
      at: new Date().toISOString(),
    };

    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        supportTickets: st.supportTickets.map((t) =>
          t.id === activeTicket.id
            ? {
                ...t,
                updatedAt: new Date().toISOString(),
                internalNotes: [...(t.internalNotes || []), note],
              }
            : t
        ),
      }),
      "ADD_TICKET_INTERNAL_NOTE",
      `Nota interna registada no ticket ${activeTicket.id}`
    );

    setActiveTicket((prev) =>
      prev
        ? {
            ...prev,
            updatedAt: new Date().toISOString(),
            internalNotes: [...(prev.internalNotes || []), note],
          }
        : null
    );

    setNewInternalNote("");
    setIsSaving(false);
    showToast("Nota interna confidencial guardada.");
  };

  // Update Status
  const handleUpdateTicketStatus = async (ticketId: string, newStatus: SupportTicketStatus) => {
    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        supportTickets: st.supportTickets.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: newStatus,
                updatedAt: new Date().toISOString(),
                resolvedAt: newStatus === "Resolvido" || newStatus === "Encerrado" ? new Date().toISOString() : t.resolvedAt,
              }
            : t
        ),
      }),
      "UPDATE_TICKET_STATUS",
      `Ticket ${ticketId} alterado para ${newStatus}`
    );

    if (activeTicket && activeTicket.id === ticketId) {
      setActiveTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    setIsSaving(false);
    showToast(`Estado do ticket ${ticketId} atualizado para ${newStatus}.`);
  };

  // Forwarding execution
  const handleExecuteForward = async () => {
    if (!forwardModal || !forwardModal.reason.trim()) return;

    const newStatus: SupportTicketStatus =
      forwardModal.target === "OPERATIONS" ? "Encaminhado para operação" : "Encaminhado para administração";

    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        supportTickets: st.supportTickets.map((t) =>
          t.id === forwardModal.ticketId
            ? {
                ...t,
                status: newStatus,
                updatedAt: new Date().toISOString(),
                forwardReason: forwardModal.reason,
                forwardTarget: forwardModal.target,
                internalNotes: [
                  ...(t.internalNotes || []),
                  {
                    id: `note-${Date.now()}`,
                    author: store.currentUser?.name || "Apoio ao Cliente",
                    note: `[ENCAMINHADO PARA ${forwardModal.target}]: ${forwardModal.reason}`,
                    at: new Date().toISOString(),
                  },
                ],
              }
            : t
        ),
      }),
      "FORWARD_SUPPORT_TICKET",
      `Ticket ${forwardModal.ticketId} encaminhado para ${forwardModal.target}`
    );

    if (activeTicket && activeTicket.id === forwardModal.ticketId) {
      setActiveTicket((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              forwardReason: forwardModal.reason,
              forwardTarget: forwardModal.target,
            }
          : null
      );
    }

    setIsSaving(false);
    const targetLabel = forwardModal.target === "OPERATIONS" ? "Operação e Produção" : "Direção / Administração Executiva";
    showToast(`Ticket ${forwardModal.ticketId} encaminhado para ${targetLabel}.`);
    setForwardModal(null);
  };

  // Submit New Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.customerName.trim() || !newTicketForm.subject.trim()) return;

    const ticketId = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket: SupportTicket = {
      id: ticketId,
      customerName: newTicketForm.customerName.trim(),
      customerPhone: newTicketForm.customerPhone.trim(),
      customerEmail: newTicketForm.customerEmail.trim() || undefined,
      category: newTicketForm.category,
      priority: newTicketForm.priority,
      subject: newTicketForm.subject.trim(),
      message: newTicketForm.description.trim(),
      status: "Novo",
      assignedTo: store.currentUser?.name || "Teresa Cambinda",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: "CLIENT",
          senderName: newTicketForm.customerName.trim(),
          text: newTicketForm.description.trim(),
          at: new Date().toISOString(),
        },
      ],
      internalNotes: [
        {
          id: `note-${Date.now()}`,
          author: store.currentUser?.name || "Atendimento REX",
          note: `Atendimento registado no balcão / telefone pelo operador de suporte.`,
          at: new Date().toISOString(),
        },
      ],
    };

    setIsSaving(true);
    await saveAdminStateAsync(
      (st) => ({
        supportTickets: [newTicket, ...st.supportTickets],
      }),
      "CREATE_SUPPORT_TICKET",
      `Ticket ${ticketId} registado`
    );
    setIsSaving(false);
    setActiveTab("tickets");
    setActiveTicket(newTicket);
    setNewTicketForm({
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      category: "Dúvidas gerais",
      priority: "Média",
      subject: "",
      description: "",
      relatedEntityId: "",
    });
    showToast(`Ticket ${ticketId} aberto com sucesso.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 rounded-2xl bg-slate-900 text-white px-5 py-3 shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <Icon name="CheckCircle2" className="size-5 text-teal-400" />
          <span className="text-sm font-bold">{toastMsg}</span>
        </div>
      )}

      {/* Banner Principal Apoio ao Cliente */}
      <div className="bg-gradient-to-r from-[#07242B] via-slate-900 to-[#0A3641] text-white pt-8 pb-10 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-0.5 text-xs font-black text-teal-300 border border-teal-400/30">
                  <Icon name="Headphones" className="size-3.5" />
                  PORTAL APOIO AO CLIENTE
                </span>
                <span className="text-xs text-slate-400">Central Multicanal Resolve Express · Huambo</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                Central de Atendimento, Mediação & Gestão de Tickets
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Recepção de solicitações, esclarecimento de dúvidas, apoio direto aos clientes, mediação de conflitos e encaminhamento com 1 clique para Operação ou Administração.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("novo")}
                className="inline-flex items-center gap-2 rounded-xl bg-action hover:bg-action-hover text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-lg transition"
              >
                <Icon name="PlusCircle" className="size-4" />
                Registar Novo Atendimento
              </button>
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Tickets Abertos</span>
              <p className="font-display text-xl sm:text-2xl font-black text-white mt-1">
                {metrics.openTickets}
              </p>
              <span className="text-[10px] text-teal-300 font-semibold">Em tratamento ativo</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Aguardando Cliente</span>
              <p className="font-display text-xl sm:text-2xl font-black text-amber-400 mt-1">
                {metrics.awaitingCustomer}
              </p>
              <span className="text-[10px] text-slate-400">Resposta enviada</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Encaminhados Operação</span>
              <p className="font-display text-xl sm:text-2xl font-black text-blue-400 mt-1">
                {metrics.forwardedOps}
              </p>
              <span className="text-[10px] text-blue-300 font-semibold">Atrasos & Campo</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Para Administração</span>
              <p className="font-display text-xl sm:text-2xl font-black text-purple-400 mt-1">
                {metrics.forwardedAdmin}
              </p>
              <span className="text-[10px] text-purple-300 font-semibold">Reembolsos & Decisão</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">1ª Resposta Média</span>
              <p className="font-display text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                {metrics.avgResponseTime}
              </p>
              <span className="text-[10px] text-slate-400">Meta: abaixo de 20 min</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5">
              <span className="text-[11px] font-bold text-slate-400 block">Índice Satisfação (CSAT)</span>
              <p className="font-display text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                {metrics.csatRate}
              </p>
              <span className="text-[10px] text-slate-400">Avaliações positivas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-lg border border-slate-200 dark:border-slate-800">
          {[
            { id: "tickets", label: `Central de Tickets (${store.supportTickets?.length || 0})`, icon: "Inbox" },
            { id: "novo", label: "Registar Novo Atendimento", icon: "PlusCircle" },
            { id: "reclamacoes", label: `Reclamações & Devoluções (${metrics.complaints})`, icon: "RefreshCw" },
            { id: "base", label: "Base de Conhecimento & FAQs", icon: "BookOpen" },
          ].map((tabItem) => {
            const isActive = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setActiveTab(tabItem.id as any)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? "bg-[#0A3641] text-white shadow-sm"
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

      {/* Conteúdo Principal */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        {/* ================= ABA 1: CENTRAL DE TICKETS ================= */}
        {activeTab === "tickets" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de Tickets (7 colunas em telas grandes) */}
            <div className={`space-y-4 ${activeTicket ? "lg:col-span-7" : "lg:col-span-12"}`}>
              {/* Barra de Filtros */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Icon name="Search" className="size-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Pesquisar por ID, cliente, telefone ou assunto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-1.5 text-xs text-primary dark:text-white outline-none"
                    />
                  </div>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-primary dark:text-white w-full sm:w-auto"
                  >
                    <option value="TODAS">Todas as Categorias</option>
                    {TICKET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-primary dark:text-white w-full sm:w-auto"
                  >
                    <option value="TODOS">Todos os Estados</option>
                    {TICKET_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lista dos Tickets Filtrados */}
              <div className="space-y-3">
                {filteredTickets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900">
                    <Icon name="Inbox" className="size-10 text-slate-400 mx-auto mb-2" />
                    <p className="font-bold text-sm text-primary dark:text-white">Nenhum ticket encontrado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Tente ajustar os termos de pesquisa ou filtros.</p>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => {
                    const isSelected = activeTicket?.id === ticket.id;
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => setActiveTicket(ticket)}
                        className={`rounded-2xl border p-4 transition cursor-pointer ${
                          isSelected
                            ? "border-teal-500 bg-teal-50/20 dark:bg-teal-950/20 shadow-md ring-2 ring-teal-500/20"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 shadow-xs"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-500">{ticket.id}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              ticket.priority === "Urgente"
                                ? "bg-red-600 text-white"
                                : ticket.priority === "Alta"
                                ? "bg-amber-600 text-white"
                                : ticket.priority === "Média"
                                ? "bg-blue-600 text-white"
                                : "bg-slate-500 text-white"
                            }`}>
                              {ticket.priority || "Normal"}
                            </span>
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5">
                              {ticket.category || "Atendimento"}
                            </span>
                          </div>

                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            ticket.status === "Resolvido" || ticket.status === "Encerrado"
                              ? "bg-emerald-100 text-emerald-800"
                              : ticket.status === "Encaminhado para operação"
                              ? "bg-blue-100 text-blue-800"
                              : ticket.status === "Encaminhado para administração"
                              ? "bg-purple-100 text-purple-800"
                              : ticket.status === "A aguardar cliente"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-teal-100 text-teal-800"
                          }`}>
                            {ticket.status}
                          </span>
                        </div>

                        <h4 className="font-display text-sm font-bold text-primary dark:text-white line-clamp-1">
                          {ticket.subject}
                        </h4>

                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {ticket.message}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                          <span>👤 <strong>{ticket.customerName}</strong> ({ticket.customerPhone})</span>
                          <span>{new Date(ticket.createdAt).toLocaleDateString("pt-AO")}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Painel de Detalhes do Ticket Ativo (5 colunas) */}
            {activeTicket && (
              <div className="lg:col-span-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-5 sticky top-24 self-start">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-primary dark:text-white">
                      {activeTicket.id}
                    </span>
                    <span className="rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5">
                      {activeTicket.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTicket(null)}
                    className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-600 hover:bg-slate-200"
                  >
                    <Icon name="X" className="size-4" />
                  </button>
                </div>

                {/* Dados do Cliente */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary dark:text-white text-sm">{activeTicket.customerName}</span>
                    <a
                      href={`https://wa.me/244${activeTicket.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Olá ${activeTicket.customerName}, fala a Teresa da equipa de Apoio ao Cliente da Resolve Express referente ao seu pedido/atendimento ${activeTicket.id}.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-emerald-700 shadow-xs"
                    >
                      <Icon name="MessageSquare" className="size-3" />
                      WhatsApp
                    </a>
                  </div>
                  <p className="text-muted-foreground">Telefone: {activeTicket.customerPhone}</p>
                  {activeTicket.customerEmail && <p className="text-muted-foreground">Email: {activeTicket.customerEmail}</p>}
                  {activeTicket.orderId && <p className="text-primary font-bold">Encomenda Associada: #{activeTicket.orderId}</p>}
                  {activeTicket.bookingId && <p className="text-primary font-bold">Serviço Agendado: #{activeTicket.bookingId}</p>}
                </div>

                {/* Assunto e Descrição */}
                <div>
                  <h4 className="font-display text-sm font-black text-primary dark:text-white">
                    {activeTicket.subject}
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {activeTicket.message}
                  </p>
                </div>

                {/* Histórico de Mensagens no Ticket */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-primary dark:text-white block">Histórico da Conversa</span>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {(activeTicket.messages || []).map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded-xl text-xs ${
                          msg.sender === "CLIENT"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            : "bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-900"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold opacity-75 mb-1">
                          <span>{msg.senderName} ({msg.sender === "CLIENT" ? "Cliente" : "Apoio REX"})</span>
                          <span>{new Date(msg.at).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notas Internas Confidenciais */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Icon name="Lock" className="size-3 text-amber-700" />
                      Notas Internas Confidenciais (Apenas Equipa)
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {(activeTicket.internalNotes || []).map((n) => (
                      <div key={n.id} className="text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-200/80">
                        <span className="font-bold text-amber-800 block">{n.author}:</span>
                        <p className="text-slate-700 dark:text-slate-300">{n.note}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar nota interna..."
                      value={newInternalNote}
                      onChange={(e) => setNewInternalNote(e.target.value)}
                      className="flex-1 rounded-lg border border-amber-300 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-primary dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddInternalNote}
                      disabled={!newInternalNote.trim()}
                      className="rounded-lg bg-amber-600 text-white px-2.5 py-1 text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
                    >
                      Gravar
                    </button>
                  </div>
                </div>

                {/* Campo de Envio de Resposta Oficial */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-primary dark:text-white block">
                    Enviar Resposta Oficial ao Cliente
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Escreva a resposta que será registada e notificada ao cliente..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className={inputCls}
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || isSaving}
                      className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-xs font-bold shadow-md transition disabled:opacity-50"
                    >
                      <Icon name="Send" className="size-3.5 inline mr-1" />
                      Enviar Resposta
                    </button>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={activeTicket.status}
                        onChange={(e) => handleUpdateTicketStatus(activeTicket.id, e.target.value as any)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-bold text-primary dark:text-white cursor-pointer"
                      >
                        {TICKET_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Encaminhamentos com 1 Clique */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Encaminhar Tratamento Especializado
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForwardModal({
                          ticketId: activeTicket.id,
                          target: "OPERATIONS",
                          reason: `Atraso logístico ou necessidade de alocação de técnico reportado pelo cliente no ticket #${activeTicket.id}.`,
                        })
                      }
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 p-2 text-xs font-bold text-blue-800 hover:bg-blue-100 transition"
                    >
                      <Icon name="Truck" className="size-3.5" />
                      Para Operação
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setForwardModal({
                          ticketId: activeTicket.id,
                          target: "ADMIN",
                          reason: `Solicitação que exige aprovação financeira ou intervenção da Direção Executiva (ex: devolução bancária ou litígio).`,
                        })
                      }
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 p-2 text-xs font-bold text-purple-800 hover:bg-purple-100 transition"
                    >
                      <Icon name="Shield" className="size-3.5" />
                      Para Administração
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= ABA 2: REGISTAR NOVO ATENDIMENTO ================= */}
        {activeTab === "novo" && (
          <div className="max-w-2xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="PlusCircle" className="size-5 text-action" />
                <h3 className="font-display text-xl font-bold text-primary dark:text-white">
                  Registar Novo Atendimento (Balcão / Telefone)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Registo de pedidos de ajuda recebidos por via telefónica, balcão físico em Huambo ou mensagens diretas.
              </p>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome do Cliente *">
                  <input
                    type="text"
                    placeholder="Ex: João Baptista"
                    value={newTicketForm.customerName}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, customerName: e.target.value })}
                    className={inputCls}
                    required
                  />
                </Field>

                <Field label="Contacto Telefónico *">
                  <input
                    type="tel"
                    placeholder="Ex: 923 111 222"
                    value={newTicketForm.customerPhone}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, customerPhone: e.target.value })}
                    className={inputCls}
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Categoria do Problema *">
                  <select
                    value={newTicketForm.category}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value as any })}
                    className={selectCls}
                  >
                    {TICKET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Prioridade de Resolução *">
                  <select
                    value={newTicketForm.priority}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value as any })}
                    className={selectCls}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente (Prioridade Máxima)</option>
                  </select>
                </Field>
              </div>

              <Field label="Assunto do Atendimento *">
                <input
                  type="text"
                  placeholder="Ex: Atraso na entrega de encomenda de supermercado"
                  value={newTicketForm.subject}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Descrição Detalhada do Cliente *">
                <textarea
                  rows={4}
                  placeholder="Registe o relato do cliente, histórico do pedido e detalhes relevantes..."
                  value={newTicketForm.description}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <Btn kind="ghost" type="button" onClick={() => setActiveTab("tickets")}>
                  Cancelar
                </Btn>
                <Btn kind="action" type="submit" disabled={isSaving}>
                  {isSaving ? "A registar..." : "Abrir Ticket de Atendimento"}
                </Btn>
              </div>
            </form>
          </div>
        )}

        {/* ================= ABA 3: RECLAMAÇÕES & DEVOLUÇÕES ================= */}
        {activeTab === "reclamacoes" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                  Mediação de Reclamações, Trocas e Ajustes Financeiros
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Processos de garantia, inconformidade de produtos na Praça e pedidos de devolução encaminhados para a Administração.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {store.supportTickets
                  .filter(
                    (t) =>
                      t.category === "Reclamações de serviços" ||
                      t.category === "Reembolsos" ||
                      t.category === "Cancelamentos" ||
                      t.category === "Problemas com produtos"
                  )
                  .map((t) => (
                    <div key={t.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{t.id}</span>
                          <span className="rounded bg-red-100 text-red-800 text-[10px] font-black uppercase px-2 py-0.5">
                            {t.category}
                          </span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 text-[10px] font-bold px-2 py-0.5">
                            {t.status}
                          </span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-primary dark:text-white">{t.subject}</h4>
                        <p className="text-xs text-muted-foreground">
                          Cliente: <strong>{t.customerName}</strong> ({t.customerPhone})
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("tickets");
                            setActiveTicket(t);
                          }}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-primary dark:text-white hover:bg-slate-50"
                        >
                          Ver Histórico
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setForwardModal({
                              ticketId: t.id,
                              target: "ADMIN",
                              reason: `Parecer de apoio ao cliente favorável a reembolso ou ajuste financeiro referente à reclamação #${t.id}.`,
                            })
                          }
                          className="rounded-lg bg-purple-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-purple-700"
                        >
                          Remeter à Administração
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 4: BASE DE CONHECIMENTO & FAQS ================= */}
        {activeTab === "base" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-display text-lg font-bold text-primary dark:text-white">
                  Procedimentos Operacionais Padronizados (SOP) & Scripts Rápidos
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Guia de respostas rápidas para os operadores de apoio ao cliente da Resolve Express.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: "Prazos de Entrega no Huambo",
                    content: "Entregas expressas (água, gás, alimentação): 30 a 60 minutos. Produtos da Praça: até 3 horas úteis se o vendedor for local.",
                  },
                  {
                    title: "Política de Trocas da PRAÇA",
                    content: "O cliente dispõe de 48 horas após a entrega para reclamar avaria, defeito ou divergência de tamanho. O produto deve estar acompanhado da embalagem original.",
                  },
                  {
                    title: "Fluxo de Reembolso Financeiro",
                    content: "A equipa de Apoio valida o extrato e formula o parecer. O envio de fundos para o IBAN do cliente é executado exclusivamente pela Direção / Administração Executiva.",
                  },
                  {
                    title: "Garantia de Serviços Técnicos",
                    content: "Serviços de canalização, eletricidade e montagem têm garantia de reexecução técnica gratuita de 7 dias úteis se verificada desconformidade pela equipa de Operação.",
                  },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                    <h4 className="font-bold text-sm text-primary dark:text-white flex items-center gap-1.5">
                      <Icon name="CheckCircle" className="size-4 text-teal-600" />
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: ENCAMINHAMENTO ================= */}
      {forwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-base font-bold text-primary dark:text-white mb-1">
              Encaminhar Ticket #{forwardModal.ticketId}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Destino: <strong>{forwardModal.target === "OPERATIONS" ? "Operação e Produção (Logística / Técnicos)" : "Direção Executiva (Financeiro / Governança)"}</strong>
            </p>

            <Field label="Justificação do Encaminhamento *">
              <textarea
                rows={3}
                placeholder="Indique o motivo e a ação esperada da equipa de destino..."
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
              <Btn kind="action" onClick={handleExecuteForward} disabled={!forwardModal.reason.trim() || isSaving}>
                Confirmar Encaminhamento
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
