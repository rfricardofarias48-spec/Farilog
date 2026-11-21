-- Detalhes de endividamento: valor financiado (principal), para calcular juros,
-- taxa mensal implícita e a data da última parcela.
--
-- valor_total continua sendo o total a pagar (parcela x quantidade de parcelas).
-- valor_principal é o valor financiado (à vista); a diferença para o total é juros.
-- Sem esta coluna o app continua funcionando: assume principal = valor_total (0% de juros).
--
-- O vencimento das parcelas é derivado de data_inicio (data da 1ª parcela),
-- mantendo o mesmo dia do mês em todas as parcelas.
--
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.financeiro_dividas
  add column if not exists valor_principal numeric;

comment on column public.financeiro_dividas.valor_principal is
  'Valor financiado (à vista) da dívida. valor_total - valor_principal = juros total.';
