-- 0017_categoria_disciplina.sql
-- ------------------------------------------------------------------
-- Categoriza cada disciplina em 'obra' ou 'lancamento'. A coluna nasce
-- anulável: já existem disciplinas cadastradas (ver seed_listas.sql) e
-- não há uma categoria "padrão" segura para atribuir a elas — a tela de
-- Disciplinas cobra o preenchimento de quem faltou.
-- ------------------------------------------------------------------

BEGIN;

CREATE TYPE public.categoria_disciplina AS ENUM ('obra', 'lancamento');

ALTER TABLE public.disciplinas
  ADD COLUMN IF NOT EXISTS categoria public.categoria_disciplina;

COMMIT;
