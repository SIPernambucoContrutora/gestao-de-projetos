-- validate_0016.sql — confira antes de aplicar na branch principal.

-- 1) Enum criado com os dois valores.
SELECT enumlabel
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname = 'tipo_email'
 ORDER BY e.enumsortorder;

-- 2) Colunas da tabela.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'emails_enviados'
 ORDER BY ordinal_position;

-- 3) Índice único da idempotência presente.
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename = 'emails_enviados';

-- 4) A trava funciona: o segundo INSERT igual deve falhar com
--    unique_violation. Rode dentro de um bloco que faz ROLLBACK.
BEGIN;
INSERT INTO public.emails_enviados (tipo, item_id, referencia, destinatario, assunto)
VALUES ('vencimento_hoje', NULL, '__teste__', 'a@b.c', 'teste');
-- Esperado: ERROR duplicate key value violates unique constraint
INSERT INTO public.emails_enviados (tipo, item_id, referencia, destinatario, assunto)
VALUES ('vencimento_hoje', NULL, '__teste__', 'a@b.c', 'teste');
ROLLBACK;
