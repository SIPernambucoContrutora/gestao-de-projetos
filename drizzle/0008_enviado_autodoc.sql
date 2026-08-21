-- 0008_enviado_autodoc.sql
-- ------------------------------------------------------------------
-- Checkbox "Enviado para o Autodoc" em itens_projeto: preenchida apenas
-- no menu de itens, exibida também no dashboard (só para visualização).
-- ------------------------------------------------------------------

ALTER TABLE public.itens_projeto
  ADD COLUMN IF NOT EXISTS enviado_autodoc boolean NOT NULL DEFAULT false;
