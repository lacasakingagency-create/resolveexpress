-- ==============================================================================
-- RESOLVE EXPRESS - SUPABASE MIGRATION: ROLES, SETTINGS, TENANT PROFILES & STORAGE
-- Migration: 20261109000000_platform_settings_and_roles.sql
-- ==============================================================================

-- 1. Expand role check constraint on public.profiles to support all system roles
do $$
begin
  -- Drop existing constraint if present
  alter table public.profiles drop constraint if exists profiles_role_check;
  
  -- Re-add check constraint with all operational and commercial roles
  alter table public.profiles add constraint profiles_role_check
    check (role in (
      'cliente',
      'funcionario',
      'empresa_parceira',
      'profissional',
      'operacao',
      'apoio',
      'vendedor',
      'afiliado',
      'admin',
      'super_admin'
    ));
exception
  when others then
    raise notice 'profiles_role_check constraint adjustment handled: %', sqlerrm;
end $$;

-- 2. Update trigger function to handle full user metadata on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, province, municipio, bairro)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', null),
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    coalesce(new.raw_user_meta_data->>'province', 'Huambo'),
    coalesce(new.raw_user_meta_data->>'municipio', 'Huambo'),
    coalesce(new.raw_user_meta_data->>'bairro', null)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- 3. Platform Settings Table (Single-row 'global' persistence for real Supabase sync)
create table if not exists public.platform_settings (
  id text primary key default 'global',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.platform_settings enable row level security;

-- Platform Settings Policies: Everyone can read; Only Admins can insert/update
drop policy if exists "Configuracoes visiveis publicamente" on public.platform_settings;
create policy "Configuracoes visiveis publicamente"
  on public.platform_settings for select
  using (true);

drop policy if exists "Apenas administradores alteram configuracoes" on public.platform_settings;
create policy "Apenas administradores alteram configuracoes"
  on public.platform_settings for all
  using (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- Pre-seed default global settings if not existing
insert into public.platform_settings (id, settings)
values (
  'global',
  jsonb_build_object(
    'platformName', 'Resolve Express',
    'location', 'Huambo, Angola',
    'whatsapp', '244923111222',
    'whatsappDefault', 'Olá! Gostaria de informações sobre os serviços da Resolve Express Huambo.',
    'defaultCommissionRate', 15,
    'theme', jsonb_build_object(
      'primaryColor', '#E6540F',
      'secondaryColor', '#071B33',
      'darkNavy', '#071B33'
    ),
    'marketplace', jsonb_build_object(
      'allowPartnerProducts', true,
      'requireStockVerification', true,
      'defaultDeliveryFeeAOA', 500
    )
  )
)
on conflict (id) do nothing;

-- 4. Partner Company Profiles Table (Isolated multi-tenant data)
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
  commission_rate numeric default 15,
  is_verified boolean default false,
  documents jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.partner_profiles enable row level security;

drop policy if exists "Parceiro acede ao proprio perfil e admin/operacao ve todos" on public.partner_profiles;
create policy "Parceiro acede ao proprio perfil e admin/operacao ve todos"
  on public.partner_profiles for select
  using (
    auth.uid() = id
    or auth.jwt()->>'role' = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'operacao')
    )
  );

drop policy if exists "Parceiro atualiza proprio perfil" on public.partner_profiles;
create policy "Parceiro atualiza proprio perfil"
  on public.partner_profiles for update
  using (
    auth.uid() = id
    or auth.jwt()->>'role' = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Parceiro cria o proprio perfil" on public.partner_profiles;
create policy "Parceiro cria o proprio perfil"
  on public.partner_profiles for insert
  with check (
    auth.uid() = id
    or auth.jwt()->>'role' = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- 5. Professional Profiles Table (Independent contractors)
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
  rating numeric default 5.0,
  reviews_count integer default 1,
  documents jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.professional_profiles enable row level security;

drop policy if exists "Profissionais verificados visiveis publicamente ou proprios" on public.professional_profiles;
create policy "Profissionais verificados visiveis publicamente ou proprios"
  on public.professional_profiles for select
  using (
    is_verified = true
    or auth.uid() = id
    or auth.jwt()->>'role' = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'operacao')
    )
  );

drop policy if exists "Profissional atualiza proprio perfil" on public.professional_profiles;
create policy "Profissional atualiza proprio perfil"
  on public.professional_profiles for update
  using (
    auth.uid() = id
    or auth.jwt()->>'role' = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Profissional insere proprio perfil" on public.professional_profiles;
create policy "Profissional insere proprio perfil"
  on public.professional_profiles for insert
  with check (
    auth.uid() = id
    or auth.jwt()->>'role' = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- 6. Storage Buckets and Policies (Idempotent creation)
insert into storage.buckets (id, name, public)
values 
  ('public-assets', 'public-assets', true),
  ('partner-documents', 'partner-documents', false)
on conflict (id) do nothing;

-- Storage Policies for public-assets
drop policy if exists "Public Assets sao publicos para leitura" on storage.objects;
create policy "Public Assets sao publicos para leitura"
  on storage.objects for select
  using (bucket_id = 'public-assets');

drop policy if exists "Utilizadores autenticados podem enviar public-assets" on storage.objects;
create policy "Utilizadores autenticados podem enviar public-assets"
  on storage.objects for insert
  with check (
    bucket_id = 'public-assets'
    and (auth.role() = 'authenticated' or auth.jwt()->>'role' = 'service_role')
  );

drop policy if exists "Admins gerem todos os public-assets" on storage.objects;
create policy "Admins gerem todos os public-assets"
  on storage.objects for all
  using (
    bucket_id = 'public-assets'
    and (
      auth.jwt()->>'role' = 'service_role'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
      )
    )
  );

-- Storage Policies for partner-documents (Private bucket)
drop policy if exists "Parceiro e Admin acedem a documentos privados" on storage.objects;
create policy "Parceiro e Admin acedem a documentos privados"
  on storage.objects for select
  using (
    bucket_id = 'partner-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or auth.jwt()->>'role' = 'service_role'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin', 'operacao')
      )
    )
  );

drop policy if exists "Parceiro envia documentos para a sua propria pasta" on storage.objects;
create policy "Parceiro envia documentos para a sua propria pasta"
  on storage.objects for insert
  with check (
    bucket_id = 'partner-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or auth.jwt()->>'role' = 'service_role'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
      )
    )
  );
