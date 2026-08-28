-- 0012_prioridade_item.sql
-- ------------------------------------------------------------------
-- Prioridade do item de disciplina (baixa/media/alta). Escolhida à mão
-- no cadastro e no drawer — diferente do status, não é derivada de nada.
-- Default 'media': o acervo existente passa a ter prioridade média, que
-- é o meio-termo neutro (nenhum item nasce marcado como urgente).
--
-- ATENÇÃO: `CREATE TYPE` e `ALTER TABLE` podem rodar juntos; só o
-- `ALTER TYPE ... ADD VALUE` é que exige autocommit (ver 0009).
--
-- NÃO mexe em itens_projeto.meta_dias: o campo saiu da interface (não é
-- mais exibido nem editável), mas a coluna fica no banco para preservar
-- o que já foi digitado e manter o histórico antigo legível.
-- ------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridade_item') THEN
    CREATE TYPE public.prioridade_item AS ENUM ('baixa', 'media', 'alta');
  END IF;
END
$$;

ALTER TABLE public.itens_projeto
  ADD COLUMN IF NOT EXISTS "prioridade" public.prioridade_item NOT NULL DEFAULT 'media';

CREATE INDEX IF NOT EXISTS itens_projeto_prioridade_idx
  ON public.itens_projeto ("prioridade");
