-- validate_0013.sql — confere a tabela de revisões e o flag em_revisao.

-- Esperado: 11 colunas, com realizada_em nullable e solicitacao NOT NULL.
select column_name, udt_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'revisoes_item'
 order by ordinal_position;

-- Esperado: 2 FKs — item_id (CASCADE) e projetista_id (SET NULL).
select tc.constraint_name, kcu.column_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
 where tc.table_schema = 'public'
   and tc.table_name = 'revisoes_item'
   and tc.constraint_type = 'FOREIGN KEY'
 order by kcu.column_name;

-- Esperado: revisoes_item_item_id_idx, revisoes_item_item_id_numero_key
-- e revisoes_item_aberta_key (esta com o WHERE realizada_em IS NULL).
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'revisoes_item'
 order by indexname;

-- Esperado: em_revisao | bool | NO | false
select column_name, udt_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'itens_projeto'
   and column_name in ('em_revisao', 'revisao_atual', 'data_revisao')
 order by column_name;

-- Esperado: todo o acervo com em_revisao = false logo após a migration.
select em_revisao, count(*) as total
  from public.itens_projeto
 group by em_revisao;

-- Invariante: nenhum item com em_revisao = true sem revisão em aberto
-- (e vice-versa). Esperado: 0 linhas.
select i.id, i.em_revisao, count(r.id) filter (where r.realizada_em is null) as abertas
  from public.itens_projeto i
  left join public.revisoes_item r on r.item_id = i.id
 group by i.id, i.em_revisao
having i.em_revisao <> (count(r.id) filter (where r.realizada_em is null) > 0);
