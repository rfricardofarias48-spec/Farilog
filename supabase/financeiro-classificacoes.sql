-- ============================================================================
-- Classificações do Financeiro
-- ----------------------------------------------------------------------------
-- Cria a tabela de classificações, adiciona a coluna em financeiro_lancamentos
-- e já deixa os lançamentos existentes classificados.
-- Rode este script no SQL Editor do Supabase (uma vez).
-- ============================================================================

create table if not exists public.financeiro_classificacoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  tipo       text not null default 'despesa' check (tipo in ('despesa', 'receita')),
  cor        text not null default '#4A4A4A',
  sistema    boolean not null default false,
  criado_em  timestamptz not null default now()
);

alter table public.financeiro_lancamentos
  add column if not exists classificacao_id uuid
  references public.financeiro_classificacoes(id) on delete set null;

create index if not exists idx_financeiro_lancamentos_classificacao
  on public.financeiro_lancamentos (classificacao_id);

-- Acesso total para o app (mesmo padrão das outras tabelas do financeiro).
alter table public.financeiro_classificacoes enable row level security;

drop policy if exists "financeiro_classificacoes_full_access" on public.financeiro_classificacoes;
create policy "financeiro_classificacoes_full_access"
  on public.financeiro_classificacoes
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Classificações padrão (idempotente: não duplica se rodar de novo).
insert into public.financeiro_classificacoes (nome, tipo, cor, sistema) values
  ('Benefícios',          'despesa', '#7B5EA7', true),
  ('Folha de Pagamento',  'despesa', '#3A4F6B', true),
  ('Custo Fixo',          'despesa', '#96671F', true),
  ('Endividamento',       'despesa', '#8C3B4A', true),
  ('Despesas Variáveis',  'despesa', '#2F6F73', true),
  ('Receitas',            'receita', '#2F7A4F', true)
on conflict (nome) do nothing;

-- Backfill: classifica o que já existe.
update public.financeiro_lancamentos l
set classificacao_id = c.id
from public.financeiro_classificacoes c
where l.classificacao_id is null
  and c.nome = case
    when l.tipo = 'a_receber'            then 'Receitas'
    when l.origem_tipo = 'custo_fixo'    then 'Custo Fixo'
    when l.origem_tipo = 'divida'        then 'Endividamento'
    when l.origem_tipo = 'beneficio'     then 'Benefícios'
    when l.origem_tipo = 'folha'         then 'Folha de Pagamento'
    else 'Despesas Variáveis'
  end;

-- ----------------------------------------------------------------------------
-- OPCIONAL: amplia a constraint de origem_tipo para aceitar benefício e folha.
-- Sem isso o app ainda funciona (grava como 'manual' + classificação correta),
-- mas com isso a origem fica semanticamente correta.
-- ----------------------------------------------------------------------------
alter table public.financeiro_lancamentos
  drop constraint if exists financeiro_lancamentos_origem_tipo_check;
alter table public.financeiro_lancamentos
  add constraint financeiro_lancamentos_origem_tipo_check
  check (origem_tipo in ('manual', 'custo_fixo', 'divida', 'beneficio', 'folha'));