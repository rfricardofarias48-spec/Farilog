-- Períodos de responsabilidade do encarregado por empresa.
-- Cada linha de lider_empresas passa a registrar o intervalo em que aquele
-- encarregado foi o responsável pela empresa. Quando o responsável é trocado,
-- o período do antigo é encerrado (ate = data da troca) e é aberto um novo
-- período (de = mesma data) para o novo encarregado. Assim o desempenho
-- (diárias, faltas, presença e faturado) de cada um considera apenas o
-- intervalo em que ele realmente respondeu pela empresa.
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.lider_empresas
  add column if not exists de  date not null default current_date,
  add column if not exists ate date;

comment on column public.lider_empresas.de  is
  'Início do período em que o encarregado foi responsável pela empresa.';
comment on column public.lider_empresas.ate is
  'Fim do período (NULL = responsável atual). Preenchido na troca de encarregado.';

create index if not exists lider_empresas_lider_idx   on public.lider_empresas (lider_id);
create index if not exists lider_empresas_empresa_idx on public.lider_empresas (empresa_id);

-- Status de acesso do encarregado (badge Ativo/Inativo na conta).
alter table public.lideres_equipe
  add column if not exists status text default 'active';

-- Conferência rápida: mostra os vínculos e seus períodos.
-- select le.lider_id, l.nome as encarregado, e.nome as empresa,
--        le.de, coalesce(le.ate::text, 'Atual') as ate
--   from public.lider_empresas le
--   join public.lideres_equipe  l on l.id = le.lider_id
--   join public.empresas        e on e.id = le.empresa_id
--  order by l.nome, le.de;
