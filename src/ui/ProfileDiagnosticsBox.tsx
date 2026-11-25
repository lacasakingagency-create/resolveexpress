import type { SupabaseProfileDiagnostics } from "../lib/supabase";

export function ProfileDiagnosticsBox({
  diagnostics,
  title = "Diagnóstico Seguro de Autenticação e Perfil",
}: {
  diagnostics: SupabaseProfileDiagnostics | null | undefined;
  title?: string;
}) {
  if (!diagnostics) return null;

  const sessionLabel = diagnostics.sessionPresent
    ? diagnostics.getUserConfirmed
      ? "Sessão ativa e validada (getUser OK)"
      : "Sessão local ativa (getUser pendente/aviso)"
    : "Sessão ausente";

  const queryLabel =
    diagnostics.queryState === "success"
      ? `Sucesso (HTTP ${diagnostics.queryStatus ?? 200})`
      : diagnostics.queryState === "empty"
      ? `Sem linhas devolvidas (HTTP ${diagnostics.queryStatus ?? 200})`
      : diagnostics.queryState === "no_session"
      ? "Bloqueado: sem access_token na sessão"
      : diagnostics.queryState === "error"
      ? `Erro na consulta (HTTP ${diagnostics.queryStatus ?? "?"})`
      : "A aguardar";

  const finalStateLabel =
    diagnostics.finalState === "ready"
      ? `Pronto (${diagnostics.mappedRole || "validado"})`
      : diagnostics.finalState === "missing"
      ? "Perfil não encontrado / bloqueado por RLS"
      : diagnostics.finalState === "no_session"
      ? "Sem sessão autenticada"
      : "Erro ao validar perfil";

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 text-left text-xs text-slate-800">
      <p className="font-bold uppercase tracking-wider text-[10px] text-slate-500 mb-2">
        {title}
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
        <div>
          <dt className="text-slate-500 inline">UUID autenticado: </dt>
          <dd className="inline font-semibold text-slate-900">
            {diagnostics.maskedUserId || "não disponível"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 inline">Estado da sessão: </dt>
          <dd className="inline font-semibold text-slate-900">{sessionLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500 inline">Consulta profiles: </dt>
          <dd className="inline font-semibold text-slate-900">{queryLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500 inline">Role na BD: </dt>
          <dd className="inline font-semibold text-slate-900">
            {diagnostics.dbRole ?? "nenhuma"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 inline">Estado final do perfil: </dt>
          <dd className="inline font-semibold text-slate-900">{finalStateLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500 inline">Código de erro: </dt>
          <dd className="inline font-semibold text-red-700">
            {diagnostics.errorCode || "nenhum"}
          </dd>
        </div>
      </dl>
      {(diagnostics.errorMessage || diagnostics.errorDetails || diagnostics.errorHint || diagnostics.getUserError) && (
        <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] font-mono text-red-700 space-y-0.5 break-words">
          {diagnostics.errorMessage && (
            <p>
              <span className="font-bold">Mensagem:</span> {diagnostics.errorMessage}
            </p>
          )}
          {diagnostics.errorDetails && (
            <p>
              <span className="font-bold">Detalhes:</span> {diagnostics.errorDetails}
            </p>
          )}
          {diagnostics.errorHint && (
            <p>
              <span className="font-bold">Sugestão (hint):</span> {diagnostics.errorHint}
            </p>
          )}
          {diagnostics.getUserError && (
            <p>
              <span className="font-bold">getUser():</span> {diagnostics.getUserError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
