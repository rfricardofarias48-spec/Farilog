-- Endereço residencial do ajudante (dados do contrato) + localização exata.
--
-- A cidade continua sendo o dado de agrupamento; o endereço e as coordenadas
-- permitem calcular a distância real até a empresa nas buscas e escalas.
-- Sem estas colunas o app continua funcionando, mas cai no centroide da cidade.
--
-- Execute no SQL Editor do Supabase do projeto do Farilog.

alter table public.funcionarios
  add column if not exists endereco text,
  add column if not exists bairro   text,
  add column if not exists cep      text,
  add column if not exists localizacao text;

comment on column public.funcionarios.endereco is
  'Endereço residencial (rua e número) do ajudante — usado no contrato e no cálculo de deslocamento.';

comment on column public.funcionarios.bairro is
  'Bairro do endereço residencial do ajudante.';

comment on column public.funcionarios.cep is
  'CEP do endereço residencial do ajudante.';

comment on column public.funcionarios.localizacao is
  'Link completo do Google Maps ou par "latitude,longitude" para localização exata. Links curtos (maps.app.goo.gl) não trazem coordenadas para o navegador.';

-- latitude/longitude já existem desde supabase/convocacoes.sql.
-- Se ainda não existirem, descomente:
-- alter table public.funcionarios
--   add column if not exists latitude  double precision,
--   add column if not exists longitude double precision;