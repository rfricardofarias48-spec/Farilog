-- Prazo de pagamento contado em dias ÚTEIS.
--
-- Quando ligado, o vencimento da cobrança conta apenas dias úteis (pula sábado
-- e domingo), começando a contar no dia seguinte ao fechamento.
-- Ex.: fechamento na sexta 20/11 + 5 dias úteis = sexta 27/11.
--
-- Não considera feriados — só fins de semana.
--
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.empresas
  add column if not exists prazo_dias_uteis boolean not null default false;

comment on column public.empresas.prazo_dias_uteis is
  'Se true, o prazo de pagamento é contado em dias úteis (pula sábado e domingo), a partir do dia seguinte ao fechamento.';

-- Bremen paga em 5 dias úteis após a emissão da nota (ajuste no cadastro se mudar).
update public.empresas set prazo_dias_uteis = true where nome ilike 'Bremen%';