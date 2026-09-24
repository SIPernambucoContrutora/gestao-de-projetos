-- validate_0020.sql — confira antes de aplicar na branch principal.

-- 1) Coluna adicionada, anulável.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'projetistas'
 ORDER BY ordinal_position;

-- 2) Projetistas existentes ficam sem CNPJ (a preencher na tela).
SELECT nome, cnpj FROM public.projetistas ORDER BY nome;
