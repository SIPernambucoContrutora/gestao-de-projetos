-- validate_0019.sql — confira antes de aplicar na branch principal.

-- 1) Enum fase_empreendimento agora tem 5 valores, "em_execucao" antes de "executado".
SELECT e.enumlabel, e.enumsortorder
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname = 'fase_empreendimento'
 ORDER BY e.enumsortorder;
