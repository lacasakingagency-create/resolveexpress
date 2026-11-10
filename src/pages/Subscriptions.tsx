import { useState } from "react";
import { Icon, go, Btn, Section } from "../ui/kit";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "../lib/data";
import { useStore, formatCurrency } from "../lib/store";

export function Subscriptions() {
  const [store, setStore] = useStore();
  const [successPlan, setSuccessPlan] = useState<string | null>(null);

  const handleSubscribe = (plan: SubscriptionPlan) => {
    setStore(() => ({
      subscriptionPlan: plan.id,
    }));
    setSuccessPlan(plan.name);
    setTimeout(() => {
      setSuccessPlan(null);
    }, 4000);
  };

  return (
    <Section
      eyebrow="Assinaturas Resolve Express"
      title="Planos pensados para a sua casa, família ou empresa."
    >
      <p className="max-w-2xl text-lg text-muted-foreground -mt-4 mb-10">
        Pague mensalmente e desfrute de descontos contínuos, atendimento prioritário no Huambo e vantagens exclusivas em todos os 12 departamentos.
      </p>

      {successPlan && (
        <div className="mb-6 flex items-center justify-between rounded-[var(--radius)] bg-ok/15 p-4 text-ok border border-ok/30">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" className="size-5" />
            <span className="font-semibold text-sm">
              Plano <strong>{successPlan}</strong> ativado com sucesso para a sua conta!
            </span>
          </div>
          <Btn kind="ghost" className="min-h-8 text-xs" onClick={() => go("/portal-cliente")}>
            Ir ao Portal
          </Btn>
        </div>
      )}

      <div className="grid gap-6 @3xl:grid-cols-2 @5xl:grid-cols-4">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = store.subscriptionPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-[calc(var(--radius)*1.5)] border bg-paper p-6 transition shadow-xs ${
                plan.popular
                  ? "border-action ring-2 ring-action/20"
                  : "border-border hover:border-primary/40"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-action px-3 py-1 text-xs font-black uppercase text-action-ink shadow-xs">
                  {plan.badge}
                </span>
              )}

              <div>
                <h3 className="font-display text-2xl font-black text-primary">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground min-h-[40px]">
                  {plan.description}
                </p>

                <div className="my-6">
                  <span className="font-display text-3xl font-black text-primary">
                    {plan.priceAOA === 0
                      ? "Grátis"
                      : formatCurrency(plan.priceAOA, store.currency)}
                  </span>
                  {plan.priceAOA > 0 && (
                    <span className="text-sm text-muted-foreground">/{plan.period}</span>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Inclui:
                  </p>
                  <ul className="space-y-2.5 text-sm">
                    {plan.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <Icon name="Check" className="size-4 text-ok shrink-0 mt-0.5" />
                        <span className="leading-snug">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 border-t border-border pt-5">
                <Btn
                  kind={isCurrent ? "ghost" : plan.popular ? "action" : "ink"}
                  className="w-full"
                  disabled={isCurrent}
                  onClick={() => handleSubscribe(plan)}
                >
                  {isCurrent ? "Plano Atual" : "Subscrever Plano"}
                </Btn>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 rounded-[var(--radius)] bg-mist p-6 text-sm text-muted-foreground">
        <h4 className="font-bold text-primary mb-1">Dúvidas sobre assinaturas empresariais?</h4>
        <p>
          Para hospitais, colégios ou empresas com mais de 20 colaboradores em Huambo, desenvolvemos pacotes personalizados com SLA sob medida.{" "}
          <button
            type="button"
            onClick={() => go("/empresas")}
            className="font-bold text-primary underline"
          >
            Fale com a nossa equipa B2B
          </button>
          .
        </p>
      </div>
    </Section>
  );
}
