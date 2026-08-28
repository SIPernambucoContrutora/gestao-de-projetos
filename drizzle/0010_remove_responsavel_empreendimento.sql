-- 0010_remove_responsavel_empreendimento.sql
-- ------------------------------------------------------------------
-- Remove empreendimentos.responsavel. O campo era texto livre, sem
-- vínculo com os usuários da aplicação, e não alimentava nenhuma regra
-- — só duplicava informação já coberta pelo projetista do item e pelo
-- usuário da análise.
--
-- O histórico NÃO é tocado: linhas antigas com campo = 'responsavel'
-- continuam válidas e legíveis (o rótulo segue em lib/ui/status.ts).
-- ------------------------------------------------------------------

ALTER TABLE public.empreendimentos DROP COLUMN IF EXISTS "responsavel";
