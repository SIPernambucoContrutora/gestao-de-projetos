-- 0022_tipo_email_aprovacao.sql
-- ------------------------------------------------------------------
-- Novo tipo de e-mail: aviso de que a aprovação de um empreendimento na
-- Prefeitura vence em ~60 dias. Não é ligado a item: a linha em
-- emails_enviados fica com item_id NULL e a referencia é
-- "<empreendimento_id>:<data_aprovacao>" — o índice único (com NULLS NOT
-- DISTINCT, ver 0016) garante um aviso por aprovação, e uma nova
-- aprovação (nova data) gera um novo aviso.
--
-- ALTER TYPE ... ADD VALUE fica isolado, sem BEGIN/COMMIT e sem outro
-- DDL junto — mesma razão da 0019.
-- ------------------------------------------------------------------

ALTER TYPE public.tipo_email ADD VALUE IF NOT EXISTS 'aprovacao_vencendo';
