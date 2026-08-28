-- validate_0011.sql — a invariante da regra de 'pendente'.
-- Esperado: 0 em ambas as colunas (a equivalência vale nos dois sentidos).
select
  count(*) filter (where status = 'pendente'     and prazo_previsto is not null)
    as pendentes_com_previsto,
  count(*) filter (where status = 'em_andamento' and prazo_previsto is null)
    as em_andamento_sem_previsto
  from public.itens_projeto;

-- Distribuição por status, para conferir o efeito dos UPDATEs.
select status, count(*) as total
  from public.itens_projeto
 group by status
 order by status;
