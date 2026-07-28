# Gestão das Obras

Painel para acompanhamento de projetos técnicos de empreendimentos (obras) —
empreendimentos, disciplinas, etapas, prazos, desvios e histórico de alterações,
com autenticação real e controle de acesso por papel.

Aplicação **Next.js (App Router) + TypeScript + Drizzle ORM + Neon (Postgres) +
Neon Auth**. Foi portada de um protótipo estático em React (ver `src/`, mantido
apenas como referência) para um app real, multiusuário e com dados no banco.

---

## Sumário

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Segurança](#segurança)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como rodar](#como-rodar)
- [Modelo de dados](#modelo-de-dados)
- [Controle de acesso (RBAC)](#controle-de-acesso-rbac)
- [Server Actions](#server-actions)
- [Telas](#telas)
- [Migrations](#migrations)
- [Scripts](#scripts)
- [Notas e limitações conhecidas](#notas-e-limitações-conhecidas)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Linguagem | TypeScript, React 19 |
| Banco | Neon (Postgres serverless) |
| ORM | Drizzle ORM (`neon-http` para queries; `neon-serverless` + Pool para transações) |
| Autenticação | Neon Auth (Managed Better Auth, beta) via `@neondatabase/auth` |
| Estilo | CSS único com design tokens (`app/globals.css`) — identidade teal `#064a52` / accent `#0099A5` |

---

## Arquitetura

**Fluxo de dados:** componentes de servidor (páginas) e componentes de cliente
chamam **Server Actions** (`lib/actions/*`). Cada action valida a sessão e o
papel do usuário, então acessa o banco via Drizzle. O navegador **nunca** fala
direto com o banco nem enxerga credenciais.

```
Browser (client components) ──chama──> Server Actions ──valida auth──> Drizzle ──> Neon
                                        (lib/actions/*)   (lib/auth)              (Postgres)
```

- **Leitura** costuma rodar em Server Components (ex.: `listEmpreendimentos` na
  página). **Escrita e interações** rodam em componentes client que invocam
  actions (ex.: `updateItem`, `createItem`, `setPapelUsuario`).
- **Status derivado, não armazenado:** a cor (verde/âmbar/vermelho/cinza) e o
  **desvio** de prazo são calculados a partir de `status` + prazos + data de hoje
  (`lib/ui/status.ts` → `derivarStatus`). "Atrasado" = não finalizado com
  `coalesce(prazo_reprogramado, prazo_previsto) < hoje`. A mesma regra existe em
  SQL nas contagens do dashboard/cards, mantendo fonte única de verdade.
- **Transações:** `neon-http` não faz transação multi-statement, então
  `updateItem` usa `getTxDb()` (Pool/WebSocket) para gravar o item e as N linhas
  de histórico atomicamente.
- **Histórico automático:** `updateItem` compara o item campo a campo e grava
  **uma linha em `historico_alteracoes` por campo alterado**, com o id do usuário
  da sessão.

---

## Segurança

Postura verificada por auditoria (todas as credenciais no lado do servidor):

- **Segredos só no servidor.** `DATABASE_URL`, `NEON_AUTH_BASE_URL` e
  `NEON_AUTH_COOKIE_SECRET` são lidos via `process.env` **apenas** em módulos de
  servidor (`db/index.ts`, `lib/auth/server.ts`, `drizzle.config.ts`). **Nenhuma**
  variável usa o prefixo `NEXT_PUBLIC_`, então nada disso é embarcado no bundle
  do navegador.
- **Fronteira client/servidor limpa.** Nenhum componente `"use client"` importa
  `@/db`, `@/lib/auth/server` ou `@/lib/auth/session`. Componentes client só
  importam **tipos** do schema (`import type`, apagados no build) e **Server
  Actions** (que são um boundary RPC — o corpo roda no servidor).
- **Trava defensiva.** `lib/server-only-guard.ts` é importado pelos módulos de
  servidor e lança imediatamente se algum dia forem avaliados no navegador —
  transforma um erro silencioso em erro óbvio (equivalente leve ao pacote
  `server-only`, sem dependência).
- **Autorização em toda mutação.** Cada action chama `requireUser` /
  `requireEscrita` / `requireAdmin` (`lib/auth/session.ts`) antes de tocar o
  banco. Papel default é `leitura` (least privilege).
- **Segredos fora do git.** `.env` está no `.gitignore` e não é versionado. Só o
  `.env.example` (com placeholders) vai pro repositório.
- **Erros sanitizados em produção.** Em build de produção, o Next redige
  mensagens de erro de Server Actions/RSC para o cliente (mensagem genérica +
  digest), então detalhes de query/stack não vazam para o navegador.

---

## Estrutura de pastas

```
app/
  layout.tsx                     Root layout (html/body, Providers, globals.css)
  icon.png                       Favicon (auto-detectado pelo Next)
  globals.css                    Estilos + design tokens (fonte única de CSS)
  providers.tsx                  NeonAuthUIProvider (client)
  api/auth/[...path]/route.ts    Proxy de todas as rotas do Neon Auth
  auth/
    LoginForm.tsx                Login customizado (client), sem cadastro
    [path]/page.tsx              Renderiza o login para qualquer /auth/*
  (app)/                         Grupo de rotas com o shell autenticado
    layout.tsx                   Sidebar + main (resolve usuário/papel)
    page.tsx                     Dashboard consolidado (rota /)
    empreendimentos/
      page.tsx                   Listagem (cards com progresso)
      [id]/page.tsx              Quadro de itens de um empreendimento
    historico/page.tsx           Histórico global (auditoria)
    usuarios/page.tsx            Gestão de usuários e papéis (admin)
    _components/                 Componentes de UI (Sidebar, boards, drawers, modais)

db/
  index.ts                       db (neon-http) + getTxDb() (pool) + guard
  schema.ts                      Tabelas da aplicação + tipos inferidos
  neonAuth.ts                    Espelho read-only de neon_auth.user (id/email/name)

lib/
  server-only-guard.ts           Trava "só servidor"
  auth/
    server.ts                    createNeonAuth (instância de servidor)
    client.ts                    createAuthClient (cliente de navegador)
    session.ts                   getCurrentUser, requireUser/Escrita/Admin, AuthError
  actions/                       Server Actions ("use server")
    empreendimentos.ts           list/get/create/update/delete + progresso
    itens.ts                     list/create/update(+histórico)/delete + listTodosItens
    historico.ts                 listHistoricoPorItem, listHistoricoGlobal
    listas.ts                    listDisciplinas, listEtapas
    usuarios.ts                  listUsuarios, setPapelUsuario (admin)
  ui/
    status.ts                    derivarStatus, formatBR, formatDataHora, parseISO

drizzle/                         Migrations SQL manuais + runbook
  0000_init.sql                  empreendimentos, disciplinas, etapas, itens_projeto
  0001_papel_historico.sql       papel_usuario, usuarios_papel, historico_alteracoes
  0002_meta_dias_text.sql        Corrige meta_dias INTEGER -> TEXT
  seed_listas.sql                Popula disciplinas e etapas
  RUNBOOK.md                     Passo a passo de aplicação via branch do Neon

public/brand/                    logo.png (sidebar), logo-login.png (tela de login)
src/                             App estático original (referência/legado — não usado em runtime)
.env.example                     Modelo das variáveis de ambiente
drizzle.config.ts                Config do drizzle-kit
```

---

## Como rodar

### 1. Dependências

```bash
npm install
```

> Não rode `npm audit fix --force` — ele faz downgrade destrutivo do `next` e do
> `drizzle-kit`. Ver [Notas](#notas-e-limitações-conhecidas) sobre o `better-auth`.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
DATABASE_URL="postgresql://...-pooler...neon.tech/...?sslmode=require"   # string pooled
DATABASE_URL_UNPOOLED="postgresql://...neon.tech/...?sslmode=require"    # string direct (drizzle-kit)
NEON_AUTH_BASE_URL="https://ep-xxxx.neonauth.<region>.aws.neon.tech"     # host puro, sem path
NEON_AUTH_COOKIE_SECRET="<32+ chars>"                                    # openssl rand -base64 32
```

- `DATABASE_URL` / `DATABASE_URL_UNPOOLED`: Console Neon → projeto → Connection Details.
- Auth: Console Neon → projeto → **Auth → Enable Auth**. Copie o **Auth/Base URL**
  (host puro, **sem** `/auth` nem `/<db>`). Se houver "allowed origins", inclua
  `http://localhost:3000`.

### 3. Migrations e seed

Rode, em ordem, no SQL Editor do Neon (ou via `drizzle/RUNBOOK.md`):

```
drizzle/0000_init.sql
drizzle/0001_papel_historico.sql
drizzle/0002_meta_dias_text.sql
drizzle/seed_listas.sql
```

### 4. Subir o app

```bash
npm run dev        # http://localhost:3000
```

### 5. Primeiro usuário e admin

1. Crie sua conta em `/auth/sign-in` **ou** pelo console da Neon. Não há tela de
   cadastro no app — por decisão de produto, novos usuários são criados pelo admin.
2. Promova-se a admin (a primeira vez é via SQL, pois quem não tem papel é
   `leitura`):

```sql
insert into usuarios_papel (usuario_id, papel)
select id::text, 'admin' from neon_auth.user where email = 'seu-email@dominio.com'
on conflict (usuario_id) do update set papel = 'admin', updated_at = now();
```

Depois disso, a gestão de papéis é feita pela tela **Usuários** (sem SQL).

---

## Modelo de dados

Schema da aplicação (`db/schema.ts`), no schema `public`:

- **`empreendimentos`** — `id`, `nome`, `responsavel`, `revisao_atual` (default
  `R00`), `data_revisao`, `created_at`.
- **`disciplinas`** — `id`, `nome` (único). Ex.: Arquitetura, Estrutura, …
- **`etapas`** — `id`, `nome` (único). Ex.: Estudo preliminar, Anteprojeto, …
- **`itens_projeto`** — `id`, `empreendimento_id` (FK, `ON DELETE CASCADE`),
  `item` (nº), `disciplina_id`/`etapa_id` (FK, `RESTRICT`), `planta`, `status`
  (enum `pendente|em_andamento|finalizado`, default `pendente`), `data_inicio`,
  `prazo_previsto`, `prazo_reprogramado`, `prazo_realizado`, `meta_dias` (**text**,
  ex. "D+30"), `observacoes`. Índices em cada FK e em `status`.
- **`historico_alteracoes`** (auditoria **durável**) — `id`, `item_id` /
  `empreendimento_id` (**nullable**, FKs em **`ON DELETE SET NULL`**), `acao`
  (enum `criacao|edicao|exclusao`), `usuario_id` (**text**), `campo`
  (**nullable**), `valor_antigo`, `valor_novo`, contexto denormalizado
  (`empreendimento_nome`, `item_numero`, `disciplina_nome`), `created_at`.
  Registra criação/edição/exclusão de itens **e** de empreendimentos. Como as FKs
  são `SET NULL` e o contexto é gravado no próprio evento, **o histórico sobrevive
  à exclusão** da entidade (excluir um empreendimento é registrado e não apaga o
  passado dele).
- **`usuarios_papel`** (RBAC da aplicação) — `usuario_id` (**text**, PK), `papel`
  (enum `admin|equipe|leitura`, default `leitura`), `created_at`, `updated_at`.

**Usuários** vêm do schema gerenciado `neon_auth.user` (`id` **uuid**, `email`,
`name`). Não fazemos FK física para ele. `db/neonAuth.ts` é um espelho read-only
tipado para joins.

> ⚠️ **Pegadinha de tipos:** `neon_auth.user.id` é `uuid`, mas nossos
> `usuario_id` são `text`. Joins cross-table precisam de cast explícito:
> `sql\`${usuariosPapel.usuarioId} = ${neonAuthUser.id}::text\``.

---

## Controle de acesso (RBAC)

Papéis (em `usuarios_papel`, keyed pelo id de sessão do Neon Auth):

| Papel | Pode |
|---|---|
| `admin` | Tudo, incluindo gerir papéis de outros usuários. |
| `equipe` | Criar/editar/excluir empreendimentos e itens. |
| `leitura` | Somente visualizar (default de quem não tem linha na tabela). |

Aplicado no servidor por `requireUser` / `requireEscrita` / `requireAdmin`
(`lib/auth/session.ts`) e refletido na UI (`podeEditar` esconde botões de ação e
deixa o drawer em modo consulta para `leitura`). Um admin **não pode rebaixar a
si mesmo** (trava anti-lockout em `setPapelUsuario`).

---

## Server Actions

Todas em `lib/actions/*`, todas com checagem de auth:

| Action | Papel | Descrição |
|---|---|---|
| `listEmpreendimentos` | user | Lista com progresso + contagens (finalizados/andamento/atrasados) |
| `getEmpreendimento` | user | Um empreendimento com progresso |
| `createEmpreendimento` / `updateEmpreendimento` / `deleteEmpreendimento` | escrita | CRUD (delete cascateia itens+histórico) |
| `listItensPorEmpreendimento` | user | Itens de um empreendimento (com nomes de disciplina/etapa) |
| `listTodosItens` | user | Todos os itens (dashboard consolidado) |
| `createItem` | escrita | Cria item |
| `updateItem` | escrita | Atualiza + grava histórico por campo (transação) |
| `deleteItem` | escrita | Remove item |
| `listHistoricoPorItem` | user | Histórico de um item |
| `listHistoricoGlobal` | user | Auditoria global com autor e contexto |
| `listDisciplinas` / `listEtapas` | user | Listas para filtros/selects |
| `listUsuarios` | admin | Usuários + papel resolvido |
| `setPapelUsuario` | admin | Define papel (upsert) |

---

## Telas

- **Dashboard** (`/`) — visão consolidada de todos os itens: 4 métricas (total,
  % finalizados, em andamento, atrasados), filtros (empreendimento, disciplina,
  status, busca) e tabela cross-empreendimento; clicar numa linha abre o quadro.
- **Empreendimentos** (`/empreendimentos`) — cards com progresso, contagens e
  criação de novo empreendimento (admin/equipe).
- **Quadro de itens** (`/empreendimentos/[id]`) — cabeçalho com progresso, tabela
  com filtros, **exportação CSV** dos itens filtrados, criação de item, e drawer
  de edição (status/etapa/datas/observações) com o **histórico do item** e botão
  de excluir.
- **Histórico** (`/historico`) — timeline de auditoria: quem alterou qual campo,
  de→para, quando (fuso America/Recife) e o contexto (empreendimento/item/disciplina).
- **Usuários** (`/usuarios`, admin) — lista usuários e altera papéis inline.
- **Login** (`/auth/*`) — tela fiel ao protótipo; **sem cadastro** (feito pelo admin).

---

## Migrations

As migrations são **SQL manual** aplicado via branch temporária do Neon
(`drizzle/RUNBOOK.md`) — o schema em `db/schema.ts` é a fonte de verdade e os
arquivos `.sql` refletem o estado aplicado. Para checar divergências
schema↔banco antes de virarem erro em runtime, é útil rodar `drizzle-kit`
apontando para o banco.

Ordem: `0000_init` → `0001_papel_historico` → `0002_meta_dias_text` →
`0003_auditoria_ampla` → `0004_auditoria_duravel` → `seed_listas`.

---

## Scripts

```bash
npm run dev          # servidor de desenvolvimento (Turbopack)
npm run build        # build de produção
npm run start        # servir o build
npm run lint         # ESLint (next lint)
npm run db:generate  # drizzle-kit generate
npm run db:migrate   # drizzle-kit migrate
npm run db:studio    # drizzle-kit studio
```

---

## Notas e limitações conhecidas

- **Neon Auth é beta** e fixa `better-auth` em `1.4.x`. Há uma CVE crítica no
  `better-auth <= 1.6.21`, mas a versão corrigida (`>= 1.6.22`) **quebra** o Neon
  Auth beta em runtime (remove APIs que o `auth-ui` usa). Por isso ficamos no
  `1.4.x` conscientemente: os fluxos vulneráveis (OAuth/OIDC provider, magic-link,
  SCIM, organization) rodam no **servidor gerenciado da Neon** (que eles
  patcheiam) — o app só consome sessão. Reavaliar quando a Neon atualizar o pacote.
- **Sem tenancy por linha:** qualquer usuário autenticado enxerga todos os
  empreendimentos. O controle é por **papel** (leitura/escrita/admin), não por
  dono do dado — adequado a uma equipe interna.
- **Deslogado ≠ redirect:** páginas protegidas mostram um estado "Entre com sua
  conta" em vez de redirecionar para o login. Um `middleware.ts` pode adicionar
  redirect automático se desejado.
- **`src/` é legado:** o app estático original (React via Babel, `localStorage`)
  fica no repositório apenas como referência visual; não faz parte do runtime.
