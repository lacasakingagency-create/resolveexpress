-- ==============================================================================
-- RESOLVE EXPRESS — MIGRAÇÃO CONSOLIDADA E INCREMENTAL (SUPABASE)
-- Ficheiro: supabase/migrations/20261110000000_complete_resolve_express.sql
-- Plataforma: Resolve Express (Huambo & Angola)
-- Versão: 2.8.0 (Auditoria Corretiva de Produção, Concorrência Real e Blindagem de Stock)
-- Decisões Oficiais:
--   1. Preservação Total de Dados: Esquema estritamente incremental e compatível.
--   2. Confirmação Financeira: Dedução de stock APENAS por confirmação autorizada pelo backend (RPC confirm_order_payment).
--   3. Idempotência de Pagamento: Referência única global e validação rigorosa de montante e sobrepagamento.
--   4. Eliminação de Dupla Libertação de Stock: A rotina release_expired_stock_reservations() delega atock release ao trigger de cancelamento.
--   5. Super Admin Autenticado: Validação do e-mail real em auth.users (admin@resolvemcx.ao).
--   6. Comissões Variáveis com Holding de Liquidação: Sem fallbacks de 15%. Snapshot indelével por vendedor e retenção de pagamentos sem regra.
--   7. Quantidades sem Divergência: Rejeição de frações e validação exata de stock disponível.
--   8. Carteiras Idempotentes: Bloqueio FOR UPDATE e rejeição de referências repetidas com dados divergentes.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSÕES DO POSTGRESQL
-- ------------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists "uuid-ossp";
  exception when others then null;
  end;
  begin
    create extension if not exists "pgcrypto";
  exception when others then null;
  end;
  -- Garante existência das roles padrão em ambientes PostgreSQL de teste/locais
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 1. ESTRUTURA DE TABELAS (Criação em ordem de integridade referencial)
-- ------------------------------------------------------------------------------

-- 1.1. Perfis de Utilizadores
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text not null,
  phone text,
  role text not null default 'cliente' check (role in (
    'cliente', 'funcionario', 'empresa_parceira', 'profissional', 
    'operacao', 'apoio', 'vendedor', 'afiliado', 'admin', 'super_admin'
  )),
  province text default 'Huambo',
  municipio text default 'Huambo',
  bairro text,
  avatar_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.2. Serviços Oficiais da Plataforma
create table if not exists public.services (
  id text primary key,
  category_id text not null,
  category_name text not null,
  name text not null,
  price_aoa numeric not null default 0 check (price_aoa >= 0),
  unit text not null default 'por serviço',
  provider text not null default 'COMPANY_OWNED' check (provider in ('COMPANY_OWNED', 'INDEPENDENT_PARTNER', 'BUSINESS_PARTNER')),
  includes text[] default '{}',
  excludes text[] default '{}',
  description text not null,
  image text not null,
  is_featured boolean default false,
  is_active boolean default true,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.3. Perfis de Empresas Parceiras
create table if not exists public.partner_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  company_name text not null,
  commercial_name text,
  nif text,
  phone text,
  email text,
  province text default 'Huambo',
  municipio text default 'Huambo',
  address text,
  bairro text,
  commission_rate numeric check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100)),
  is_verified boolean default false,
  documents jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.4. Perfis de Profissionais Independentes
create table if not exists public.professional_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  specialties text[] default '{}',
  phone text,
  email text,
  province text default 'Huambo',
  municipio text default 'Huambo',
  bairro text,
  is_available boolean default true,
  is_verified boolean default false,
  rating numeric default 5.0 check (rating >= 0 and rating <= 5),
  reviews_count integer default 1 check (reviews_count >= 0),
  documents jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.5. Produtos / Marketplace
create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null,
  price_aoa numeric not null check (price_aoa >= 0),
  promotional_price_aoa numeric check (promotional_price_aoa is null or promotional_price_aoa >= 0),
  stock integer not null default 0 check (stock >= 0),
  reserved_stock integer not null default 0 check (reserved_stock >= 0),
  available boolean not null default true,
  seller_name text not null,
  seller_id text not null,
  seller_type text not null default 'COMPANY' check (seller_type in ('COMPANY', 'PARTNER', 'SELLER')),
  category text not null,
  image text not null,
  delivery_location text,
  estimated_delivery text,
  warranty text,
  unit text default 'unidade',
  rating numeric default 5.0 check (rating >= 0 and rating <= 5),
  reviews_count integer default 1 check (reviews_count >= 0),
  badge text,
  is_featured boolean default false,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint chk_reserved_stock check (reserved_stock <= stock)
);

-- 1.6. Regras de Comissões Variáveis
create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null check (rule_type in ('contract', 'partner', 'category', 'default')),
  partner_id uuid references auth.users(id) on delete cascade,
  category text,
  contract_reference text,
  rate numeric not null check (rate >= 0 and rate <= 100),
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.7. Agendamentos de Serviços
create table if not exists public.bookings (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  service_id text not null,
  service_name text not null,
  category text not null,
  customer_name text not null,
  customer_phone text not null,
  date text not null,
  time text not null,
  location text not null,
  province text not null default 'Huambo',
  municipio text not null default 'Huambo',
  bairro text,
  details text,
  status text not null default 'Recebido' check (status in ('Recebido', 'Confirmado', 'Em curso', 'Concluído', 'Cancelado')),
  payment_status text not null default 'Pendente',
  payment_method text not null,
  payment_reference text,
  payment_details jsonb default '{}'::jsonb,
  proof_of_payment text,
  total_aoa numeric check (total_aoa is null or total_aoa >= 0),
  assigned_to text,
  partner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.8. Encomendas do Marketplace
create table if not exists public.product_orders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal_aoa numeric not null default 0 check (subtotal_aoa >= 0),
  delivery_fee_aoa numeric not null default 0 check (delivery_fee_aoa >= 0),
  discount_aoa numeric not null default 0 check (discount_aoa >= 0),
  total_aoa numeric not null default 0 check (total_aoa >= 0),
  delivery_address text not null,
  delivery_bairro text not null,
  delivery_province text not null default 'Huambo',
  delivery_municipio text not null default 'Huambo',
  payment_method text not null,
  payment_status text not null default 'Pendente' check (payment_status in ('Pendente', 'Confirmado', 'Reembolsado', 'Cancelado')),
  payment_reference text,
  payment_details jsonb default '{}'::jsonb,
  proof_of_payment text,
  order_status text not null default 'Recebida' check (order_status in ('Recebida', 'Confirmada', 'Em preparação', 'A caminho', 'Entregue', 'Cancelada')),
  seller_names text[] default '{}',
  reservation_expires_at timestamptz not null default (timezone('utc'::text, now()) + interval '30 minutes'),
  stock_confirmed boolean not null default false,
  commission_rate_applied numeric check (commission_rate_applied is null or (commission_rate_applied >= 0 and commission_rate_applied <= 100)),
  commission_amount_aoa numeric not null default 0 check (commission_amount_aoa >= 0),
  seller_payout_amount_aoa numeric not null default 0 check (seller_payout_amount_aoa >= 0),
  commission_breakdown jsonb not null default '[]'::jsonb,
  requires_commission_review boolean not null default false,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.9. Auditoria Transacional de Stock
create table if not exists public.stock_audit_logs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  order_id text,
  action text not null check (action in ('RESERVE', 'CONFIRM', 'RELEASE', 'ADJUST', 'REFUND')),
  quantity integer not null,
  stock_before integer not null,
  stock_after integer not null,
  reserved_before integer not null,
  reserved_after integer not null,
  details text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.10. Carteiras e Livro-Razão
create table if not exists public.wallets (
  user_id uuid references auth.users(id) on delete cascade primary key,
  balance_aoa numeric not null default 0 check (balance_aoa >= 0),
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('credit', 'debit')),
  amount_aoa numeric not null check (amount_aoa > 0),
  description text not null,
  reference text unique,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1.11. Configurações Globais
create table if not exists public.platform_settings (
  id text primary key default 'global',
  settings jsonb not null default '{}'::jsonb,
  is_public boolean default true,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id) on delete set null
);

-- ------------------------------------------------------------------------------
-- 2. MIGRAÇÃO INCREMENTAL SEGURA (Compatibilidade com esquemas pré-existentes)
-- ------------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists province text default 'Huambo';
alter table public.profiles add column if not exists municipio text default 'Huambo';
alter table public.profiles add column if not exists bairro text;

alter table public.products add column if not exists reserved_stock integer not null default 0;
alter table public.products add column if not exists delivery_location text;
alter table public.products add column if not exists estimated_delivery text;
alter table public.products add column if not exists warranty text;
alter table public.products add column if not exists unit text default 'unidade';

alter table public.partner_profiles add column if not exists commission_rate numeric check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100));
alter table public.partner_profiles add column if not exists is_verified boolean default false;
alter table public.partner_profiles add column if not exists documents jsonb default '[]'::jsonb;

alter table public.product_orders add column if not exists reservation_expires_at timestamptz not null default (timezone('utc'::text, now()) + interval '30 minutes');
alter table public.product_orders add column if not exists stock_confirmed boolean not null default false;
alter table public.product_orders add column if not exists commission_rate_applied numeric check (commission_rate_applied is null or (commission_rate_applied >= 0 and commission_rate_applied <= 100));
alter table public.product_orders add column if not exists commission_amount_aoa numeric not null default 0 check (commission_amount_aoa >= 0);
alter table public.product_orders add column if not exists seller_payout_amount_aoa numeric not null default 0 check (seller_payout_amount_aoa >= 0);
alter table public.product_orders add column if not exists commission_breakdown jsonb not null default '[]'::jsonb;
alter table public.product_orders add column if not exists requires_commission_review boolean not null default false;

-- Restrição de Unicidade de Referência de Pagamento Confirmado
-- Uma referência externa NUNCA pode ser reutilizada para liquidar mais de uma encomenda!
create unique index if not exists uq_product_orders_paid_reference 
  on public.product_orders (payment_reference) 
  where (payment_status in ('Confirmado', 'Pago') and payment_reference is not null);

-- ------------------------------------------------------------------------------
-- 3. FUNÇÕES DE AUTORIZAÇÃO (RBAC) COM SEARCH_PATH SEGURO E PROTEÇÃO CONTRA PROBING
-- ------------------------------------------------------------------------------
create or replace function public.is_admin(p_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = case
      when p_user_id is not null and p_user_id <> auth.uid() then
        case when (
          coalesce(auth.jwt()->>'role', '') = 'service_role'
          or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
        ) then p_user_id else auth.uid() end
      else auth.uid()
    end
    and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_staff(p_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = case
      when p_user_id is not null and p_user_id <> auth.uid() then
        case when (
          coalesce(auth.jwt()->>'role', '') = 'service_role'
          or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin', 'operacao', 'funcionario', 'apoio'))
        ) then p_user_id else auth.uid() end
      else auth.uid()
    end
    and role in ('admin', 'super_admin', 'operacao', 'funcionario', 'apoio')
  );
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role';
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

revoke execute on function public.is_staff(uuid) from public, anon;
grant execute on function public.is_staff(uuid) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. FUNÇÃO DE CÁLCULO DE COMISSÃO (HIERARQUIA SEM FALLBACK ARBITRÁRIO)
-- Precedência: Contrato > Parceiro > Categoria > Padrão Ativo Configurado.
-- Se nenhuma regra existir, retorna NULL para exigir intervenção administrativa.
-- ------------------------------------------------------------------------------
create or replace function public.calculate_commission_rate(
  p_partner_id uuid,
  p_category text,
  p_contract_reference text default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate numeric;
begin
  -- 1. Prioridade Máxima: Contrato Específico
  if p_contract_reference is not null and length(trim(p_contract_reference)) > 0 then
    select rate into v_rate
    from public.commission_rules
    where rule_type = 'contract'
      and contract_reference = p_contract_reference
      and is_active = true
    order by updated_at desc
    limit 1;
    if v_rate is not null then return v_rate; end if;
  end if;

  -- 2. Segunda Prioridade: Parceiro Específico
  if p_partner_id is not null then
    select rate into v_rate
    from public.commission_rules
    where rule_type = 'partner'
      and partner_id = p_partner_id
      and is_active = true
    order by updated_at desc
    limit 1;
    if v_rate is not null then return v_rate; end if;

    -- Fallback de perfil de parceiro (apenas se taxa foi expressamente homologada por admin)
    select commission_rate into v_rate
    from public.partner_profiles
    where id = p_partner_id
      and is_verified = true
      and commission_rate is not null;
    if v_rate is not null then return v_rate; end if;
  end if;

  -- 3. Terceira Prioridade: Categoria de Produto / Serviço
  if p_category is not null and length(trim(p_category)) > 0 then
    select rate into v_rate
    from public.commission_rules
    where rule_type = 'category'
      and lower(trim(category)) = lower(trim(p_category))
      and is_active = true
    order by updated_at desc
    limit 1;
    if v_rate is not null then return v_rate; end if;
  end if;

  -- 4. Quarta Prioridade: Taxa Padrão Ativa Configurada na Tabela de Regras
  select rate into v_rate
  from public.commission_rules
  where rule_type = 'default'
    and is_active = true
  order by updated_at desc
  limit 1;
  if v_rate is not null then return v_rate; end if;

  -- REGRA DE SEGURANÇA MÁXIMA: Nunca inventar fallbacks de 15%. Retorna NULL para sinalizar revisão!
  return null;
end;
$$;

revoke execute on function public.calculate_commission_rate(uuid, text, text) from public, anon;
grant execute on function public.calculate_commission_rate(uuid, text, text) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. TRIGGERS DE SEGURANÇA E GESTÃO TRANSACIONAL
-- ------------------------------------------------------------------------------

-- 5.1. Sincronização de Novos Utilizadores e Promoção Exclusiva de admin@resolvemcx.ao
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_initial_role text := 'cliente';
begin
  -- Promoção automática autorizada estritamente para a conta oficial única
  if lower(trim(new.email)) = 'admin@resolvemcx.ao' then
    v_initial_role := 'super_admin';
  end if;

  insert into public.profiles (id, email, full_name, phone, role, province, municipio, bairro)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', null),
    v_initial_role,
    coalesce(new.raw_user_meta_data->>'province', 'Huambo'),
    coalesce(new.raw_user_meta_data->>'municipio', 'Huambo'),
    coalesce(new.raw_user_meta_data->>'bairro', null)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    role = case when lower(trim(excluded.email)) = 'admin@resolvemcx.ao' then 'super_admin' else public.profiles.role end,
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5.2. Bloqueio de Inserção Não Autorizada de Perfis (Verifica auth.users real!)
create or replace function public.validate_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_email text;
begin
  -- Busca o email real na tabela auth.users pelo UUID para impedir spoofing do payload
  select lower(trim(u.email)) into v_auth_email
  from auth.users u
  where u.id = coalesce(new.id, auth.uid());

  if v_auth_email = 'admin@resolvemcx.ao' then
    new.role := 'super_admin';
  elsif not (public.is_admin() or public.is_service_role()) then
    new.role := 'cliente';
  end if;

  new.created_at := coalesce(new.created_at, timezone('utc'::text, now()));
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_validate_profile_insert on public.profiles;
create trigger trg_validate_profile_insert
  before insert on public.profiles
  for each row execute procedure public.validate_profile_insert();

-- 5.3. Bloqueio de Auto-Elevação de Papéis em Atualizações (Verifica auth.users real!)
create or replace function public.prevent_profile_role_self_elevation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_email text;
begin
  if old.role is distinct from new.role then
    select lower(trim(u.email)) into v_auth_email
    from auth.users u
    where u.id = coalesce(new.id, auth.uid());

    if v_auth_email = 'admin@resolvemcx.ao' and new.role = 'super_admin' then
      null; -- Promoção permitida apenas para a conta oficial confirmada em auth.users
    elsif not (public.is_admin() or public.is_service_role()) then
      new.role := old.role; -- Bloqueio de autoelevação
    end if;
  end if;

  new.id := old.id;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_role_elevation on public.profiles;
create trigger trg_prevent_profile_role_elevation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_role_self_elevation();

-- 5.4. Proteção de Perfis de Empresas Parceiras
create or replace function public.protect_partner_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not (public.is_admin() or public.is_service_role()) then
      new.is_verified := false;
      new.commission_rate := null; -- Nunca forçar 15% na criação!
    end if;
  elsif tg_op = 'UPDATE' then
    if not (public.is_admin() or public.is_service_role()) then
      new.is_verified := old.is_verified;
      new.commission_rate := old.commission_rate;
      new.id := old.id;
    end if;
  end if;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_protect_partner_profile on public.partner_profiles;
create trigger trg_protect_partner_profile
  before insert or update on public.partner_profiles
  for each row execute procedure public.protect_partner_profile_fields();

-- 5.5. Proteção de Perfis Profissionais
create or replace function public.protect_professional_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not (public.is_admin() or public.is_service_role()) then
      new.is_verified := false;
      new.rating := 5.0;
      new.reviews_count := 1;
    end if;
  elsif tg_op = 'UPDATE' then
    if not (public.is_admin() or public.is_service_role()) then
      new.is_verified := old.is_verified;
      new.rating := old.rating;
      new.reviews_count := old.reviews_count;
      new.id := old.id;
    end if;
  end if;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_protect_professional_profile on public.professional_profiles;
create trigger trg_protect_professional_profile
  before insert or update on public.professional_profiles
  for each row execute procedure public.protect_professional_profile_fields();

-- 5.6. Proteção de Produtos e Vendedores
create or replace function public.protect_product_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not (public.is_admin() or public.is_service_role()) then
      new.seller_id := auth.uid()::text;
      new.seller_type := 'PARTNER';
      new.rating := 5.0;
      new.reviews_count := 1;
      new.reserved_stock := 0;
    end if;
  elsif tg_op = 'UPDATE' then
    if not (public.is_admin() or public.is_service_role()) then
      new.seller_id := old.seller_id;
      new.seller_type := old.seller_type;
      new.rating := old.rating;
      new.reviews_count := old.reviews_count;
      -- Protege reserved_stock contra adulteração externa; permite apenas rotinas transacionais autorizadas
      if coalesce(current_setting('app.internal_stock_operation', true), 'false') <> 'true' then
        new.reserved_stock := old.reserved_stock;
      end if;
    end if;
  end if;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_protect_product_fields on public.products;
create trigger trg_protect_product_fields
  before insert or update on public.products
  for each row execute procedure public.protect_product_fields();

-- 5.7. Validação de Agendamentos (Trata Preço Zero e Orçamentos sob Consulta)
create or replace function public.validate_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_db_service_price numeric;
  v_db_service_active boolean;
begin
  if not (public.is_staff() or public.is_service_role()) then
    new.status := 'Recebido';
    new.payment_status := 'Pendente';
    new.assigned_to := null;
    new.partner_id := null;

    if new.service_id is null or length(trim(new.service_id)) = 0 then
      raise exception 'O identificador do serviço (service_id) é estritamente obrigatório.';
    end if;

    select price_aoa, is_active
    into v_db_service_price, v_db_service_active
    from public.services
    where id = new.service_id;

    if not found then
      raise exception 'Serviço inexistente no catálogo oficial: %', new.service_id;
    end if;

    if not v_db_service_active then
      raise exception 'O serviço % encontra-se inativo no momento.', new.service_id;
    end if;

    -- Se o serviço tem preço fixo configurado, força o valor do catálogo.
    -- Se tem preço zero ou sob consulta, total é forçado para 0 (aguarda vistoria/orçamento).
    if v_db_service_price is not null and v_db_service_price > 0 then
      new.total_aoa := v_db_service_price;
    else
      new.total_aoa := 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_booking_insert on public.bookings;
create trigger trg_validate_booking_insert
  before insert on public.bookings
  for each row execute procedure public.validate_booking_insert();

-- Proteção Individual de Todos os Campos de Agendamentos em Atualizações
create or replace function public.protect_booking_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.user_id := old.user_id;
  new.service_id := old.service_id;

  if not (public.is_staff() or public.is_service_role()) then
    -- Campos financeiros e operacionais protegidos contra cliente e terceiros
    new.total_aoa := old.total_aoa;
    new.assigned_to := old.assigned_to;
    new.partner_id := old.partner_id;
    new.payment_status := old.payment_status;
    new.payment_method := old.payment_method;
    new.payment_reference := old.payment_reference;

    if auth.uid() = old.user_id then
      -- O cliente só pode editar detalhes se o pedido ainda estiver apenas 'Recebido'
      if old.status <> 'Recebido' then
        new.customer_name := old.customer_name;
        new.customer_phone := old.customer_phone;
        new.date := old.date;
        new.time := old.time;
        new.location := old.location;
        new.details := old.details;
      end if;

      -- O cliente só pode transitar de 'Recebido' para 'Cancelado'
      if old.status <> new.status then
        if new.status = 'Cancelado' and old.status = 'Recebido' then
          null;
        else
          new.status := old.status;
        end if;
      end if;
    elsif auth.uid() = old.partner_id then
      -- Parceiro só pode alterar status operacional para 'Em curso' ou 'Concluído'
      if old.status <> new.status then
        if new.status not in ('Em curso', 'Concluído') or old.status not in ('Confirmado', 'Em curso') then
          new.status := old.status;
        end if;
      end if;
    else
      new.status := old.status;
    end if;
  end if;

  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_protect_booking_tampering on public.bookings;
create trigger trg_protect_booking_tampering
  before update on public.bookings
  for each row execute procedure public.protect_booking_tampering();

-- 5.8. Validação de Encomendas: Reserva Temporária de Stock (30m) e Comissão por Vendedor
create or replace function public.validate_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_prod_id text;
  v_qty numeric;
  v_unit text;
  v_calc_subtotal numeric := 0;
  v_db_price numeric;
  v_db_promo numeric;
  v_effective_price numeric;
  v_item_subtotal numeric := 0;
  v_db_stock integer;
  v_db_reserved integer;
  v_available_to_sell integer;
  v_db_available boolean;
  v_seller_id text;
  v_seller_uuid uuid;
  v_seller_name text;
  v_category text;
  v_authorized_delivery_fee numeric := 500;
  v_item_rate numeric;
  v_item_commission numeric := 0;
  v_item_seller_payout numeric := 0;
  v_total_commission numeric := 0;
  v_total_seller_payout numeric := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_has_missing_rule boolean := false;
begin
  if not (public.is_staff() or public.is_service_role()) then
    new.order_status := 'Recebida';
    new.payment_status := 'Pendente';
    new.stock_confirmed := false;
    new.reservation_expires_at := timezone('utc'::text, now()) + interval '30 minutes';

    -- Exige utilizador autenticado
    if new.user_id is null then
      raise exception 'A criação de encomendas exige um utilizador devidamente autenticado.';
    end if;

    if auth.uid() is not null and new.user_id <> auth.uid() then
      new.user_id := auth.uid();
    end if;

    if new.items is null or jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then
      raise exception 'A encomenda deve conter pelo menos um produto catalogado.';
    end if;

    -- Itera sobre cada produto: bloqueio FOR UPDATE, reserva de stock e cálculo individual de comissão
    for v_item in select * from jsonb_array_elements(new.items)
    loop
      v_prod_id := coalesce(v_item->'product'->>'id', v_item->>'productId', v_item->>'id');
      v_qty := coalesce((v_item->>'quantity')::numeric, 1);

      if v_prod_id is null or v_qty <= 0 then
        raise exception 'Item de encomenda inválido: identificador ou quantidade incorreta.';
      end if;

      -- Rejeição estrita de quantidades fracionárias para produtos por unidade
      if v_qty <> floor(v_qty) then
        raise exception 'Quantidades fracionárias não são permitidas no Resolve Express: produto % (quantidade solicitada: %).',
          v_prod_id, v_qty;
      end if;

      -- Bloqueio Concorrente de Linha (FOR UPDATE)
      select price_aoa, promotional_price_aoa, stock, reserved_stock, available, unit, seller_id, seller_name, category
      into v_db_price, v_db_promo, v_db_stock, v_db_reserved, v_db_available, v_unit, v_seller_id, v_seller_name, v_category
      from public.products
      where id = v_prod_id
      for update;

      if not found then
        raise exception 'Produto inexistente no inventário do Resolve Express: %', v_prod_id;
      end if;

      if not v_db_available then
        raise exception 'O produto % encontra-se indisponível no momento.', v_prod_id;
      end if;

      -- Validação de stock disponível real (Físico - Já Reservado)
      v_available_to_sell := v_db_stock - v_db_reserved;
      if v_available_to_sell < v_qty::integer then
        raise exception 'Stock insuficiente para o produto % (Total: %, Já Reservado: %, Disponível: %, Solicitado: %)',
          v_prod_id, v_db_stock, v_db_reserved, v_available_to_sell, v_qty::integer;
      end if;

      -- Habilita operação transacional de stock na sessão corrente
      perform set_config('app.internal_stock_operation', 'true', true);

      -- Reserva Atómica Temporária (sem deduções físicas prematuras)
      update public.products
      set reserved_stock = reserved_stock + v_qty::integer,
          updated_at = timezone('utc'::text, now())
      where id = v_prod_id;

      -- Registo de Auditoria Transacional
      insert into public.stock_audit_logs (
        product_id, order_id, action, quantity,
        stock_before, stock_after, reserved_before, reserved_after,
        details, performed_by
      ) values (
        v_prod_id, new.id, 'RESERVE', v_qty::integer,
        v_db_stock, v_db_stock, v_db_reserved, v_db_reserved + v_qty::integer,
        'Reserva temporária atómica (janela de 30 minutos)', new.user_id
      );

      -- Preço unitário efetivo (com promoção se aplicável)
      if v_db_promo is not null and v_db_promo > 0 and v_db_promo < v_db_price then
        v_effective_price := v_db_promo;
      else
        v_effective_price := v_db_price;
      end if;

      v_item_subtotal := v_effective_price * v_qty::integer;
      v_calc_subtotal := v_calc_subtotal + v_item_subtotal;

      begin
        v_seller_uuid := v_seller_id::uuid;
      exception when others then
        v_seller_uuid := null;
      end;

      -- Cálculo de comissão individual por item/vendedor
      v_item_rate := public.calculate_commission_rate(v_seller_uuid, v_category);

      if v_item_rate is null then
        v_has_missing_rule := true;
        v_item_commission := 0;
        v_item_seller_payout := v_item_subtotal;
      else
        v_item_commission := round((v_item_subtotal * v_item_rate) / 100, 2);
        v_item_seller_payout := greatest(0, v_item_subtotal - v_item_commission);
      end if;

      v_total_commission := v_total_commission + v_item_commission;
      v_total_seller_payout := v_total_seller_payout + v_item_seller_payout;

      -- Snapshot histórico indelével por item e vendedor
      v_breakdown := v_breakdown || jsonb_build_object(
        'product_id', v_prod_id,
        'seller_id', v_seller_id,
        'seller_name', v_seller_name,
        'category', v_category,
        'quantity', v_qty::integer,
        'effective_price_aoa', v_effective_price,
        'subtotal_aoa', v_item_subtotal,
        'commission_rate', v_item_rate,
        'commission_amount_aoa', v_item_commission,
        'seller_payout_amount_aoa', v_item_seller_payout,
        'rule_status', case when v_item_rate is null then 'REQUIRES_ADMIN_CONFIG' else 'CONFIGURED' end
      );
    end loop;

    new.subtotal_aoa := v_calc_subtotal;

    -- Taxa de Entrega Homologada pelo Servidor
    select coalesce((settings->'marketplace'->>'defaultDeliveryFeeAOA')::numeric, 500)
    into v_authorized_delivery_fee
    from public.platform_settings
    where id = 'global';

    new.delivery_fee_aoa := coalesce(v_authorized_delivery_fee, 500);
    new.discount_aoa := 0;
    new.total_aoa := greatest(0, new.subtotal_aoa - new.discount_aoa + new.delivery_fee_aoa);

    -- Snapshots Históricos Indeléveis
    new.commission_breakdown := v_breakdown;
    new.commission_amount_aoa := v_total_commission;
    new.seller_payout_amount_aoa := v_total_seller_payout;
    new.requires_commission_review := v_has_missing_rule;

    if new.subtotal_aoa > 0 then
      new.commission_rate_applied := round((v_total_commission / new.subtotal_aoa) * 100, 2);
    else
      new.commission_rate_applied := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_order_insert on public.product_orders;
create trigger trg_validate_order_insert
  before insert on public.product_orders
  for each row execute procedure public.validate_order_insert();

-- 5.9. Gestão Transacional de Encomendas: Tratamento Exclusivo de Cancelamentos e Blindagem
-- IMPORTANTE: A dedução de stock NÃO é feita aqui; é executada exclusivamente por confirm_order_payment()
create or replace function public.protect_order_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_prod_id text;
  v_qty numeric;
  v_curr_stock integer;
  v_curr_reserved integer;
begin
  new.user_id := old.user_id;
  new.items := old.items;

  -- 1. TRATAMENTO ATÓMICO DE CANCELAMENTO (Ponto único de libertação e reembolso)
  if new.order_status = 'Cancelada' and old.order_status <> 'Cancelada' then
    for v_item in select * from jsonb_array_elements(old.items)
    loop
      v_prod_id := coalesce(v_item->'product'->>'id', v_item->>'productId', v_item->>'id');
      v_qty := coalesce((v_item->>'quantity')::numeric, 1);

      if v_prod_id is not null and v_qty > 0 then
        select stock, reserved_stock into v_curr_stock, v_curr_reserved
        from public.products
        where id = v_prod_id
        for update;

        perform set_config('app.internal_stock_operation', 'true', true);

        if old.stock_confirmed = true then
          -- O stock físico já tinha sido deduzido pelo pagamento confirmado; reembolsar ao inventário
          update public.products
          set stock = stock + v_qty::integer,
              updated_at = timezone('utc'::text, now())
          where id = v_prod_id;

          insert into public.stock_audit_logs (
            product_id, order_id, action, quantity,
            stock_before, stock_after, reserved_before, reserved_after,
            details, performed_by
          ) values (
            v_prod_id, new.id, 'REFUND', v_qty::integer,
            v_curr_stock, v_curr_stock + v_qty::integer,
            v_curr_reserved, v_curr_reserved,
            'Estorno de inventário por cancelamento de encomenda previamente liquidada',
            coalesce(auth.uid(), old.user_id)
          );
        else
          -- O stock estava apenas reservado; libertar a reserva temporária
          update public.products
          set reserved_stock = greatest(0, reserved_stock - v_qty::integer),
              updated_at = timezone('utc'::text, now())
          where id = v_prod_id;

          insert into public.stock_audit_logs (
            product_id, order_id, action, quantity,
            stock_before, stock_after, reserved_before, reserved_after,
            details, performed_by
          ) values (
            v_prod_id, new.id, 'RELEASE', v_qty::integer,
            v_curr_stock, v_curr_stock,
            v_curr_reserved, greatest(0, v_curr_reserved - v_qty::integer),
            'Libertação de reserva temporária de stock por cancelamento',
            coalesce(auth.uid(), old.user_id)
          );
        end if;
      end if;
    end loop;
  end if;

  -- 2. BLINDAGEM CONTRA ADULTERAÇÃO DE DADOS PELO CLIENTE
  if not (public.is_staff() or public.is_service_role()) then
    new.payment_status := old.payment_status;
    new.stock_confirmed := old.stock_confirmed;
    new.total_aoa := old.total_aoa;
    new.subtotal_aoa := old.subtotal_aoa;
    new.delivery_fee_aoa := old.delivery_fee_aoa;
    new.discount_aoa := old.discount_aoa;
    new.commission_rate_applied := old.commission_rate_applied;
    new.commission_amount_aoa := old.commission_amount_aoa;
    new.seller_payout_amount_aoa := old.seller_payout_amount_aoa;
    new.commission_breakdown := old.commission_breakdown;
    new.requires_commission_review := old.requires_commission_review;
    new.reservation_expires_at := old.reservation_expires_at;

    -- O cliente só pode transitar de 'Recebida' para 'Cancelada'
    if old.order_status <> new.order_status then
      if new.order_status = 'Cancelada' and old.order_status = 'Recebida' then
        null;
      else
        new.order_status := old.order_status;
      end if;
    end if;
  end if;

  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_protect_order_tampering on public.product_orders;
create trigger trg_protect_order_tampering
  before update on public.product_orders
  for each row execute procedure public.protect_order_tampering();

-- ------------------------------------------------------------------------------
-- 6. RPC DE CONFIRMAÇÃO FINANCEIRA E DEDUÇÃO DE STOCK (BACKEND AUTENTICADO)
-- Ponto único, transacional e atómico de liquidação financeira e dedução de stock
-- ------------------------------------------------------------------------------
create or replace function public.confirm_order_payment(
  p_order_id text,
  p_payment_reference text,
  p_payment_method text,
  p_amount_paid numeric,
  p_payment_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.product_orders%rowtype;
  v_item jsonb;
  v_prod_id text;
  v_qty numeric;
  v_curr_stock integer;
  v_curr_reserved integer;
  v_existing_order_id text;
  v_overpayment numeric := 0;
begin
  -- 1. Autorização estrita: apenas backend seguro ou administradores
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Acesso negado: a confirmação financeira de encomendas exige privilégios de service_role ou administrador.';
  end if;

  -- 2. Validações preliminares obrigatórias
  if p_order_id is null or length(trim(p_order_id)) = 0 then
    raise exception 'O identificador da encomenda (p_order_id) é obrigatório.';
  end if;

  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A referência externa de pagamento (p_payment_reference) é estritamente obrigatória.';
  end if;

  if p_payment_method is null or length(trim(p_payment_method)) = 0 then
    raise exception 'O método de pagamento (p_payment_method) é obrigatório.';
  end if;

  if p_amount_paid is null or p_amount_paid <= 0 then
    raise exception 'Montante pago inválido: o valor deve ser estritamente superior a zero (recebido: %).', p_amount_paid;
  end if;

  -- 3. Bloqueio pessimista da encomenda (FOR UPDATE)
  select * into v_order
  from public.product_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Encomenda não encontrada no sistema: %', p_order_id;
  end if;

  -- 4. Idempotência real: se a encomenda já foi liquidada
  if v_order.payment_status in ('Confirmado', 'Pago') and v_order.stock_confirmed = true then
    if v_order.payment_reference is distinct from p_payment_reference then
      raise exception 'Conflito de confirmação: a encomenda % já foi liquidada com outra referência (existente: %, tentativa: %).',
        p_order_id, v_order.payment_reference, p_payment_reference;
    end if;

    return jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'already_confirmed', true,
      'payment_status', v_order.payment_status,
      'stock_confirmed', true,
      'idempotent_replay', true
    );
  end if;

  -- 5. Impedir confirmação de encomendas canceladas
  if v_order.order_status = 'Cancelada' then
    raise exception 'Operação rejeitada: a encomenda % está cancelada e as suas reservas foram libertadas.', p_order_id;
  end if;

  -- 6. Impedir confirmação se a reserva temporária expirou antes do pagamento
  if v_order.reservation_expires_at < timezone('utc'::text, now()) then
    raise exception 'Operação rejeitada: a reserva temporária de stock da encomenda % expirou em %. Requeira nova encomenda.',
      p_order_id, v_order.reservation_expires_at;
  end if;

  -- 7. Unicidade global da referência de pagamento externa
  select id into v_existing_order_id
  from public.product_orders
  where payment_reference = p_payment_reference
    and payment_status in ('Confirmado', 'Pago')
    and id <> p_order_id
  limit 1;

  if v_existing_order_id is not null then
    raise exception 'Referência externa duplicada detectada: a referência % já liquidou a encomenda %.',
      p_payment_reference, v_existing_order_id;
  end if;

  -- 8. Validação do montante pago e cálculo explícito de excedente
  if p_amount_paid < v_order.total_aoa then
    raise exception 'Montante insuficiente: o valor pago (% AOA) é inferior ao total exigido (% AOA).',
      p_amount_paid, v_order.total_aoa;
  end if;

  v_overpayment := round(p_amount_paid - v_order.total_aoa, 2);

  -- 9. DEDUÇÃO DEFINITIVA DE STOCK E LIMPEZA DA RESERVA (FOR UPDATE em produtos)
  for v_item in select * from jsonb_array_elements(v_order.items)
  loop
    v_prod_id := coalesce(v_item->'product'->>'id', v_item->>'productId', v_item->>'id');
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);

    if v_prod_id is not null and v_qty > 0 then
      select stock, reserved_stock into v_curr_stock, v_curr_reserved
      from public.products
      where id = v_prod_id
      for update;

      if not found then
        raise exception 'Produto inexistente durante a liquidação de stock: %', v_prod_id;
      end if;

      perform set_config('app.internal_stock_operation', 'true', true);

      update public.products
      set stock = greatest(0, stock - v_qty::integer),
          reserved_stock = greatest(0, reserved_stock - v_qty::integer),
          updated_at = timezone('utc'::text, now())
      where id = v_prod_id;

      insert into public.stock_audit_logs (
        product_id, order_id, action, quantity,
        stock_before, stock_after, reserved_before, reserved_after,
        details, performed_by
      ) values (
        v_prod_id, p_order_id, 'CONFIRM', v_qty::integer,
        v_curr_stock, greatest(0, v_curr_stock - v_qty::integer),
        v_curr_reserved, greatest(0, v_curr_reserved - v_qty::integer),
        'Liquidação financeira autorizada: dedução física definitiva de inventário',
        coalesce(auth.uid(), v_order.user_id)
      );
    end if;
  end loop;

  -- 10. Atualização final da encomenda
  update public.product_orders
  set payment_status = 'Confirmado',
      payment_reference = p_payment_reference,
      payment_method = p_payment_method,
      payment_details = coalesce(p_payment_details, '{}'::jsonb) || jsonb_build_object(
        'amount_paid_aoa', p_amount_paid,
        'overpayment_aoa', v_overpayment,
        'confirmed_at', timezone('utc'::text, now())
      ),
      order_status = 'Confirmada',
      stock_confirmed = true,
      updated_at = timezone('utc'::text, now())
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payment_status', 'Confirmado',
    'stock_confirmed', true,
    'total_aoa', v_order.total_aoa,
    'amount_paid_aoa', p_amount_paid,
    'overpayment_aoa', v_overpayment,
    'requires_commission_review', v_order.requires_commission_review,
    'idempotent_replay', false
  );
end;
$$;

revoke execute on function public.confirm_order_payment(text, text, text, numeric, jsonb) from public, anon;
grant execute on function public.confirm_order_payment(text, text, text, numeric, jsonb) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. ROTINA DE EXPIRAÇÃO DE RESERVAS DE STOCK (30 MINUTOS)
-- Sem duplo decremento: delega o release de stock exclusivamente ao trigger de cancelamento
-- ------------------------------------------------------------------------------
create or replace function public.release_expired_stock_reservations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec record;
  v_count integer := 0;
begin
  -- Apenas service_role ou administradores podem disparar a rotina global
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Acesso negado: a rotina de expiração de reservas é de uso exclusivo do sistema.';
  end if;

  -- Itera apenas sobre encomendas pendentes não confirmadas com reserva vencida
  for v_rec in
    select id
    from public.product_orders
    where stock_confirmed = false
      and order_status = 'Recebida'
      and payment_status = 'Pendente'
      and reservation_expires_at < timezone('utc'::text, now())
    for update skip locked
  loop
    -- O UPDATE aciona o trigger protect_order_tampering que liberta o reserved_stock
    -- de forma atómica e idempotente (eliminando o bug de dupla libertação da v2.7.0)
    update public.product_orders
    set order_status = 'Cancelada',
        updated_at = timezone('utc'::text, now())
    where id = v_rec.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Restringe estritamente a execução: clientes comuns não podem disparar a rotina
revoke execute on function public.release_expired_stock_reservations() from public, anon, authenticated;
grant execute on function public.release_expired_stock_reservations() to service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC FINANCEIRA TRANSACIONAL COM VALIDAÇÃO ESTRITA DE IDEMPOTÊNCIA
-- ------------------------------------------------------------------------------
create or replace function public.execute_wallet_movement(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_balance numeric := 0;
  v_new_balance numeric := 0;
  v_existing_tx record;
  v_tx_id uuid;
begin
  if p_user_id is null then
    raise exception 'O identificador de utilizador (p_user_id) é estritamente obrigatório.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Utilizador não encontrado no sistema de autenticação: %', p_user_id;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'O montante da operação financeira deve ser estritamente superior a zero.';
  end if;

  if p_type not in ('credit', 'debit') then
    raise exception 'Tipo de movimento inválido: utilize credit ou debit.';
  end if;

  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'A descrição da movimentação (p_description) é obrigatória.';
  end if;

  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Acesso negado: operações financeiras requerem privilégios de administrador ou service_role.';
  end if;

  -- Validação Estrita de Idempotência: Parâmetros devem coincidir integralmente
  if p_reference is not null and length(trim(p_reference)) > 0 then
    select id, user_id, amount_aoa, type
    into v_existing_tx
    from public.wallet_transactions
    where reference = p_reference;

    if found then
      if v_existing_tx.user_id <> p_user_id 
         or v_existing_tx.amount_aoa <> p_amount 
         or v_existing_tx.type <> p_type then
        raise exception 'Violação de idempotência financeira: a referência % já existe com parâmetros divergentes (Utilizador: %, Tipo: %, Montante: %).',
          p_reference, v_existing_tx.user_id, v_existing_tx.type, v_existing_tx.amount_aoa;
      end if;

      select balance_aoa into v_current_balance from public.wallets where user_id = p_user_id;
      return jsonb_build_object(
        'success', true,
        'transaction_id', v_existing_tx.id,
        'balance_aoa', v_current_balance,
        'amount', v_existing_tx.amount_aoa,
        'type', v_existing_tx.type,
        'reference', p_reference,
        'idempotent_replay', true
      );
    end if;
  else
    raise exception 'A referência única da transação (p_reference) é estritamente obrigatória para garantir idempotência.';
  end if;

  -- Bloqueio Concorrente Pessimista (FOR UPDATE)
  insert into public.wallets (user_id, balance_aoa, updated_at)
  values (p_user_id, 0, timezone('utc'::text, now()))
  on conflict (user_id) do nothing;

  select balance_aoa into v_current_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if p_type = 'credit' then
    v_new_balance := v_current_balance + p_amount;
  else
    if v_current_balance < p_amount then
      raise exception 'Saldo insuficiente na carteira (Saldo atual: % AOA, Tentativa de débito: % AOA)', v_current_balance, p_amount;
    end if;
    v_new_balance := v_current_balance - p_amount;
  end if;

  update public.wallets
  set balance_aoa = v_new_balance, updated_at = timezone('utc'::text, now())
  where user_id = p_user_id;

  insert into public.wallet_transactions (user_id, type, amount_aoa, description, reference, created_at)
  values (p_user_id, p_type, p_amount, p_description, p_reference, timezone('utc'::text, now()))
  returning id into v_tx_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount,
    'type', p_type,
    'reference', p_reference,
    'idempotent_replay', false
  );
end;
$$;

revoke execute on function public.execute_wallet_movement(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.execute_wallet_movement(uuid, text, numeric, text, text) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. VISTA PÚBLICA SEGURA (Sem dados pessoais ou papéis internos)
-- ------------------------------------------------------------------------------
create or replace view public.public_profiles with (security_invoker = false) as
  select
    id,
    full_name,
    avatar_url,
    created_at
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 10. POLÍTICAS DE CONTROLO DE ACESSO (ROW LEVEL SECURITY)
-- Limpeza preventiva de políticas antigas e homologação de regras estritas
-- ------------------------------------------------------------------------------

-- 10.1. Profiles
alter table public.profiles enable row level security;
drop policy if exists "Perfis restritos ao proprio utilizador ou staff" on public.profiles;
drop policy if exists "Perfis públicos ou próprios para leitura" on public.profiles;
drop policy if exists "Utilizadores podem criar o seu perfil" on public.profiles;
drop policy if exists "Utilizadores podem atualizar o seu próprio perfil" on public.profiles;

create policy "Perfis restritos ao proprio utilizador ou staff"
  on public.profiles for select
  using (auth.uid() = id or public.is_staff() or public.is_service_role());

create policy "Utilizadores podem criar o seu perfil"
  on public.profiles for insert
  with check (auth.uid() = id or public.is_service_role());

create policy "Utilizadores podem atualizar o seu próprio perfil"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin() or public.is_service_role());

-- 10.2. Services
alter table public.services enable row level security;
drop policy if exists "Serviços visíveis para todos" on public.services;
drop policy if exists "Apenas administradores gerem serviços" on public.services;

create policy "Serviços visíveis para todos"
  on public.services for select
  using (is_active = true or public.is_staff() or public.is_service_role());

create policy "Apenas administradores gerem serviços"
  on public.services for all
  using (public.is_admin() or public.is_service_role());

-- 10.3. Products
alter table public.products enable row level security;
drop policy if exists "Produtos visíveis para todos" on public.products;
drop policy if exists "Admins e parceiros autorizados inserem produtos" on public.products;
drop policy if exists "Admins e parceiros autorizados atualizam produtos" on public.products;
drop policy if exists "Admins e parceiros autorizados eliminam produtos" on public.products;

create policy "Produtos visíveis para todos"
  on public.products for select
  using (
    available = true 
    or public.is_staff() 
    or public.is_service_role()
    or (auth.uid() is not null and seller_id = auth.uid()::text)
  );

create policy "Admins e parceiros autorizados inserem produtos"
  on public.products for insert
  with check (
    public.is_admin() 
    or public.is_service_role()
    or (
      seller_type = 'PARTNER' 
      and seller_id = auth.uid()::text 
      and exists (
        select 1 from public.partner_profiles 
        where id = auth.uid() and is_verified = true
      )
    )
  );

create policy "Admins e parceiros autorizados atualizam produtos"
  on public.products for update
  using (
    public.is_admin() 
    or public.is_service_role()
    or (
      seller_type = 'PARTNER' 
      and seller_id = auth.uid()::text 
      and exists (
        select 1 from public.partner_profiles 
        where id = auth.uid() and is_verified = true
      )
    )
  );

create policy "Admins e parceiros autorizados eliminam produtos"
  on public.products for delete
  using (
    public.is_admin() 
    or public.is_service_role()
    or (
      seller_type = 'PARTNER' 
      and seller_id = auth.uid()::text
      and exists (
        select 1 from public.partner_profiles 
        where id = auth.uid() and is_verified = true
      )
    )
  );

-- 10.4. Commission Rules (Restrição pública de taxas e contratos)
alter table public.commission_rules enable row level security;
drop policy if exists "Staff e parceiros consultam comissoes" on public.commission_rules;
drop policy if exists "Apenas administradores gerem regras de comissao" on public.commission_rules;

create policy "Staff e parceiros consultam comissoes"
  on public.commission_rules for select
  using (
    public.is_staff()
    or public.is_service_role()
    or (auth.uid() is not null and partner_id = auth.uid())
  );

create policy "Apenas administradores gerem regras de comissao"
  on public.commission_rules for all
  using (public.is_admin() or public.is_service_role())
  with check (public.is_admin() or public.is_service_role());

-- 10.5. Bookings
alter table public.bookings enable row level security;
drop policy if exists "Qualquer pessoa pode criar agendamento próprio" on public.bookings;
drop policy if exists "Clientes veem os seus agendamentos e parceiros os seus" on public.bookings;
drop policy if exists "Staff e parceiros atualizam agendamentos" on public.bookings;

create policy "Qualquer pessoa pode criar agendamento próprio"
  on public.bookings for insert
  with check (
    (auth.uid() is not null and (user_id = auth.uid() or public.is_staff() or public.is_service_role()))
    or (auth.uid() is null and user_id is null)
  );

create policy "Clientes veem os seus agendamentos e parceiros os seus"
  on public.bookings for select
  using (
    auth.uid() = user_id 
    or auth.uid() = partner_id
    or public.is_staff()
    or public.is_service_role()
  );

create policy "Staff e parceiros atualizam agendamentos"
  on public.bookings for update
  using (
    auth.uid() = user_id
    or auth.uid() = partner_id
    or public.is_staff()
    or public.is_service_role()
  );

-- 10.6. Product Orders (Checkout Autenticado)
alter table public.product_orders enable row level security;
drop policy if exists "Clientes autenticados criam encomendas" on public.product_orders;
drop policy if exists "Clientes podem criar encomendas" on public.product_orders;
drop policy if exists "Clientes veem as suas encomendas e admins veem todas" on public.product_orders;
drop policy if exists "Admins e parceiros atualizam encomendas" on public.product_orders;

create policy "Clientes autenticados criam encomendas"
  on public.product_orders for insert
  with check (
    auth.uid() is not null 
    and (user_id = auth.uid() or public.is_staff() or public.is_service_role())
  );

create policy "Clientes veem as suas encomendas e admins veem todas"
  on public.product_orders for select
  using (
    auth.uid() = user_id 
    or public.is_staff()
    or public.is_service_role()
  );

create policy "Admins e parceiros atualizam encomendas"
  on public.product_orders for update
  using (
    auth.uid() = user_id
    or public.is_staff()
    or public.is_service_role()
  );

-- 10.7. Stock Audit Logs
alter table public.stock_audit_logs enable row level security;
drop policy if exists "Staff e vendedores consultam auditoria de stock" on public.stock_audit_logs;
drop policy if exists "Insercao de auditoria restrita ao sistema" on public.stock_audit_logs;

create policy "Staff e vendedores consultam auditoria de stock"
  on public.stock_audit_logs for select
  using (
    public.is_staff()
    or public.is_service_role()
    or exists (
      select 1 from public.products p
      where p.id = product_id
      and p.seller_id = auth.uid()::text
    )
  );

create policy "Insercao de auditoria restrita ao sistema"
  on public.stock_audit_logs for insert
  with check (public.is_staff() or public.is_service_role());

-- 10.8. Wallets & Transactions
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists "Utilizadores consultam a sua própria carteira" on public.wallets;
drop policy if exists "Alteracao de carteira restrita a funcoes seguras" on public.wallets;
drop policy if exists "Utilizadores consultam as suas transações de carteira" on public.wallet_transactions;
drop policy if exists "Insercao de transacoes restrita a servico/admin" on public.wallet_transactions;

create policy "Utilizadores consultam a sua própria carteira"
  on public.wallets for select
  using (auth.uid() = user_id or public.is_admin() or public.is_service_role());

create policy "Alteracao de carteira restrita a funcoes seguras"
  on public.wallets for all
  using (public.is_admin() or public.is_service_role());

create policy "Utilizadores consultam as suas transações de carteira"
  on public.wallet_transactions for select
  using (auth.uid() = user_id or public.is_admin() or public.is_service_role());

create policy "Insercao de transacoes restrita a servico/admin"
  on public.wallet_transactions for insert
  with check (public.is_admin() or public.is_service_role());

-- 10.9. Partner Profiles & Professional Profiles
alter table public.partner_profiles enable row level security;
alter table public.professional_profiles enable row level security;

drop policy if exists "Parceiro acede ao proprio perfil e admin/operacao ve todos" on public.partner_profiles;
drop policy if exists "Parceiro cria o proprio perfil" on public.partner_profiles;
drop policy if exists "Parceiro atualiza proprio perfil" on public.partner_profiles;

create policy "Parceiro acede ao proprio perfil e admin/operacao ve todos"
  on public.partner_profiles for select
  using (auth.uid() = id or public.is_staff() or public.is_service_role());

create policy "Parceiro cria o proprio perfil"
  on public.partner_profiles for insert
  with check (auth.uid() = id or public.is_admin() or public.is_service_role());

create policy "Parceiro atualiza proprio perfil"
  on public.partner_profiles for update
  using (auth.uid() = id or public.is_admin() or public.is_service_role());

drop policy if exists "Profissionais verificados visiveis publicamente ou proprios" on public.professional_profiles;
drop policy if exists "Profissional insere proprio perfil" on public.professional_profiles;
drop policy if exists "Profissional atualiza proprio perfil" on public.professional_profiles;

create policy "Profissionais verificados visiveis publicamente ou proprios"
  on public.professional_profiles for select
  using (is_verified = true or auth.uid() = id or public.is_staff() or public.is_service_role());

create policy "Profissional insere proprio perfil"
  on public.professional_profiles for insert
  with check (auth.uid() = id or public.is_admin() or public.is_service_role());

create policy "Profissional atualiza proprio perfil"
  on public.professional_profiles for update
  using (auth.uid() = id or public.is_admin() or public.is_service_role());

-- 10.10. Platform Settings
alter table public.platform_settings enable row level security;
drop policy if exists "Configuracoes visiveis publicamente" on public.platform_settings;
drop policy if exists "Apenas administradores alteram configuracoes" on public.platform_settings;

create policy "Configuracoes visiveis publicamente"
  on public.platform_settings for select
  using (is_public = true or public.is_admin() or public.is_service_role());

create policy "Apenas administradores alteram configuracoes"
  on public.platform_settings for all
  using (public.is_admin() or public.is_service_role())
  with check (public.is_admin() or public.is_service_role());

-- ------------------------------------------------------------------------------
-- 11. BUCKETS DE STORAGE E POLÍTICAS DE ISOLAMENTO
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('public-assets', 'public-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf']),
  ('partner-documents', 'partner-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public Assets sao publicos para leitura" on storage.objects;
drop policy if exists "Utilizadores autorizados enviam public-assets" on storage.objects;
drop policy if exists "Utilizadores autorizados atualizam public-assets" on storage.objects;
drop policy if exists "Admins gerem todos os public-assets" on storage.objects;

create policy "Public Assets sao publicos para leitura"
  on storage.objects for select
  using (bucket_id = 'public-assets');

create policy "Utilizadores autorizados enviam public-assets"
  on storage.objects for insert
  with check (
    bucket_id = 'public-assets'
    and (
      public.is_staff()
      or public.is_service_role()
      or exists (
        select 1 from public.partner_profiles
        where id = auth.uid() and is_verified = true
      )
    )
  );

create policy "Utilizadores autorizados atualizam public-assets"
  on storage.objects for update
  using (
    bucket_id = 'public-assets'
    and (public.is_staff() or public.is_service_role())
  )
  with check (
    bucket_id = 'public-assets'
    and (public.is_staff() or public.is_service_role())
  );

create policy "Admins gerem todos os public-assets"
  on storage.objects for all
  using (bucket_id = 'public-assets' and (public.is_admin() or public.is_service_role()))
  with check (bucket_id = 'public-assets' and (public.is_admin() or public.is_service_role()));

drop policy if exists "Parceiro e Admin acedem a documentos privados" on storage.objects;
drop policy if exists "Parceiro envia documentos para a sua propria pasta" on storage.objects;
drop policy if exists "Parceiro remove documentos da sua pasta" on storage.objects;
drop policy if exists "Parceiro atualiza documentos da sua pasta" on storage.objects;

create policy "Parceiro e Admin acedem a documentos privados"
  on storage.objects for select
  using (
    bucket_id = 'partner-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_staff()
      or public.is_service_role()
    )
  );

create policy "Parceiro envia documentos para a sua propria pasta"
  on storage.objects for insert
  with check (
    bucket_id = 'partner-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
      or public.is_service_role()
    )
  );

create policy "Parceiro remove documentos da sua pasta"
  on storage.objects for delete
  using (
    bucket_id = 'partner-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
      or public.is_service_role()
    )
  );

create policy "Parceiro atualiza documentos da sua pasta"
  on storage.objects for update
  using (
    bucket_id = 'partner-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
      or public.is_service_role()
    )
  );

-- ------------------------------------------------------------------------------
-- 12. ÍNDICES DE PERFORMANCE E PESQUISA OTIMIZADA
-- ------------------------------------------------------------------------------
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_products_available_featured on public.products (available, is_featured);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_seller on public.products (seller_id, seller_type);
create index if not exists idx_commission_rules_lookup on public.commission_rules (rule_type, partner_id, category, is_active);
create index if not exists idx_stock_audit_product_order on public.stock_audit_logs (product_id, order_id, created_at desc);
create index if not exists idx_services_category_active on public.services (category_id, is_active);
create index if not exists idx_bookings_user_id on public.bookings (user_id);
create index if not exists idx_bookings_status_created on public.bookings (status, created_at desc);
create index if not exists idx_product_orders_user_id on public.product_orders (user_id);
create index if not exists idx_product_orders_status on public.product_orders (order_status, created_at desc);
create index if not exists idx_product_orders_reservation on public.product_orders (stock_confirmed, reservation_expires_at) where stock_confirmed = false;
create index if not exists idx_wallet_transactions_user_id on public.wallet_transactions (user_id, created_at desc);
create index if not exists idx_partner_profiles_verified on public.partner_profiles (is_verified);
create index if not exists idx_professional_profiles_verified on public.professional_profiles (is_verified);

-- ------------------------------------------------------------------------------
-- 13. ATIVAÇÃO OFICIAL DO SUPER ADMINISTRADOR (admin@resolvemcx.ao)
-- ------------------------------------------------------------------------------
do $$
declare
  v_admin_email text := 'admin@resolvemcx.ao';
begin
  insert into public.profiles (id, email, full_name, role, province, municipio)
  select 
    u.id, 
    u.email, 
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'Super Administrador Resolve'),
    'super_admin',
    'Huambo',
    'Huambo'
  from auth.users u
  where lower(trim(u.email)) = v_admin_email
  on conflict (id) do update set
    role = 'super_admin',
    updated_at = timezone('utc'::text, now());
end $$;

-- ------------------------------------------------------------------------------
-- 14. CONFIGURAÇÃO BASE DA PLATAFORMA (SEM SEEDS FICTÍCIOS OU TAXAS ARBITRÁRIAS)
-- ------------------------------------------------------------------------------
insert into public.platform_settings (id, settings, is_public)
values (
  'global',
  jsonb_build_object(
    'platformName', 'Resolve Express',
    'location', 'Huambo, Angola',
    'whatsapp', '244923111222',
    'whatsappDefault', 'Olá! Gostaria de informações sobre os serviços da Resolve Express Huambo.',
    'theme', jsonb_build_object(
      'primaryColor', '#E6540F',
      'secondaryColor', '#071B33',
      'darkNavy', '#071B33'
    ),
    'marketplace', jsonb_build_object(
      'allowPartnerProducts', true,
      'requireStockVerification', true,
      'defaultDeliveryFeeAOA', 500,
      'stockReservationMinutes', 30
    )
  ),
  true
)
on conflict (id) do nothing;

-- ------------------------------------------------------------------------------
-- 15. SUPABASE REALTIME PARA SINCRONIZAÇÃO GLOBAL EM TEMPO REAL
-- ------------------------------------------------------------------------------
alter table public.platform_settings replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'platform_settings'
  ) then
    alter publication supabase_realtime add table public.platform_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;
