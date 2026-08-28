import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

// Ciclo de vida do item. A cor no frontend é DERIVADA automaticamente do
// valor (não é mais escolhida livremente). O par 'pendente'/'em_andamento'
// também é derivado, e equivale à presença de prazo_previsto: sem previsto o
// item é 'pendente', com previsto é 'em_andamento' (ver resolverStatus em
// lib/ui/status.ts). Nunca é escolhido à mão.
// 'em_analise' é a etapa entre o projetista concluir e a equipe validar —
// exige usuario_analise_id.
// 'cancelado' encerra o item sem entrega — sai do fluxo de prazos.
export const statusItemEnum = pgEnum("status_item", [
  "pendente",
  "em_andamento",
  "em_analise",
  "finalizado",
  "cancelado",
]);

// Papéis de acesso. O papel é atributo da APLICAÇÃO (tabela usuarios_papel),
// keyed pelo id de usuário do Neon Auth — a doc do Neon Auth managed (beta)
// não garante campos customizados no perfil do neon_auth. Ver lib/auth/session.ts.
export const papelUsuarioEnum = pgEnum("papel_usuario", [
  "admin",
  "equipe",
  "leitura",
]);

// Prioridade do item — escolha manual (ao contrário do status, que é
// derivado de status + prazos). 'media' é o default de quem não escolhe.
export const prioridadeItemEnum = pgEnum("prioridade_item", [
  "baixa",
  "media",
  "alta",
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
 * projetistas  (cadastro simples, sem login — vinculado a itens 1:N)
 * ------------------------------------------------------------------ */

export const projetistas = pgTable("projetistas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  telefone: text("telefone"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
    projetistaId: uuid("projetista_id").references(() => projetistas.id, {
      onDelete: "set null",
    }),
    planta: text("planta"),
    status: statusItemEnum("status").notNull().default("pendente"),
    prioridade: prioridadeItemEnum("prioridade").notNull().default("media"),
    // Usuário que conduz a análise (id do Neon Auth, text, sem FK física).
    // Obrigatório quando status = 'em_analise' (validado nas Server Actions).
    usuarioAnaliseId: text("usuario_analise_id"),
    dataInicio: date("data_inicio"),
    prazoPrevisto: date("prazo_previsto"),
    prazoReprogramado: date("prazo_reprogramado"),
    prazoRealizado: date("prazo_realizado"),
    // LEGADO: a meta saiu da interface (não é exibida nem editável). A
    // coluna fica para preservar o que já foi digitado e manter legível o
    // histórico antigo com campo = 'meta_dias'.
    metaDias: text("meta_dias"),
    observacoes: text("observacoes"),
    // Revisão: não é digitada. Quem avança a revisão é o botão "Nova
    // revisão", habilitado apenas com o item finalizado (ver revisoesItem).
    // Conta apenas as revisões ENTREGUES: uma revisão aberta NÃO muda o
    // número — R00 só vira R01 quando ela chega ao Autodoc.
    revisaoAtual: text("revisao_atual").notNull().default("R00"),
    // Data da última revisão ENTREGUE (= a data do envio para o Autodoc).
    dataRevisao: date("data_revisao"),
    // Existe revisão EM ABERTO. Redundante com "revisão sem realizada_em",
    // mas evita um LATERAL em toda listagem e é o que faz o badge dizer
    // "Em andamento (Revisão)". Sincronizado pelas Server Actions.
    emRevisao: boolean("em_revisao").notNull().default(false),
    // Preenchido apenas no menu de itens; exibido também no dashboard, mas
    // somente para visualização (não editável por lá).
    enviadoAutodoc: boolean("enviado_autodoc").notNull().default(false),
  },
  (t) => [
    index("itens_projeto_empreendimento_id_idx").on(t.empreendimentoId),
    index("itens_projeto_disciplina_id_idx").on(t.disciplinaId),
    index("itens_projeto_etapa_id_idx").on(t.etapaId),
    index("itens_projeto_projetista_id_idx").on(t.projetistaId),
    index("itens_projeto_status_idx").on(t.status),
    index("itens_projeto_prioridade_idx").on(t.prioridade),
    index("itens_projeto_usuario_analise_id_idx").on(t.usuarioAnaliseId),
    index("itens_projeto_em_revisao_idx").on(t.emRevisao),
  ],
);

/* ------------------------------------------------------------------ *
 * revisoes_item
 *
 * Uma linha por VOLTA do item já finalizado para a equipe: o texto da
 * solicitação mandada ao projetista, quando foi pedida e quando foi
 * entregue (realizadaEm = o dia em que a revisão foi ao Autodoc).
 *
 * projetistaNome/projetistaEmail ficam desnormalizados de propósito: a
 * solicitação registra o que foi pedido, a quem, naquela data — trocar o
 * projetista do item depois não pode reescrever esse registro.
 * ------------------------------------------------------------------ */

export const revisoesItem = pgTable(
  "revisoes_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => itensProjeto.id, { onDelete: "cascade" }),
    // Ordinal da revisão dentro do item (1, 2, 3...) — exibido como R01, R02.
    numero: integer("numero").notNull(),
    solicitacao: text("solicitacao").notNull(),
    projetistaId: uuid("projetista_id").references(() => projetistas.id, {
      onDelete: "set null",
    }),
    projetistaNome: text("projetista_nome"),
    projetistaEmail: text("projetista_email"),
    // Quem solicitou (id do Neon Auth, text, sem FK física).
    usuarioId: text("usuario_id").notNull(),
    solicitadaEm: date("solicitada_em").notNull(),
    // NULL = revisão em aberto; preenchida no envio para o Autodoc.
    realizadaEm: date("realizada_em"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("revisoes_item_item_id_idx").on(t.itemId),
    uniqueIndex("revisoes_item_item_id_numero_key").on(t.itemId, t.numero),
    // No máximo UMA revisão aberta por item (invariante do emRevisao).
    uniqueIndex("revisoes_item_aberta_key")
      .on(t.itemId)
      .where(sql`${t.realizadaEm} is null`),
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

export const projetistasRelations = relations(projetistas, ({ many }) => ({
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
  projetista: one(projetistas, {
    fields: [itensProjeto.projetistaId],
    references: [projetistas.id],
  }),
  historico: many(historicoAlteracoes),
  revisoes: many(revisoesItem),
}));

export const revisoesItemRelations = relations(revisoesItem, ({ one }) => ({
  item: one(itensProjeto, {
    fields: [revisoesItem.itemId],
    references: [itensProjeto.id],
  }),
  projetista: one(projetistas, {
    fields: [revisoesItem.projetistaId],
    references: [projetistas.id],
  }),
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
export type Projetista = typeof projetistas.$inferSelect;
export type NovoProjetista = typeof projetistas.$inferInsert;
export type ItemProjeto = typeof itensProjeto.$inferSelect;
export type NovoItemProjeto = typeof itensProjeto.$inferInsert;
export type RevisaoItem = typeof revisoesItem.$inferSelect;
export type NovaRevisaoItem = typeof revisoesItem.$inferInsert;
export type HistoricoAlteracao = typeof historicoAlteracoes.$inferSelect;
export type UsuarioPapel = typeof usuariosPapel.$inferSelect;
export type StatusItem = (typeof statusItemEnum.enumValues)[number];
export type PapelUsuario = (typeof papelUsuarioEnum.enumValues)[number];
export type PrioridadeItem = (typeof prioridadeItemEnum.enumValues)[number];
export type AcaoHistorico = (typeof acaoHistoricoEnum.enumValues)[number];
