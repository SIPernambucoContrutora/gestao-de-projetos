-- Validação da migration 0000 (equivale ao run_sql do fluxo MCP).
-- Rode na branch temporária e confira a saída contra o RUNBOOK.

-- Colunas e tipos de todas as tabelas
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('empreendimentos', 'disciplinas', 'etapas', 'itens_projeto')
ORDER BY table_name, ordinal_position;

-- Valores do enum status_item
SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'status_item'
ORDER BY e.enumsortorder;

-- Constraints (PK, UNIQUE, FK) e ação de delete das FKs
SELECT tc.table_name, tc.constraint_type, tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('empreendimentos', 'disciplinas', 'etapas', 'itens_projeto')
ORDER BY tc.table_name, tc.constraint_type;

-- Índices
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('empreendimentos', 'disciplinas', 'etapas', 'itens_projeto')
ORDER BY tablename, indexname;
