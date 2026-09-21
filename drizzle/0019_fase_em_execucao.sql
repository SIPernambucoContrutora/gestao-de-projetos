-- 0019_fase_em_execucao.sql
-- ------------------------------------------------------------------
-- Acrescenta a fase "Em execução" ao enum fase_empreendimento, entre
-- "Aprovado" e "Executado" (rotulado na UI como "Pronto"). ALTER TYPE
-- ... ADD VALUE não pode rodar dentro de uma transação com outros
-- comandos que já usem o tipo, então este arquivo fica isolado (sem
-- BEGIN/COMMIT) e sem nenhum outro DDL junto.
-- ------------------------------------------------------------------

ALTER TYPE public.fase_empreendimento ADD VALUE IF NOT EXISTS 'em_execucao' BEFORE 'executado';
