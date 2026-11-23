-- ============================================================================
-- Data efetiva de recebimento/pagamento dos lançamentos do Financeiro
-- ----------------------------------------------------------------------------
-- Guarda a data em que o valor foi de fato recebido (a_receber) ou pago
-- (a_pagar). O Fluxo de Caixa usa essa data para exibir "Recebido em DD/MM"
-- na coluna Status. Sem a coluna o app continua funcionando: mostra apenas
-- "Recebido"/"Pago", sem a data.
--
-- Execute este script no SQL Editor do Supabase (uma vez).
-- ============================================================================

alter table public.financeiro_lancamentos
  add column if not exists data_recebimento date;

comment on column public.financeiro_lancamentos.data_recebimento is
  'Data efetiva do recebimento (a_receber) ou pagamento (a_pagar). Exibida como "Recebido em DD/MM" no Status.';