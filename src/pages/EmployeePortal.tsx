import { useState } from "react";
import { Icon, Btn, Field, inputCls, Empty } from "../ui/kit";
import { useStore } from "../lib/store";
import { StatusPill } from "./Other";

export function EmployeePortal({
  initialTab,
}: {
  initialTab?: "agenda" | "history" | "supervision";
}) {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState<"agenda" | "history" | "supervision">(
    initialTab || "agenda"
  );

  // RBAC Access Control
  const isAuthorizedEmployee =
    store.currentUser &&
    (store.currentUser.role === "EMPLOYEE" ||
      store.currentUser.role === "ADMIN" ||
      store.currentUser.role === "SUPER_ADMIN") &&
    store.currentUser.active;

  if (!isAuthorizedEmployee) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-blue-100 text-blue-700 shadow-xl">
          <Icon name="HardHat" className="size-8" />
        </div>
        <span className="inline-block rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-bold uppercase tracking-wider mb-2">
          Acesso Operacional
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-black text-primary">
          Portal do Funcionário
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Este ambiente é reservado aos colaboradores da equipa própria da RESOLVE EXPRESS. Ative o seu convite institucional ou inicie sessão.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Btn kind="ink" onClick={() => (window.location.hash = "/entrar/funcionario")}>
            <Icon name="KeyRound" className="size-4" /> Iniciar Sessão de Funcionário
          </Btn>
          <Btn kind="ghost" onClick={() => (window.location.hash = "/ambientes")}>
            Ver Todos os Ambientes
          </Btn>
        </div>
      </div>
    );
  }

  const [incidentModal, setIncidentModal] = useState<string | null>(null);
  const [incidentText, setIncidentText] = useState("");
  const [incidentSuccess, setIncidentSuccess] = useState(false);

  // Current logged in internal employee
  const employee =
    store.employees.find((e) => e.email === store.currentUser?.email) ||
    store.employees[0] || {
      id: store.currentUser?.id || "emp-1",
      name: store.currentUser?.name || "Manuel Chipindo",
      role: "Especialista Operacional",
      city: "Huambo",
      phone: store.currentUser?.phone || "923456789",
    };

  // Internal company bookings assigned to internal employees
  const assignedTasks = store.bookings.filter(
    (b) =>
      b.provider === "COMPANY_OWNED" ||
      b.assignedTo?.includes(employee.name) ||
      !b.assignedTo
  );

  const updateTaskStatus = (
    bookingId: string,
    newStatus: "Confirmado" | "Em curso" | "Concluído",
    note: string
  ) => {
    setStore((st) => ({
      bookings: st.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: newStatus,
              assignedTo: `${employee.name} (Equipa Resolve)`,
              assignedType: "EMPLOYEE",
              history: [
                ...b.history,
                {
                  at: new Date().toISOString(),
                  status: newStatus,
                  note: `${employee.name}: ${note}`,
                },
              ],
            }
          : b
      ),
    }));
  };

  const handleRegisterIncident = () => {
    if (!incidentModal || !incidentText.trim()) return;
    setStore((st) => ({
      bookings: st.bookings.map((b) =>
        b.id === incidentModal
          ? {
              ...b,
              history: [
                ...b.history,
                {
                  at: new Date().toISOString(),
                  status: b.status,
                  note: `⚠️ Ocorrência registada por ${employee.name}: ${incidentText.trim()}`,
                },
              ],
            }
          : b
      ),
    }));
    setIncidentSuccess(true);
    setTimeout(() => {
      setIncidentSuccess(false);
      setIncidentModal(null);
      setIncidentText("");
    }, 1500);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 @3xl:px-8">
      {/* Employee Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[calc(var(--radius)*1.5)] border border-border bg-ink p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-action text-xl font-black text-action-ink">
            JB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-black text-white">
                Portal do Funcionário Próprio
              </h1>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                Equipa Interna
              </span>
            </div>
            <p className="text-sm text-white/75 mt-0.5">
              {employee.name} · {employee.role} · Delegação Huambo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-[var(--radius)] bg-white/10 px-4 py-2 text-right">
            <span className="text-[11px] text-white/70 block uppercase">
              Tarefas Atribuídas
            </span>
            <span className="font-display text-xl font-black text-action">
              {assignedTasks.filter((t) => t.status !== "Concluído").length} Pendentes
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mb-6 flex gap-2 border-b border-border pb-2">
        {[
          { id: "agenda", label: "Agenda & Tarefas de Hoje", icon: "Calendar" },
          { id: "history", label: "Histórico de Execuções", icon: "CheckCircle" },
          { id: "supervision", label: "Contacto com Supervisão", icon: "Headset" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-mist text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name={t.icon} className="size-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "agenda" && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-primary">
            Serviços Designados para Execução
          </h2>
          <p className="text-sm text-muted-foreground">
            Apenas informações operacionais estritamente necessárias para o serviço no terreno são apresentadas.
          </p>

          {assignedTasks.length ? (
            assignedTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-[var(--radius)] border border-border bg-paper p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary">
                      {task.id}
                    </span>
                    <StatusPill s={task.status} />
                  </div>
                  <span className="text-xs font-semibold text-action">
                    ⏰ Horário marcado: {task.date} às {task.slot}
                  </span>
                </div>

                <div className="mt-3 grid gap-4 @3xl:grid-cols-[1.5fr_1fr]">
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      {task.service} ({task.qty} {task.unit})
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">
                        📍 Local: {task.address}
                      </p>
                      {task.ref && <p>Ponto de referência: {task.ref}</p>}
                      <p>
                        👤 Cliente: {task.customer} · Contacto:{" "}
                        <a
                          href={`tel:+244${task.phone}`}
                          className="font-bold text-primary underline"
                        >
                          +244 {task.phone}
                        </a>
                      </p>
                    </div>

                    <div className="mt-3 rounded-[var(--radius)] bg-mist p-3 text-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                        Instruções do Cliente:
                      </span>
                      "{task.details}"
                    </div>
                  </div>

                  {/* Operational workflow buttons */}
                  <div className="flex flex-col justify-center gap-2 border-t border-border pt-4 @3xl:border-t-0 @3xl:border-l @3xl:pl-5 @3xl:pt-0">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Ações Operacionais de Campo:
                    </span>

                    {task.status === "Recebido" && (
                      <Btn
                        kind="ink"
                        className="min-h-10 text-xs"
                        onClick={() =>
                          updateTaskStatus(
                            task.id,
                            "Confirmado",
                            "Chegada ao local confirmada pelo funcionário"
                          )
                        }
                      >
                        <Icon name="MapPin" className="size-4" /> Confirmar Chegada ao Local
                      </Btn>
                    )}

                    {task.status === "Confirmado" && (
                      <Btn
                        kind="action"
                        className="min-h-10 text-xs"
                        onClick={() =>
                          updateTaskStatus(
                            task.id,
                            "Em curso",
                            "Início do trabalho prático no domicílio"
                          )
                        }
                      >
                        <Icon name="Play" className="size-4" /> Iniciar Serviço
                      </Btn>
                    )}

                    {task.status === "Em curso" && (
                      <Btn
                        kind="action"
                        className="min-h-10 text-xs bg-ok text-white hover:bg-ok/90"
                        onClick={() =>
                          updateTaskStatus(
                            task.id,
                            "Concluído",
                            "Serviço inspecionado e finalizado com sucesso"
                          )
                        }
                      >
                        <Icon name="CheckCircle" className="size-4" /> Finalizar Serviço
                      </Btn>
                    )}

                    <Btn
                      kind="ghost"
                      className="min-h-9 text-xs text-warn hover:bg-warn/10"
                      onClick={() => setIncidentModal(task.id)}
                    >
                      <Icon name="AlertTriangle" className="size-4" /> Registar Ocorrência
                    </Btn>
                  </div>
                </div>

                {/* Timeline status log */}
                <div className="mt-4 border-t border-border pt-3">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Registo operacional:{" "}
                    {task.history
                      .map((h) => `${h.status}${h.note ? ` (${h.note})` : ""}`)
                      .join("  ›  ")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <Empty
              icon="CalendarCheck"
              title="Sem tarefas agendadas"
              text="Você não tem nenhum serviço pendente atribuído pela supervisão no Huambo."
            />
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">
            Histórico de Conclusões
          </h2>
          {store.bookings
            .filter((b) => b.status === "Concluído")
            .map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-paper p-4 text-sm"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-primary">
                    {b.id}
                  </span>
                  <p className="font-bold">{b.service}</p>
                  <p className="text-xs text-muted-foreground">{b.address}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-ok/10 text-ok px-2.5 py-0.5 text-xs font-bold">
                    Concluído com Sucesso
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1">
                    {b.date}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {activeTab === "supervision" && (
        <div className="space-y-4 max-w-xl">
          <h2 className="font-display text-xl font-bold text-primary">
            Supervisão Operacional Huambo
          </h2>
          <div className="rounded-[var(--radius)] border border-border bg-paper p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Em caso de acidentes, impossibilidade de acesso ao domicílio, falta de água ou eletricidade, contacte o supervisor de turno imediatamente.
            </p>
            <div className="space-y-2 text-sm font-semibold">
              <div className="flex items-center justify-between p-3 rounded bg-mist">
                <span>Supervisor de Campo (Huambo Central):</span>
                <a href="tel:+244923999111" className="text-primary underline">
                  +244 923 999 111
                </a>
              </div>
              <div className="flex items-center justify-between p-3 rounded bg-mist">
                <span>Logística & Armazém de Produtos:</span>
                <a href="tel:+244923999222" className="text-primary underline">
                  +244 923 999 222
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incident Modal */}
      {incidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-paper p-6 shadow-xl">
            <h3 className="font-display text-xl font-bold text-primary">
              Registar Ocorrência de Campo
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Pedido {incidentModal}. O relatório será anexado à ficha do pedido e notificado ao supervisor.
            </p>

            <div className="my-4">
              <Field label="Descrição da Ocorrência">
                <textarea
                  rows={3}
                  value={incidentText}
                  onChange={(e) => setIncidentText(e.target.value)}
                  placeholder="Ex: Cliente ausente na morada, cão solto no quintal, falta de ponto de água..."
                  className={inputCls + " py-2"}
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Btn kind="ghost" onClick={() => setIncidentModal(null)}>
                Cancelar
              </Btn>
              <Btn
                kind="action"
                onClick={handleRegisterIncident}
                disabled={!incidentText.trim()}
              >
                {incidentSuccess ? "Gravado!" : "Gravar Ocorrência"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
