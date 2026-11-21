-- ============================================================================
-- Status dos lançamentos do Financeiro (Fluxo de Caixa)
-- ----------------------------------------------------------------------------
-- Adiciona a coluna `status` em financeiro_lancamentos e insere 2 lançamentos
-- genéricos de exemplo (um deles VENCIDO) para visualizar o novo design.
--
-- Valores de status:
--   'pendente'  → não confirmado (padrão quando a coluna está nula)
--   'pago'      → usado quando tipo = 'a_pagar'
--   'recebido'  → usado quando tipo = 'a_receber'
--
-- "Vencido" NÃO é um status armazenado: é derivado (pendente + data no passado).
--
-- Rode este script no SQL Editor do Supabase (uma vez).
-- ============================================================================

alter table public.financeiro_lancamentos
  add column if not exists status text default 'pendente';

alter table public.financeiro_lancamentos
  drop constraint if exists financeiro_lancamentos_status_check;
alter table public.financeiro_lancamentos
  add constraint financeiro_lancamentos_status_check
  check (status is null or status in ('pendente', 'pago', 'recebido'));

create index if not exists idx_financeiro_lancamentos_status
  on public.financeiro_lancamentos (status);

-- ----------------------------------------------------------------------------
-- Dados genéricos de exemplo (opcional — apague depois, se quiser).
-- O primeiro está VENCIDO (a receber, pendente, vencimento 10 dias atrás);
-- o segundo é um pagamento futuro ainda pendente.
-- IDs fixos: rodar de novo não duplica.
-- ----------------------------------------------------------------------------
insert into public.financeiro_lancamentos (id, tipo, descricao, valor, data_vencimento, origem_tipo, status, classificacao_id)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'a_receber',
    '[EXEMPLO] Recebimento — Cliente Alfa (fatura em atraso)',
    5000.00,
    (current_date - interval '10 days')::date,
    'manual',
    'pendente',
    (select id from public.financeiro_classificacoes where nome = 'Receitas')
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'a_pagar',
    '[EXEMPLO] Pagamento — Fornecedor Beta',
    1200.00,
    (current_date + interval '5 days')::date,
    'manual',
    'pendente',
    (select id from public.financeiro_classificacoes where nome = 'Despesas Variáveis')
  )
on conflict (id) do nothing;
