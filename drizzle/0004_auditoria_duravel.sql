-- 0004_auditoria_duravel.sql
-- ------------------------------------------------------------------
-- Torna a auditoria DURÁVEL: os registros sobrevivem à exclusão da entidade.
--
--  * Adiciona contexto denormalizado (empreendimento_nome, item_numero,
--    disciplina_nome), gravado no momento do evento.
--  * Troca as FKs de historico_alteracoes (item_id, empreendimento_id) de
--    ON DELETE CASCADE para ON DELETE SET NULL — assim excluir um item ou
--    empreendimento NÃO apaga o histórico; só desliga a referência.
--  * Backfill do contexto para linhas já existentes.
--
-- Depois disso, a exclusão de um empreendimento é registrada e o histórico
-- passado dele permanece (com empreendimento_id nulo, mas nome preservado).
-- ------------------------------------------------------------------

-- 1) Colunas de contexto denormalizado
ALTER TABLE public.historico_alteracoes
  ADD COLUMN IF NOT EXISTS empreendimento_nome text,
  ADD COLUMN IF NOT EXISTS item_numero integer,
  ADD COLUMN IF NOT EXISTS disciplina_nome text;

-- 2) Backfill do que dá para recuperar das linhas existentes
UPDATE public.historico_alteracoes h
SET empreendimento_nome = e.nome
FROM public.empreendimentos e
WHERE h.empreendimento_id = e.id AND h.empreendimento_nome IS NULL;

UPDATE public.historico_alteracoes h
SET item_numero = i.item,
    disciplina_nome = d.nome
FROM public.itens_projeto i
JOIN public.disciplinas d ON d.id = i.disciplina_id
WHERE h.item_id = i.id AND h.item_numero IS NULL;

-- 3) Troca TODAS as FKs da tabela para ON DELETE SET NULL (nome-agnóstico)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'historico_alteracoes'
      AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.historico_alteracoes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

ALTER TABLE public.historico_alteracoes
  ADD CONSTRAINT historico_alteracoes_item_id_fk
    FOREIGN KEY (item_id) REFERENCES public.itens_projeto(id) ON DELETE SET NULL,
  ADD CONSTRAINT historico_alteracoes_empreendimento_id_fk
    FOREIGN KEY (empreendimento_id) REFERENCES public.empreendimentos(id) ON DELETE SET NULL;
