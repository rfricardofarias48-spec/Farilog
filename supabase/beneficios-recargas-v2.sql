-- ============================================================================
-- Benefícios (VT/VR) — recargas nomeadas, lote, período e proteção contra
-- dias duplicados.
-- ----------------------------------------------------------------------------
-- Rode este script no SQL Editor do Supabase (uma vez).
-- A tabela public.beneficios_recargas já existe no projeto; este script só
-- acrescenta as colunas novas usadas pela tela de RH → Benefícios.
--
-- Modelo:
--   * Cada "recarga" é um lote (lote_id) com um nome escolhido pelo usuário.
--   * Cada lote tem período de uso (data_inicio/data_fim), data de pagamento
--     (boleto/repasse) e data da recarga (liberação do crédito).
--   * Cada linha do lote é um funcionário, com valor/dia, dias e a lista
--     exata de dias de uso (dias_uso) — é sobre ela que a deduplicação roda.
-- ============================================================================

alter table public.beneficios_recargas
  add column if not exists lote_id        uuid,
  add column if not exists nome           text,
  add column if not exists data_pagamento date,
  add column if not exists data_inicio    date,
  add column if not exists data_fim       date,
  add column if not exists dias_uso       date[];

create index if not exists idx_beneficios_recargas_lote
  on public.beneficios_recargas (lote_id);

create index if not exists idx_beneficios_recargas_func_tipo
  on public.beneficios_recargas (funcionario_id, tipo);

-- ----------------------------------------------------------------------------
-- Backfill dos lançamentos antigos (sem lote/nome/período).
-- Agrupa por tipo + quinzena para virar um lote coerente no histórico.
-- ----------------------------------------------------------------------------
do $$
declare
  g record;
  novo_lote uuid;
begin
  for g in
    select tipo, quinzena
    from public.beneficios_recargas
    where lote_id is null
    group by tipo, quinzena
  loop
    novo_lote := gen_random_uuid();
    update public.beneficios_recargas
       set lote_id = novo_lote
     where lote_id is null
       and tipo = g.tipo
       and quinzena is not distinct from g.quinzena;
  end loop;
end $$;

update public.beneficios_recargas
   set data_pagamento = coalesce(data_pagamento, data_recarga)
 where data_pagamento is null;

update public.beneficios_recargas
   set data_inicio = make_date(
         split_part(quinzena, '-', 1)::int,
         split_part(quinzena, '-', 2)::int,
         case when split_part(quinzena, '-', 3) = 'Q1' then 1 else 16 end
       )
 where data_inicio is null
   and quinzena ~ '^\d{4}-\d{2}-Q[12]$';

update public.beneficios_recargas
   set data_fim = case
         when split_part(quinzena, '-', 3) = 'Q1'
           then make_date(split_part(quinzena, '-', 1)::int, split_part(quinzena, '-', 2)::int, 15)
         else (date_trunc('month', make_date(split_part(quinzena, '-', 1)::int, split_part(quinzena, '-', 2)::int, 1)) + interval '1 month - 1 day')::date
       end
 where data_fim is null
   and quinzena ~ '^\d{4}-\d{2}-Q[12]$';

-- Nome das recargas antigas: derivado do período (as novas já chegam nomeadas).
update public.beneficios_recargas
   set nome = case
         when data_inicio is not null and data_fim is not null
           then 'Recarga ' || to_char(data_inicio, 'DD/MM/YYYY') || ' a ' || to_char(data_fim, 'DD/MM/YYYY')
         else 'Recarga ' || coalesce(to_char(data_recarga, 'DD/MM/YYYY'), 'antiga')
       end
 where nome is null;

-- ----------------------------------------------------------------------------
-- Anti-duplicidade no banco: o mesmo funcionário não pode receber dois
-- créditos do mesmo tipo no mesmo dia. A tela também valida antes de salvar,
-- mas este trigger protege contra dois usuários salvando ao mesmo tempo.
-- A mensagem de erro começa com "DIAS_DUPLICADOS:" para o app identificar.
-- ----------------------------------------------------------------------------
create or replace function public.checar_conflito_dias_recarga()
returns trigger
language plpgsql
as $$
declare
  dias_conflitantes date[];
begin
  if new.dias_uso is null or cardinality(new.dias_uso) = 0 then
    return new;
  end if;

  select array_agg(d order by d)
    into dias_conflitantes
  from (
    select unnest(existente.dias_uso) as d
    from public.beneficios_recargas existente
    where existente.funcionario_id = new.funcionario_id
      and existente.tipo = new.tipo
      and existente.id <> new.id
      and existente.lote_id is distinct from new.lote_id
  ) dias
  where d = any(new.dias_uso);

  if dias_conflitantes is not null and cardinality(dias_conflitantes) > 0 then
    raise exception 'DIAS_DUPLICADOS:%', array_to_string(dias_conflitantes, ',')
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_beneficios_recargas_conflito on public.beneficios_recargas;
create trigger trg_beneficios_recargas_conflito
before insert or update
on public.beneficios_recargas
for each row execute function public.checar_conflito_dias_recarga();