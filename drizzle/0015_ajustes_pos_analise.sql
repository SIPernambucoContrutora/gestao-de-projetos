-- 0015_ajustes_pos_analise.sql
-- ------------------------------------------------------------------
-- Marca o item que VOLTOU da análise: quando o status sai de
-- 'em_analise' para 'em_andamento', a equipe pediu correções e o item
-- está em "Ajustes pós análises" — não é um recomeço qualquer.
--
-- É só RÓTULO: o status gravado continua 'em_andamento' (métricas,
-- filtros e ordenação seguem contando o item como em andamento) e o
-- desvio segue a regra normal de prazo. Ver derivarStatus em
-- lib/ui/status.ts.
--
-- A coluna existe pelo mesmo motivo de em_revisao: a transição só é
-- observável no momento em que acontece, e reconstruí-la a cada
-- listagem exigiria varrer o histórico.
--
-- Sem backfill: o histórico anterior não distingue com segurança um
-- retorno da análise de uma reprogramação comum, e marcar itens
-- antigos por engano é pior que deixá-los como "Em andamento".
-- ------------------------------------------------------------------

BEGIN;

ALTER TABLE public.itens_projeto
  ADD COLUMN IF NOT EXISTS ajustes_pos_analise boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS itens_projeto_ajustes_pos_analise_idx
  ON public.itens_projeto (ajustes_pos_analise);

COMMIT;
