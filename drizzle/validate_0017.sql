-- validate_0017.sql — confira antes de aplicar na branch principal.

-- 1) Enum criado com os dois valores.
SELECT enumlabel
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname = 'categoria_disciplina'
 ORDER BY e.enumsortorder;

-- 2) Coluna adicionada, anulável.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'disciplinas'
 ORDER BY ordinal_position;

-- 3) Disciplinas existentes ficam sem categoria (a preencher na tela).
SELECT nome, categoria FROM public.disciplinas ORDER BY nome;
