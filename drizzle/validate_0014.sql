-- validate_0014.sql — confere a 0014_status_derivado.sql.

-- 1) O enum deve ter EXATAMENTE 4 valores, sem 'cancelado'.
SELECT enumlabel, enumsortorder
  FROM pg_enum
  JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
 WHERE pg_type.typname = 'status_item'
 ORDER BY enumsortorder;

-- 2) Nenhum item pode violar a derivação. Esperado: 0 linhas.
SELECT id, status, prazo_previsto, prazo_realizado
  FROM public.itens_projeto
 WHERE (prazo_realizado IS NOT NULL AND status <> 'finalizado')
    OR (prazo_realizado IS NULL AND prazo_previsto IS NULL AND status <> 'pendente')
    OR (prazo_realizado IS NULL AND prazo_previsto IS NOT NULL
        AND status NOT IN ('em_andamento', 'em_analise'));

-- 3) Distribuição final, para conferência visual.
SELECT status, count(*) FROM public.itens_projeto GROUP BY status ORDER BY status;

-- 4) O default da coluna deve continuar 'pendente'.
SELECT column_default
  FROM information_schema.columns
 WHERE table_name = 'itens_projeto' AND column_name = 'status';
