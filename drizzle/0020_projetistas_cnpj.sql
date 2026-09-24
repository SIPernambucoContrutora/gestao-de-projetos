-- 0020_projetistas_cnpj.sql
-- ------------------------------------------------------------------
-- Adiciona o CNPJ ao cadastro de projetistas, no formato
-- "00.000.000/0000-00". A coluna nasce anulável: já existem projetistas
-- cadastrados sem esse dado e não há um valor "padrão" seguro para
-- atribuir a eles — a tela de Projetistas cobra o preenchimento de quem
-- faltou (projetistas.cnpj IS NULL). Novos projetistas passam a exigir o
-- campo na Server Action (createProjetista), não no banco.
-- ------------------------------------------------------------------

BEGIN;

ALTER TABLE public.projetistas
  ADD COLUMN IF NOT EXISTS cnpj text;

COMMIT;
