-- 0021_data_aprovacao_empreendimento.sql
-- ------------------------------------------------------------------
-- Data em que a Prefeitura aprovou o empreendimento. A aprovação vale
-- 1 ano: se o empreendimento continuar "Aprovado" 10 meses depois dela,
-- o cron diário avisa os usuários com papel 'equipe' (ver 0022 e
-- lib/email/aprovacoes.ts).
--
-- A coluna nasce anulável: empreendimentos "Em estudo" não têm aprovação,
-- e os que já passaram dessa fase foram cadastrados sem a data — não há
-- valor seguro para inventar. As regras (nula em 'em_estudo', obrigatória
-- em 'aprovado') ficam na Server Action, como as de tipo/fase (0018).
-- ------------------------------------------------------------------

BEGIN;

ALTER TABLE public.empreendimentos
  ADD COLUMN IF NOT EXISTS data_aprovacao date;

COMMIT;
