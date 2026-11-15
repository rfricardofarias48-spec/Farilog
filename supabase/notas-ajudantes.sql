-- Avaliações diárias dos ajudantes (notas e observações)
-- Regra de negócio:
--   • O encarregado responsável lança UMA nota por ajudante em cada diária/escala.
--   • A nota vai de 0 a 5 e aceita uma observação livre.
--   • A média do ajudante é recalculada automaticamente pela view vw_funcionarios_notas.
--   • O histórico do ajudante mostra data, empresa, serviço, nota, observação e avaliador.
-- Execute no SQL Editor do Supabase do projeto do Farilog.

create table if not exists public.avaliacoes_diarias (
  id                uuid primary key default gen_random_uuid(),
  escala_id         uuid not null references public.escalas(id) on delete cascade,
  registro_id       uuid references public.registros(id) on delete set null,
  funcionario_id    text not null references public.funcionarios(id) on delete cascade,
  empresa_id        uuid references public.empresas(id) on delete set null,
  lider_id          uuid,
  data              date not null,
  nota              smallint not null,
  observacao        text,
  avaliado_por_tipo text not null default 'encarregado',
  avaliado_por_nome text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint avaliacoes_nota_range check (nota between 0 and 5),
  constraint avaliacoes_unica_por_diaria unique (funcionario_id, escala_id)
);

comment on table  public.avaliacoes_diarias is
  'Notas (0-5) e observações dadas pelo encarregado a cada ajudante em uma diária.';
comment on column public.avaliacoes_diarias.avaliado_por_tipo is
  'Origem do lançamento: encarregado, admin ou sistema.';
comment on column public.avaliacoes_diarias.lider_id is
  'Encarregado/líder responsável pela empresa naquela diária (quando conhecido).';

create index if not exists idx_avaliacoes_funcionario_data
  on public.avaliacoes_diarias (funcionario_id, data desc);
create index if not exists idx_avaliacoes_escala
  on public.avaliacoes_diarias (escala_id);
create index if not exists idx_avaliacoes_empresa_data
  on public.avaliacoes_diarias (empresa_id, data desc);

-- Mantém atualizado_em coerente em updates (upsert de nota já existente).
create or replace function public.tg_avaliacoes_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_avaliacoes_atualizado_em on public.avaliacoes_diarias;
create trigger trg_avaliacoes_atualizado_em
  before update on public.avaliacoes_diarias
  for each row execute function public.tg_avaliacoes_atualizado_em();

-- Média consolidada por ajudante — usada pelo ranking de candidatos e pelo perfil.
create or replace view public.vw_funcionarios_notas as
select
  funcionario_id,
  round(avg(nota)::numeric, 2) as media,
  count(*)::int               as total_avaliacoes,
  min(data)                   as primeira_avaliacao,
  max(data)                   as ultima_avaliacao
from public.avaliacoes_diarias
group by funcionario_id;

grant select on public.vw_funcionarios_notas to anon, authenticated;

-- RLS: o app usa a chave anon e controla o acesso pelas telas (mesmo padrão das demais tabelas).
alter table public.avaliacoes_diarias enable row level security;

drop policy if exists "avaliacoes_diarias_full_access" on public.avaliacoes_diarias;
create policy "avaliacoes_diarias_full_access"
  on public.avaliacoes_diarias
  for all
  to anon, authenticated
  using (true)
  with check (true);