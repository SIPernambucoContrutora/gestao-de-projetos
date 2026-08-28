-- 0014_status_derivado.sql
-- ------------------------------------------------------------------
-- O status do item deixa de ser um campo escolhido e passa a ser uma
-- LEITURA das datas (resolverStatus, lib/ui/status.ts):
--
--   prazo_realizado preenchido → 'finalizado'   (precedência)
--   sem prazo_previsto         → 'pendente'
--   com prazo_previsto         → 'em_andamento'
--
-- 'em_analise' segue sendo a única escolha manual (drawer do item, a
-- partir de 'em_andamento'), então NÃO é normalizado enquanto o item
-- tiver previsto e não tiver realizado.
--
-- 'cancelado' é REMOVIDO do enum: o status saiu do produto.
--
-- Sem linhas de histórico: historico_alteracoes.usuario_id é NOT NULL e
-- esta é uma correção de sistema, não a edição de um usuário. Mesma
-- decisão da 0011_pendente_sem_previsto.sql.
-- ------------------------------------------------------------------

BEGIN;

-- 1) Itens cancelados voltam para o fluxo normal. Como o status vira
--    derivado, o destino sai das datas que o item já tem — não há
--    escolha a preservar.
UPDATE public.itens_projeto
   SET status = CASE
         WHEN prazo_realizado IS NOT NULL THEN 'finalizado'
         WHEN prazo_previsto  IS NOT NULL THEN 'em_andamento'
         ELSE 'pendente'
       END::public.status_item
 WHERE status = 'cancelado';

-- 2) Normaliza o acervo inteiro para a nova regra, preservando
--    'em_analise' onde ele ainda é válido (com previsto, sem realizado).
UPDATE public.itens_projeto
   SET status = 'finalizado'
 WHERE prazo_realizado IS NOT NULL
   AND status <> 'finalizado';

UPDATE public.itens_projeto
   SET status = 'pendente'
 WHERE prazo_realizado IS NULL
   AND prazo_previsto IS NULL
   AND status <> 'pendente';

UPDATE public.itens_projeto
   SET status = 'em_andamento'
 WHERE prazo_realizado IS NULL
   AND prazo_previsto IS NOT NULL
   AND status NOT IN ('em_andamento', 'em_analise');

-- 3) Remove 'cancelado' do enum. O Postgres não tem DROP VALUE, então o
--    tipo é recriado e a coluna migrada. historico_alteracoes guarda o
--    status como TEXT (valor_antigo/valor_novo), então o histórico
--    antigo com "cancelado" continua legível e não é tocado.
ALTER TYPE public.status_item RENAME TO status_item_old;

CREATE TYPE public.status_item AS ENUM (
  'pendente',
  'em_andamento',
  'em_analise',
  'finalizado'
);

ALTER TABLE public.itens_projeto
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.status_item
    USING status::text::public.status_item,
  ALTER COLUMN status SET DEFAULT 'pendente';

DROP TYPE public.status_item_old;

COMMIT;
