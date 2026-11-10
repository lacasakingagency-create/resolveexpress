import React from "react";
import { useStore, type UserRole } from "./store";
import { useAuth } from "./AuthContext";
import { Icon, Btn, go } from "../ui/kit";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectPath?: string;
  roleTitle?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  redirectPath = "/entrar",
  roleTitle = "Ambiente Restrito",
}: ProtectedRouteProps) {
  const [store] = useStore();
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <Icon name="Loader2" className="size-10 animate-spin text-action mb-4" />
        <p className="font-display text-base font-bold text-primary">A verificar credenciais e permissões...</p>
        <p className="text-xs text-muted-foreground mt-1">Resolve Express Huambo</p>
      </div>
    );
  }

  const currentUser = store.currentUser;

  // 1. Not authenticated
  if (!currentUser) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border bg-paper p-8 shadow-lg">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
            <Icon name="Lock" className="size-8" />
          </span>
          <h2 className="font-display text-2xl font-black text-primary">Autenticação Obrigatória</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O acesso ao painel de <strong className="text-foreground">{roleTitle}</strong> requer início de sessão com conta autorizada.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Btn kind="action" onClick={() => go(redirectPath)} className="w-full sm:w-auto">
              <Icon name="LogIn" className="size-4" /> Iniciar Sessão
            </Btn>
            <Btn kind="ghost" onClick={() => go("/")} className="w-full sm:w-auto">
              Voltar ao Início
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authenticated but unauthorized role
  const isAuthorized =
    currentUser.role === "SUPER_ADMIN" ||
    allowedRoles.includes(currentUser.role);

  if (!isAuthorized) {
    const userRoleLabel =
      currentUser.role === "CUSTOMER"
        ? "Cliente"
        : currentUser.role === "EMPLOYEE"
        ? "Funcionário"
        : currentUser.role === "BUSINESS_PARTNER" || currentUser.role === "PARTNER"
        ? "Empresa Parceira"
        : currentUser.role === "PROFESSIONAL"
        ? "Profissional Independente"
        : currentUser.role === "SELLER"
        ? "Vendedor da Praça"
        : currentUser.role === "AFFILIATE"
        ? "Afiliado"
        : currentUser.role === "OPERATIONS"
        ? "Operação e Produção"
        : currentUser.role === "CUSTOMER_SUPPORT"
        ? "Apoio ao Cliente"
        : currentUser.role;

    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-paper p-8 shadow-lg">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-50 text-red-600 mb-4">
            <Icon name="ShieldAlert" className="size-8" />
          </span>
          <h2 className="font-display text-2xl font-black text-primary">Acesso Não Autorizado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A sua conta atual está registada como <strong className="text-foreground font-bold">{userRoleLabel}</strong> e não tem permissões para aceder ao módulo de <strong className="text-foreground">{roleTitle}</strong>.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Btn
              kind="action"
              onClick={() => {
                const target =
                  currentUser.role === "CUSTOMER"
                    ? "/portal-cliente"
                    : currentUser.role === "EMPLOYEE"
                    ? "/portal-funcionario"
                    : currentUser.role === "BUSINESS_PARTNER" || currentUser.role === "PARTNER"
                    ? "/portal-empresa"
                    : currentUser.role === "PROFESSIONAL"
                    ? "/portal-parceiro"
                    : currentUser.role === "SELLER"
                    ? "/praca/painel-vendedor"
                    : currentUser.role === "AFFILIATE"
                    ? "/praca/afiliados"
                    : currentUser.role === "OPERATIONS"
                    ? "/operacao"
                    : currentUser.role === "CUSTOMER_SUPPORT"
                    ? "/apoio"
                    : "/";
                go(target);
              }}
              className="w-full sm:w-auto"
            >
              Ir para o Meu Ambiente Permitido
            </Btn>
            <Btn kind="ghost" onClick={() => go("/entrar")} className="w-full sm:w-auto">
              Alternar de Conta
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
