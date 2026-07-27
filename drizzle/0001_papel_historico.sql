-- Migration 0001 — RBAC da aplicação + histórico de alterações
-- Rode DEPOIS de 0000_init e DEPOIS de habilitar o Neon Auth no console
-- (Auth > Enable Auth). Aplicar sempre via branch temporária (ver RUNBOOK.md).
--
-- usuario_id guarda o session.user.id do Neon Auth (text). Não criamos FK
-- física para o schema neon_auth: no managed (beta) ele é gerenciado pelo
-- Neon e não é um alvo estável de FK.

BEGIN;

--> enum de papéis
CREATE TYPE "papel_usuario" AS ENUM ('admin', 'equipe', 'leitura');

--> usuarios_papel (uma linha por usuário; default leitura)
CREATE TABLE "usuarios_papel" (
  "usuario_id" text PRIMARY KEY NOT NULL,
  "papel"      "papel_usuario" NOT NULL DEFAULT 'leitura',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> historico_alteracoes
CREATE TABLE "historico_alteracoes" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id"      uuid NOT NULL,
  "usuario_id"   text NOT NULL,
  "campo"        text NOT NULL,
  "valor_antigo" text,
  "valor_novo"   text,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "historico_alteracoes_item_id_fk"
    FOREIGN KEY ("item_id") REFERENCES "itens_projeto" ("id") ON DELETE CASCADE
);

CREATE INDEX "historico_alteracoes_item_id_idx"    ON "historico_alteracoes" ("item_id");
CREATE INDEX "historico_alteracoes_usuario_id_idx" ON "historico_alteracoes" ("usuario_id");

COMMIT;

-- Promova seu 1º admin manualmente (troque pelo seu session.user.id):
-- INSERT INTO "usuarios_papel" ("usuario_id", "papel")
-- VALUES ('<seu-user-id-do-neon-auth>', 'admin')
-- ON CONFLICT ("usuario_id") DO UPDATE SET "papel" = 'admin', "updated_at" = now();
