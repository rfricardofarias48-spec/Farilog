-- Prazo de pagamento por empresa (dias após o fechamento da quinzena)
-- Regra: vencimento = último dia da quinzena + prazo_pagamento dias
--   1ª quinzena (01 a 15): fecha dia 15 → vencimento dia 15 + prazo
--   2ª quinzena (16 a fim): fecha no último dia do mês → vencimento último dia + prazo
-- Padrão 5 dias = regra antiga do app (Q1 → dia 20, Q2 → dia 5 do mês seguinte).
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.empresas
  add column if not exists prazo_pagamento integer not null default 5;

comment on column public.empresas.prazo_pagamento is
  'Prazo de pagamento em dias contados a partir do fechamento da quinzena (padrão 5).';
