-- validate_0018.sql — confira antes de aplicar na branch principal.

-- 1) Enums criados com os valores esperados.
SELECT t.typname, e.enumlabel
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname IN ('tipo_empreendimento', 'fase_empreendimento')
 ORDER BY t.typname, e.enumsortorder;

-- 2) Colunas adicionadas, anuláveis.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'empreendimentos'
 ORDER BY ordinal_position;

-- 3) Empreendimentos existentes ficam sem tipo/fase (a preencher na tela).
SELECT nome, tipo, fase FROM public.empreendimentos ORDER BY nome;
