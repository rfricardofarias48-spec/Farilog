-- ============================================================================
-- Prazo de pagamento dos ajudantes (folha) por empresa
-- ----------------------------------------------------------------------------
-- Define em quantos dias, após o fim da quinzena, os ajudantes daquela empresa
-- são pagos. O Financeiro usa esse prazo para calcular automaticamente a data
-- das linhas de Folha/VT/VR em Contas a Pagar.
--
-- Padrão 7 dias (equivale à regra antiga: Q1 fecha dia 15 → paga dia 22;
-- Q2 fecha no fim do mês → paga dia 7 do mês seguinte).
--
-- Execute no SQL Editor do Supabase (uma vez).
-- ============================================================================

alter table public.empresas
  add column if not exists prazo_folha integer default 7;

comment on column public.empresas.prazo_folha is
  'Dias após o fim da quinzena para pagar os ajudantes (folha/VT/VR).';