-- 0018_tipo_fase_empreendimento.sql
-- ------------------------------------------------------------------
-- Classifica cada empreendimento por tipo (Prince/Praia) e fase (Em
-- estudo/Pré-lançamento/Aprovado/Executado). Ambas as colunas nascem
-- anuláveis: já existem empreendimentos cadastrados e não há um valor
-- "padrão" seguro para atribuir a eles — a tela de Empreendimentos cobra
-- o preenchimento de quem faltou (empreendimento.tipo/fase IS NULL). Novos
-- empreendimentos passam a exigir os dois campos na Server Action
-- (createEmpreendimento), não no banco.
-- ------------------------------------------------------------------

BEGIN;

CREATE TYPE public.tipo_empreendimento AS ENUM ('prince', 'praia');
CREATE TYPE public.fase_empreendimento AS ENUM (
  'em_estudo',
  'pre_lancamento',
  'aprovado',
  'executado'
);

ALTER TABLE public.empreendimentos
  ADD COLUMN IF NOT EXISTS tipo public.tipo_empreendimento,
  ADD COLUMN IF NOT EXISTS fase public.fase_empreendimento;

COMMIT;
