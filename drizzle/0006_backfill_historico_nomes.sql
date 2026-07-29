-- 0006_backfill_historico_nomes.sql
-- ------------------------------------------------------------------
-- Corrige RETROATIVAMENTE o historico_alteracoes: antes da correção em
-- updateItem() (lib/actions/itens.ts), trocar etapa/disciplina/projetista
-- gravava o UUID cru em valor_antigo/valor_novo, em vez do nome legível.
--
-- Este script resolve o nome para toda linha cujo valor ainda seja um uuid
-- válido que corresponda a um registro existente em etapas/disciplinas/
-- projetistas. Linhas cujo uuid não corresponde mais a nada (a entidade foi
-- excluída depois) NÃO podem ser recuperadas e permanecem como uuid — não há
-- como reconstruir um nome que não existe mais em lugar nenhum.
-- ------------------------------------------------------------------

-- Etapa
UPDATE public.historico_alteracoes h
SET valor_antigo = et.nome
FROM public.etapas et
WHERE h.campo = 'etapa'
  AND h.valor_antigo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND h.valor_antigo::uuid = et.id;

UPDATE public.historico_alteracoes h
SET valor_novo = et.nome
FROM public.etapas et
WHERE h.campo = 'etapa'
  AND h.valor_novo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND h.valor_novo::uuid = et.id;

-- Disciplina
UPDATE public.historico_alteracoes h
SET valor_antigo = d.nome
FROM public.disciplinas d
WHERE h.campo = 'disciplina'
  AND h.valor_antigo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND h.valor_antigo::uuid = d.id;

UPDATE public.historico_alteracoes h
SET valor_novo = d.nome
FROM public.disciplinas d
WHERE h.campo = 'disciplina'
  AND h.valor_novo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND h.valor_novo::uuid = d.id;

-- Projetista (campo introduzido na migration 0005; pode não haver linhas ainda)
UPDATE public.historico_alteracoes h
SET valor_antigo = p.nome
FROM public.projetistas p
WHERE h.campo = 'projetista'
  AND h.valor_antigo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND h.valor_antigo::uuid = p.id;

UPDATE public.historico_alteracoes h
SET valor_novo = p.nome
FROM public.projetistas p
WHERE h.campo = 'projetista'
  AND h.valor_novo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND h.valor_novo::uuid = p.id;
