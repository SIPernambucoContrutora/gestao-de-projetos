-- validate_0012.sql — confere o enum, a coluna e o default da prioridade.

-- Esperado: baixa, media, alta (nesta ordem).
select enumlabel
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
 where t.typname = 'prioridade_item'
 order by e.enumsortorder;

-- Esperado: prioridade | prioridade_item | NO | 'media'::prioridade_item
select column_name, udt_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'itens_projeto'
   and column_name in ('prioridade', 'meta_dias')
 order by column_name;

-- Esperado: todo o acervo em 'media' logo após a migration.
select prioridade, count(*) as total
  from public.itens_projeto
 group by prioridade
 order by prioridade;

-- Esperado: 1 linha (itens_projeto_prioridade_idx).
select indexname
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'itens_projeto'
   and indexname = 'itens_projeto_prioridade_idx';
