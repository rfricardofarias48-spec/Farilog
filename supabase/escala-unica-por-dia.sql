-- Garante uma única escala/convocação por empresa e dia.
--
-- O app já bloqueia na tela, mas este índice é a garantia final contra
-- duplicatas (inclusive em cliques simultâneos).
--
-- Antes de rodar, confira se não há duplicatas antigas:
--   select empresa_id, data, count(*)
--     from public.escalas
--    group by empresa_id, data
--   having count(*) > 1;
--
-- Execute no SQL Editor do Supabase do projeto do Farilog.

create unique index if not exists escalas_empresa_data_unique
  on public.escalas (empresa_id, data);

comment on index public.escalas_empresa_data_unique is
  'Impede duas escalas/convocações para a mesma empresa no mesmo dia.';