import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

// Status é sempre um dos três valores. A cor no frontend é DERIVADA
// automaticamente do valor (não é mais escolhida livremente).
export const statusItemEnum = pgEnum("status_item", [
  "pendente",
  "em_andamento",
  "finalizado",
]);

// Papéis de acesso. O papel é atributo da APLICAÇÃO (tabela usuarios_papel),
// keyed pelo id de usuário do Neon Auth — a doc do Neon Auth managed (beta)
// não garante campos customizados no perfil do neon_auth. Ver lib/auth/session.ts.
export const papelUsuarioEnum = pgEnum("papel_usuario", [
  "admin",
  "equipe",
  "leitura",
]);

// Tipo de evento registrado na auditoria.
export const acaoHistoricoEnum = pgEnum("acao_historico", [
  "criacao",
  "edicao",
  "exclusao",
]);

/* ------------------------------------------------------------------ *
 * empreendimentos
 * ------------------------------------------------------------------ */

export const empreendimentos = pgTable("empreendimentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  responsavel: text("responsavel"),
  revisaoAtual: text("revisao_atual").notNull().default("R00"),
  dataRevisao: date("data_revisao"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ *
 * disciplinas  (nome único: Arquitetura, Estrutura, ...)
 * ------------------------------------------------------------------ */

export const disciplinas = pgTable("disciplinas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
});

/* ------------------------------------------------------------------ *
 * etapas  (nome único: Estudo, Anteprojeto, ...)
 * ------------------------------------------------------------------ */

export const etapas = pgTable("etapas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
});

/* ------------------------------------------------------------------ *
 * itens_projeto
 * ------------------------------------------------------------------ */

export const itensProjeto = pgTable(
  "itens_projeto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empreendimentoId: uuid("empreendimento_id")
      .notNull()
      .references(() => empreendimentos.id, { onDelete: "cascade" }),
    item: integer("item"),
    disciplinaId: uuid("disciplina_id")
      .notNull()
      .references(() => disciplinas.id, { onDelete: "restrict" }),
    etapaId: uuid("etapa_id")
      .notNull()
      .references(() => etapas.id, { onDelete: "restrict" }),
    planta: text("planta"),
    status: statusItemEnum("status").notNull().default("pendente"),
    dataInicio: date("data_inicio"),
    prazoPrevisto: date("prazo_previsto"),
    prazoReprogramado: date("prazo_reprogramado"),
    prazoRealizado: date("prazo_realizado"),
    // Guardada como no design: "D+30", "D+45", ... (texto livre).
    metaDias: text("meta_dias"),
    observacoes: text("observacoes"),
  },
  (t) => [
    index("itens_projeto_empreendimento_id_idx").on(t.empreendimentoId),
    index("itens_projeto_disciplina_id_idx").on(t.disciplinaId),
    index("itens_projeto_etapa_id_idx").on(t.etapaId),
    index("itens_projeto_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ *
 * historico_alteracoes
 *
 * usuario_id = id do usuário do Neon Auth (session.user.id), que é text.
 * Sem FK física para neon_auth (schema gerenciado pelo Neon no managed/beta).
 * Fora da 1ª migration por depender do fluxo de auth; entra na migration 0001.
 * ------------------------------------------------------------------ */

export const historicoAlteracoes = pgTable(
  "historico_alteracoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Auditoria DURÁVEL: FKs em SET NULL para o log sobreviver à exclusão da
    // entidade (o contexto fica preservado nas colunas *_nome/*_numero abaixo).
    itemId: uuid("item_id").references(() => itensProjeto.id, {
      onDelete: "set null",
    }),
    empreendimentoId: uuid("empreendimento_id").references(
      () => empreendimentos.id,
      { onDelete: "set null" },
    ),
    acao: acaoHistoricoEnum("acao").notNull().default("edicao"),
    // usuario_id = id do usuário do Neon Auth (text, sem FK física).
    usuarioId: text("usuario_id").notNull(),
    // campo/valores só se aplicam a 'edicao'; nulos em criação/exclusão.
    campo: text("campo"),
    valorAntigo: text("valor_antigo"),
    valorNovo: text("valor_novo"),
    // Contexto denormalizado, gravado no momento do evento — permanece legível
    // mesmo depois que o item/empreendimento é excluído.
    empreendimentoNome: text("empreendimento_nome"),
    itemNumero: integer("item_numero"),
    disciplinaNome: text("disciplina_nome"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("historico_alteracoes_item_id_idx").on(t.itemId),
    index("historico_alteracoes_empreendimento_id_idx").on(t.empreendimentoId),
    index("historico_alteracoes_usuario_id_idx").on(t.usuarioId),
  ],
);

/* ------------------------------------------------------------------ *
 * usuarios_papel  (RBAC da aplicação)
 *
 * usuario_id = id do usuário no Neon Auth (session.user.id), que é text.
 * Uma linha por usuário. Papel default 'leitura' (least privilege) — quem
 * não tiver linha aqui é tratado como 'leitura' pelas Server Actions.
 * Sem FK física para neon_auth: no managed (beta) esse schema é gerenciado
 * pelo Neon e sua estabilidade como alvo de FK não é garantida.
 * ------------------------------------------------------------------ */

export const usuariosPapel = pgTable("usuarios_papel", {
  usuarioId: text("usuario_id").primaryKey(),
  papel: papelUsuarioEnum("papel").notNull().default("leitura"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ *
 * Relacionamentos
 * ------------------------------------------------------------------ */

export const empreendimentosRelations = relations(empreendimentos, ({ many }) => ({
  itens: many(itensProjeto),
}));

export const disciplinasRelations = relations(disciplinas, ({ many }) => ({
  itens: many(itensProjeto),
}));

export const etapasRelations = relations(etapas, ({ many }) => ({
  itens: many(itensProjeto),
}));

export const itensProjetoRelations = relations(itensProjeto, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [itensProjeto.empreendimentoId],
    references: [empreendimentos.id],
  }),
  disciplina: one(disciplinas, {
    fields: [itensProjeto.disciplinaId],
    references: [disciplinas.id],
  }),
  etapa: one(etapas, {
    fields: [itensProjeto.etapaId],
    references: [etapas.id],
  }),
  historico: many(historicoAlteracoes),
}));

export const historicoAlteracoesRelations = relations(historicoAlteracoes, ({ one }) => ({
  item: one(itensProjeto, {
    fields: [historicoAlteracoes.itemId],
    references: [itensProjeto.id],
  }),
}));

/* ------------------------------------------------------------------ *
 * Tipos inferidos (para uso nas Server Actions da FASE 4)
 * ------------------------------------------------------------------ */

export type Empreendimento = typeof empreendimentos.$inferSelect;
export type NovoEmpreendimento = typeof empreendimentos.$inferInsert;
export type Disciplina = typeof disciplinas.$inferSelect;
export type Etapa = typeof etapas.$inferSelect;
export type ItemProjeto = typeof itensProjeto.$inferSelect;
export type NovoItemProjeto = typeof itensProjeto.$inferInsert;
export type HistoricoAlteracao = typeof historicoAlteracoes.$inferSelect;
export type UsuarioPapel = typeof usuariosPapel.$inferSelect;
export type StatusItem = (typeof statusItemEnum.enumValues)[number];
export type PapelUsuario = (typeof papelUsuarioEnum.enumValues)[number];
export type AcaoHistorico = (typeof acaoHistoricoEnum.enumValues)[number];
