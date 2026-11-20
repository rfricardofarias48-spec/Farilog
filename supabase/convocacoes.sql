-- Convocação de ajudantes para uma escala (encarregado) + ponte para o agente de WhatsApp.
-- Regra de negócio:
--   • O encarregado monta a escala, marca os titulares e confirma a convocação.
--   • Cada ajudante convidado vira uma linha em public.convocacoes (status inicial 'pendente').
--   • O agente de WhatsApp lê as convocações, envia as mensagens e atualiza o status.
--   • O encarregado e o admin acompanham o status ao vivo (realtime na tabela convocoes).
--   • Sempre há reservas (padrão 2) por escala; quem aceita depois de lotar vira reserva.
-- Execute no SQL Editor do Supabase do projeto do Farilog.

-- ── 1. Vagas, reservas e data de pagamento na escala ──────────────────────────
alter table public.escalas
  add column if not exists vagas         int,
  add column if not exists total_reservas int not null default 2,
  add column if not exists pagamento_em  date;

comment on column public.escalas.vagas is
  'Número de vagas da escala. Quando nulo, assume a quantidade de titulares convocados.';
comment on column public.escalas.total_reservas is
  'Quantidade de reservas que o agente deve buscar para esta escala (padrão 2).';
comment on column public.escalas.pagamento_em is
  'Data prevista de pagamento da diária (calculada na criação a partir do prazo da empresa).';

-- ── 2. Coordenadas (para o mapa da busca) ─────────────────────────────────────
alter table public.empresas
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists raio_km   numeric not null default 40;

alter table public.funcionarios
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

comment on column public.empresas.raio_km is
  'Raio de busca (km) usado pela tela "estilo Uber" e pelo agente para achar candidatos/reservas.';
comment on column public.funcionarios.latitude is
  'Coordenada do ajudante (opcional). Sem ela, o mapa usa o centroide da cidade cadastrada.';

-- ── 3. Convocação: 1 linha por ajudante convidado numa escala ─────────────────
create table if not exists public.convocacoes (
  id                  text primary key default gen_random_uuid()::text,
  escala_id           text not null references public.escalas(id) on delete cascade,
  registro_id         text,
  funcionario_id      text not null references public.funcionarios(id) on delete cascade,
  empresa_id          text,
  lider_id            text,
  papel               text not null default 'titular',   -- titular | reserva
  ordem               int,                               -- posição no ranking (1 = melhor)
  status              text not null default 'pendente',  -- ver máquina de estados abaixo
  distancia_km        numeric,
  nota_snapshot       numeric,
  convite_enviado_em  timestamptz,
  followup_enviado_em timestamptz,
  respondido_em       timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint convocacoes_unica_por_escala unique (escala_id, funcionario_id)
);

comment on column public.convocacoes.papel is
  'titular = escolhido pelo encarregado; reserva = buscado pelo agente fora da lista.';
comment on column public.convocacoes.status is
  'pendente|enviada|confirmado|recusado|sem_resposta|reserva|acionada|falta|cancelada';
comment on column public.convocacoes.distancia_km is
  'Distância (km) até a empresa no momento da convocação — 1ª prioridade do ranking.';
comment on column public.convocacoes.nota_snapshot is
  'Média de notas do ajudante no momento da convocação — 2ª prioridade do ranking.';

create index if not exists idx_convocacoes_escala   on public.convocacoes (escala_id);
create index if not exists idx_convocacoes_status   on public.convocacoes (status);
create index if not exists idx_convocacoes_empresa  on public.convocacoes (empresa_id);

-- ── 4. Log de mensagens (o agente grava o que enviou/recebeu) ──────────────────
create table if not exists public.convocacao_eventos (
  id            text primary key default gen_random_uuid()::text,
  convocacao_id text not null references public.convocacoes(id) on delete cascade,
  direcao       text not null,   -- out | in | sistema
  tipo          text not null,   -- convite|followup_2h|confirmacao_1h|confirmacao_40m|confirmacao_30m|resposta|reserva|cancelamento
  conteudo      text,
  em            timestamptz not null default now()
);

create index if not exists idx_convocacao_eventos_conv on public.convocacao_eventos (convocacao_id, em desc);

-- ── 5. atualizado_em automático ───────────────────────────────────────────────
create or replace function public.tg_convocacoes_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end; $$;

drop trigger if exists trg_convocacoes_atualizado_em on public.convocacoes;
create trigger trg_convocacoes_atualizado_em
  before update on public.convocacoes
  for each row execute function public.tg_convocacoes_atualizado_em();

-- ── 6. View com tudo que o agente precisa para montar a mensagem ──────────────
create or replace view public.vw_convocacoes_agente as
select
  c.id                     as convocacao_id,
  c.escala_id,
  c.funcionario_id,
  c.empresa_id,
  c.status,
  c.papel,
  c.ordem,
  c.distancia_km,
  f.nome                   as ajudante,
  f.telefone,
  f.iniciais,
  e.nome                   as empresa,
  e.endereco,
  coalesce(e.diaria, 0)    as valor_diaria,
  es.data                  as data_servico,
  es.horario,
  coalesce(es.vagas, 0)    as vagas,
  es.pagamento_em,
  es.lider_id,
  (select count(*) from public.convocacoes c2
     where c2.escala_id = c.escala_id and c2.status = 'confirmado') as confirmados
from public.convocacoes c
join public.funcionarios f on f.id = c.funcionario_id
join public.escalas      es on es.id = c.escala_id
left join public.empresas e on e.id = c.empresa_id;

grant select on public.vw_convocacoes_agente to anon, authenticated;

-- ── 7. RLS (mesmo padrão das demais tabelas do app) ───────────────────────────
alter table public.convocacoes        enable row level security;
alter table public.convocacao_eventos  enable row level security;

drop policy if exists "convocacoes_full_access" on public.convocacoes;
create policy "convocacoes_full_access" on public.convocacoes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "convocacao_eventos_full_access" on public.convocacao_eventos;
create policy "convocacao_eventos_full_access" on public.convocacao_eventos
  for all to anon, authenticated using (true) with check (true);

-- ── 8. Realtime na tabela de convocações (status ao vivo p/ encarregado e admin) ─
do $$
begin
  begin
    alter publication supabase_realtime add table public.convocacoes;
  exception when duplicate_object then null;
  end;
end $$;
