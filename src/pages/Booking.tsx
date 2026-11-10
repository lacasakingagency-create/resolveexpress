import { useState } from "react";
import { Icon, go, Btn, Field, inputCls, Empty, FilePick } from "../ui/kit";
import {
  PROVIDERS,
  LOCATIONS,
  ANGOLA_PROVINCES,
  SLOTS,
  PAYMENTS,
  findService,
  findCategory,
} from "../lib/data";
import { useStore, svcConfig, nextBookingId, kz, type BookingRecord } from "../lib/store";
import { AuthPromptModal } from "../ui/AuthPromptModal";
import { PaymentCheckoutModal } from "../ui/PaymentCheckoutModal";
import { syncBookingToSupabase } from "../lib/supabase";

const STEPS = ["Detalhes", "Local", "Data", "Pagamento", "Confirmar"];

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function Booking({ id }: { id: string }) {
  const [store, setStore] = useStore();
  const svc = findService(id);
  const [step, setStep] = useState(0);
  const [bookingProvince, setBookingProvince] = useState(store.currentUser?.province || "Huambo");
  const [bookingMunicipio, setBookingMunicipio] = useState(store.currentUser?.municipio || "Huambo");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [form, setForm] = useState<{
    qty: number;
    details: string;
    photos: string[];
    bairro: string;
    street: string;
    ref: string;
    date: string;
    slot: string;
    recurrence: string;
    payment: string;
    name: string;
    phone: string;
    accept: boolean;
  }>({
    qty: 1,
    details: "",
    photos: [],
    bairro: store.currentUser?.bairro || "",
    street: store.currentUser?.address || "",
    ref: store.currentUser?.reference || "",
    date: "",
    slot: "",
    recurrence: "none",
    payment: "",
    name: store.currentUser?.name || "",
    phone: store.currentUser?.phone || "",
    accept: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<BookingRecord | null>(null);

  const currentBookingMunicipalities =
    ANGOLA_PROVINCES.find((p) => p.name.toLowerCase() === bookingProvince.toLowerCase())
      ?.municipalities || ANGOLA_PROVINCES[0].municipalities;

  if (!svc) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Empty title="Serviço não encontrado">
          <Btn onClick={() => go("/servicos")}>Ver serviços</Btn>
        </Empty>
      </div>
    );
  }

  const cat = findCategory(svc.categoryId);
  if (!cat) return null;
  const cfg = svcConfig(store, svc);
  const loc = LOCATIONS.find((l) => l.id === (store.location || "huambo"));

  const set = (k: string) => (e: any) =>
    setForm({
      ...form,
      [k]: e?.target
        ? e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value
        : e,
    });

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; percent?: number; amount?: number } | null>(null);
  const [couponError, setCouponError] = useState("");

  const rawTotal = cfg.price ? cfg.price * Number(form.qty || 0) : null;

  // Plan discounts
  let planDiscountPercent = 0;
  if (store.subscriptionPlan === "family" && (svc.categoryId === "casa" || svc.categoryId === "lavandaria")) {
    planDiscountPercent = 10;
  } else if (store.subscriptionPlan === "premium") {
    planDiscountPercent = 15;
  }

  let total = rawTotal;
  if (total) {
    if (planDiscountPercent > 0) {
      total = Math.round(total * (1 - planDiscountPercent / 100));
    }
    if (appliedCoupon) {
      if (appliedCoupon.percent) {
        total = Math.round(total * (1 - appliedCoupon.percent / 100));
      } else if (appliedCoupon.amount) {
        total = Math.max(0, total - appliedCoupon.amount);
      }
    }
  }

  const handleApplyCoupon = () => {
    setCouponError("");
    const found = store.coupons.find(
      (c) => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.active
    );
    if (!found) {
      setCouponError("Cupom inválido ou expirado.");
      return;
    }
    setAppliedCoupon({
      code: found.code,
      percent: found.discountPercent,
      amount: found.discountAOA,
    });
  };

  const validate = (s: number) => {
    const err: Record<string, string> = {};
    if (s === 0) {
      if (!(Number(form.qty) >= 1 && Number(form.qty) <= 50))
        err.qty = "Indique uma quantidade entre 1 e 50.";
      if (form.details.trim().length < 10)
        err.details = "Descreva o que precisa (mínimo 10 caracteres).";
    }
    if (s === 1) {
      if (!loc?.active) err.bairro = "Esta localização ainda não é servida.";
      if (form.bairro.trim().length < 2) err.bairro = "Indique o bairro.";
      if (form.street.trim().length < 4)
        err.street = "Indique rua, número ou casa.";
    }
    if (s === 2) {
      if (!form.date || form.date < todayISO())
        err.date = "Escolha hoje ou uma data futura.";
      if (!form.slot) err.slot = "Escolha um horário.";
    }
    if (s === 3) {
      if (!form.payment) err.payment = "Escolha como vai pagar.";
    }
    if (s === 4) {
      if (form.name.trim().length < 3) err.name = "Indique o seu nome.";
      if (!/^9\d{8}$/.test(form.phone.replace(/\D/g, "").replace(/^244/, "")))
        err.phone = "Número angolano com 9 dígitos, ex.: 923 000 000.";
      if (!form.accept) err.accept = "Aceite os termos para continuar.";
    }
    setErrors(err);
    return !Object.keys(err).length;
  };

  const next = () => {
    if (!validate(step)) return;
    if (step === 3 && !store.currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setStep(step + 1);
  };

  const confirm = () => {
    if (!store.currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (![0, 1, 2, 3, 4].every((s) => validate(s))) return;
    const seq = store.seq + 1;
    const bid = nextBookingId(seq);
    const pay = PAYMENTS.find((p) => p.id === form.payment);
    const fullAddress = `${form.street}, ${form.bairro}, ${bookingMunicipio}, ${bookingProvince}`;
    const item: BookingRecord = {
      id: bid,
      serviceId: svc.id,
      service: svc.name,
      category: cat.name,
      provider: cfg.provider,
      qty: Number(form.qty),
      unit: svc.unit,
      details: form.details,
      photos: form.photos,
      address: fullAddress,
      ref: form.ref,
      date: form.date,
      slot: form.slot,
      recurrence: form.recurrence,
      payment: pay?.name || "Dinheiro",
      total,
      status: "Recebido",
      paymentStatus:
        form.payment === "cash"
          ? "A pagar no domicílio"
          : "Aguardando confirmação de pagamento",
      customer: form.name || store.currentUser.name,
      phone: form.phone || store.currentUser.phone,
      createdAt: new Date().toISOString(),
      history: [{ at: new Date().toISOString(), status: "Recebido" }],
    };
    setStore((st) => ({ seq, bookings: [item, ...st.bookings] }));
    setDone(item);
    syncBookingToSupabase(item);
    if (total && total > 0 && form.payment !== "cash") {
      setPaymentModalOpen(true);
    }
  };

  const handleBookingPaymentSuccess = (paymentResult: {
    method: string;
    status: string;
    reference?: string;
    proofOfPayment?: string;
    paymentDetails: Record<string, any>;
  }) => {
    if (!done) return;
    const updated: BookingRecord = {
      ...done,
      payment: paymentResult.method,
      paymentStatus: paymentResult.status,
      paymentReference: paymentResult.reference,
      proofOfPayment: paymentResult.proofOfPayment,
      paymentDetails: paymentResult.paymentDetails,
    };
    setStore((st) => ({
      bookings: st.bookings.map((b) => (b.id === done.id ? updated : b)),
    }));
    setDone(updated);
    syncBookingToSupabase(updated);
    setPaymentModalOpen(false);
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center">
        <div className="stamp grid size-20 place-items-center rounded-full bg-ok text-white">
          <Icon name="Check" className="size-10" />
        </div>
        <h1 className="font-display text-3xl font-black text-primary">
          PEDIDO REGISTADO COM SUCESSO
        </h1>
        <div className="ticket w-full rounded-[var(--radius)] bg-paper p-6 text-left shadow-lg ring-1 ring-border">
          <div className="flex justify-between items-start">
            <p className="font-mono text-2xl font-bold text-primary">{done.id}</p>
            <span
              className={
                "px-2.5 py-1 rounded-full text-xs font-bold " +
                (done.paymentStatus === "Pago"
                  ? "bg-ok/15 text-ok"
                  : "bg-warn/20 text-warn")
              }
            >
              {done.paymentStatus}
            </span>
          </div>

          <div className="my-4 border-t-2 border-dashed border-border" />
          <p className="font-display text-lg font-bold text-primary">{done.service}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            📅 {done.date} às {done.slot} · 📍 {done.address}
          </p>
          {done.total && (
            <p className="font-display font-black text-xl text-action mt-2">
              Total: {kz(done.total)}
            </p>
          )}

          <div className="mt-4 rounded-[var(--radius)] bg-mist p-3 text-xs space-y-1">
            <p>💳 <strong>Método:</strong> {done.payment}</p>
            {done.paymentReference && (
              <p>🔖 <strong>Referência:</strong> <span className="font-mono font-bold text-primary">{done.paymentReference}</span></p>
            )}
          </div>
        </div>

        {done.total && done.paymentStatus !== "Pago" && (
          <Btn
            kind="action"
            className="w-full min-h-12 shadow-md"
            onClick={() => setPaymentModalOpen(true)}
          >
            <Icon name="CreditCard" className="size-5" /> Abrir Checkout / Pagar Agora ({kz(done.total)})
          </Btn>
        )}

        <p className="text-muted-foreground text-xs">
          A equipa confirma a disponibilidade e os detalhes consigo através do número {done.phone}.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Btn kind="ink" onClick={() => go("/pedidos")}>
            Acompanhar nos Meus Pedidos
          </Btn>
          <Btn kind="ghost" onClick={() => go("/")}>
            Voltar ao início
          </Btn>
        </div>

        <PaymentCheckoutModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title={`Pagamento de Serviço: ${done.service}`}
          itemType="booking"
          itemId={done.id}
          totalAOA={done.total || 0}
          customerName={done.customer}
          customerPhone={done.phone}
          deliveryAddress={done.address}
          onPaymentSuccess={handleBookingPaymentSuccess}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 @3xl:px-8 @5xl:grid-cols-[1fr_340px] @5xl:py-12">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => go(`/servicos/${cat.id}`)}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <Icon name="ArrowLeft" className="size-4" /> {cat.name}
        </button>

        {/* Imagem do Serviço */}
        <div className="relative mb-6 h-52 @3xl:h-64 w-full overflow-hidden rounded-[var(--radius)] border border-border shadow-xs">
          <img
            src={(svc.image?.trim() || cat.image?.trim()) || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
            alt={svc.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-xs text-white">
              {cat.name} · Huambo
            </span>
            <span className="rounded-full bg-action px-3 py-1 text-xs font-bold text-action-ink shadow-xs">
              Serviço Verificado
            </span>
          </div>
        </div>

        <h1 className="font-display text-3xl font-black tracking-tight text-primary @3xl:text-4xl">
          {svc.name}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{svc.description}</p>

        {cfg.available ? (
          <>
            <div className="mt-6 grid gap-4 @3xl:grid-cols-2">
              <div className="rounded-[var(--radius)] bg-paper p-4 ring-1 ring-border">
                <p className="mb-2 text-sm font-bold text-ok">Incluído</p>
                {svc.includes.map((x) => (
                  <p key={x} className="flex gap-2 text-sm">
                    <Icon name="Check" className="size-4 shrink-0 text-ok" />
                    {x}
                  </p>
                ))}
              </div>
              <div className="rounded-[var(--radius)] bg-paper p-4 ring-1 ring-border">
                <p className="mb-2 text-sm font-bold text-destructive">
                  Não incluído
                </p>
                {svc.excludes.map((x) => (
                  <p key={x} className="flex gap-2 text-sm">
                    <Icon
                      name="Minus"
                      className="size-4 shrink-0 text-destructive"
                    />
                    {x}
                  </p>
                ))}
              </div>
            </div>

            {/* Aviso Obrigatório para Clientes Não Autenticados */}
            {!store.currentUser && (
              <div className="mt-6 rounded-2xl border-2 border-action/40 bg-action/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-action text-white shrink-0">
                    <Icon name="UserCheck" className="size-5" />
                  </span>
                  <div>
                    <p className="font-display font-bold text-sm text-primary">
                      Atenção: É necessário criar conta de cliente para solicitar este serviço
                    </p>
                    <p className="text-xs text-muted-foreground">
                      O seu pedido fica protegido, registrado e associado ao seu histórico no Portal do Cliente.
                    </p>
                  </div>
                </div>
                <Btn
                  kind="action"
                  className="text-xs min-h-9 px-4 whitespace-nowrap self-end sm:self-auto cursor-pointer"
                  onClick={() => setAuthModalOpen(true)}
                >
                  Criar Conta de Cliente Grátis
                </Btn>
              </div>
            )}

            <ol className="mt-8 flex gap-1 overflow-x-auto">
              {STEPS.map((label, idx) => (
                <li key={label} className="min-w-20 flex-1">
                  <div
                    className={
                      "h-1.5 rounded-full transition " +
                      (idx <= step ? "bg-action" : "bg-mist")
                    }
                  />
                  <span
                    className={
                      "mt-2 block text-sm " +
                      (idx === step
                        ? "font-bold text-primary"
                        : "text-muted-foreground")
                    }
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>

            <div key={step} className="step-in mt-6 flex flex-col gap-5">
              {step === 0 && (
                <>
                  <Field label={`Quantidade (${svc.unit})`} error={errors.qty}>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={form.qty}
                      onChange={set("qty")}
                      className={inputCls + " w-32"}
                    />
                  </Field>
                  <Field
                    label="O que precisa?"
                    error={errors.details}
                    hint="Quanto mais detalhe, mais rápido confirmamos."
                  >
                    <textarea
                      rows={4}
                      value={form.details}
                      onChange={set("details")}
                      className={inputCls + " py-3"}
                      placeholder="Ex.: Casa T3, 2 casas de banho, cozinha com muita gordura."
                    />
                  </Field>
                  <Field
                    label="Fotografias (opcional)"
                    hint="Ajudam a orçamentar. Máx. 4."
                  >
                    <FilePick
                      label="Escolher fotografias"
                      multiple
                      accept="image/*"
                      files={form.photos}
                      onFiles={(f) => setForm({ ...form, photos: f.slice(0, 4) })}
                    />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Província (Angola)">
                      <select
                        value={bookingProvince}
                        onChange={(e) => {
                          const newProv = e.target.value;
                          setBookingProvince(newProv);
                          const munList = ANGOLA_PROVINCES.find(
                            (p) => p.name.toLowerCase() === newProv.toLowerCase()
                          )?.municipalities;
                          if (munList && munList.length > 0) {
                            setBookingMunicipio(munList[0]);
                          }
                        }}
                        className={inputCls}
                      >
                        {ANGOLA_PROVINCES.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Município">
                      <select
                        value={bookingMunicipio}
                        onChange={(e) => setBookingMunicipio(e.target.value)}
                        className={inputCls}
                      >
                        {currentBookingMunicipalities.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Bairro" error={errors.bairro}>
                    <input
                      value={form.bairro}
                      onChange={set("bairro")}
                      className={inputCls}
                      placeholder="Ex.: Cidade Alta, São João, Maianga..."
                    />
                  </Field>
                  <Field label="Rua, número ou casa" error={errors.street}>
                    <input
                      value={form.street}
                      onChange={set("street")}
                      className={inputCls}
                      placeholder="Ex.: Rua Direita do Comércio nº 12"
                    />
                  </Field>
                  <Field label="Ponto de referência (opcional)">
                    <input
                      value={form.ref}
                      onChange={set("ref")}
                      className={inputCls}
                      placeholder="Ex.: ao lado da escola, defronte à farmácia"
                    />
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Data" error={errors.date}>
                    <input
                      type="date"
                      min={todayISO()}
                      value={form.date}
                      onChange={set("date")}
                      className={inputCls + " w-56"}
                    />
                  </Field>
                  <Field label="Horário" error={errors.slot}>
                    <div className="grid grid-cols-3 gap-2 @md:grid-cols-6">
                      {SLOTS.map((sl) => {
                        const past =
                          form.date === todayISO() &&
                          Number(sl.slice(0, 2)) <= new Date().getHours();
                        return (
                          <button
                            key={sl}
                            type="button"
                            disabled={past}
                            onClick={() => setForm({ ...form, slot: sl })}
                            className={
                              "min-h-12 rounded-[var(--radius)] border font-semibold transition disabled:opacity-40 " +
                              (form.slot === sl
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-paper hover:border-primary")
                            }
                          >
                            {sl}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Repetir">
                    <div className="flex flex-wrap gap-2">
                      {[
                        ["none", "Só uma vez"],
                        ["daily", "Diário"],
                        ["weekly", "Semanal"],
                        ["biweekly", "Quinzenal"],
                        ["monthly", "Mensal"],
                      ].map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setForm({ ...form, recurrence: k })}
                          className={
                            "min-h-10 rounded-full border px-4 text-sm font-semibold " +
                            (form.recurrence === k
                              ? "border-action bg-action text-action-ink"
                              : "border-border bg-paper")
                          }
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {step === 3 && (
                <Field label="Como prefere pagar?" error={errors.payment}>
                  <div className="flex flex-col gap-2.5">
                    {PAYMENTS.map((p) => {
                      const isSelected = form.payment === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setForm({ ...form, payment: p.id })}
                          className={
                            "flex items-center gap-3.5 rounded-[var(--radius)] border p-4 text-left transition cursor-pointer " +
                            (isSelected
                              ? "border-action bg-action/5 ring-2 ring-action/20"
                              : "border-border bg-paper hover:border-action/40")
                          }
                        >
                          <span
                            className={
                              "grid size-10 place-items-center rounded-xl shrink-0 " +
                              (isSelected
                                ? "bg-action text-white"
                                : "bg-mist text-primary")
                            }
                          >
                            <Icon name={p.icon} className="size-5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-sm text-primary">
                                {p.name}
                              </span>
                              {p.badge && (
                                <span className="rounded-full bg-mist text-[10px] font-bold text-primary px-2 py-0.2">
                                  {p.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground block mt-0.5 line-clamp-1">
                              {p.note}
                            </span>
                          </div>
                          <span
                            className={
                              "size-5 shrink-0 rounded-full border-2 grid place-items-center " +
                              (isSelected
                                ? "border-action bg-action text-white"
                                : "border-neutral-300")
                            }
                          >
                            {isSelected && <Icon name="Check" className="size-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              {step === 4 && (
                <>
                  <Field label="Nome" error={errors.name}>
                    <input
                      value={form.name}
                      onChange={set("name")}
                      className={inputCls}
                      autoComplete="name"
                    />
                  </Field>
                  <Field label="Telefone" error={errors.phone}>
                    <div className="flex">
                      <span className="grid place-items-center rounded-l-[var(--radius)] border border-r-0 border-border bg-mist px-3 text-sm font-semibold">
                        +244
                      </span>
                      <input
                        inputMode="tel"
                        value={form.phone}
                        onChange={set("phone")}
                        className={inputCls + " rounded-l-none"}
                        placeholder="923 000 000"
                      />
                    </div>
                  </Field>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.accept}
                      onChange={set("accept")}
                      className="mt-1 size-5 accent-[var(--color-primary)]"
                    />
                    <span>
                      Li e aceito os{" "}
                      <button
                        type="button"
                        className="font-semibold text-primary underline"
                        onClick={() => go("/legal/termos")}
                      >
                        termos
                      </button>{" "}
                      e a{" "}
                      <button
                        type="button"
                        className="font-semibold text-primary underline"
                        onClick={() => go("/legal/cancelamento")}
                      >
                        política de cancelamento
                      </button>
                      .
                    </span>
                  </label>
                  {errors.accept && (
                    <span className="text-sm text-destructive">
                      {errors.accept}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="mt-8 mr-20 flex gap-3 @3xl:mr-0">
              {step > 0 && (
                <Btn
                  kind="ghost"
                  onClick={() => {
                    setErrors({});
                    setStep(step - 1);
                  }}
                >
                  Voltar
                </Btn>
              )}
              {step < 4 ? (
                <Btn onClick={next}>
                  Continuar <Icon name="ArrowRight" className="size-4" />
                </Btn>
              ) : (
                <Btn onClick={confirm}>Confirmar pedido</Btn>
              )}
            </div>
          </>
        ) : (
          <div className="mt-8">
            <Empty
              icon="CalendarX"
              title="Serviço indisponível de momento"
              text="Não aceitamos pedidos para este serviço agora. Fale connosco pelo WhatsApp."
            />
          </div>
        )}
      </div>

      <aside className="h-fit @5xl:sticky @5xl:top-28">
        <div className="ticket rounded-[var(--radius)] bg-paper p-5 shadow-[0_16px_40px_oklch(0.2_0.06_258/0.12)] ring-1 ring-border">
          <div className="flex justify-between font-mono text-sm text-muted-foreground">
            <span>RESUMO</span>
            <span>{nextBookingId(store.seq + 1)}</span>
          </div>
          <div className="my-4 border-t-2 border-dashed border-border" />
          {svc.image && (
            <div className="mb-3 h-20 w-full overflow-hidden rounded-[var(--radius)] border border-border shadow-xs">
              <img
                src={svc.image?.trim() || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"}
                alt={svc.name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Serviço</dt>
            <dd className="text-right font-semibold">{svc.name}</dd>
            <dt className="text-muted-foreground">Quant.</dt>
            <dd className="text-right font-semibold">
              {form.qty} {svc.unit}
            </dd>
            <dt className="text-muted-foreground">Local</dt>
            <dd className="text-right font-semibold">{form.bairro || "·"}</dd>
            <dt className="text-muted-foreground">Quando</dt>
            <dd className="text-right font-semibold">
              {form.date ? `${form.date} ${form.slot}` : "·"}
            </dd>
            <dt className="text-muted-foreground">Por</dt>
            <dd className="text-right font-semibold">
              {PROVIDERS[cfg.provider]}
            </dd>
          </dl>
          {/* Coupon and Discounts */}
          <div className="my-3 border-t border-border pt-3">
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-xs bg-ok/10 text-ok p-2 rounded">
                <span>Cupom <strong>{appliedCoupon.code}</strong> aplicado</span>
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  className="font-bold underline text-destructive hover:opacity-80"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Cupom (ex: BEMVINDO10)"
                  className={inputCls + " min-h-8 py-1 px-2.5 text-xs flex-1"}
                />
                <Btn
                  kind="ink"
                  className="min-h-8 px-2.5 text-xs whitespace-nowrap"
                  onClick={handleApplyCoupon}
                >
                  Aplicar
                </Btn>
              </div>
            )}
            {couponError && (
              <span className="text-[11px] text-destructive block mt-1">{couponError}</span>
            )}
            {planDiscountPercent > 0 && (
              <span className="text-[11px] text-action font-semibold block mt-1">
                ⭐ {planDiscountPercent}% de desconto do Plano {store.subscriptionPlan.toUpperCase()} aplicado
              </span>
            )}
          </div>

          <div className="my-4 border-t-2 border-dashed border-border" />
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted-foreground">
              {total ? "Estimativa" : "Preço"}
            </span>
            <div className="text-right">
              {rawTotal && total && rawTotal !== total && (
                <span className="text-xs line-through text-muted-foreground block">
                  {kz(rawTotal)}
                </span>
              )}
              <span className="font-display text-2xl font-black text-primary">
                {total ? kz(total) : "Orçamento"}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Nada é cobrado agora. Pagamento só após confirmação.
          </p>
        </div>
      </aside>

      {/* Modal de Aviso Obrigatório para Criar Conta / Iniciar Sessão */}
      <AuthPromptModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        actionType="service"
        itemName={svc.name}
      />
    </div>
  );
}
