-- Prazo de pagamento contado em dias ÚTEIS — regra ESPECÍFICA da Bremen.
--
-- O campo é por empresa e fica ligado APENAS na Bremen. Todas as outras
-- empresas continuam contando dias corridos (padrão do campo = false).
--
-- Quando ligado: o vencimento conta apenas dias úteis (pula sábado e domingo),
-- começando a contar no dia seguinte ao fechamento.
-- Ex.: fechamento na sexta 20/11 + 5 dias úteis = sexta 27/11.
-- Não considera feriados — só fins de semana.
--
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.empresas
  add column if not exists prazo_dias_uteis boolean not null default false;

comment on column public.empresas.prazo_dias_uteis is
  'Prazo de pagamento em dias úteis (pula sábado e domingo). Regra da Bremen; empresas sem o campo ligado contam dias corridos.';

-- Só a Bremen. Garante que nenhuma outra empresa entre na regra.
update public.empresas set prazo_dias_uteis = false where coalesce(nome, '') not ilike 'Bremen%';
update public.empresas set prazo_dias_uteis = true  where nome ilike 'Bremen%';