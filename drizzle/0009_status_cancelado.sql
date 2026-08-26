-- 0009_status_cancelado.sql
-- ------------------------------------------------------------------
-- Novo valor 'cancelado' no enum status_item — item encerrado sem
-- entrega. Sai do fluxo de prazos: nunca conta como atrasado nem entra
-- na base do percentual de finalizados (ver lib/ui/status.ts).
--
-- ATENÇÃO: `ALTER TYPE ... ADD VALUE` não pode rodar dentro de um bloco
-- de transação explícito. Rodando com `psql -f` (autocommit) funciona;
-- no console web, execute a instrução sozinha.
-- ------------------------------------------------------------------

ALTER TYPE public.status_item ADD VALUE IF NOT EXISTS 'cancelado' AFTER 'finalizado';
