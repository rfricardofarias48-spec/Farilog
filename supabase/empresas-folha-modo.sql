-- ============================================================================
-- Modo de pagamento dos ajudantes por empresa
-- ----------------------------------------------------------------------------
-- Define como a folha (diária + HE) e o VT/VR são pagos:
--   'quinzena' → fim da quinzena + prazo_folha (dias)
--   'semanal'  → diárias feitas até sexta são pagas na quarta da semana seguinte
--
-- É independente do prazo_pagamento (recebimento do cliente).
--
-- Execute no SQL Editor do Supabase (uma vez).
-- ============================================================================

alter table public.empresas
  add column if not exists folha_modo text default 'quinzena';

alter table public.empresas
  drop constraint if exists empresas_folha_modo_check;
alter table public.empresas
  add constraint empresas_folha_modo_check
  check (folha_modo is null or folha_modo in ('quinzena', 'semanal'));

comment on column public.empresas.folha_modo is
  'Regra de pagamento dos ajudantes: quinzena (fim da quinzena + prazo_folha) ou semanal (até sexta, paga na quarta seguinte).';