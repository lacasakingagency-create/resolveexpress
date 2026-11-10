-- ==============================================================================
-- RESOLVE EXPRESS - SUPABASE INITIAL SCHEMA & SEED DATA
-- Local: Huambo & Angola (18 Províncias)
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA DE PERFIS DE UTILIZADOR (PROFILES)
-- Ligada ao Supabase Auth (auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text not null,
  phone text,
  role text not null default 'cliente' check (role in ('cliente', 'funcionario', 'empresa_parceira', 'profissional', 'admin')),
  province text default 'Huambo',
  municipio text default 'Huambo',
  bairro text,
  avatar_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- RLS para perfis
alter table public.profiles enable row level security;

create policy "Perfis públicos ou próprios para leitura"
  on public.profiles for select
  using (true);

create policy "Utilizadores podem atualizar o seu próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Utilizadores podem criar o seu perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger para criar perfil automaticamente ao registar novo utilizador no Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, province, municipio)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    coalesce(new.raw_user_meta_data->>'province', 'Huambo'),
    coalesce(new.raw_user_meta_data->>'municipio', 'Huambo')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. TABELA DE SERVIÇOS (SERVICES)
-- ------------------------------------------------------------------------------
create table if not exists public.services (
  id text primary key,
  category_id text not null,
  category_name text not null,
  name text not null,
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

alter table public.services enable row level security;

create policy "Serviços visíveis para todos"
  on public.services for select
  using (is_active = true);

create policy "Apenas administradores gerem serviços"
  on public.services for all
  using (auth.jwt()->>'role' = 'service_role' or exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

-- ------------------------------------------------------------------------------
-- 3. TABELA DE PRODUTOS / MARKETPLACE (PRODUCTS)
-- ------------------------------------------------------------------------------
create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null,
  price_aoa numeric not null check (price_aoa >= 0),
  promotional_price_aoa numeric check (promotional_price_aoa >= 0),
  stock integer not null default 10,
  available boolean not null default true,
  seller_name text not null default 'Resolve Express Oficial',
  seller_id text not null default 'resolve-official',
  seller_type text not null default 'COMPANY' check (seller_type in ('COMPANY', 'PARTNER')),
  category text not null,
  image text not null,
  delivery_location text default 'Huambo (Entrega Rápida)',
  estimated_delivery text default '30 a 60 minutos',
  warranty text,
  unit text default 'unidade',
  rating numeric default 5.0,
  reviews_count integer default 1,
  badge text,
  is_featured boolean default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.products enable row level security;

create policy "Produtos visíveis para todos"
  on public.products for select
  using (available = true);

create policy "Admins e parceiros gerem produtos"
  on public.products for all
  using (auth.jwt()->>'role' = 'service_role' or exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'empresa_parceira')
  ));

-- ------------------------------------------------------------------------------
-- 4. TABELA DE AGENDAMENTOS DE SERVIÇO (BOOKINGS)
-- ------------------------------------------------------------------------------
create table if not exists public.bookings (
  id text primary key,
  user_id uuid references auth.users on delete set null,
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
  total_aoa numeric,
  assigned_to text,
  partner_id text,
  history jsonb default '[]'::jsonb,
  rating integer,
  review_comment text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.bookings enable row level security;

create policy "Clientes criam agendamentos"
  on public.bookings for insert
  with check (true);

create policy "Clientes visualizam os seus agendamentos ou via telefone/id"
  on public.bookings for select
  using (
    auth.uid() = user_id 
    or auth.jwt()->>'role' = 'service_role'
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'funcionario', 'profissional'))
  );

create policy "Admins e equipa atualizam agendamentos"
  on public.bookings for update
  using (
    auth.uid() = user_id
    or auth.jwt()->>'role' = 'service_role'
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'funcionario', 'profissional'))
  );

-- ------------------------------------------------------------------------------
-- 5. TABELA DE ENCOMENDAS DE PRODUTOS (PRODUCT_ORDERS)
-- ------------------------------------------------------------------------------
create table if not exists public.product_orders (
  id text primary key,
  user_id uuid references auth.users on delete set null,
  customer_name text not null,
  customer_phone text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal_aoa numeric not null default 0,
  delivery_fee_aoa numeric not null default 0,
  discount_aoa numeric not null default 0,
  total_aoa numeric not null default 0,
  delivery_address text not null,
  delivery_bairro text not null,
  delivery_province text not null default 'Huambo',
  delivery_municipio text not null default 'Huambo',
  payment_method text not null,
  payment_status text not null default 'Pendente',
  payment_reference text,
  payment_details jsonb default '{}'::jsonb,
  proof_of_payment text,
  order_status text not null default 'Recebida' check (order_status in ('Recebida', 'Confirmada', 'Em preparação', 'A caminho', 'Entregue', 'Cancelada')),
  seller_names text[] default '{}',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.product_orders enable row level security;

create policy "Clientes podem criar encomendas"
  on public.product_orders for insert
  with check (true);

create policy "Clientes veem as suas encomendas e admins veem todas"
  on public.product_orders for select
  using (
    auth.uid() = user_id 
    or auth.jwt()->>'role' = 'service_role'
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'funcionario', 'empresa_parceira'))
  );

create policy "Admins e parceiros atualizam encomendas"
  on public.product_orders for update
  using (
    auth.uid() = user_id
    or auth.jwt()->>'role' = 'service_role'
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'funcionario', 'empresa_parceira'))
  );

-- ------------------------------------------------------------------------------
-- 6. CARTEIRA DIGITAL E TRANSAÇÕES (WALLETS)
-- ------------------------------------------------------------------------------
create table if not exists public.wallets (
  user_id uuid references auth.users on delete cascade primary key,
  balance_aoa numeric not null default 0 check (balance_aoa >= 0),
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.wallet_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null check (type in ('credit', 'debit')),
  amount_aoa numeric not null check (amount_aoa > 0),
  description text not null,
  reference text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

create policy "Utilizador acede à sua própria carteira"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "Utilizador acede às suas transações"
  on public.wallet_transactions for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. SEED DATA - PRODUTOS OFICIAIS RESOLVE EXPRESS
-- ------------------------------------------------------------------------------
insert into public.products (id, name, description, price_aoa, promotional_price_aoa, stock, available, seller_name, seller_id, seller_type, category, image, delivery_location, estimated_delivery, unit, rating, reviews_count, badge, is_featured)
values
  (
    'prod-gas-12kg',
    'Botija de Gás 12kg (Sonangol Gás Huambo)',
    'Botija de gás de cozinha oficial Sonangol selada com entrega rápida ao domicílio e conexão segura incluída.',
    15000,
    13500,
    25,
    true,
    'Sonangol Gás Huambo / Resolve Express',
    'resolve-gas',
    'COMPANY',
    'Gás e Água',
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&auto=format&fit=crop&q=80',
    'Huambo (Todas as zonas)',
    '30 a 45 minutos',
    'botija 12kg',
    4.9,
    128,
    'Mais Vendido',
    true
  ),
  (
    'prod-agua-18l',
    'Garrafão de Água Mineral 18.9L',
    'Garrafão purificado com tampa lacrada de fábrica. Entrega limpa e colocação no dispensador sem esforço.',
    4500,
    3900,
    40,
    true,
    'Resolve Water Service',
    'resolve-water',
    'COMPANY',
    'Gás e Água',
    'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    'Huambo (Cidade Alta, São Pedro e arredores)',
    '30 a 60 minutos',
    'garrafão 18.9L',
    4.8,
    94,
    'Essencial',
    true
  ),
  (
    'prod-cesta-basica',
    'Cesta Básica Familiar Completa',
    'Arroz agulha 5kg, fuba de milho 5kg, óleo alimentar 3L, açúcar 2kg, massa esparguete 2kg, feijão manteiga 2kg, leite condensado e sal iodado.',
    38500,
    null,
    15,
    true,
    'Mercado Central Huambo & Resolve Shopping',
    'resolve-shopping',
    'PARTNER',
    'Alimentação e Frescos',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
    'Huambo e Províncias Vizinhas',
    '2 a 3 horas',
    'cabaz familiar',
    5.0,
    62,
    'Destaque do Mês',
    true
  ),
  (
    'prod-frango-assado',
    'Frango Assado Inteiro com Batata Frita e Molho da Casa',
    'Frango estaladiço na brasa com tempero tradicional huambino, porção generosa de batatas fritas e molho picante.',
    6500,
    5800,
    18,
    true,
    'Sabores do Planalto Lda',
    'partner-sabores',
    'PARTNER',
    'Alimentação e Frescos',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80',
    'Huambo (Raio de 12km)',
    '35 a 50 minutos',
    'refeição completa',
    4.9,
    140,
    'Pronto a Comer',
    true
  ),
  (
    'prod-cimento-50kg',
    'Saco de Cimento Portland 50kg (Cimenfort)',
    'Cimento estrutural de alta resistência e secagem rápida para construção e reparações.',
    6200,
    null,
    50,
    true,
    'Armazéns Huambo Construção',
    'partner-construcao',
    'PARTNER',
    'Construção e Ferramentas',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80',
    'Entrega em camião ou carrinha',
    '24 horas',
    'saco 50kg',
    4.7,
    39,
    null,
    false
  ),
  (
    'prod-tinta-15l',
    'Tinta Acrílica Branca 15L Robbialac',
    'Tinta lavável de alta cobertura para interiores e exteriores, resistente ao clima huambino.',
    24500,
    22000,
    12,
    true,
    'Tintas do Planalto',
    'partner-tintas',
    'PARTNER',
    'Construção e Ferramentas',
    'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80',
    'Huambo e Caála',
    '2 a 4 horas',
    'balde 15L',
    4.8,
    27,
    'Promoção',
    true
  )
on conflict (id) do nothing;
