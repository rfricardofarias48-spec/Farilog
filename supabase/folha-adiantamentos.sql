-- Adiantamentos de pagamento (Folha de Pagamento — admin)
-- Cada lançamento é descontado do total a pagar de um ajudante em uma quinzena.
-- quinzena_idx segue a mesma matemática da folha:
--   idx = (ano - 2000) * 24 + (mes - 1) * 2 + (0 = 1ª quinzena 01–15, 1 = 2ª quinzena 16–fim)

create table if not exists public.folha_adiantamentos (
  id             uuid primary key default gen_random_uuid(),
  funcionario_id text not null references public.funcionarios(id) on delete cascade,
  quinzena_idx   integer not null,
  valor          numeric(10,2) not null check (valor > 0),
  data           date not null default current_date,
  criado_em      timestamptz not null default now()
);

create index if not exists idx_folha_adiantamentos_quinzena
  on public.folha_adiantamentos (quinzena_idx);
create index if not exists idx_folha_adiantamentos_funcionario
  on public.folha_adiantamentos (funcionario_id);

alter table public.folha_adiantamentos enable row level security;

drop policy if exists "folha_adiantamentos_full_access" on public.folha_adiantamentos;
create policy "folha_adiantamentos_full_access"
  on public.folha_adiantamentos
  for all
  to anon, authenticated
  using (true)
  with check (true);
