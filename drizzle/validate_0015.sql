-- validate_0015.sql — confira antes de aplicar na branch principal.

-- 1) Coluna criada: boolean, NOT NULL, default false.
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'itens_projeto'
   AND column_name = 'ajustes_pos_analise';

-- 2) Índice criado.
SELECT indexname
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename = 'itens_projeto'
   AND indexname = 'itens_projeto_ajustes_pos_analise_idx';

-- 3) Nenhum item marcado (a migration não faz backfill).
SELECT count(*) AS marcados
  FROM public.itens_projeto
 WHERE ajustes_pos_analise;
