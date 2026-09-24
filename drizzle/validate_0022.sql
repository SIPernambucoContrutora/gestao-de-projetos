-- validate_0022.sql — confira antes de aplicar na branch principal.

-- 1) Enum tipo_email agora tem 3 valores, "aprovacao_vencendo" por último.
SELECT e.enumlabel, e.enumsortorder
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname = 'tipo_email'
 ORDER BY e.enumsortorder;
