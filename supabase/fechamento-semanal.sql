-- ============================================================================
-- Fechamento semanal por DIA DA SEMANA
-- ----------------------------------------------------------------------------
-- Adiciona o modo 'semanal' ao faturamento do cliente: a empresa fecha sempre
-- num dia da semana (ex.: toda sexta) e o cliente paga noutro dia da semana
-- seguinte (ex.: toda quarta). Não depende de data fixa no mês.
--
-- No modo semanal, a coluna dias_fechamento guarda DOIS valores ISO (1=segunda
-- … 7=domingo): [dia do fechamento, dia do pagamento].
-- Ex.: fechamento sexta + pagamento quarta  ->  dias_fechamento = {5,3}
--      prazo_pagamento fica 5 (sexta + 5 = quarta seguinte), usado no vencimento.
--
-- Execute no SQL Editor do Supabase (uma vez).
-- ============================================================================

-- A constraint atual só aceita diaria/datas; recria incluindo 'semanal'.
alter table public.empresas
  drop constraint if exists empresas_periodicidade_fechamento_check;

alter table public.empresas
  add constraint empresas_periodicidade_fechamento_check
  check (periodicidade_fechamento in ('diaria', 'datas', 'semanal'));

comment on column public.empresas.periodicidade_fechamento is
  'Modo de fechamento do faturamento: diaria (cada diária), datas (ver dias_fechamento) ou semanal (dia da semana).';
comment on column public.empresas.dias_fechamento is
  'datas: dias do mês (1..31). semanal: dois dias ISO 1..7 = [fechamento, pagamento].';

notify pgrst, 'reload schema';