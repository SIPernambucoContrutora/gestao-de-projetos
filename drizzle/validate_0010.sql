-- validate_0010.sql — confere a remoção do responsável do empreendimento.
-- Esperado: NENHUMA linha (a coluna não deve mais existir).
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'empreendimentos'
   and column_name  = 'responsavel';

-- Esperado: as colunas remanescentes — id, nome, created_at.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'empreendimentos'
 order by ordinal_position;

-- Esperado: o histórico antigo de 'responsavel' continua intacto.
select count(*) as historico_responsavel_preservado
  from public.historico_alteracoes
 where campo = 'responsavel';
