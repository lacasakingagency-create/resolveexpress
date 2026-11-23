# GUIA DE INSTALAÇÃO NOVO SUPABASE — RESOLVE EXPRESS
## Manual Passo a Passo para Instalação em Produção

Este documento fornece as instruções operacionais exatas para instalar a infraestrutura de dados da **Resolve Express** num **projeto Supabase novo**, com compatibilidade total para o frontend hospedado na Vercel.

---

## 📋 Pré-requisitos

1. Uma conta ativa em [supabase.com](https://supabase.com).
2. Um projeto novo criado (ex.: `resolve-express-prod` ou `resolve-express-huambo`).
3. Credenciais do projeto obtidas em **Project Settings -> API**:
   - `Project URL`
   - `anon / public key` (chave JWT pública)
4. Acesso ao painel da Vercel para configurar as variáveis de ambiente.

---

## 🚀 Passo 1: Executar o Script SQL Consolidado

1. Aceda ao painel do seu projeto no Supabase: `https://supabase.com/dashboard/project/<seu-project-id>`.
2. No menu lateral esquerdo, clique no ícone **SQL Editor** (Editor SQL).
3. Clique no botão **+ New query** (Nova Consulta).
4. Abra o ficheiro:
   `supabase/migrations/20261110000000_complete_resolve_express.sql`
5. Copie **todo o conteúdo** do ficheiro e cole-o no editor SQL do Supabase.
6. Clique no botão verde **Run** (Executar) no canto inferior direito.
7. Aguarde a mensagem: `Success. No rows returned`.

> **O que foi criado automaticamente:**
> - Extensões `uuid-ossp` e `pgcrypto`.
> - Funções auxiliares de controlo de acesso RBAC (`is_admin`, `is_staff`, `is_service_role`).
> - 10 tabelas relacionais com Row Level Security (RLS) estrito.
> - Vista pública segura `public_profiles`.
> - 2 Buckets no Storage: `public-assets` (público) e `partner-documents` (privado) com respetivas políticas de acesso.
> - 9 Triggers de integridade, anti-escalada de privilégios e validação de checkout.
> - RPC financeira transacional `execute_wallet_movement` com lock pessimista (`FOR UPDATE`) e idempotência única.
> - 12 Índices de performance para consultas de alta velocidade.
> - Configurações globais seguras e catálogo inicial verificado.

---

## 🗄️ Passo 2: Confirmar os Buckets no Supabase Storage

1. No menu lateral do Supabase, clique em **Storage**.
2. Confirme que constam dois buckets na lista:
   - **`public-assets`**: Deve apresentar a etiqueta verde **Public** (Acesso público de leitura para logótipos, banners e catálogo).
   - **`partner-documents`**: Deve apresentar o ícone de **cadeado / Private** (Acesso restrito e assinado para documentos de empresas e profissionais).
3. Se por alguma razão de rede os buckets não aparecerem, clique em **New bucket**, crie `public-assets` com o botão *Public bucket* ativado e `partner-documents` com o botão desativado.

---

## 👤 Passo 3: Ativação e Reconhecimento do Administrador

Como o script SQL inclui o bloco de sincronização automática (**12.1.b**), **qualquer utilizador já criado no Supabase Auth antes de rodar o SQL é automaticamente inserido em `public.profiles` com o papel `super_admin`**!

### Se já criou o utilizador no Supabase Auth:
Basta confirmar executando no **SQL Editor**:
```sql
select id, email, full_name, role from public.profiles where role = 'super_admin';
```
Se o seu e-mail aparecer com `role = 'super_admin'`, a sua conta de Administrador já está 100% pronta!

### Para garantir ou promover um e-mail específico a Super Administrador:
Caso pretenda associar explicitamente o e-mail que criou:
```sql
update public.profiles
set role = 'super_admin'
where lower(email) = lower('SEU_EMAIL_AQUI'); -- Substitua pelo e-mail criado no Supabase Auth
```

### Se ainda não tinha criado o utilizador no Auth:
1. No menu lateral do Supabase, aceda a **Authentication -> Users**.
2. Clique em **Add user -> Create user**:
   - Insira o e-mail do administrador.
   - Defina a password.
   - Ative a opção **Auto Confirm User**.
   - Clique em **Create user**.
3. No **SQL Editor**, execute:
```sql
update public.profiles
set role = 'super_admin'
where lower(email) = lower('SEU_EMAIL_AQUI');
```

---

## 🌐 Passo 4: Configurar as Variáveis na Vercel

1. Aceda ao painel da Vercel: [vercel.com](https://vercel.com).
2. Abra o projeto da **Resolve Express**.
3. Vá a **Settings -> Environment Variables**.
4. Configure as seguintes variáveis (selecione os ambientes `Production`, `Preview` e `Development`):

| Variável | Valor | Origem |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` | Supabase -> Project Settings -> API -> Project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI...` | Supabase -> Project Settings -> API -> `anon / public` |
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio (para o assistente Resolve AI) |

> ⚠️ **AVISO CRÍTICO DE SEGURANÇA:**
> **JAMAIS** configure a chave `service_role` em variáveis de ambiente com o prefixo `VITE_`. A chave anónima pública `VITE_SUPABASE_ANON_KEY` possui todas as permissões necessárias e é filtrada pelo RLS.

5. Após salvar as variáveis, vá a **Deployments** e clique em **Redeploy** na última versão para injetar os novos valores no pacote estático.

---

## 🧪 Passo 5: Testes de Validação no Navegador

Após o deploy:
1. Abra a aplicação no navegador.
2. Abra as Ferramentas de Desenvolvedor (F12 -> Console) e confirme que não há erros de ligação ao Supabase.
3. Teste o fluxo de registo com uma conta nova:
   - Verifique que o perfil é criado no Supabase com `role = 'cliente'`.
4. Inicie sessão com a conta `super_admin`:
   - Aceda a `/admin` e confirme que o painel administrativo carrega com sucesso.
   - Teste o carregamento do logótipo em **Configurações -> Logótipo Oficial da Plataforma**.
   - Confirme que a imagem é gravada no bucket `public-assets` e transmitida ao cabeçalho.
