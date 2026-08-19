-- 0007_status_em_analise.sql
-- ------------------------------------------------------------------
-- 1) Novo valor 'em_analise' no enum status_item — a etapa entre o
--    projetista concluir e a equipe validar o item.
-- 2) Coluna usuario_analise_id em itens_projeto: quem está analisando.
--    É o id do usuário do Neon Auth (text, sem FK física — o schema
--    neon_auth é gerenciado pelo Neon, mesma razão de usuarios_papel).
--
-- ATENÇÃO: `ALTER TYPE ... ADD VALUE` não pode rodar dentro de um bloco
-- de transação explícito. Rodando com `psql -f` (autocommit) funciona;
-- se for colar no console web, execute o passo 1 sozinho, antes do 2.
-- ------------------------------------------------------------------

-- 1) Novo valor do enum
ALTER TYPE public.status_item ADD VALUE IF NOT EXISTS 'em_analise' AFTER 'em_andamento';

-- 2) Usuário responsável pela análise
ALTER TABLE public.itens_projeto
  ADD COLUMN IF NOT EXISTS usuario_analise_id text;

CREATE INDEX IF NOT EXISTS itens_projeto_usuario_analise_id_idx
  ON public.itens_projeto (usuario_analise_id);
