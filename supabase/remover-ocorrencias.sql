-- Remoção do recurso de Ocorrências (admin + app do encarregado).
-- O recurso foi retirado do app: a sub-aba do admin, a aba do encarregado,
-- o contador "Ocorrências" do relatório diário e as funções correspondentes
-- em src/lib/db.js.
--
-- ATENÇÃO: irreversível. Se a tabela tiver linhas, elas serão apagadas.
-- (Na data desta remoção a tabela public.ocorrencias estava vazia.)
-- Execute no SQL Editor do Supabase do projeto do Farilog.

drop table if exists public.ocorrencias;

-- Opcional: a coluna do relatório diário deixou de ser usada pelo app.
-- Descomente apenas se quiser remover também os contadores históricos:
-- alter table public.relatorios_diarios drop column if exists ocorrencias_count;