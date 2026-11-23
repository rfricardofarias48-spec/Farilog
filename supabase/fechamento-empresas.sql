-- Cadência de fechamento do faturamento por empresa.
--
-- Valores aceitos:
--   diaria    → fecha todo dia
--   semanal   → fecha a cada 7 dias (semana de segunda a domingo)
--   decenal   → fecha a cada 10 dias (1–10, 11–20, 21–fim do mês)
--   quinzenal → fecha dias 1–15 e 16–fim do mês (padrão)
--
-- O app agrupa as diárias da empresa pelo período de fechamento e gera um único
-- lançamento a receber, com vencimento = fim do período + prazo_pagamento.
--
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.empresas
  add column if not exists periodicidade_fechamento text not null default 'quinzenal';

alter table public.empresas
  drop constraint if exists empresas_periodicidade_fechamento_check;
alter table public.empresas
  add constraint empresas_periodicidade_fechamento_check
  check (periodicidade_fechamento in ('diaria', 'semanal', 'decenal', 'quinzenal'));

comment on column public.empresas.periodicidade_fechamento is
  'Cadência de fechamento do faturamento: diaria, semanal, decenal (10 dias) ou quinzenal.';