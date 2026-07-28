-- 0003_auditoria_ampla.sql
-- ------------------------------------------------------------------
-- Amplia historico_alteracoes de "edições de item" para uma auditoria que
-- cobre criação, edição e exclusão de itens E empreendimentos.
--
--  * item_id passa a ser NULLABLE (eventos de empreendimento e exclusões de
--    item não referenciam uma linha viva de itens_projeto).
--  * empreendimento_id: contexto do evento (FK cascade — o histórico some com
--    o empreendimento).
--  * acao: 'criacao' | 'edicao' | 'exclusao'.
--  * campo passa a ser NULLABLE (nulo em criação/exclusão).
--
-- Idempotente e seguro em tabela vazia (o default de `acao` cobre linhas
-- existentes, se houver).
-- ------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE acao_historico AS ENUM ('criacao', 'edicao', 'exclusao');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.historico_alteracoes
  ALTER COLUMN item_id DROP NOT NULL,
  ALTER COLUMN campo   DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS empreendimento_id uuid
    REFERENCES public.empreendimentos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS acao acao_historico NOT NULL DEFAULT 'edicao';

CREATE INDEX IF NOT EXISTS historico_alteracoes_empreendimento_id_idx
  ON public.historico_alteracoes (empreendimento_id);
