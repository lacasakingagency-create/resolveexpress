-- ==============================================================================
-- RESOLVE EXPRESS - SECURITY AUDIT & VULNERABILITY REMEDIATION
-- Migration: 20261109010000_security_audit_and_hardening.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORREÇÃO DA ESCALADA DE PRIVILÉGIOS (HANDLE_NEW_USER)
-- ------------------------------------------------------------------------------
-- Impede que qualquer utilizador escolha o seu papel no registo público.
-- Todos os registos recebem OBRIGATORIAMENTE 'cliente'.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, province, municipio, bairro)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', null),
    'cliente', -- HARDCODED: Jamais confiar em raw_user_meta_data->>'role'
    coalesce(new.raw_user_meta_data->>'province', 'Huambo'),
    coalesce(new.raw_user_meta_data->>'municipio', 'Huambo'),
    coalesce(new.raw_user_meta_data->>'bairro', null)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = now();
    -- NOTA: O papel (role) NUNCA é atualizado no conflito
  return new;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------------------
-- 2. BLOQUEIO DE AUTO-PROMOÇÃO DE PAPEL EM PUBLIC.PROFILES
-- ------------------------------------------------------------------------------
create or replace function public.prevent_profile_role_self_elevation()
returns trigger as $$
begin
  -- Se o campo 'role' estiver a ser alterado:
  if old.role is distinct from new.role then
    -- Apenas service_role ou super_admin ou admin podem alterar papéis
    if not (
      auth.jwt()->>'role' = 'service_role' or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
      )
    ) then
      -- Reverte a tentativa de alteração de papel
      new.role := old.role;
    end if;
  end if;
  
  -- Impede alteração do ID de utilizador
  new.id := old.id;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_profile_role_elevation on public.profiles;
create trigger trg_prevent_profile_role_elevation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_role_self_elevation();

-- ------------------------------------------------------------------------------
-- 3. PROTEÇÃO DE EMPRESAS PARCEIRAS (PARTNER_PROFILES)
-- ------------------------------------------------------------------------------
create or replace function public.protect_partner_profile_fields()
returns trigger as $$
begin
  -- Se o utilizador não for admin/super_admin/service_role:
  if not (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  ) then
    -- Campos sensíveis congelados contra adulteração pelo parceiro
    new.is_verified := old.is_verified;
    new.commission_rate := old.commission_rate;
    new.id := old.id;
  end if;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_partner_profile on public.partner_profiles;
create trigger trg_protect_partner_profile
  before update on public.partner_profiles
  for each row execute procedure public.protect_partner_profile_fields();

-- ------------------------------------------------------------------------------
-- 4. PROTEÇÃO DE PROFISSIONAIS INDEPENDENTES (PROFESSIONAL_PROFILES)
-- ------------------------------------------------------------------------------
create or replace function public.protect_professional_profile_fields()
returns trigger as $$
begin
  -- Se o utilizador não for admin/super_admin/service_role:
  if not (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  ) then
    -- Bloqueia auto-aprovação e inflação de reputação/avaliação
    new.is_verified := old.is_verified;
    new.rating := old.rating;
    new.reviews_count := old.reviews_count;
    new.id := old.id;
  end if;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_professional_profile on public.professional_profiles;
create trigger trg_protect_professional_profile
  before update on public.professional_profiles
  for each row execute procedure public.protect_professional_profile_fields();

-- ------------------------------------------------------------------------------
-- 5. BLINDAGEM DE CONFIGURAÇÕES GLOBAIS (PLATFORM_SETTINGS)
-- ------------------------------------------------------------------------------
alter table public.platform_settings add column if not exists is_public boolean default false;

update public.platform_settings
set is_public = true
where id in ('global', 'global_public');

drop policy if exists "Configuracoes visiveis publicamente" on public.platform_settings;
create policy "Configuracoes visiveis publicamente"
  on public.platform_settings for select
  using (
    is_public = true
    or auth.jwt()->>'role' = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- ------------------------------------------------------------------------------
-- 6. PROTEÇÃO DE AGENDAMENTOS E ENCOMENDAS CONTRA ADULTERAÇÃO DE PAGAMENTO
-- ------------------------------------------------------------------------------
create or replace function public.protect_booking_tampering()
returns trigger as $$
begin
  if not (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'operacao', 'funcionario')
    )
  ) then
    -- Clientes não podem marcar serviços como concluídos, alterar pagamento ou valores
    new.status := old.status;
    new.payment_status := old.payment_status;
    new.total_aoa := old.total_aoa;
    new.assigned_to := old.assigned_to;
    new.partner_id := old.partner_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_booking_tampering on public.bookings;
create trigger trg_protect_booking_tampering
  before update on public.bookings
  for each row execute procedure public.protect_booking_tampering();

create or replace function public.protect_order_tampering()
returns trigger as $$
begin
  if not (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'operacao', 'funcionario')
    )
  ) then
    -- Clientes não podem alterar estado de entrega, pagamento ou totais de encomenda
    new.order_status := old.order_status;
    new.payment_status := old.payment_status;
    new.total_aoa := old.total_aoa;
    new.subtotal_aoa := old.subtotal_aoa;
    new.delivery_fee_aoa := old.delivery_fee_aoa;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_order_tampering on public.product_orders;
create trigger trg_protect_order_tampering
  before update on public.product_orders
  for each row execute procedure public.protect_order_tampering();

-- ------------------------------------------------------------------------------
-- 7. BLINDAGEM FINANCEIRA: WALLETS E TRANSACTIONS (RPC TRANSACIONAL ATÓMICA)
-- ------------------------------------------------------------------------------
-- Garantir que clientes/parceiros NÃO possuem permissão direta de INSERT/UPDATE em wallets
drop policy if exists "Admins atualizam carteiras" on public.wallets;
create policy "Admins atualizam carteiras"
  on public.wallets for update
  using (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Admins inserem transacoes" on public.wallet_transactions;
create policy "Admins inserem transacoes"
  on public.wallet_transactions for insert
  with check (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- Procedimento transacional auditado com bloqueio concorrente (FOR UPDATE) e idempotência
create or replace function public.execute_wallet_movement(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_reference text default null
)
returns jsonb as $$
declare
  v_current_balance numeric := 0;
  v_new_balance numeric := 0;
  v_tx_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'O montante da operação deve ser estritamente superior a zero.';
  end if;

  if p_type not in ('credit', 'debit') then
    raise exception 'Tipo de movimento inválido: utilize credit ou debit.';
  end if;

  -- Verificação de autorização: apenas admin, super_admin ou service_role podem executar
  if not (
    auth.jwt()->>'role' = 'service_role' or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  ) then
    raise exception 'Acesso negado: operações financeiras requerem privilégios administrativos.';
  end if;

  -- Prevenção de duplicados (Idempotência financeira via referência)
  if p_reference is not null and length(trim(p_reference)) > 0 then
    if exists (
      select 1 from public.wallet_transactions
      where reference = p_reference
    ) then
      raise exception 'Operação já processada anteriormente (referência duplicada: %)', p_reference;
    end if;
  end if;

  -- Garante existência da carteira com bloqueio exclusivo de linha (Row-Level Locking)
  insert into public.wallets (user_id, balance_aoa, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do nothing;

  select balance_aoa into v_current_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  -- Cálculo do novo saldo
  if p_type = 'credit' then
    v_new_balance := v_current_balance + p_amount;
  else
    if v_current_balance < p_amount then
      raise exception 'Saldo insuficiente na carteira (Saldo atual: % AOA, Tentativa de débito: % AOA)', v_current_balance, p_amount;
    end if;
    v_new_balance := v_current_balance - p_amount;
  end if;

  -- Atualização atómica do saldo
  update public.wallets
  set balance_aoa = v_new_balance, updated_at = now()
  where user_id = p_user_id;

  -- Inserção no livro-razão auditável de transações
  insert into public.wallet_transactions (user_id, type, amount_aoa, description, reference, created_at)
  values (p_user_id, p_type, p_amount, p_description, p_reference, now())
  returning id into v_tx_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount,
    'type', p_type,
    'reference', p_reference
  );
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------------------
-- 8. POLÍTICAS DE SEGURANÇA E ISOLAMENTO NO STORAGE
-- ------------------------------------------------------------------------------
-- Bloqueio contra sobrescrita e remoção indevida de ficheiros de parceiros
drop policy if exists "Parceiro remove documentos da sua pasta" on storage.objects;
create policy "Parceiro remove documentos da sua pasta"
  on storage.objects for delete
  using (
    bucket_id = 'partner-documents'
    and (
      (auth.uid()::text = (storage.foldername(name))[1])
      or auth.jwt()->>'role' = 'service_role'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
      )
    )
  );

drop policy if exists "Parceiro atualiza documentos da sua pasta" on storage.objects;
create policy "Parceiro atualiza documentos da sua pasta"
  on storage.objects for update
  using (
    bucket_id = 'partner-documents'
    and (
      (auth.uid()::text = (storage.foldername(name))[1])
      or auth.jwt()->>'role' = 'service_role'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
      )
    )
  );
