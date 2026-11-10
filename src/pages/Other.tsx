import { useState } from "react";
import {
  Icon,
  go,
  Btn,
  Field,
  inputCls,
  Section,
  Empty,
  FilePick,
} from "../ui/kit";
import { CATEGORIES, LEGAL_DOCS } from "../lib/data";
import { useStore, kz } from "../lib/store";
import { PaymentCheckoutModal } from "../ui/PaymentCheckoutModal";

const STATUS_CLS: Record<string, string> = {
  Recebido: "bg-mist text-primary",
  Confirmado: "bg-primary text-primary-foreground",
  "Em curso": "bg-action text-action-ink",
  Concluído: "bg-ok text-white",
  Cancelado: "bg-destructive/15 text-destructive",
};

export const StatusPill = ({ s }: { s: string }) => (
  <span
    className={
      "rounded-full px-3 py-1 text-sm font-semibold " +
      (STATUS_CLS[s] || "bg-mist")
    }
  >
    {s}
  </span>
);

export function Orders() {
  const [store, setStore] = useStore();
  const [payBooking, setPayBooking] = useState<any | null>(null);

  const cancel = (id: string) =>
    setStore((st) => ({
      bookings: st.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              status: "Cancelado",
              history: [
                ...b.history,
                { at: new Date().toISOString(), status: "Cancelado" },
              ],
            }
          : b
      ),
    }));

  return (
    <Section
      eyebrow="Os meus pedidos"
      title="Acompanhe cada pedido, do início ao fim."
    >
      {store.bookings.length ? (
        <div className="flex flex-col gap-3">
          {store.bookings.map((b) => (
            <div
              key={b.id}
              className="grid gap-4 rounded-[var(--radius)] border border-border bg-paper p-5 @3xl:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm font-bold text-primary">
                    {b.id}
                  </span>
                  <StatusPill s={b.status} />
                </div>
                <p className="mt-2 font-display text-lg font-bold">
                  {b.service}
                </p>
                <p className="text-sm text-muted-foreground">
                  {b.date} às {b.slot} · {b.address}
                </p>
                <p className="mt-2 text-sm">
                  {b.payment} ·{" "}
                  <span
                    className={
                      "font-semibold " +
                      (b.paymentStatus === "Pago" ? "text-ok" : "text-warn")
                    }
                  >
                    {b.paymentStatus}
                  </span>
                  {b.total ? ` · ${kz(b.total)}` : " · Orçamento"}
                </p>
                {b.paymentReference && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ref: <span className="font-mono font-bold text-primary">{b.paymentReference}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 self-start">
                {b.paymentStatus !== "Pago" && b.total && b.status !== "Cancelado" && (
                  <Btn
                    kind="action"
                    className="h-fit text-xs px-3 shadow-xs"
                    onClick={() => setPayBooking(b)}
                  >
                    <Icon name="CreditCard" className="size-3.5" /> Pagar Agora
                  </Btn>
                )}
                {!["Cancelado", "Concluído", "Em curso"].includes(b.status) && (
                  <Btn
                    kind="ghost"
                    className="h-fit text-xs"
                    onClick={() => cancel(b.id)}
                  >
                    Cancelar
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon="ClipboardList"
          title="Ainda não fez nenhum pedido"
          text="Quando pedir um serviço, ele aparece aqui com número e estado."
        >
          <Btn onClick={() => go("/servicos")}>Encontrar serviço</Btn>
        </Empty>
      )}

      {payBooking && (
        <PaymentCheckoutModal
          open={Boolean(payBooking)}
          onClose={() => setPayBooking(null)}
          title={`Pagamento de Serviço: ${payBooking.service}`}
          itemType="booking"
          itemId={payBooking.id}
          totalAOA={payBooking.total || 0}
          customerName={payBooking.customer}
          customerPhone={payBooking.phone}
          deliveryAddress={payBooking.address}
          onPaymentSuccess={(paymentResult) => {
            setStore((st) => ({
              bookings: st.bookings.map((b) =>
                b.id === payBooking.id
                  ? {
                      ...b,
                      payment: paymentResult.method,
                      paymentStatus: paymentResult.status,
                      paymentReference: paymentResult.reference,
                      proofOfPayment: paymentResult.proofOfPayment,
                      paymentDetails: paymentResult.paymentDetails,
                    }
                  : b
              ),
            }));
            setPayBooking(null);
          }}
        />
      )}
    </Section>
  );
}

export function Partner() {
  const [, setStore] = useStore();
  const [form, setForm] = useState<{
    name: string;
    phone: string;
    email: string;
    city: string;
    skills: string[];
    exp: string;
    refs: string;
    id: string;
    photo: string;
    certs: string[];
  }>({
    name: "",
    phone: "",
    email: "",
    city: "Huambo",
    skills: [],
    exp: "",
    refs: "",
    id: "",
    photo: "",
    certs: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const set = (k: string) => (e: any) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = () => {
    const err: Record<string, string> = {};
    if (form.name.trim().length < 3) err.name = "Nome completo.";
    if (!/^9\d{8}$/.test(form.phone.replace(/\D/g, "")))
      err.phone = "9 dígitos, ex.: 923000000.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) err.email = "Email válido.";
    if (!form.skills.length)
      err.skills = "Escolha pelo menos uma especialidade.";
    if (!form.id) err.id = "Anexe o documento de identificação.";
    if (!form.photo) err.photo = "Anexe uma fotografia.";
    if (form.exp.trim().length < 10)
      err.exp = "Conte-nos a sua experiência.";
    setErrors(err);
    if (!Object.keys(err).length) {
      setStore((st) => ({
        applications: [
          { ...form, at: new Date().toISOString(), status: "Pendente" },
          ...st.applications,
        ],
      }));
      setDone(true);
    }
  };

  if (done) {
    return (
      <Section title="Candidatura enviada.">
        <Empty
          icon="Hourglass"
          title="Aguarda aprovação"
          text="A equipa verifica os documentos e entra em contacto pelo telefone indicado."
        />
      </Section>
    );
  }

  return (
    <Section
      eyebrow="Seja um profissional"
      title="Transforme as suas competências em oportunidades."
    >
      <div className="grid max-w-3xl gap-5 @3xl:grid-cols-2">
        <Field label="Nome" error={errors.name}>
          <input
            value={form.name}
            onChange={set("name")}
            className={inputCls}
          />
        </Field>
        <Field label="Telefone" error={errors.phone}>
          <input
            inputMode="tel"
            value={form.phone}
            onChange={set("phone")}
            className={inputCls}
            placeholder="923000000"
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            className={inputCls}
          />
        </Field>
        <Field label="Localização">
          <input
            value={form.city}
            onChange={set("city")}
            className={inputCls}
          />
        </Field>
        <div className="@3xl:col-span-2">
          <Field label="Especialidades" error={errors.skills}>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const active = form.skills.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        skills: active
                          ? form.skills.filter((s) => s !== c.id)
                          : [...form.skills, c.id],
                      })
                    }
                    className={
                      "min-h-10 rounded-full border px-4 text-sm font-semibold " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-paper")
                    }
                  >
                    {c.name.replace("Resolve ", "")}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <div className="@3xl:col-span-2">
          <Field label="Experiência" error={errors.exp}>
            <textarea
              rows={3}
              value={form.exp}
              onChange={set("exp")}
              className={inputCls + " py-3"}
            />
          </Field>
        </div>
        <div className="@3xl:col-span-2">
          <Field label="Referências (opcional)">
            <input
              value={form.refs}
              onChange={set("refs")}
              className={inputCls}
              placeholder="Nome e contacto de quem já trabalhou consigo"
            />
          </Field>
        </div>
        <Field label="Documento de identificação" error={errors.id}>
          <FilePick
            accept="image/*,.pdf"
            files={form.id ? [form.id] : []}
            onFiles={(f) => setForm({ ...form, id: f[0] || "" })}
          />
        </Field>
        <Field label="Fotografia" error={errors.photo}>
          <FilePick
            accept="image/*"
            files={form.photo ? [form.photo] : []}
            onFiles={(f) => setForm({ ...form, photo: f[0] || "" })}
          />
        </Field>
        <Field label="Certificados (quando aplicável)">
          <FilePick
            multiple
            files={form.certs}
            onFiles={(f) => setForm({ ...form, certs: f })}
          />
        </Field>
        <div className="@3xl:col-span-2">
          <Btn onClick={submit}>Quero ser parceiro</Btn>
        </div>
      </div>
    </Section>
  );
}

export function Business() {
  const businessCat = CATEGORIES.find((c) => c.id === "business");
  return (
    <Section
      eyebrow="Empresas"
      title="A sua empresa também merece soluções mais simples."
    >
      <div className="grid gap-4 @3xl:grid-cols-3">
        {businessCat?.services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(`/pedir/${s.id}`)}
            className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-paper p-5 text-left font-display font-bold hover:border-primary"
          >
            {s.name}
            <Icon name="ArrowRight" className="size-4 text-action" />
          </button>
        ))}
      </div>
      <p className="mt-8 max-w-xl text-muted-foreground">
        Contratos com faturação mensal, gestor de conta e níveis de serviço
        acordados. Peça um orçamento em qualquer serviço acima.
      </p>
    </Section>
  );
}

export const About = () => (
  <Section
    eyebrow="Sobre nós"
    title="Nascemos em Huambo para resolver o dia a dia."
  >
    <p className="max-w-2xl text-lg text-muted-foreground">
      A Resolve Express liga pessoas, famílias e empresas a profissionais e
      serviços de confiança. Equipa própria quando faz sentido, parceiros
      verificados quando é preciso, e um pedido organizado sempre.
    </p>
  </Section>
);

export function Contacts() {
  const [store] = useStore();
  return (
    <Section eyebrow="Contactos" title="Fale connosco.">
      <div className="grid max-w-2xl gap-3">
        <p className="flex items-center gap-3">
          <Icon name="MessageCircle" className="size-5 text-whatsapp" />{" "}
          WhatsApp:{" "}
          {store.whatsapp ? (
            `+${store.whatsapp.replace(/\D/g, "")}`
          ) : (
            <span className="text-muted-foreground">
              por configurar no painel
            </span>
          )}
        </p>
        <p className="flex items-center gap-3">
          <Icon name="MapPin" className="size-5 text-action" /> Huambo, Angola
        </p>
        <p className="flex items-center gap-3">
          <Icon name="Mail" className="size-5 text-primary" /> Email:{" "}
          <span className="text-muted-foreground">
            por configurar (serviço de email transacional)
          </span>
        </p>
      </div>
    </Section>
  );
}

export const Legal = ({ k }: { k: string }) => (
  <Section eyebrow="Documento legal" title={LEGAL_DOCS[k] || "Documento"}>
    <div className="max-w-2xl rounded-[var(--radius)] border border-warn bg-warn/10 p-5">
      <p className="font-semibold">Conteúdo em revisão jurídica.</p>
      <p className="mt-1 text-muted-foreground">
        Este texto é gerido no painel (Gestão de conteúdo) e só é publicado
        depois de aprovado por advogado.
      </p>
    </div>
  </Section>
);

export const Account = () => (
  <Section eyebrow="Conta" title="Entrar ou criar conta.">
    <Empty
      icon="LockKeyhole"
      title="Contas ativam na Etapa 2"
      text="Login, registo e recuperação de palavra-passe usam Supabase Auth, que ainda não está ligado. Por agora os seus pedidos ficam neste dispositivo."
    >
      <Btn kind="ink" onClick={() => go("/pedidos")}>
        Ver os meus pedidos
      </Btn>
    </Empty>
  </Section>
);
