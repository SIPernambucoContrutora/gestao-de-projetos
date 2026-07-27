-- Migration 0000_init — camada de dados base
-- Tabelas: empreendimentos, disciplinas, etapas, itens_projeto (+ enum status_item)
--
-- historico_alteracoes NÃO entra aqui: sua FK usuario_id aponta para a tabela
-- de usuários do Neon Auth, que só existe após a FASE 3. Ver drizzle/RUNBOOK.md.
--
-- Rode este arquivo numa BRANCH TEMPORÁRIA do Neon primeiro (ver RUNBOOK).

BEGIN;

--> enum
CREATE TYPE "status_item" AS ENUM ('pendente', 'em_andamento', 'finalizado');

--> empreendimentos
CREATE TABLE "empreendimentos" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nome"          text NOT NULL,
  "responsavel"   text,
  "revisao_atual" text NOT NULL DEFAULT 'R00',
  "data_revisao"  date,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);

--> disciplinas
CREATE TABLE "disciplinas" (
  "id"   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  CONSTRAINT "disciplinas_nome_unique" UNIQUE ("nome")
);

--> etapas
CREATE TABLE "etapas" (
  "id"   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  CONSTRAINT "etapas_nome_unique" UNIQUE ("nome")
);

--> itens_projeto
CREATE TABLE "itens_projeto" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empreendimento_id"  uuid NOT NULL,
  "item"               integer,
  "disciplina_id"      uuid NOT NULL,
  "etapa_id"           uuid NOT NULL,
  "planta"             text,
  "status"             "status_item" NOT NULL DEFAULT 'pendente',
  "data_inicio"        date,
  "prazo_previsto"     date,
  "prazo_reprogramado" date,
  "prazo_realizado"    date,
  "meta_dias"          text,
  "observacoes"        text,
  CONSTRAINT "itens_projeto_empreendimento_id_fk"
    FOREIGN KEY ("empreendimento_id") REFERENCES "empreendimentos" ("id") ON DELETE CASCADE,
  CONSTRAINT "itens_projeto_disciplina_id_fk"
    FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas" ("id") ON DELETE RESTRICT,
  CONSTRAINT "itens_projeto_etapa_id_fk"
    FOREIGN KEY ("etapa_id") REFERENCES "etapas" ("id") ON DELETE RESTRICT
);

CREATE INDEX "itens_projeto_empreendimento_id_idx" ON "itens_projeto" ("empreendimento_id");
CREATE INDEX "itens_projeto_disciplina_id_idx"     ON "itens_projeto" ("disciplina_id");
CREATE INDEX "itens_projeto_etapa_id_idx"          ON "itens_projeto" ("etapa_id");
CREATE INDEX "itens_projeto_status_idx"            ON "itens_projeto" ("status");

COMMIT;
