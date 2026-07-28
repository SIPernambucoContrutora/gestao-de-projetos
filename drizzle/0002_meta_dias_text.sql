-- 0002_meta_dias_text.sql
-- ------------------------------------------------------------------
-- Corrige o tipo de itens_projeto.meta_dias.
--
-- Contexto: uma versão inicial do 0000 criou meta_dias como INTEGER,
-- mas o design guarda texto livre ("D+30", "D+45", ...). O schema
-- (db/schema.ts) sempre foi text; o banco é que ficou defasado. Sem
-- isso, criar/editar item com meta="D+30" falha com:
--   invalid input syntax for type integer: "D+30"  (SQLSTATE 22P02)
--
-- Idempotência: só altera se ainda estiver como integer. Como não há
-- (ou há pouquíssimos) valores, o cast integer->text é seguro.
-- ------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'itens_projeto'
      AND column_name = 'meta_dias'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.itens_projeto
      ALTER COLUMN meta_dias TYPE text USING meta_dias::text;
  END IF;
END
$$;
