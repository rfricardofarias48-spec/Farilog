-- ============================================================================
-- Status dos itens DERIVADOS do Fluxo de Caixa
-- ----------------------------------------------------------------------------
-- Serviços (fechamentos) e Folha entram no Fluxo de Caixa calculados em tempo
-- real, sem linha própria em financeiro_lancamentos — então não havia onde
-- guardar a confirmação de recebimento/pagamento nem uma data especial de
-- cobrança. Esta tabela guarda as duas coisas, identificadas pela chave
-- derivada:
--   • receita de serviço → "REC:<empresa>__<início do fechamento>"
--   • folha automática   → "PAG:<empresa>__Q<quinzena>" (ou "__W<sexta>")
--
-- Sem linha aqui, a derivada é PENDENTE e usa a data calculada automaticamente.
-- O caixa só conta como fato o que estiver confirmado como 'pago'/'recebido'.
-- "Vencido" NÃO é armazenado: é derivado (pendente + vencimento no passado).
--
-- Rode este script no SQL Editor do Supabase (uma vez).
-- ============================================================================

create table if not exists public.financeiro_fluxo_status (
  chave            text primary key,
  status           text not null default 'pendente'
                     check (status in ('pendente', 'pago', 'recebido')),
  data_recebimento date,
  -- Vencimento especial da linha derivada. Nulo = usa a data calculada
  -- automaticamente (fim do fechamento + prazo, ou fim da quinzena + prazo).
  data_vencimento  date,
  atualizado_em    timestamptz not null default now()
);

-- Para bases que já rodaram a versão anterior deste script (sem a coluna).
alter table public.financeiro_fluxo_status
  add column if not exists data_vencimento date;

-- Acesso total para o app (mesmo padrão das outras tabelas do financeiro).
alter table public.financeiro_fluxo_status enable row level security;

drop policy if exists "financeiro_fluxo_status_full_access" on public.financeiro_fluxo_status;
create policy "financeiro_fluxo_status_full_access"
  on public.financeiro_fluxo_status
  for all
  to anon, authenticated
  using (true)
  with check (true);

create index if not exists idx_financeiro_fluxo_status_status
  on public.financeiro_fluxo_status (status);
