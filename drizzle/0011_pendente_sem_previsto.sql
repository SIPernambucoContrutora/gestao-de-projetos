-- 0011_pendente_sem_previsto.sql
-- ------------------------------------------------------------------
-- Normaliza o acervo para a nova regra: o par 'pendente'/'em_andamento'
-- passa a EQUIVALER à presença de prazo_previsto — é a mesma resolução
-- que a aplicação faz ao salvar (resolverStatus, lib/ui/status.ts).
--
-- Corrige os dois lados da equivalência:
--   · pendente COM previsto      → em_andamento
--   · em_andamento SEM previsto  → pendente
--
-- 'em_analise', 'finalizado' e 'cancelado' NÃO são tocados: continuam
-- escolhas explícitas, válidas com ou sem previsto.
--
-- Sem linha de histórico: historico_alteracoes.usuario_id é NOT NULL e
-- esta é uma correção de sistema, não a edição de um usuário.
-- ------------------------------------------------------------------

UPDATE public.itens_projeto
   SET status = 'em_andamento'
 WHERE status = 'pendente'
   AND prazo_previsto IS NOT NULL;

UPDATE public.itens_projeto
   SET status = 'pendente'
 WHERE status = 'em_andamento'
   AND prazo_previsto IS NULL;
