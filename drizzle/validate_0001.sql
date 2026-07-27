-- Validação da migration 0001 (rode na branch temporária).

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('usuarios_papel', 'historico_alteracoes')
ORDER BY table_name, ordinal_position;

SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'papel_usuario'
ORDER BY e.enumsortorder;

SELECT tc.table_name, tc.constraint_type, tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('usuarios_papel', 'historico_alteracoes')
ORDER BY tc.table_name, tc.constraint_type;
