-- ============================================================================
-- Desconto / Acréscimo por demanda (escala)
-- ----------------------------------------------------------------------------
-- Permite lançar um desconto ou um valor a mais na demanda. O ajuste entra no
-- faturamento da diária e aparece no total do formulário da demanda.
--
-- desconto e acrescimo ficam guardados na escala (o par da demanda). Para o
-- faturamento, o ajuste líquido (acrescimo - desconto) é distribuído igualmente
-- entre os registros da demanda, na coluna `ajuste` de `registros`, então todo
-- cálculo de faturamento já o considera automaticamente.
--
-- Execute no SQL Editor do Supabase (uma vez).
-- ============================================================================

alter table public.escalas
  add column if not exists desconto  numeric default 0;

alter table public.escalas
  add column if not exists acrescimo numeric default 0;

alter table public.registros
  add column if not exists ajuste numeric default 0;

comment on column public.escalas.desconto  is 'Desconto aplicado à demanda (R$).';
comment on column public.escalas.acrescimo is 'Valor a mais aplicado à demanda (R$).';
comment on column public.registros.ajuste  is 'Parte do desconto/acréscimo da demanda alocada neste registro (R$).';