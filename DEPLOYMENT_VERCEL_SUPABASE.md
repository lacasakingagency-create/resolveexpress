# Guia de Deploy: Vercel & Supabase — Resolve Express

Este projeto está 100% preparado e estruturado para deploy na **Vercel** com base de dados PostgreSQL e Autenticação no **Supabase**.

---

## 📁 Estrutura Configurada

| Ficheiro / Pasta | Finalidade |
| :--- | :--- |
| `vercel.json` | Configuração de build, roteamento SPA para sub-rotas (`/produtos`, `/agendar`, `/painel-adm`, etc.) e cabeçalhos de segurança. |
| `.vercelignore` | Exclusão de ficheiros temporários e `node_modules` para builds ultra-rápidos na Vercel. |
| `/api/ai/chat.ts` | Serverless Function da Vercel para o assistente inteligente **Resolve AI** com o modelo `gemini-3.8-flash`. |
| `/api/health.ts` | Endpoint de monitorização e health-check na Vercel. |
| `supabase/schema.sql` | Esquema SQL completo: tabelas (`profiles`, `services`, `products`, `bookings`, `product_orders`, `wallets`, `wallet_transactions`), políticas RLS e dados iniciais (Seed). |
| `supabase/migrations/` | Migração numerada pronta para versionamento com a CLI oficial do Supabase (`supabase db push`). |
| `src/lib/supabase.ts` | Cliente Supabase tipado (`@supabase/supabase-js`) com detecção automática de credenciais e sincronização fluida. |
| `.env.example` | Variáveis de ambiente prontas para preencher localmente ou na Vercel. |

---

## 🚀 Passo 1: Configurar a Base de Dados no Supabase

1. Aceda a [supabase.com](https://supabase.com) e crie uma conta ou novo projeto (ex.: `resolve-express-angola`).
2. No menu lateral esquerdo do Supabase, clique em **SQL Editor**.
3. Clique em **+ New query**.
4. Copie todo o conteúdo do ficheiro `supabase/schema.sql` deste repositório e cole no editor.
5. Clique no botão verde **Run** (Executar).
   * As tabelas serão criadas com **Row Level Security (RLS)** ativado.
   * O trigger para criação automática de perfil ao registar novos utilizadores (`handle_new_user`) será configurado.
   * O catálogo inicial de produtos oficiais da Resolve Express no Huambo será inserido imediatamente.
6. Aceda a **Project Settings -> API** e copie:
   * **Project URL**: (ex: `https://xyzcompany.supabase.co`)
   * **Project API Keys (`anon` / `public`)**: (chave JWT pública)

---

## ⚡ Passo 2: Deploy na Vercel

1. Aceda a [vercel.com](https://vercel.com) e conecte a sua conta GitHub/GitLab.
2. Clique em **Add New... -> Project** e selecione o repositório deste projeto.
3. Nas definições de configuração:
   * **Framework Preset**: `Vite` (a Vercel detecta automaticamente através do `vercel.json`).
   * **Build Command**: `vite build` (ou `npm run build`).
   * **Output Directory**: `dist`.
4. Na secção **Environment Variables** (Variáveis de Ambiente), adicione:
   * `VITE_SUPABASE_URL`: O seu Project URL do Supabase.
   * `VITE_SUPABASE_ANON_KEY`: A sua chave anónima (`anon` / `public`) do Supabase.
   * `GEMINI_API_KEY`: A sua chave da Google Gemini API para o assistente Resolve AI.
5. Clique em **Deploy**.

Em menos de 1 minuto a sua aplicação estará online com HTTPS e CDN global!

---

## 🔄 Modo Híbrido e Resiliência Automática

A plataforma foi arquitetada com resiliência total:
* **Com chaves Supabase**: Os produtos, agendamentos, encomendas e carteiras sincronizam em tempo real com a base de dados PostgreSQL no Supabase.
* **Sem chaves ou em modo offline**: O sistema opera com fallback transparente para o armazenamento local reativo (`store.ts`), garantindo que o utilizador nunca vê ecrãs de erro ou quebras de sistema.
