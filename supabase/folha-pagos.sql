-- Marcação de pagamento efetuado na Folha de Pagamento (admin).
-- Um registro por ajudante + quinzena indica que aquele valor foi pago.
-- quinzena_idx segue a mesma matemática da folha:
--   idx = (ano - 2000) * 24 + (mes - 1) * 2 + (0 = 1ª quinzena 01–15, 1 = 2ª quinzena 16–fim)

create table if not exists public.folha_pagos (
  id             uuid primary key default gen_random_uuid(),
  funcionario_id text not null references public.funcionarios(id) on delete cascade,
  quinzena_idx   integer not null,
  pago_em        timestamptz not null default now(),
  unique (funcionario_id, quinzena_idx)
);

create index if not exists idx_folha_pagos_quinzena
  on public.folha_pagos (quinzena_idx);

alter table public.folha_pagos enable row level security;

drop policy if exists "folha_pagos_full_access" on public.folha_pagos;
create policy "folha_pagos_full_access"
  on public.folha_pagos
  for all
  to anon, authenticated
  using (true)
  with check (true);
