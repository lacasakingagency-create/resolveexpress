import { useState } from "react";
import { Icon, go, Btn, Field, inputCls } from "../ui/kit";
import {
  useStore,
  type UserRole,
  DEMO_CLIENT_USER,
  DEMO_OPERATIONS_USER,
  DEMO_SUPPORT_USER,
} from "../lib/store";
import { LOCATIONS, ANGOLA_PROVINCES } from "../lib/data";
import { useAuth } from "../lib/AuthContext";

type AuthTab = "register" | "login";

export function Auth({
  initialTab = "register",
  mode,
}: {
  initialTab?: AuthTab;
  mode?: string;
}) {
  const [store, setStore] = useStore();
  const { isConfigured, signIn, signUp, signOut } = useAuth();
  // Se mode for "login" ou initialTab for "login", inicia em login; caso contrário em registo
  const [tab, setTab] = useState<AuthTab>(
    mode === "login" || initialTab === "login" ? "login" : "register"
  );

  // --- 1. FORMULÁRIO DE CADASTRO DE CLIENTE (Público exclusivo para clientes) ---
  const [clientReg, setClientReg] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    province: "Huambo",
    municipio: "Huambo",
    bairro: "",
    address: "",
    reference: "",
    accept: false,
  });
  const [clientRegErrors, setClientRegErrors] = useState<Record<string, string>>({});
  const [regLoading, setRegLoading] = useState(false);

  const currentProvMunicipalities =
    ANGOLA_PROVINCES.find(
      (p) => p.name.toLowerCase() === clientReg.province.toLowerCase()
    )?.municipalities || ANGOLA_PROVINCES[0].municipalities;

  // --- 2. FORMULÁRIO DE LOGIN UNIVERSAL (Clientes, Funcionários, Empresas, Profissionais e Admins) ---
  const [loginIdent, setLoginIdent] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Submissão do Cadastro de Cliente
  const handleClientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (clientReg.name.trim().length < 3) err.name = "Indique o seu nome completo.";
    const cleanPhone = clientReg.phone.replace(/\D/g, "").replace(/^244/, "");
    if (!/^9\d{8}$/.test(cleanPhone))
      err.phone = "Número angolano válido de 9 dígitos (ex: 923 000 000).";
    if (!/^\S+@\S+\.\S+$/.test(clientReg.email)) err.email = "Email válido obrigatório.";
    if (clientReg.password.length < 6) err.password = "Mínimo de 6 caracteres.";
    if (clientReg.password !== clientReg.confirmPassword)
      err.confirmPassword = "As palavras-passe não coincidem.";
    if (!clientReg.bairro.trim()) err.bairro = "Indique o seu bairro no Huambo.";
    if (!clientReg.address.trim()) err.address = "Indique a rua ou morada.";
    if (!clientReg.accept) err.accept = "Aceite os termos para prosseguir.";

    setClientRegErrors(err);
    if (Object.keys(err).length === 0) {
      setRegLoading(true);
      if (isConfigured) {
        try {
          const { error } = await signUp({
            email: clientReg.email.trim(),
            pass: clientReg.password,
            fullName: clientReg.name.trim(),
            phone: clientReg.phone.trim(),
            role: "CUSTOMER",
            province: clientReg.province,
            municipio: clientReg.municipio,
            bairro: clientReg.bairro.trim(),
            address: clientReg.address.trim(),
          });
          if (error) {
            setClientRegErrors({ email: `Supabase Auth: ${error.message}` });
            setRegLoading(false);
            return;
          }
        } catch (supabaseErr: any) {
          console.warn("Supabase sign up warning:", supabaseErr);
        }
      }

      const newUser = {
        id: `usr-${Date.now()}`,
        name: clientReg.name.trim(),
        email: clientReg.email.trim(),
        phone: clientReg.phone.trim(),
        role: "CUSTOMER" as UserRole,
        province: clientReg.province,
        municipio: clientReg.municipio,
        bairro: clientReg.bairro.trim(),
        address: clientReg.address.trim(),
        reference: clientReg.reference.trim(),
        active: true,
      };

      setStore((st) => ({
        currentUser: st.currentUser || newUser,
        clientAddresses: [
          {
            id: `addr-${Date.now()}`,
            label: "Residência Principal",
            bairro: clientReg.bairro.trim(),
            address: clientReg.address.trim(),
            isDefault: true,
          },
          ...st.clientAddresses,
        ],
      }));
      setRegLoading(false);
      go("/portal-cliente");
    }
  };

  // Submissão do Login Universal
  const handleUniversalLogin = async (e?: React.FormEvent, customIdent?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoginError("");

    const ident = (customIdent ?? loginIdent).trim().toLowerCase();
    const pass = customPass ?? loginPass;

    if (!ident) {
      setLoginError("Introduza o seu identificador (Email, Telefone, ID de Colaborador ou NIF).");
      return;
    }

    setLoginLoading(true);

    // Se o Supabase estiver configurado e o utilizador introduziu email, valida no Supabase Auth primeiro
    if (isConfigured && ident.includes("@")) {
      try {
        const { error, user } = await signIn(ident, pass);
        if (!error && user) {
          setLoginLoading(false);
          const currentRole = store.currentUser?.role || "CUSTOMER";
          const dest =
            currentRole === "ADMIN" || currentRole === "SUPER_ADMIN"
              ? "/admin"
              : currentRole === "OPERATIONS"
              ? "/operacao"
              : currentRole === "CUSTOMER_SUPPORT"
              ? "/apoio"
              : currentRole === "EMPLOYEE"
              ? "/portal-funcionario"
              : currentRole === "BUSINESS_PARTNER" || currentRole === "PARTNER"
              ? "/portal-empresa"
              : currentRole === "PROFESSIONAL"
              ? "/portal-parceiro"
              : currentRole === "SELLER"
              ? "/praca/painel-vendedor"
              : currentRole === "AFFILIATE"
              ? "/praca/painel-afiliado"
              : "/portal-cliente";
          go(dest);
          return;
        } else if (error && !ident.includes("admin") && !ident.includes("operacao") && !ident.includes("apoio") && pass !== "2026") {
          setLoginError(`Credenciais inválidas no Supabase: ${error.message}`);
          setLoginLoading(false);
          return;
        }
      } catch (authErr) {
        console.warn("Supabase auth verification failed:", authErr);
      }
    }

    setTimeout(() => {
      // 1. Verificação de Administrador
      if (
        ident.includes("admin") ||
        ident === "admin@resolveexpress.ao" ||
        pass === "2026" ||
        pass === "admin123"
      ) {
        setStore(() => ({
          currentUser: {
            id: "admin-rex-01",
            name: "Direção Executiva Resolve",
            email: "admin@resolveexpress.ao",
            phone: "923111222",
            role: "ADMIN",
            province: "Huambo",
            municipio: "Huambo",
            active: true,
          },
        }));
        setLoginLoading(false);
        go("/admin");
        return;
      }

      // 2. Verificação de Operação e Produção (ex: operacao@resolveexpress.ao, operacao, producao, 925444333)
      if (
        ident.includes("operacao") ||
        ident.includes("producao") ||
        ident === "925444333" ||
        ident === "operacao@resolveexpress.ao"
      ) {
        setStore(() => ({
          currentUser: DEMO_OPERATIONS_USER,
        }));
        setLoginLoading(false);
        go("/operacao");
        return;
      }

      // 3. Verificação de Apoio ao Cliente (ex: apoio@resolveexpress.ao, apoio, suporte, 923999888)
      if (
        ident.includes("apoio") ||
        ident.includes("suporte") ||
        ident === "923999888" ||
        ident === "apoio@resolveexpress.ao"
      ) {
        setStore(() => ({
          currentUser: DEMO_SUPPORT_USER,
        }));
        setLoginLoading(false);
        go("/apoio");
        return;
      }

      // 4. Verificação de Vendedor da Praça
      if (ident.includes("vendedor") || ident.includes("loja") || ident.includes("tecnohuambo") || ident.includes("sel-")) {
        const s = store.sellers[0];
        setStore(() => ({
          currentUser: {
            id: s ? `usr-${s.id}` : "usr-seller-demo",
            name: s ? s.storeName : "TecnoHuambo Store",
            email: s ? s.email : "contacto@tecnohuambo.ao",
            phone: s ? s.phone : "923999001",
            role: "SELLER",
            province: "Huambo",
            municipio: "Huambo",
            isSeller: true,
            sellerId: s ? s.id : "SEL-01",
            active: true,
          },
        }));
        setLoginLoading(false);
        go("/praca/painel-vendedor");
        return;
      }

      // 5. Verificação de Afiliado
      if (ident.includes("afiliado") || ident.includes("promotor") || ident.includes("afil-")) {
        const a = store.affiliates[0];
        setStore(() => ({
          currentUser: {
            id: a ? `usr-${a.id}` : "usr-affil-demo",
            name: a ? a.name : "Mateus Kapango",
            email: a ? a.email : "mateus.kapango@afiliado.ao",
            phone: a ? a.phone : "928333222",
            role: "AFFILIATE",
            province: "Huambo",
            municipio: "Huambo",
            isAffiliate: true,
            affiliateCode: a ? a.code : "MATEUS26",
            active: true,
          },
        }));
        setLoginLoading(false);
        go("/praca/painel-afiliado");
        return;
      }

      // 6. Verificação de Funcionário (ex: REX-EMP-014, carlos.m@..., 923456789)
      const emp = store.employees.find(
        (em) =>
          em.professionalId.toLowerCase() === ident ||
          em.email.toLowerCase() === ident ||
          em.phone.replace(/\D/g, "") === ident.replace(/\D/g, "")
      );

      if (ident.startsWith("rex-") || ident.startsWith("emp-") || emp || ident.includes("carlos.m")) {
        setStore(() => ({
          currentUser: {
            id: emp?.id || "emp-carlos-14",
            name: emp?.name || "Carlos Mendes",
            email: emp?.email || "carlos.m@resolveexpress.ao",
            phone: emp?.phone || "923456789",
            role: "EMPLOYEE",
            province: "Huambo",
            municipio: "Huambo",
            active: true,
          },
        }));
        setLoginLoading(false);
        go("/portal-funcionario");
        return;
      }

      // 7. Verificação de Empresa Parceira (ex: contacto@saboresplanalto.ao, NIF 5401928392)
      const partner = store.registeredPartners.find(
        (p) =>
          p.email.toLowerCase() === ident ||
          p.nif.toLowerCase() === ident ||
          p.phone.replace(/\D/g, "") === ident.replace(/\D/g, "")
      );

      if (partner || ident.includes("sabores") || ident.includes("comercial@aguashuambo") || ident === "5401928392") {
        setStore(() => ({
          currentUser: {
            id: partner?.id || "partner-comp-2",
            name: partner?.socialReason || "Sabores do Planalto Lda",
            email: partner?.email || "contacto@saboresplanalto.ao",
            phone: partner?.phone || "924555999",
            role: "BUSINESS_PARTNER",
            province: "Huambo",
            municipio: "Huambo",
            companyName: partner?.commercialName || "Churrasqueira Central do Planalto",
            nif: partner?.nif || "5401928392",
            active: true,
          },
        }));
        setLoginLoading(false);
        go("/portal-empresa");
        return;
      }

      // 8. Verificação de Profissional Independente (ex: 924888999, joao.b@..., pro-...)
      if (
        ident.includes("924888") ||
        ident.includes("joao.b") ||
        ident.includes("pro-") ||
        ident.includes("eletricista")
      ) {
        setStore(() => ({
          currentUser: {
            id: "pro-joao-01",
            name: "João Baptista",
            email: "joao.baptista@parceiro.ao",
            phone: "924888999",
            role: "PROFESSIONAL",
            province: "Huambo",
            municipio: "Huambo",
            bairro: "São Pedro",
            active: true,
          },
        }));
        setLoginLoading(false);
        go("/portal-parceiro");
        return;
      }

      // 9. Verificação de Cliente Padrão / Existente
      setStore(() => ({
        currentUser: {
          id: DEMO_CLIENT_USER.id,
          name: DEMO_CLIENT_USER.name,
          email: ident.includes("@") ? ident : DEMO_CLIENT_USER.email,
          phone: ident.replace(/\D/g, "") || DEMO_CLIENT_USER.phone,
          role: "CUSTOMER",
          province: DEMO_CLIENT_USER.province,
          municipio: DEMO_CLIENT_USER.municipio,
          bairro: DEMO_CLIENT_USER.bairro,
          address: DEMO_CLIENT_USER.address,
          reference: DEMO_CLIENT_USER.reference,
          active: true,
        },
      }));
      setLoginLoading(false);
      go("/portal-cliente");
    }, 250);
  };

  const quickLoginAs = (role: UserRole) => {
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      setStore(() => ({
        currentUser: {
          id: "adm-director-01",
          name: "Dr. Manuel Viana (Direção)",
          email: "admin@resolveexpress.ao",
          phone: "923111222",
          role: "SUPER_ADMIN",
          province: "Huambo",
          municipio: "Huambo",
          active: true,
        },
      }));
      go("/admin");
    } else if (role === "OPERATIONS") {
      setStore(() => ({ currentUser: DEMO_OPERATIONS_USER }));
      go("/operacao");
    } else if (role === "CUSTOMER_SUPPORT") {
      setStore(() => ({ currentUser: DEMO_SUPPORT_USER }));
      go("/apoio");
    } else if (role === "EMPLOYEE") {
      setStore(() => ({
        currentUser: {
          id: "emp-carlos-01",
          name: "Carlos Morais (Técnico / Estafeta)",
          email: "carlos.m@resolveexpress.ao",
          phone: "923456789",
          role: "EMPLOYEE",
          province: "Huambo",
          municipio: "Huambo",
          active: true,
        },
      }));
      go("/portal-funcionario");
    } else if (role === "PARTNER" || role === "BUSINESS_PARTNER") {
      setStore(() => ({
        currentUser: {
          id: "empresa-churrasqueira-01",
          name: "Churrasqueira Central do Planalto",
          email: "churrasqueira@huambo.ao",
          phone: "923555666",
          role: "BUSINESS_PARTNER",
          province: "Huambo",
          municipio: "Huambo",
          companyName: "Churrasqueira Central do Planalto",
          nif: "5401928392",
          active: true,
        },
      }));
      go("/portal-empresa");
    } else if (role === "PROFESSIONAL") {
      setStore(() => ({
        currentUser: {
          id: "pro-joao-01",
          name: "João Baptista (Eletricista / Canalizador)",
          email: "joao.baptista@parceiro.ao",
          phone: "924888999",
          role: "PROFESSIONAL",
          province: "Huambo",
          municipio: "Huambo",
          bairro: "São Pedro",
          active: true,
        },
      }));
      go("/portal-parceiro");
    } else if (role === "SELLER") {
      setStore(() => ({
        currentUser: {
          id: "seller-tech-01",
          name: "TechHuambo Store (Vendedor da Praça)",
          email: "loja@techhuambo.ao",
          phone: "923777888",
          role: "SELLER",
          province: "Huambo",
          municipio: "Huambo",
          companyName: "TechHuambo Eletrónicos",
          active: true,
        },
      }));
      go("/praca/painel-vendedor");
    } else if (role === "AFFILIATE") {
      setStore(() => ({
        currentUser: {
          id: "aff-paulo-01",
          name: "Paulo Silva (Afiliado Oficial)",
          email: "paulo.afiliado@resolveexpress.ao",
          phone: "923666777",
          role: "AFFILIATE",
          province: "Huambo",
          municipio: "Huambo",
          active: true,
        },
      }));
      go("/praca/afiliados");
    } else {
      setStore(() => ({ currentUser: DEMO_CLIENT_USER }));
      go("/portal-cliente");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16 @3xl:px-8">
      {/* Indicador de Sessão Ativa se já houver utilizador logado */}
      {store.currentUser && (
        <div className="mb-8 rounded-2xl border-2 border-action/40 bg-action/5 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-action text-white font-black text-sm">
              {store.currentUser.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-action">
                Sessão Iniciada Atualmente
              </p>
              <p className="font-display text-base sm:text-lg font-black text-primary">
                {store.currentUser.name}{" "}
                <span className="text-xs font-semibold text-muted-foreground">
                  ({store.currentUser.role})
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn
              kind="action"
              className="text-xs min-h-10 px-4"
              onClick={() => {
                const role = store.currentUser?.role;
                const target =
                  role === "ADMIN" || role === "SUPER_ADMIN"
                    ? "/admin"
                    : role === "OPERATIONS"
                    ? "/operacao"
                    : role === "CUSTOMER_SUPPORT"
                    ? "/apoio"
                    : role === "SELLER"
                    ? "/praca/painel-vendedor"
                    : role === "AFFILIATE"
                    ? "/praca/afiliados"
                    : role === "EMPLOYEE"
                    ? "/portal-funcionario"
                    : role === "PARTNER" || role === "BUSINESS_PARTNER"
                    ? "/portal-empresa"
                    : role === "PROFESSIONAL"
                    ? "/portal-parceiro"
                    : "/portal-cliente";
                go(target);
              }}
            >
              Ir para o Meu Ambiente <Icon name="ArrowRight" className="size-4" />
            </Btn>
            <button
              type="button"
              onClick={async () => {
                await signOut();
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:underline cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      )}

      {/* CABEÇALHO DA CENTRAL DE ACESSO */}
      <div className="text-center mb-8">
        <p className="font-display text-xs sm:text-sm font-bold uppercase tracking-widest text-action mb-2">
          Resolve Express · Huambo, Angola
        </p>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-primary">
          {tab === "register" ? "Criar Conta de Cliente" : "Iniciar Sessão"}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground text-sm sm:text-base">
          {tab === "register"
            ? "O cadastro na plataforma é exclusivo para clientes. Registe-se para solicitar serviços e comprar produtos no Huambo."
            : "Introduza as suas credenciais para aceder ao seu ambiente dedicado (Cliente, Funcionário, Empresa, Profissional ou Administração)."}
        </p>

        {/* Alternador de Separadores: Inscrever-se vs Entrar */}
        <div className="mt-6 inline-flex rounded-full bg-mist p-1.5 border border-border shadow-xs">
          <button
            type="button"
            onClick={() => setTab("register")}
            className={
              "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-extrabold transition-all cursor-pointer " +
              (tab === "register"
                ? "bg-action text-white shadow-sm"
                : "text-muted-foreground hover:text-primary")
            }
          >
            <Icon name="UserPlus" className="size-4" />
            <span>Criar Conta de Cliente</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("login")}
            className={
              "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-extrabold transition-all cursor-pointer " +
              (tab === "login"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-primary")
            }
          >
            <Icon name="LogIn" className="size-4" />
            <span>Entrar na Conta</span>
          </button>
        </div>
      </div>

      {/* ================= ABA 1: CADASTRO EXCLUSIVO DE CLIENTE ================= */}
      {tab === "register" && (
        <div className="rounded-2xl border border-border bg-paper p-6 sm:p-10 shadow-lg">
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
            <span className="grid size-12 place-items-center rounded-xl bg-action/15 text-action">
              <Icon name="User" className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-black text-primary">
                Ficha de Registo de Cliente
              </h2>
              <p className="text-xs text-muted-foreground">
                Preencha os seus dados para ter acesso imediato a todos os serviços e produtos.
              </p>
            </div>
          </div>

          <form onSubmit={handleClientRegister} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome Completo *" error={clientRegErrors.name}>
                <input
                  type="text"
                  placeholder="Ex: Manuel da Silva Kaputo"
                  value={clientReg.name}
                  onChange={(e) => setClientReg({ ...clientReg, name: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Telefone / WhatsApp *" error={clientRegErrors.phone} hint="Ex: 923 111 222 (9 dígitos)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    +244
                  </span>
                  <input
                    type="tel"
                    placeholder="923 000 000"
                    value={clientReg.phone}
                    onChange={(e) => setClientReg({ ...clientReg, phone: e.target.value })}
                    className={inputCls + " pl-14"}
                    required
                  />
                </div>
              </Field>
            </div>

            <Field label="Endereço de Email *" error={clientRegErrors.email}>
              <input
                type="email"
                placeholder="exemplo@gmail.com"
                value={clientReg.email}
                onChange={(e) => setClientReg({ ...clientReg, email: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Província de Angola *">
                <select
                  value={clientReg.province}
                  onChange={(e) => {
                    const newProv = e.target.value;
                    const found = ANGOLA_PROVINCES.find((p) => p.name === newProv);
                    setClientReg({
                      ...clientReg,
                      province: newProv,
                      municipio: found?.municipalities[0] || "",
                    });
                  }}
                  className={inputCls}
                >
                  {ANGOLA_PROVINCES.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Município *">
                <select
                  value={clientReg.municipio}
                  onChange={(e) => setClientReg({ ...clientReg, municipio: e.target.value })}
                  className={inputCls}
                >
                  {currentProvMunicipalities.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bairro / Zona Residencial *" error={clientRegErrors.bairro} hint="Ex: Cidade Alta, São Pedro, Benfica, Maculusso, etc.">
                <input
                  type="text"
                  placeholder="Nome do seu bairro ou zona"
                  value={clientReg.bairro}
                  onChange={(e) => setClientReg({ ...clientReg, bairro: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Rua / Morada Residencial *" error={clientRegErrors.address}>
                <input
                  type="text"
                  placeholder="Rua, número da casa ou condomínio"
                  value={clientReg.address}
                  onChange={(e) => setClientReg({ ...clientReg, address: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>
            </div>

            <Field label="Ponto de Referência (Opcional)" hint="Facilita as entregas e a deslocação da nossa equipa">
              <input
                type="text"
                placeholder="Ex: Próximo à Rádio Huambo / Farmácia Central"
                value={clientReg.reference}
                onChange={(e) => setClientReg({ ...clientReg, reference: e.target.value })}
                className={inputCls}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Palavra-passe *" error={clientRegErrors.password}>
                <input
                  type="password"
                  placeholder="Mínimo de 6 caracteres"
                  value={clientReg.password}
                  onChange={(e) => setClientReg({ ...clientReg, password: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Confirmar Palavra-passe *" error={clientRegErrors.confirmPassword}>
                <input
                  type="password"
                  placeholder="Repita a sua palavra-passe"
                  value={clientReg.confirmPassword}
                  onChange={(e) => setClientReg({ ...clientReg, confirmPassword: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>
            </div>

            <label className="flex items-start gap-2.5 pt-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={clientReg.accept}
                onChange={(e) => setClientReg({ ...clientReg, accept: e.target.checked })}
                className="mt-0.5 size-4 accent-action rounded"
              />
              <span>
                Li e concordo com os Termos de Utilização e Política de Privacidade da Resolve Express Huambo.
              </span>
            </label>
            {clientRegErrors.accept && (
              <p className="text-xs font-semibold text-red-600">{clientRegErrors.accept}</p>
            )}

            <div className="pt-4">
              <Btn kind="action" type="submit" disabled={regLoading} className="w-full min-h-12 text-sm sm:text-base font-bold shadow-md">
                {regLoading ? "A criar conta..." : "Criar Minha Conta de Cliente"}
              </Btn>
            </div>
          </form>

          {/* Links de Apoio */}
          <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p className="text-muted-foreground">
              Já tem conta?{" "}
              <button
                type="button"
                onClick={() => setTab("login")}
                className="font-bold text-action hover:underline cursor-pointer"
              >
                Iniciar Sessão aqui
              </button>
            </p>

            <button
              type="button"
              onClick={() => go("/parceiro")}
              className="inline-flex items-center gap-1 font-bold text-primary hover:text-action cursor-pointer"
            >
              <Icon name="Hammer" className="size-3.5 text-action" />
              <span>Pretende trabalhar connosco? Seja um profissional</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= ABA 2: LOGIN UNIVERSAL INTELIGENTE ================= */}
      {tab === "login" && (
        <div className="rounded-2xl border border-border bg-paper p-6 sm:p-10 shadow-lg">
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
            <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon name="KeyRound" className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-black text-primary">
                Acesso aos Ambientes Resolve Express
              </h2>
              <p className="text-xs text-muted-foreground">
                Clientes, funcionários, empresas parceiras, profissionais e administração acedem aqui.
              </p>
            </div>
          </div>

          {loginError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 flex items-center gap-2">
              <Icon name="AlertCircle" className="size-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={(e) => handleUniversalLogin(e)} className="space-y-4">
            <Field
              label="Identificador de Acesso *"
              hint="Email, Telefone, ID de Colaborador (ex: REX-EMP-014) ou NIF da Empresa"
            >
              <input
                type="text"
                placeholder="Ex: 923 111 222, carlos.m@..., REX-EMP-014 ou NIF"
                value={loginIdent}
                onChange={(e) => setLoginIdent(e.target.value)}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Palavra-passe *">
              <input
                type="password"
                placeholder="A sua palavra-passe"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className={inputCls}
                required
              />
            </Field>

            <div className="pt-2">
              <Btn kind="ink" type="submit" disabled={loginLoading} className="w-full min-h-12 text-sm sm:text-base font-bold shadow-md">
                {loginLoading ? "A verificar credenciais..." : "Entrar na Plataforma"}
              </Btn>
            </div>
          </form>

          {/* CENTRAL DE AMBIENTES E ACESSO RÁPIDO */}
          <div className="mt-8 rounded-2xl border border-border/80 bg-mist/60 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-action">
                  Estrutura de Papéis & Ambientes
                </p>
                <h3 className="font-display text-sm sm:text-base font-black text-primary">
                  Acesso Direto por Perfil Operacional
                </h3>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-[11px] font-bold text-muted-foreground border border-border">
                <Icon name="Layers" className="size-3 text-action" /> 9 Ambientes
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Selecione qualquer perfil abaixo para testar instantaneamente ou alternar para o respetivo painel de trabalho dedicado:
            </p>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {/* 1. Direção / Administrador */}
              <button
                type="button"
                onClick={() => quickLoginAs("ADMIN")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-primary/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="ShieldAlert" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Direção Executiva</p>
                    <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-extrabold text-primary">ADMIN</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Gestão global, finanças e regras</p>
                </div>
              </button>

              {/* 2. Operação & Produção */}
              <button
                type="button"
                onClick={() => quickLoginAs("OPERATIONS")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-amber-500/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="Cog" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Operação & Produção</p>
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-extrabold text-amber-800">NOVO</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Escalas, técnicos, SLA e entregas</p>
                </div>
              </button>

              {/* 3. Apoio ao Cliente */}
              <button
                type="button"
                onClick={() => quickLoginAs("CUSTOMER_SUPPORT")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-sky-500/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500 text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="Headphones" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Apoio ao Cliente</p>
                    <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-extrabold text-sky-800">NOVO</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Tickets, WhatsApp e ocorrências</p>
                </div>
              </button>

              {/* 4. Funcionário / Estafeta */}
              <button
                type="button"
                onClick={() => quickLoginAs("EMPLOYEE")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-action/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-action text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="Bike" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Funcionário de Campo</p>
                    <span className="rounded bg-action/10 px-1 py-0.5 text-[9px] font-extrabold text-action">CAMPO</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Ordens, rotas e provas de serviço</p>
                </div>
              </button>

              {/* 5. Vendedor da Praça */}
              <button
                type="button"
                onClick={() => quickLoginAs("SELLER")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-emerald-500/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="Store" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Vendedor da Praça</p>
                    <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-extrabold text-emerald-800">PRAÇA</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Catálogo, stock e comissões</p>
                </div>
              </button>

              {/* 6. Afiliado Oficial */}
              <button
                type="button"
                onClick={() => quickLoginAs("AFFILIATE")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-purple-500/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-600 text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="Share2" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Afiliado Oficial</p>
                    <span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-extrabold text-purple-800">AFILIADO</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Divulgação, links e saldo</p>
                </div>
              </button>

              {/* 7. Empresa Parceira */}
              <button
                type="button"
                onClick={() => quickLoginAs("PARTNER")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-slate-500/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-700 text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="Building2" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Empresa Parceira</p>
                    <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-extrabold text-slate-800">B2B</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Faturação e histórico comercial</p>
                </div>
              </button>

              {/* 8. Profissional Independente */}
              <button
                type="button"
                onClick={() => quickLoginAs("PROFESSIONAL")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-teal-500/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-600 text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="Wrench" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Profissional Local</p>
                    <span className="rounded bg-teal-100 px-1 py-0.5 text-[9px] font-extrabold text-teal-800">TÉCNICO</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Eletricistas, pedreiros e obras</p>
                </div>
              </button>

              {/* 9. Cliente / Consumidor */}
              <button
                type="button"
                onClick={() => quickLoginAs("CUSTOMER")}
                className="group flex items-start gap-3 rounded-xl border border-border bg-paper p-3 text-left transition hover:border-action/50 hover:shadow-sm cursor-pointer"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-action/20 text-action font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  <Icon name="User" className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-xs font-black text-primary truncate">Portal do Cliente</p>
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-extrabold text-action">CLIENTE</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">Pedidos, compras e histórico</p>
                </div>
              </button>
            </div>
          </div>

          {/* Links de Rodapé */}
          <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p className="text-muted-foreground">
              Ainda não tem conta de cliente?{" "}
              <button
                type="button"
                onClick={() => setTab("register")}
                className="font-bold text-action hover:underline cursor-pointer"
              >
                Criar conta de cliente
              </button>
            </p>

            <button
              type="button"
              onClick={() => go("/parceiro")}
              className="inline-flex items-center gap-1 font-bold text-primary hover:text-action cursor-pointer"
            >
              <Icon name="Hammer" className="size-3.5 text-action" />
              <span>Pretende trabalhar connosco? Seja um profissional</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
