-- 0013_revisoes_item.sql
-- ------------------------------------------------------------------
-- Revisão dos itens do projeto.
--
-- Um item FINALIZADO pode voltar para a equipe quando algo é identificado
-- depois (erro de obra, ajuste pedido pelo cliente...). Cada volta dessas é
-- uma linha em revisoes_item, com o texto da solicitação enviada ao
-- projetista, a data em que foi solicitada e a data em que foi entregue
-- (= o momento em que o item é marcado como enviado para o Autodoc).
--
-- O nome/e-mail do projetista ficam DESNORMALIZADOS na revisão: a
-- solicitação é um documento do que foi pedido, para quem, naquela data —
-- trocar o projetista do item depois não pode reescrever esse registro
-- (mesma razão do contexto denormalizado em historico_alteracoes).
--
-- itens_projeto.em_revisao marca a revisão EM ABERTO. É redundante com
-- "existe revisão sem realizada_em", mas evita um LATERAL em toda listagem
-- (dashboard e quadro do empreendimento), e é o que faz o badge dizer
-- "Em andamento (Revisão)". Mantido em sincronia pelas Server Actions,
-- com o índice parcial abaixo garantindo no máximo UMA revisão aberta.
--
-- itens_projeto.revisao_atual (já existente, 'R00') passa a contar apenas
-- as revisões ENTREGUES: só vira R01 quando a 1ª revisão chega ao Autodoc.
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.revisoes_item (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id"          uuid NOT NULL REFERENCES public.itens_projeto("id") ON DELETE CASCADE,
  -- Ordinal da revisão dentro do item (1, 2, 3...). Exibida como R01, R02...
  "numero"           integer NOT NULL,
  "solicitacao"      text NOT NULL,
  -- Destinatário da solicitação, congelado no momento do pedido.
  "projetista_id"    uuid REFERENCES public.projetistas("id") ON DELETE SET NULL,
  "projetista_nome"  text,
  "projetista_email" text,
  -- Quem solicitou (id do Neon Auth, text, sem FK física — ver 0001).
  "usuario_id"       text NOT NULL,
  "solicitada_em"    date NOT NULL,
  -- Preenchida quando a revisão é enviada para o Autodoc. NULL = em aberto.
  "realizada_em"     date,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS revisoes_item_item_id_idx
  ON public.revisoes_item ("item_id");

-- Numeração sem buracos nem repetição dentro do item.
CREATE UNIQUE INDEX IF NOT EXISTS revisoes_item_item_id_numero_key
  ON public.revisoes_item ("item_id", "numero");

-- No máximo UMA revisão em aberto por item (invariante do em_revisao).
CREATE UNIQUE INDEX IF NOT EXISTS revisoes_item_aberta_key
  ON public.revisoes_item ("item_id")
  WHERE "realizada_em" IS NULL;

ALTER TABLE public.itens_projeto
  ADD COLUMN IF NOT EXISTS "em_revisao" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS itens_projeto_em_revisao_idx
  ON public.itens_projeto ("em_revisao");
