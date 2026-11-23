-- Fechamento por datas definidas pela empresa.
--
-- Agora são 2 modos:
--   diaria → cada diária é um fechamento
--   datas  → a empresa fecha nos dias informados (ex.: 10, 20 e 31); o período
--            termina em cada data de fechamento e o vencimento é
--            data de fechamento + prazo_pagamento.
--
-- O dia 31 vale como "último dia do mês" nos meses menores (30, 29, 28).
--
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.empresas
  add column if not exists periodicidade_fechamento text not null default 'diaria',
  add column if not exists dias_fechamento int[] not null default '{}';

-- A constraint antiga aceitava quinzenal/semanal/decenal; precisa sair antes
-- de convertermos os valores para o novo modelo.
alter table public.empresas
  drop constraint if exists empresas_periodicidade_fechamento_check;

-- Converte a configuração antiga em datas de fechamento equivalentes.
update public.empresas
   set dias_fechamento = case periodicidade_fechamento
         when 'quinzenal' then array[15, 31]
         when 'decenal'   then array[10, 20, 31]
         when 'semanal'   then array[7, 14, 21, 28]
         else dias_fechamento
       end,
       periodicidade_fechamento = case
         when periodicidade_fechamento in ('quinzenal', 'decenal', 'semanal') then 'datas'
         when periodicidade_fechamento in ('diaria', 'datas') then periodicidade_fechamento
         else 'diaria'
       end;

alter table public.empresas
  add constraint empresas_periodicidade_fechamento_check
  check (periodicidade_fechamento in ('diaria', 'datas'));

comment on column public.empresas.periodicidade_fechamento is
  'Modo de fechamento do faturamento: diaria (cada diária) ou datas (ver dias_fechamento).';
comment on column public.empresas.dias_fechamento is
  'Dias do mês em que a empresa fecha (1..31). Usado quando periodicidade_fechamento = datas.';