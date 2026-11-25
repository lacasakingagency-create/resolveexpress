-- ==============================================================================
-- RESOLVE EXPRESS — MIGRAÇÃO INCREMENTAL FUNCIONAL (2026-11-25)
-- Objetivos:
--   1. Garantir colunas e trigger robusto de cadastro de clientes (profiles).
--   2. Estender public.products para suportar gestão completa de Produtos da Loja
--      e da Praça (image_fit, is_praca, praca_category_id, sku, condition, comissões)
--      e alinhar a constraint seller_type ('COMPANY','PARTNER','SELLER','PRACA_SELLER').
--   3. Habilitar publicação Realtime em public.products sem alterar dados/RLS existentes.
-- ==============================================================================

-- 1. PERFIS DE UTILIZADORES (Campos opcionais de morada no registo)
alter table public.profiles
  add column if not exists address text,
  add column if not exists reference text;

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

  insert into public.profiles (
    id, email, full_name, phone, role, province, municipio, bairro, address, reference
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    v_initial_role,
    coalesce(nullif(trim(new.raw_user_meta_data->>'province'), ''), 'Huambo'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'municipio'), ''), 'Huambo'),
    nullif(trim(new.raw_user_meta_data->>'bairro'), ''),
    nullif(trim(new.raw_user_meta_data->>'address'), ''),
    nullif(trim(new.raw_user_meta_data->>'reference'), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(trim(public.profiles.full_name), ''), excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    province = coalesce(public.profiles.province, excluded.province),
    municipio = coalesce(public.profiles.municipio, excluded.municipio),
    bairro = coalesce(public.profiles.bairro, excluded.bairro),
    address = coalesce(public.profiles.address, excluded.address),
    reference = coalesce(public.profiles.reference, excluded.reference),
    role = case
      when lower(trim(excluded.email)) = 'admin@resolvemcx.ao' then 'super_admin'
      else public.profiles.role
    end,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. PRODUTOS & MARKETPLACE PRAÇA (Colunas relacionais completas)
alter table public.products
  add column if not exists image_fit text default 'cover',
  add column if not exists is_praca boolean default false,
  add column if not exists praca_category_id text,
  add column if not exists subcategory text,
  add column if not exists brand text,
  add column if not exists sku text,
  add column if not exists condition text default 'NOVO',
  add column if not exists images jsonb default '[]'::jsonb,
  add column if not exists platform_commission_rate numeric,
  add column if not exists affiliate_commission_rate numeric,
  add column if not exists delivery_option text default 'BOTH',
  add column if not exists status text default 'ATIVO';

-- Alinha seller_type com o domínio da Praça ('PRACA_SELLER') preservando valores existentes
alter table public.products
  drop constraint if exists products_seller_type_check;

alter table public.products
  add constraint products_seller_type_check
  check (seller_type in ('COMPANY', 'PARTNER', 'SELLER', 'PRACA_SELLER'));

-- 3. REALTIME PARA PRODUTOS
do $$
begin
  alter publication supabase_realtime add table public.products;
exception
  when duplicate_object then null;
  when others then null;
end $$;
