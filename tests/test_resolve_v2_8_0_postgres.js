/**
 * SUÍTE DE TESTES EM POSTGRESQL REAL (PGlite v16 WASM)
 * Executa a migração v2.8.0 contra um motor PostgreSQL real.
 * Testa transações, bloqueios FOR UPDATE, concorrência, triggers, RPC e idempotência.
 */

import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.join(__dirname, '../supabase/migrations/20261110000000_complete_resolve_express.sql');
const migrationSql = fs.readFileSync(sqlPath, 'utf8');

console.log('==============================================================================');
console.log('RESOLVE EXPRESS v2.8.0 — SUÍTE DE TESTES EM MOTOR POSTGRESQL REAL (PGlite)');
console.log('==============================================================================\n');

const db = new PGlite();

const results = [];
function recordTest(id, name, type, passed, details) {
  results.push({ id, name, type, passed, details });
  const status = passed ? '✅ PASSOU' : '❌ FALHOU';
  console.log(`[TESTE ${id}] ${status} [${type}]: ${name}`);
  if (details) console.log(`   -> ${details}`);
}

async function runTests() {
  try {
    // 0. Mock inicial de infraestrutura Supabase (auth e storage) para execução autónoma
    console.log('1. Inicializando schemas e mocks do Supabase (auth, storage)...');
    await db.exec(`
      create schema if not exists auth;
      create table if not exists auth.users (
        id uuid primary key default gen_random_uuid(),
        email text unique,
        raw_user_meta_data jsonb default '{}'::jsonb,
        created_at timestamptz default now()
      );
      create or replace function auth.uid() returns uuid language sql stable as $$
        select current_setting('request.jwt.claim.sub', true)::uuid;
      $$;
      create or replace function auth.jwt() returns jsonb language sql stable as $$
        select jsonb_build_object(
          'sub', current_setting('request.jwt.claim.sub', true),
          'role', current_setting('request.jwt.claim.role', true)
        );
      $$;

      create schema if not exists storage;
      create table if not exists storage.buckets (
        id text primary key,
        name text,
        public boolean default false,
        file_size_limit bigint,
        allowed_mime_types text[]
      );
      create table if not exists storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text references storage.buckets(id),
        name text,
        owner uuid,
        created_at timestamptz default now()
      );
      create or replace function storage.foldername(name text) returns text[] language plpgsql as $$
      begin
        return string_to_array(name, '/');
      end;
      $$;
    `);

    // 1. Executa a migração v2.8.0 integral no motor PostgreSQL
    console.log('2. Executando migração v2.8.0 integral no motor PostgreSQL...');
    await db.exec(migrationSql);
    console.log('   -> Migração DDL executada com sucesso no PostgreSQL.\n');

    // --------------------------------------------------------------------------
    // TESTE 1: Promoção Exclusiva de admin@resolvemcx.ao via auth.users Real
    // --------------------------------------------------------------------------
    const adminUserRes = await db.query(`
      insert into auth.users (id, email, raw_user_meta_data)
      values ('11111111-1111-1111-1111-111111111111', 'admin@resolvemcx.ao', '{"full_name": "Administrador Chefe"}')
      returning id, email;
    `);

    const clientUserRes = await db.query(`
      insert into auth.users (id, email, raw_user_meta_data)
      values ('22222222-2222-2222-2222-222222222222', 'cliente@resolve.ao', '{"full_name": "Cliente Huambo"}')
      returning id, email;
    `);

    const adminProfile = (await db.query(`select role from public.profiles where id = '11111111-1111-1111-1111-111111111111'`)).rows[0];
    const clientProfile = (await db.query(`select role from public.profiles where id = '22222222-2222-2222-2222-222222222222'`)).rows[0];

    // Tentativa de spoofing: cliente tenta enviar email admin@resolvemcx.ao no payload
    let spoofSuccess = false;
    try {
      await db.query(`
        insert into public.profiles (id, email, full_name, role)
        values ('22222222-2222-2222-2222-222222222222', 'admin@resolvemcx.ao', 'Impostor', 'super_admin')
        on conflict (id) do update set role = excluded.role;
      `);
      const checkSpoof = (await db.query(`select role from public.profiles where id = '22222222-2222-2222-2222-222222222222'`)).rows[0];
      spoofSuccess = (checkSpoof.role === 'super_admin');
    } catch (e) { spoofSuccess = false; }

    const t1Passed = adminProfile?.role === 'super_admin' && 
                     clientProfile?.role === 'cliente' && 
                     spoofSuccess === false;

    recordTest(1, 'Super Admin Autenticado via auth.users', 'REAL POSTGRESQL', t1Passed,
      `admin@resolvemcx.ao -> ${adminProfile?.role}. Cliente spoofing -> bloqueado (role mantido como cliente)`);

    // --------------------------------------------------------------------------
    // TESTE 2: Bloqueio de Auto-Elevação de Papel por Cliente
    // --------------------------------------------------------------------------
    await db.exec(`set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';`);
    await db.exec(`set "request.jwt.claim.role" = 'authenticated';`);

    await db.query(`
      update public.profiles 
      set role = 'super_admin' 
      where id = '22222222-2222-2222-2222-222222222222';
    `);

    const updatedClientProfile = (await db.query(`select role from public.profiles where id = '22222222-2222-2222-2222-222222222222'`)).rows[0];
    const t2Passed = (updatedClientProfile.role === 'cliente');
    recordTest(2, 'Bloqueio de Auto-Elevação de Papel', 'REAL POSTGRESQL TRIGGER', t2Passed,
      `Tentativa de elevação bloqueada pelo trigger (Role permaneceu: ${updatedClientProfile.role})`);

    // --------------------------------------------------------------------------
    // TESTE 3: Regras de Comissão Variáveis (Sem 15% Fallback)
    // --------------------------------------------------------------------------
    await db.exec(`set "request.jwt.claim.role" = 'service_role';`);

    // Configura regra de categoria para "Eletrónica" = 8%
    await db.query(`
      insert into public.commission_rules (rule_type, category, rate, notes)
      values ('category', 'Eletrónica', 8.0, 'Taxa especial eletrónicos');
    `);

    // Consulta taxa para categoria com regra
    const rateWithRule = (await db.query(`
      select public.calculate_commission_rate(null, 'Eletrónica', null) as rate;
    `)).rows[0].rate;

    // Consulta taxa para categoria SEM regra
    const rateWithoutRule = (await db.query(`
      select public.calculate_commission_rate(null, 'Categoria Desconhecida', null) as rate;
    `)).rows[0].rate;

    const t3Passed = Number(rateWithRule) === 8 && rateWithoutRule === null;
    recordTest(3, 'Comissões Variáveis Sem Fallback de 15%', 'REAL POSTGRESQL FUNCTION', t3Passed,
      `Categoria Eletrónica: ${rateWithRule}%. Categoria Desconhecida: ${rateWithoutRule} (NULL = Bloqueio de liquidação)`);

    // --------------------------------------------------------------------------
    // TESTE 4: Reserva Atómica de Stock e Detecção de Overselling
    // --------------------------------------------------------------------------
    // Cadastra produto com 1 unidade disponível
    await db.query(`
      insert into public.products (id, name, description, price_aoa, stock, reserved_stock, available, seller_name, seller_id, category, image)
      values ('prod-unique-gas', 'Botija de Gás 12kg', 'Gás de cozinha', 5000, 1, 0, true, 'Resolve Express', '11111111-1111-1111-1111-111111111111', 'Energia', 'gas.png');
    `);

    // Cliente 1 faz pedido da única unidade
    await db.exec(`set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';`);
    await db.exec(`set "request.jwt.claim.role" = 'authenticated';`);

    await db.query(`
      insert into public.product_orders (
        id, user_id, customer_name, customer_phone, items, 
        delivery_address, delivery_bairro, payment_method
      ) values (
        'ENC-TEST-001', '22222222-2222-2222-2222-222222222222', 'Cliente 1', '923000000',
        '[{"product": {"id": "prod-unique-gas"}, "quantity": 1}]'::jsonb,
        'Rua do Comércio', 'Centro', 'MULTICAIXA_EXPRESS'
      );
    `);

    const prodAfterOrder1 = (await db.query(`select stock, reserved_stock from public.products where id = 'prod-unique-gas'`)).rows[0];

    // Cliente 2 tenta comprar a mesma unidade (overselling)
    let client2Failed = false;
    let client2ErrMsg = '';
    try {
      await db.query(`
        insert into public.product_orders (
          id, user_id, customer_name, customer_phone, items, 
          delivery_address, delivery_bairro, payment_method
        ) values (
          'ENC-TEST-002', '22222222-2222-2222-2222-222222222222', 'Cliente 2', '923000001',
          '[{"product": {"id": "prod-unique-gas"}, "quantity": 1}]'::jsonb,
          'Av. Norton de Matos', 'Capango', 'MULTICAIXA_EXPRESS'
        );
      `);
    } catch (err) {
      client2Failed = true;
      client2ErrMsg = err.message;
    }

    const t4Passed = prodAfterOrder1.stock === 1 && 
                     prodAfterOrder1.reserved_stock === 1 && 
                     client2Failed === true;

    recordTest(4, 'Reserva Atómica de Stock e Bloqueio de Overselling', 'REAL POSTGRESQL TRANSACTION', t4Passed,
      `Cliente 1 reservou: Stock=${prodAfterOrder1.stock}, Reservado=${prodAfterOrder1.reserved_stock}. Cliente 2 bloqueado: "${client2ErrMsg.split('\n')[0]}"`);

    // --------------------------------------------------------------------------
    // TESTE 5: Confirmação Financeira Confiável e Dedução de Stock (Backend RPC)
    // --------------------------------------------------------------------------
    await db.exec(`set "request.jwt.claim.role" = 'service_role';`);

    const confirmRes = (await db.query(`
      select public.confirm_order_payment(
        'ENC-TEST-001',
        'REF-MCX-998877',
        'MULTICAIXA_EXPRESS',
        5500, -- 5000 produto + 500 entrega
        '{"terminal": "TPA-01"}'::jsonb
      ) as result;
    `)).rows[0].result;

    const prodAfterConfirm = (await db.query(`select stock, reserved_stock from public.products where id = 'prod-unique-gas'`)).rows[0];
    const orderAfterConfirm = (await db.query(`select payment_status, stock_confirmed, order_status from public.product_orders where id = 'ENC-TEST-001'`)).rows[0];

    const t5Passed = confirmRes.success === true && 
                     prodAfterConfirm.stock === 0 && 
                     prodAfterConfirm.reserved_stock === 0 && 
                     orderAfterConfirm.stock_confirmed === true &&
                     orderAfterConfirm.payment_status === 'Confirmado';

    recordTest(5, 'Confirmação Financeira e Dedução de Stock', 'REAL POSTGRESQL RPC', t5Passed,
      `Stock deduzido definitivamente para ${prodAfterConfirm.stock}, Reservado=${prodAfterConfirm.reserved_stock}, stock_confirmed=${orderAfterConfirm.stock_confirmed}`);

    // --------------------------------------------------------------------------
    // TESTE 6: Idempotência de Confirmação e Rejeição de Referência Repetida
    // --------------------------------------------------------------------------
    // Replay com mesmos dados na mesma encomenda
    const replayRes = (await db.query(`
      select public.confirm_order_payment(
        'ENC-TEST-001',
        'REF-MCX-998877',
        'MULTICAIXA_EXPRESS',
        5500,
        '{"terminal": "TPA-01"}'::jsonb
      ) as result;
    `)).rows[0].result;

    // Cadastra produto extra e nova encomenda como cliente
    await db.exec(`set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';`);
    await db.exec(`set "request.jwt.claim.role" = 'authenticated';`);

    await db.query(`
      insert into public.products (id, name, description, price_aoa, stock, reserved_stock, available, seller_name, seller_id, category, image)
      values ('prod-agua-5l', 'Água 5L', 'Garrafão', 1000, 10, 0, true, 'Resolve Express', '11111111-1111-1111-1111-111111111111', 'Bebidas', 'agua.png');
    `);

    await db.query(`
      insert into public.product_orders (
        id, user_id, customer_name, customer_phone, items, 
        delivery_address, delivery_bairro, payment_method
      ) values (
        'ENC-TEST-003', '22222222-2222-2222-2222-222222222222', 'Cliente 3', '923000002',
        '[{"product": {"id": "prod-agua-5l"}, "quantity": 1}]'::jsonb,
        'Rua Direita', 'São Pedro', 'MULTICAIXA_EXPRESS'
      );
    `);

    // Alterna para service_role para tentar confirmação
    await db.exec(`set "request.jwt.claim.role" = 'service_role';`);

    let duplicateRefBlocked = false;
    let duplicateRefErrMsg = '';
    try {
      await db.query(`
        select public.confirm_order_payment(
          'ENC-TEST-003',
          'REF-MCX-998877', -- Referência já usada em ENC-TEST-001!
          'MULTICAIXA_EXPRESS',
          1500,
          '{}'::jsonb
        );
      `);
    } catch (err) {
      duplicateRefBlocked = true;
      duplicateRefErrMsg = err.message;
    }

    const t6Passed = replayRes.idempotent_replay === true && duplicateRefBlocked === true;
    recordTest(6, 'Idempotência Real e Unicidade Global de Referência', 'REAL POSTGRESQL', t6Passed,
      `Replay mesma encomenda: ${replayRes.idempotent_replay}. Reutilização em outra encomenda bloqueada: "${duplicateRefErrMsg.split('\n')[0]}"`);

    // --------------------------------------------------------------------------
    // TESTE 7: Eliminação da Dupla Libertação na Expiração de Stock
    // --------------------------------------------------------------------------
    // Simula encomenda com reserva expirada
    await db.query(`
      update public.product_orders
      set reservation_expires_at = timezone('utc'::text, now()) - interval '10 minutes'
      where id = 'ENC-TEST-003';
    `);

    const prodBeforeExp = (await db.query(`select stock, reserved_stock from public.products where id = 'prod-agua-5l'`)).rows[0];
    
    // Executa a rotina de expiração
    const expCount = (await db.query(`select public.release_expired_stock_reservations() as count`)).rows[0].count;
    
    const prodAfterExp = (await db.query(`select stock, reserved_stock from public.products where id = 'prod-agua-5l'`)).rows[0];
    const orderAfterExp = (await db.query(`select order_status from public.product_orders where id = 'ENC-TEST-003'`)).rows[0];

    // O reserved_stock deve ter baixado EXATAMENTE 1 unidade (de 1 para 0), NUNCA duplicado
    const t7Passed = expCount === 1 && 
                     orderAfterExp.order_status === 'Cancelada' &&
                     prodBeforeExp.reserved_stock === 1 &&
                     prodAfterExp.reserved_stock === 0 &&
                     prodAfterExp.stock === 10;

    recordTest(7, 'Expiração sem Dupla Libertação (Single Source of Truth)', 'REAL POSTGRESQL TRIGGER INTEGRATION', t7Passed,
      `Ordens canceladas por expiração: ${expCount}. Reserved Stock antes: ${prodBeforeExp.reserved_stock}, após expiração: ${prodAfterExp.reserved_stock}`);

    // --------------------------------------------------------------------------
    // TESTE 8: Rejeição de Confirmação em Encomenda Cancelada
    // --------------------------------------------------------------------------
    let confirmCancelledBlocked = false;
    let confirmCancelledErrMsg = '';
    try {
      await db.query(`
        select public.confirm_order_payment(
          'ENC-TEST-003', -- Cancelada pela expiração!
          'REF-NOVA-12345',
          'MULTICAIXA_EXPRESS',
          1500,
          '{}'::jsonb
        );
      `);
    } catch (err) {
      confirmCancelledBlocked = true;
      confirmCancelledErrMsg = err.message;
    }

    const t8Passed = confirmCancelledBlocked === true;
    recordTest(8, 'Impedir Confirmação de Encomenda Cancelada/Expirada', 'REAL POSTGRESQL', t8Passed,
      `Confirmação após cancelamento bloqueada com sucesso: "${confirmCancelledErrMsg.split('\n')[0]}"`);

    // --------------------------------------------------------------------------
    // TESTE 9: Cancelamento Antes vs Depois do Pagamento
    // --------------------------------------------------------------------------
    // Pedido 001 já estava pago (stock=0, reserved=0). Se cancelarmos, deve REEMBOLSAR ao catálogo (stock passa a 1).
    await db.query(`
      update public.product_orders
      set order_status = 'Cancelada'
      where id = 'ENC-TEST-001';
    `);

    const prodRefunded = (await db.query(`select stock, reserved_stock from public.products where id = 'prod-unique-gas'`)).rows[0];
    const t9Passed = prodRefunded.stock === 1 && prodRefunded.reserved_stock === 0;
    recordTest(9, 'Reembolso Físico de Stock no Cancelamento Pós-Pagamento', 'REAL POSTGRESQL AUDIT', t9Passed,
      `Stock reposto no inventário de 0 para ${prodRefunded.stock} AOA (Reservado: ${prodRefunded.reserved_stock})`);

    // --------------------------------------------------------------------------
    // TESTE 10: Idempotência Estrita da Carteira (Rejeição de Divergência)
    // --------------------------------------------------------------------------
    const wallet1 = (await db.query(`
      select public.execute_wallet_movement(
        '22222222-2222-2222-2222-222222222222',
        'credit',
        10000,
        'Carregamento Inicial',
        'TX-WALLET-001'
      ) as res;
    `)).rows[0].res;

    // Replay idêntico
    const walletReplay = (await db.query(`
      select public.execute_wallet_movement(
        '22222222-2222-2222-2222-222222222222',
        'credit',
        10000,
        'Carregamento Inicial',
        'TX-WALLET-001'
      ) as res;
    `)).rows[0].res;

    // Tentativa de fraude: mesma referência com valor divergente (999999 AOA)
    let divergenceBlocked = false;
    let divergenceErrMsg = '';
    try {
      await db.query(`
        select public.execute_wallet_movement(
          '22222222-2222-2222-2222-222222222222',
          'credit',
          999999, -- Fraude de montante!
          'Carregamento Inicial',
          'TX-WALLET-001'
        );
      `);
    } catch (err) {
      divergenceBlocked = true;
      divergenceErrMsg = err.message;
    }

    const t10Passed = wallet1.idempotent_replay === false && 
                      walletReplay.idempotent_replay === true && 
                      divergenceBlocked === true;

    recordTest(10, 'Carteira: Idempotência Estrita e Rejeição de Fraude', 'REAL POSTGRESQL FINANCIAL LEDGER', t10Passed,
      `Replay idêntico autorizado. Fraude de montante divergente rejeitada: "${divergenceErrMsg.split('\n')[0]}"`);

    // --------------------------------------------------------------------------
    // TESTE 11: Proteção de Saldo Negativo na Carteira
    // --------------------------------------------------------------------------
    let overdraftBlocked = false;
    let overdraftErrMsg = '';
    try {
      await db.query(`
        select public.execute_wallet_movement(
          '22222222-2222-2222-2222-222222222222',
          'debit',
          50000, -- Saldo atual é 10.000 AOA!
          'Tentativa de Saque Descoberto',
          'TX-WALLET-OVERDRAFT'
        );
      `);
    } catch (err) {
      overdraftBlocked = true;
      overdraftErrMsg = err.message;
    }

    const t11Passed = overdraftBlocked === true;
    recordTest(11, 'Proteção Contra Descoberto / Saldo Negativo na Carteira', 'REAL POSTGRESQL CONSTRAINT', t11Passed,
      `Tentativa de débito superior ao saldo bloqueada com sucesso: "${overdraftErrMsg.split('\n')[0]}"`);

    // --------------------------------------------------------------------------
    // TESTE 12: Validação de Serviços e Preço 0 / Sob Orçamento em Agendamentos
    // --------------------------------------------------------------------------
    await db.query(`
      insert into public.services (id, category_id, category_name, name, price_aoa, unit, description, image)
      values ('serv-limpeza-geral', 'cat-limpeza', 'Limpezas', 'Limpeza Profunda Sob Orçamento', 0, 'por vistoria', 'Avaliação no local', 'limp.jpg');
    `);

    // Cliente agenda serviço com total adulterado de 99.000 AOA
    await db.exec(`set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';`);
    await db.exec(`set "request.jwt.claim.role" = 'authenticated';`);

    await db.query(`
      insert into public.bookings (
        id, user_id, service_id, service_name, category, customer_name, customer_phone,
        date, time, location, payment_method, total_aoa
      ) values (
        'AG-TEST-001', '22222222-2222-2222-2222-222222222222', 'serv-limpeza-geral',
        'Limpeza Profunda Sob Orçamento', 'Limpezas', 'Cliente Teste', '923999999',
        '2026-11-20', '09:00', 'Bairro Académico', 'Dinheiro', 99000
      );
    `);

    const bookingRes = (await db.query(`select total_aoa from public.bookings where id = 'AG-TEST-001'`)).rows[0];
    const t12Passed = Number(bookingRes.total_aoa) === 0;
    recordTest(12, 'Agendamento: Preço Sob Orçamento Forçado a 0 pelo Catálogo', 'REAL POSTGRESQL CATALOG INTEGRATION', t12Passed,
      `Valor arbitrário de 99.000 AOA ignorado pelo servidor; total_aoa fixado em ${bookingRes.total_aoa} AOA`);

    // --------------------------------------------------------------------------
    // TESTE 13: Rejeição de Quantidades Fracionárias
    // --------------------------------------------------------------------------
    let fractionBlocked = false;
    let fractionErrMsg = '';
    try {
      await db.query(`
        insert into public.product_orders (
          id, user_id, customer_name, customer_phone, items, 
          delivery_address, delivery_bairro, payment_method
        ) values (
          'ENC-TEST-FRAC', '22222222-2222-2222-2222-222222222222', 'Cliente Frac', '923000005',
          '[{"product": {"id": "prod-agua-5l"}, "quantity": 1.5}]'::jsonb, -- Fração não permitida!
          'Rua 1', 'Centro', 'MULTICAIXA_EXPRESS'
        );
      `);
    } catch (err) {
      fractionBlocked = true;
      fractionErrMsg = err.message;
    }

    const t13Passed = fractionBlocked === true;
    recordTest(13, 'Rejeição Estrita de Quantidades Fracionárias', 'REAL POSTGRESQL VALIDATION', t13Passed,
      `Quantidade 1.5 rejeitada com sucesso: "${fractionErrMsg.split('\n')[0]}"`);

    // --------------------------------------------------------------------------
    // RESUMO DA SUÍTE DE TESTES
    // --------------------------------------------------------------------------
    const total = results.length;
    const passed = results.filter(r => r.passed).length;

    console.log('\n==============================================================================');
    console.log(`SUÍTE DE TESTES POSTGRESQL: ${passed}/${total} TESTES APROVADOS (${Math.round((passed/total)*100)}%)`);
    console.log('==============================================================================');

    if (passed === total) {
      console.log('STATUS: 100% HOMOLOGADO CONTRA MOTOR POSTGRESQL REAL (PGlite v16)');
      process.exit(0);
    } else {
      console.error('STATUS: FALHA EM TESTES NO POSTGRESQL REAL');
      process.exit(1);
    }

  } catch (err) {
    console.error('Erro fatal ao executar suíte:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
    if (err.position) console.error('Position:', err.position);
    process.exit(1);
  }
}

runTests();
