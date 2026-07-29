-- 0005_projetistas_revisao_item.sql
-- ------------------------------------------------------------------
-- 1) Novo cadastro "projetistas" (sem login), vinculado 1:N a itens_projeto.
-- 2) Move "Revisão" (revisao_atual/data_revisao) do empreendimento para o
--    item de projeto, preservando o valor herdado do empreendimento antes
--    de remover as colunas de lá.
-- ------------------------------------------------------------------

-- 1) Tabela de projetistas
CREATE TABLE IF NOT EXISTS public.projetistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Vínculo projetista <- item (1 projetista por item, opcional)
ALTER TABLE public.itens_projeto
  ADD COLUMN IF NOT EXISTS projetista_id uuid
    REFERENCES public.projetistas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS itens_projeto_projetista_id_idx
  ON public.itens_projeto (projetista_id);

-- 3) Revisão passa a existir por item
ALTER TABLE public.itens_projeto
  ADD COLUMN IF NOT EXISTS revisao_atual text NOT NULL DEFAULT 'R00',
  ADD COLUMN IF NOT EXISTS data_revisao date;

-- 4) Backfill: herda a revisão vigente do empreendimento para os itens já
--    existentes, antes de remover as colunas do empreendimento.
UPDATE public.itens_projeto i
SET revisao_atual = COALESCE(e.revisao_atual, 'R00'),
    data_revisao = e.data_revisao
FROM public.empreendimentos e
WHERE e.id = i.empreendimento_id;

-- 5) Remove os campos de revisão do empreendimento (movidos para o item)
ALTER TABLE public.empreendimentos
  DROP COLUMN IF EXISTS revisao_atual,
  DROP COLUMN IF EXISTS data_revisao;
