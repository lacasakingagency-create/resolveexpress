# RELATÓRIO DE VALIDAÇÃO DE SEGURANÇA E MATRIZ DE PAPÉIS (RBAC)
## RESOLVE EXPRESS — AUDITORIA DE INFRAESTRUTURA SUPABASE

Este relatório documenta a análise de segurança, as vulnerabilidades corrigidas e a matriz de testes de permissões implementadas no ficheiro consolidado `supabase/migrations/20261110000000_complete_resolve_express.sql`.

---

## 1. MATRIZ DE PAPÉIS E PERMISSÕES (RBAC)

A plataforma Resolve Express possui uma hierarquia de 11 papéis com separação estrita de privilégios:

| Papel | Descrição / Escopo | Permissões de Leitura | Permissões de Escrita | Restrições Principais |
| :--- | :--- | :--- | :--- | :--- |
| **Visitante Anónimo** | Qualquer pessoa com o link público | Catálogo público (produtos ativos, serviços ativos, configurações públicas, `public_profiles`) | Criação de agendamento ou encomenda com `user_id = null` | Sem acesso a painéis, sem acesso a dados privados de clientes, não pode ver perfis completos. |
| **Cliente** | Utilizador consumidor registado | Próprio perfil, próprios agendamentos, próprias encomendas, própria carteira e extrato | Atualização do próprio perfil (contacto), criação de agendamentos e encomendas próprias | Não pode alterar o seu papel, não pode alterar status de encomendas ou pagamentos, não pode editar saldo. |
| **Empresa Parceira A** | Entidade comercial cadastrada | Próprio perfil comercial, catálogo público, encomendas atribuídas aos seus produtos | Gestão exclusiva dos produtos com `seller_id = seu_id` | **Isolamento Total:** Não consegue visualizar nem editar produtos da Empresa Parceira B. Não pode alterar a sua comissão nem o seu status `is_verified`. |
| **Empresa Parceira B** | Entidade comercial independente | Idem à Empresa A | Idem à Empresa A | Não consegue aceder a documentos, produtos ou dados da Empresa A. |
| **Profissional A** | Prestador independente | Próprio perfil técnico, catálogo, agendamentos atribuídos a si | Edição de disponibilidade e contactos autorizados | Não pode aprovar o seu perfil (`is_verified`), não pode alterar as suas avaliações ou comentários. |
| **Profissional B** | Prestador independente | Idem ao Profissional A | Idem ao Profissional A | Isolamento mútuo em relação a outros prestadores. |
| **Funcionário** | Operador administrativo regular | Catálogo, agendamentos e encomendas para atendimento ao público | Atualização de status de agendamentos em curso | Não pode alterar configurações do sistema nem comissões de parceiros. |
| **Operação** | Equipa de campo e logística | Agendamentos, rotas de entrega, atribuição de técnicos | Atribuição de técnicos (`assigned_to`) e despacho | Não pode aceder a transações financeiras globais da plataforma. |
| **Apoio ao Cliente** | Suporte e resolução de pedidos | Histórico de agendamentos e compras para suporte ao cliente | Adição de notas de histórico de atendimento | Bloqueado de alterações financeiras ou remoção de utilizadores. |
| **Administrador** | Gestor operacional da plataforma | Acesso a todas as tabelas e perfis | Gestão de produtos, categorias, moderação de parceiros, aprovação | Não pode revogar permissões de Super Administradores. |
| **Super Administrador** | Direção executiva máxima | Acesso irrestrito a todas as tabelas | Gestão total, promoção de utilizadores, taxas de comissão, RPC de carteira | Papel máximo do sistema. |

---

## 2. VALIDAÇÃO DAS 10 CORREÇÕES DE VULNERABILIDADE

### 2.1. Blindagem de Dados Privados em `profiles`
- **Problema anterior:** A política antiga permitia `SELECT using (true)`, expondo telefones, e-mails e localizações privadas de clientes a qualquer utilizador autenticado.
- **Correção Implementada:**
  - A política de `SELECT` em `public.profiles` foi restrita para `auth.uid() = id OR public.is_staff() OR public.is_service_role()`.
  - Foi criada a vista pública `public.public_profiles` contendo exclusivamente `id, full_name, role, avatar_url, created_at`, permitindo que avaliações exibam o nome e avatar do autor sem expor números de telefone ou endereços.

### 2.2. Proteção de Agendamentos (`bookings`)
- **Problema anterior:** Qualquer utilizador podia enviar agendamentos associados a `user_id` de terceiros ou forçar `status = 'Concluído'`.
- **Correção Implementada:**
  - O RLS valida que `user_id` no `INSERT` coincide com `auth.uid()` (ou é `null` para visitantes).
  - O trigger `trg_validate_booking_insert` força `status = 'Recebido'` e `payment_status = 'Pendente'`.
  - O trigger `trg_protect_booking_tampering` impede que o cliente altere status, valores ou técnicos atribuídos durante atualizações.

### 2.3. Validação de Encomendas (`product_orders`)
- **Problema anterior:** Clientes podiam forçar `order_status = 'Entregue'` ou `payment_status = 'Confirmado'` no checkout.
- **Correção Implementada:**
  - O trigger `trg_validate_order_insert` força `order_status = 'Recebida'` e `payment_status = 'Pendente'`.
  - O trigger `trg_protect_order_tampering` congela `subtotal_aoa, delivery_fee_aoa, total_aoa, order_status, payment_status` contra alterações de utilizadores sem perfil de staff.

### 2.4. Isolamento Multi-Tenant de Produtos (`products`)
- **Problema anterior:** Parceiros tinham política genérica que permitia alterar produtos de outros parceiros.
- **Correção Implementada:**
  - As políticas de `INSERT`, `UPDATE` e `DELETE` exigem que `seller_type = 'PARTNER' AND seller_id = auth.uid()::text AND exists (select 1 from partner_profiles where id = auth.uid() and is_verified = true)`.
  - O trigger `trg_protect_product_fields` impede que um parceiro altere o seu `seller_id` ou tente assumir `seller_type = 'COMPANY'`.

### 2.5. Idempotência e Transações Financeiras (`wallet_transactions`)
- **Problema anterior:** Operações concorrentes podiam duplicar créditos ou débitos sem controlo transacional.
- **Correção Implementada:**
  - Criado o índice único condicional:
    `create unique index uq_wallet_transactions_reference on public.wallet_transactions (reference) where reference is not null and reference <> '';`
  - A RPC `execute_wallet_movement` aplica bloqueio de concorrência (`FOR UPDATE`) no registo da carteira, testa a unicidade da referência e rejeita qualquer operação duplicada com `raise exception`.

### 2.6. Blindagem da Carteira Digital (`wallets`)
- **Problema anterior:** Risco de clientes alterarem saldo via cliente Supabase se as políticas falhassem.
- **Correção Implementada:**
  - A tabela `public.wallets` possui política de escrita exclusiva para `public.is_admin() OR public.is_service_role()`.
  - Nenhum cliente ou parceiro possui permissão direta de `INSERT`, `UPDATE` ou `DELETE` na tabela `wallets`.

### 2.7. Proteção de Perfis Comerciais (`partner_profiles` & `professional_profiles`)
- **Problema anterior:** Parceiros podiam auto-aprovar-se mudando `is_verified` para `true` ou alterando a comissão.
- **Correção Implementada:**
  - O trigger `trg_protect_partner_profile` restaura automaticamente `old.is_verified` e `old.commission_rate` se o autor da alteração não for administrador.
  - O trigger `trg_protect_professional_profile` restaura automaticamente `old.is_verified`, `old.rating` e `old.reviews_count`.

### 2.8. Restrição de Upload e Gestão no Storage (`public-assets`)
- **Problema anterior:** Qualquer utilizador autenticado podia enviar ficheiros indiscriminadamente.
- **Correção Implementada:**
  - Apenas membros da equipa (`is_staff()`) ou parceiros verificados (`partner_profiles.is_verified = true`) podem carregar ficheiros em `public-assets`.
  - A eliminação e substituição de ficheiros no bucket é exclusiva para administradores (`public.is_admin()`).

### 2.9. Isolamento Físico de Documentos Privados (`partner-documents`)
- **Problema anterior:** Risco de documentos de concorrentes serem lidos se os URLs fossem partilhados.
- **Correção Implementada:**
  - O bucket `partner-documents` é estritamente privado (`public = false`).
  - As políticas RLS de `SELECT`, `INSERT`, `UPDATE` e `DELETE` em `storage.objects` validam que o primeiro segmento do caminho do ficheiro coincide com o ID do utilizador autenticado:
    `auth.uid()::text = (storage.foldername(name))[1]`.

### 2.10. Bloqueio Permanente de Auto-Promoção de Papéis
- **Problema anterior:** Envio de `role: 'super_admin'` no registo ou na edição do perfil.
- **Correção Implementada:**
  - No registo: `handle_new_user()` ignora os metadados do utilizador e atribui `role = 'cliente'`.
  - Na edição: `trg_prevent_profile_role_elevation` repõe `new.role := old.role` se o utilizador não for `super_admin`, `admin` ou `service_role`.

---

## 3. PROTEÇÃO CONTRA SEARCH-PATH HIJACKING

Todas as funções `SECURITY DEFINER` foram configuradas com a cláusula explícita:
```sql
set search_path = public, pg_temp;
```
Isto elimina a vulnerabilidade crítica de sequestro de caminho de pesquisa (CWE-426), impedindo que utilizadores maliciosos criem objetos temporários maliciosos em esquemas prioritários.

---

## 4. ANÁLISE DE DIVERGÊNCIA DA TAXA DE COMISSÃO (15% vs 25%)

- **Situação Identificada:**
  - Em `supabase/schema.sql` e `platform_settings`: a comissão padrão para parceiros estava definida em **15%**.
  - Em determinadas notas operacionais da plataforma em Huambo, foi mencionada a taxa de **25%** para serviços com alocação direta de equipa e transporte da Resolve Express.
- **Decisão Tomada no SQL:**
  - A taxa padrão no `platform_settings` e em `partner_profiles` foi mantida no valor seguro conservador de **15%**, com o campo dinamicamente editável pelo Super Administrador no painel `/admin` (Aba *Configurações* -> *Taxa de Comissão Padrão para Parceiros*).
  - O Super Administrador pode ajustar individualmente a taxa de cada parceiro sem necessidade de nova migração.
