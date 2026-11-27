import { useState } from "react";
import { Icon, go, Btn, Section } from "../ui/kit";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "../lib/data";
import { useStore, formatCurrency } from "../lib/store";
import { useI18n } from "../lib/i18n";

export function Subscriptions() {
  const [store, setStore] = useStore();
  const { t } = useI18n();
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
      eyebrow={t("plans_eyebrow")}
      title={t("plans_title")}
    >
      <p className="max-w-2xl text-lg text-muted-foreground -mt-4 mb-10">
        {t("plans_subtitle")}
      </p>

      {successPlan && (
        <div className="mb-6 flex items-center justify-between rounded-[var(--radius)] bg-ok/15 p-4 text-ok border border-ok/30">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" className="size-5" />
            <span className="font-semibold text-sm">
              <strong>{successPlan}</strong> ✓
            </span>
          </div>
          <Btn kind="ghost" className="min-h-8 text-xs" onClick={() => go("/portal-cliente")}>
            {t("footer_client_portal")}
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
                      ? t("plans_free")
                      : formatCurrency(plan.priceAOA, store.currency)}
                  </span>
                  {plan.priceAOA > 0 && (
                    <span className="text-sm text-muted-foreground">/{plan.period}</span>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    {t("plans_includes")}
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
                  {isCurrent ? t("plans_current") : t("plans_subscribe")}
                </Btn>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 rounded-[var(--radius)] bg-mist p-6 text-sm text-muted-foreground">
        <h4 className="font-bold text-primary mb-1">{t("plans_b2b_title")}</h4>
        <p>
          {t("plans_b2b_desc")}{" "}
          <button
            type="button"
            onClick={() => go("/empresas")}
            className="font-bold text-primary underline"
          >
            {t("plans_b2b_cta")}
          </button>
          .
        </p>
      </div>
    </Section>
  );
}
