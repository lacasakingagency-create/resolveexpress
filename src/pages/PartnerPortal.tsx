import { useState } from "react";
import { Icon, go, Btn, Field, inputCls, Empty } from "../ui/kit";
import { useStore, formatCurrency, kz } from "../lib/store";
import { StatusPill } from "./Other";

export function PartnerPortal({ initialTab }: { initialTab?: any }) {
  const [store, setStore] = useStore();
  const [tab, setTab] = useState<"jobs" | "wallet" | "availability" | "reviews">(
    initialTab || "jobs"
  );

  // RBAC Access Control
  const isAuthorizedPro =
    store.currentUser &&
    (store.currentUser.role === "PROFESSIONAL" ||
      store.currentUser.role === "EMPLOYEE" ||
      store.currentUser.role === "ADMIN" ||
      store.currentUser.role === "SUPER_ADMIN") &&
    store.currentUser.active;

  if (!isAuthorizedPro) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xl">
          <Icon name="Hammer" className="size-8" />
        </div>
        <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-bold uppercase tracking-wider mb-2">
          Prestadores Autónomos
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-black text-primary">
          Portal do Profissional Independente
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Ambiente para técnicos e profissionais autónomos cadastrados no Huambo. Inicie sessão para gerir os seus trabalhos ou efetue o seu registo profissional.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Btn kind="ink" onClick={() => (window.location.hash = "/entrar/profissional")}>
            <Icon name="KeyRound" className="size-4" /> Aceder como Profissional
          </Btn>
          <Btn kind="ghost" onClick={() => (window.location.hash = "/cadastro/profissional")}>
            Registar Novo Profissional Independente
          </Btn>
        </div>
      </div>
    );
  }

  const [ibanInput, setIbanInput] = useState("AO06 0040 0000 1234 5678 9012 3");
  const [withdrawAmount, setWithdrawAmount] = useState(25000);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Available jobs for independent partners
  const partnerBookings = store.bookings.filter(
    (b) => b.provider === "INDEPENDENT_PARTNER" || b.assignedType === "PARTNER"
  );
  const unassignedPartnerJobs = store.bookings.filter(
    (b) => b.provider === "INDEPENDENT_PARTNER" && !b.assignedTo && b.status !== "Cancelado"
  );

  const handleAcceptJob = (bookingId: string) => {
    setStore((st) => ({
      bookings: st.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: "Confirmado",
              assignedTo: "Carlos Kaputo (Técnico Parceiro)",
              assignedType: "PARTNER",
              history: [
                ...b.history,
                { at: new Date().toISOString(), status: "Confirmado", note: "Aceite pelo Parceiro Carlos Kaputo" },
              ],
            }
          : b
      ),
    }));
  };

  const handleRejectJob = (bookingId: string) => {
    setStore((st) => ({
      bookings: st.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              history: [
                ...b.history,
                { at: new Date().toISOString(), status: b.status, note: "Recusado por um parceiro - aguarda redistribuição" },
              ],
            }
          : b
      ),
    }));
  };

  const handleRequestPayout = () => {
    if (withdrawAmount <= 0 || withdrawAmount > store.partnerWallet.balanceAOA) return;
    setStore((st) => ({
      partnerWallet: {
        ...st.partnerWallet,
        balanceAOA: st.partnerWallet.balanceAOA - withdrawAmount,
        pendingPayoutAOA: st.partnerWallet.pendingPayoutAOA + withdrawAmount,
        payoutHistory: [
          {
            date: new Date().toISOString().slice(0, 10),
            amountAOA: withdrawAmount,
            status: "Em processamento",
            iban: ibanInput,
          },
          ...st.partnerWallet.payoutHistory,
        ],
      },
    }));
    setWithdrawSuccess(true);
    setTimeout(() => setWithdrawSuccess(false), 4000);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 @3xl:px-8">
      {/* Partner Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-action text-xl font-black text-action-ink">
            CK
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-black text-primary">
                Portal do Profissional Parceiro
              </h1>
              <span className="rounded-full bg-ok/10 text-ok px-3 py-0.5 text-xs font-bold flex items-center gap-1">
                <Icon name="CheckCircle" className="size-3.5" /> Parceiro Verificado
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Carlos Kaputo · Técnico Canalizador & Eletricista · Huambo, Angola
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Saldo Disponível</span>
            <p className="font-display text-xl font-bold text-ok">
              {formatCurrency(store.partnerWallet.balanceAOA, store.currency)}
            </p>
          </div>
          <Btn kind="action" className="min-h-10" onClick={() => setTab("wallet")}>
            Levantar Saldo
          </Btn>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border pb-2">
        {[
          { id: "jobs", label: `Solicitações & Trabalhos (${partnerBookings.length})`, icon: "Briefcase" },
          { id: "wallet", label: "Ganhos & Comissões", icon: "Banknote" },
          { id: "availability", label: "Horários & Disponibilidade", icon: "Clock" },
          { id: "reviews", label: "Minhas Avaliações (4.9 ★)", icon: "Star" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-mist text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name={t.icon} className="size-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "jobs" && (
        <div className="space-y-6">
          {/* Opportunities available */}
          {unassignedPartnerJobs.length > 0 && (
            <div className="rounded-[var(--radius)] border-2 border-action/40 bg-action/5 p-5">
              <h3 className="font-display font-bold text-primary flex items-center gap-2 mb-3">
                <Icon name="Bell" className="size-4 text-action" />
                Novas Solicitações Disponíveis no Huambo
              </h3>
              <div className="space-y-3">
                {unassignedPartnerJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] border border-border bg-paper p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {job.id}
                        </span>
                        <span className="rounded-full bg-action/20 text-action-text px-2.5 py-0.5 text-xs font-bold">
                          Oportunidade
                        </span>
                      </div>
                      <p className="font-bold text-lg text-primary mt-1">
                        {job.service}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        📍 {job.address} · 📅 {job.date} às {job.slot}
                      </p>
                      <p className="text-xs italic bg-mist p-2 rounded mt-1.5">
                        "{job.details}"
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Btn
                        kind="ghost"
                        className="min-h-10 text-destructive"
                        onClick={() => handleRejectJob(job.id)}
                      >
                        Recusar
                      </Btn>
                      <Btn
                        kind="action"
                        className="min-h-10"
                        onClick={() => handleAcceptJob(job.id)}
                      >
                        Aceitar Trabalho
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Assigned Jobs */}
          <div>
            <h3 className="font-display text-lg font-bold text-primary mb-3">
              Trabalhos Atribuídos & Histórico
            </h3>
            {partnerBookings.length ? (
              <div className="space-y-3">
                {partnerBookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-[var(--radius)] border border-border bg-paper p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">
                          {b.id}
                        </span>
                        <StatusPill s={b.status} />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Cliente: <strong>{b.customer}</strong> (+244 {b.phone})
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-display font-bold text-lg">{b.service}</p>
                        <p className="text-sm text-muted-foreground">
                          {b.date} às {b.slot} · {b.address}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pagamento: {b.payment} ({b.paymentStatus})
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-muted-foreground block">
                          Valor Estimado:
                        </span>
                        <span className="font-display text-xl font-black text-primary">
                          {b.total ? formatCurrency(b.total, store.currency) : "Orçamento"}
                        </span>
                        {b.total && (
                          <span className="text-[11px] text-muted-foreground block">
                            (Comissão Resolve Express: {store.partnerWallet.commissionRate}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                icon="Briefcase"
                title="Sem trabalhos ativos"
                text="Quando clientes solicitarem serviços técnicos ou você aceitar pedidos, eles aparecerão aqui."
              />
            )}
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-3">
            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Saldo Disponível
              </span>
              <p className="mt-2 font-display text-3xl font-black text-ok">
                {formatCurrency(store.partnerWallet.balanceAOA, store.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pronto para levantamento</p>
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Levantamentos Pendentes
              </span>
              <p className="mt-2 font-display text-3xl font-black text-primary">
                {formatCurrency(store.partnerWallet.pendingPayoutAOA, store.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Em transferência bancária</p>
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Taxa de Comissão Fixa
              </span>
              <p className="mt-2 font-display text-3xl font-black text-primary">
                {store.partnerWallet.commissionRate}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Retido por cada serviço concluído</p>
            </div>
          </div>

          {/* Request Withdrawal Form */}
          <div className="rounded-[var(--radius)] border border-border bg-paper p-6">
            <h3 className="font-display text-xl font-bold text-primary mb-4">
              Solicitar Levantamento de Ganhos
            </h3>
            <div className="grid gap-4 @3xl:grid-cols-2">
              <Field label="Valor a levantar (Kz)">
                <input
                  type="number"
                  min={5000}
                  max={store.partnerWallet.balanceAOA}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="IBAN da sua Conta Bancária (Angola)">
                <input
                  value={ibanInput}
                  onChange={(e) => setIbanInput(e.target.value)}
                  className={inputCls}
                  placeholder="AO06 0000 0000 0000 0000 0000 0"
                />
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Btn
                kind="action"
                onClick={handleRequestPayout}
                disabled={withdrawAmount <= 0 || withdrawAmount > store.partnerWallet.balanceAOA}
              >
                Confirmar Pedido de Levantamento
              </Btn>
              {withdrawSuccess && (
                <span className="text-sm font-semibold text-ok flex items-center gap-1">
                  <Icon name="Check" className="size-4" /> Pedido enviado à administração com sucesso!
                </span>
              )}
            </div>
          </div>

          {/* Payout History */}
          <div className="rounded-[var(--radius)] border border-border bg-paper p-5">
            <h3 className="font-display font-bold text-primary mb-3">
              Histórico de Levantamentos
            </h3>
            <div className="space-y-2">
              {store.partnerWallet.payoutHistory.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border py-2 text-sm"
                >
                  <div>
                    <span className="font-bold">{kz(h.amountAOA)}</span>
                    <span className="text-muted-foreground block text-xs font-mono">{h.iban}</span>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-ok/10 text-ok px-2.5 py-0.5 text-xs font-bold">
                      {h.status}
                    </span>
                    <span className="text-xs text-muted-foreground block">{h.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "availability" && (
        <div className="space-y-4 max-w-xl">
          <h2 className="font-display text-2xl font-black text-primary">
            Horários de Atendimento no Huambo
          </h2>
          <div className="rounded-[var(--radius)] border border-border bg-paper p-5 space-y-3">
            {[
              "Segunda-feira (08:00 - 18:00)",
              "Terça-feira (08:00 - 18:00)",
              "Quarta-feira (08:00 - 18:00)",
              "Quinta-feira (08:00 - 18:00)",
              "Sexta-feira (08:00 - 18:00)",
              "Sábado (08:00 - 14:00)",
            ].map((day) => (
              <label key={day} className="flex items-center justify-between p-2 rounded hover:bg-mist cursor-pointer">
                <span className="text-sm font-semibold">{day}</span>
                <input type="checkbox" defaultChecked className="size-5 accent-[var(--color-primary)]" />
              </label>
            ))}
            <Btn kind="ink" className="mt-3">
              Guardar Disponibilidade
            </Btn>
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-4xl font-black text-amber-500">4.9</span>
            <div>
              <div className="text-amber-500 font-bold">★★★★★</div>
              <p className="text-xs text-muted-foreground">Classificação média baseada em 28 avaliações</p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {[
              { author: "Maria C.", date: "Há 2 dias", rating: 5, comment: "Excelente profissional! Chegou a horas e resolveu o problema de canalização rapidamente." },
              { author: "Paulo N.", date: "Há 1 semana", rating: 5, comment: "Muito educado e trabalho limpo. Recomendo vivamente a qualquer pessoa no Huambo." },
            ].map((r, i) => (
              <div key={i} className="rounded-[var(--radius)] border border-border bg-paper p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">{r.author}</span>
                  <span className="text-amber-500 font-bold">{"★".repeat(r.rating)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.date}</p>
                <p className="text-sm mt-2">"{r.comment}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
