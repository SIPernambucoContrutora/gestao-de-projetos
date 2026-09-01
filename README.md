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
- [E-mails automáticos](#e-mails-automáticos-para-projetistas)
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

**Bootstrap do primeiro admin** (só a primeira vez; depois é tudo pela UI):

1. Crie o **primeiro usuário** com senha via `createUsuario` (a tela de Usuários
   exige um admin, então para o 1º use uma chamada direta ao endpoint de sign-up
   do Neon Auth, ou o console). Novos usuários criados por quem não é admin não
   têm como — por isso este passo é manual uma única vez.
2. Promova-o a admin (quem não tem papel é `leitura`):

```sql
insert into usuarios_papel (usuario_id, papel)
select id::text, 'admin' from neon_auth.user where email = 'seu-email@dominio.com'
on conflict (usuario_id) do update set papel = 'admin', updated_at = now();
```

**Depois disso, todo usuário novo é criado pela tela `/usuarios`** (botão "Novo
usuário": nome, e-mail, senha e papel) — o cadastro público fica bloqueado.

---

## Modelo de dados

Schema da aplicação (`db/schema.ts`), no schema `public`:

- **`empreendimentos`** — `id`, `nome`, `created_at`.
- **`disciplinas`** — `id`, `nome` (único). Ex.: Arquitetura, Estrutura, …
- **`etapas`** — `id`, `nome` (único). Ex.: Estudo preliminar, Anteprojeto, …
- **`itens_projeto`** — `id`, `empreendimento_id` (FK, `ON DELETE CASCADE`),
  `item` (nº), `disciplina_id`/`etapa_id` (FK, `RESTRICT`), `planta`, `status`
  (enum `pendente|em_andamento|em_analise|finalizado|cancelado`, default
  `pendente` — o par `pendente`/`em_andamento` é derivado e equivale à presença
  de `prazo_previsto`, nos dois sentidos),
  `prioridade` (enum `baixa|media|alta`, default `media` — escolha manual, não
  derivada), `data_inicio`, `prazo_previsto`, `prazo_reprogramado`,
  `prazo_realizado`, `observacoes`, `revisao_atual`/`data_revisao` (somente
  leitura na interface — quem avança é o botão "Nova revisão", habilitado só com
  o item finalizado; `revisao_atual` conta apenas as revisões **entregues**),
  `em_revisao` (há uma revisão em aberto — ver `revisoes_item`),
  `enviado_autodoc` (é o envio ao Autodoc que **fecha** o
  item: antes dele o desvio nunca diz "Finalizado"), `meta_dias` (**text**,
  ex. "D+30" — **legado**: fora da interface, mantido pelos dados já digitados).
  Índices em cada FK, em `status`, em `prioridade` e em `em_revisao`.
- **`revisoes_item`** — `id`, `item_id` (FK, `ON DELETE CASCADE`), `numero`
  (ordinal dentro do item, exibido `R01`, `R02`…), `solicitacao` (o texto
  mandado ao projetista), `projetista_id` (FK, `SET NULL`) +
  `projetista_nome`/`projetista_email` **denormalizados** (a solicitação
  registra a quem foi pedida naquela data), `usuario_id` (**text**),
  `solicitada_em`, `realizada_em` (**nullable** — `NULL` = revisão em aberto),
  `created_at`. Índice único `(item_id, numero)` e índice **parcial** único em
  `item_id WHERE realizada_em IS NULL`, que garante no máximo **uma** revisão
  aberta por item. Abrir uma revisão zera as datas do item, põe `data_inicio`
  em hoje e desmarca `enviado_autodoc`; marcar o Autodoc de novo fecha a
  revisão e é o único momento em que `revisao_atual` avança (R00 → R01 → …).
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
- **Usuários** (`/usuarios`, admin) — lista usuários, **cria novos usuários com
  senha** e altera papéis inline.
- **Login** (`/auth/*`) — tela fiel ao protótipo; **sem cadastro público**.

---

## Migrations

As migrations são **SQL manual** aplicado via branch temporária do Neon
(`drizzle/RUNBOOK.md`) — o schema em `db/schema.ts` é a fonte de verdade e os
arquivos `.sql` refletem o estado aplicado. Para checar divergências
schema↔banco antes de virarem erro em runtime, é útil rodar `drizzle-kit`
apontando para o banco.

Ordem: `0000_init` → `0001_papel_historico` → `0002_meta_dias_text` →
`0003_auditoria_ampla` → `0004_auditoria_duravel` →
`0005_projetistas_revisao_item` → `0006_backfill_historico_nomes` →
`0007_status_em_analise` → `0008_enviado_autodoc` → `0009_status_cancelado` →
`0010_remove_responsavel_empreendimento` → `0011_pendente_sem_previsto` →
`0012_prioridade_item` → `0013_revisoes_item` → `seed_listas`.

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

## E-mails automáticos para projetistas

Dois disparos, ambos para o e-mail cadastrado do projetista, saindo de
`gestaodeprojetos@pernambucoconstrutora.com.br` via SMTP.

| Gatilho | Quando | Corpo |
|---|---|---|
| `vencimento_hoje` | Todo dia às 08h (Recife), para itens cujo prazo vigente vence hoje | Ficha do item + prazo |
| `revisao_aberta` | No `abrirRevisao` (botão "Nova revisão") | O texto digitado na solicitação |

**Prazo vigente** = `prazo_reprogramado ?? prazo_previsto` — a mesma regra de
`derivarStatus`. Reprogramar move o aviso junto. Ficam de fora itens já
entregues (`prazo_realizado` preenchido) e os status `finalizado` / `em_analise`:
nesses o item está com a equipe, não com o projetista.

### Peças

| Arquivo | Papel |
|---|---|
| `lib/email/smtp.ts` | Transporter nodemailer com pool, criado uma vez por processo |
| `lib/email/templates.ts` | Assunto + HTML/texto. Escapa o que foi digitado |
| `lib/email/enviar.ts` | Envio + registro em `emails_enviados`. **Nunca lança** |
| `lib/email/vencimentos.ts` | A varredura diária |
| `app/api/cron/vencimentos/route.ts` | Rota chamada pelo agendador |

### Idempotência

A tabela `emails_enviados` tem índice único em `(tipo, item_id, referencia)`,
com `NULLS NOT DISTINCT`. A linha é gravada **antes** do envio, via
`INSERT ... ON CONFLICT DO NOTHING`: quem não consegue inserir sabe que outra
execução já assumiu o disparo. É isso que impede o cron de duplicar o aviso ao
reexecutar (retry da plataforma, deploy no meio da janela, chamada manual).

A `referencia` é o que distingue os envios dentro do tipo: a **data do prazo**
para o aviso diário, o **id da revisão** para a revisão.

### O envio nunca derruba a operação

`abrirRevisao` chama `enviarSemBloquear` **depois** do commit. Um SMTP fora do
ar não desfaz a revisão nem interrompe a varredura no meio: a falha vira a
coluna `erro` da linha correspondente. Para ver o que não saiu:

```sql
SELECT created_at, tipo, destinatario, assunto, erro
  FROM emails_enviados
 WHERE erro IS NOT NULL
 ORDER BY created_at DESC
 LIMIT 50;
```

### Autenticação: OAuth2 app-only, não senha

O envio usa SMTP autenticado por **OAuth2 no fluxo client credentials**.
Usuário e senha foram descartados de propósito: a Microsoft desativa o Basic
Auth do SMTP AUTH por padrão nos tenants existentes no **fim de dezembro de
2026**, com remoção definitiva anunciada para 2027.

App-only é o fluxo certo aqui porque quem envia é um cron às 08h — não há
usuário logado para consentir nem refresh token para renovar. A renovação é
pedir outro token com o mesmo segredo, e `lib/email/smtp.ts` cuida disso com
5 minutos de margem antes do vencimento.

### Configuração do lado da Microsoft

> **Os passos 4 e 5 não existem no portal do Azure.** São PowerShell no
> Exchange Online, e sem eles o token é emitido normalmente mas o SMTP recusa
> com `535 5.7.3` — uma falha que parece credencial errada e não é. É o erro
> mais provável desta configuração.

1. **Registrar o app** no Entra ID (Azure portal → Microsoft Entra ID →
   Registros de aplicativo → Novo registro). Escolha "Somente neste diretório
   organizacional". Anote **Directory (tenant) ID** e **Application (client) ID**.

2. **Criar um segredo**: no app → Certificados e segredos → Novo segredo do
   cliente. Copie o **Valor** (não o *ID do segredo* — o portal mostra os dois
   lado a lado e o valor some quando você sai da página). Ele **expira em no
   máximo 24 meses**: anote a data, porque o vencimento derruba o envio sem
   aviso prévio.

3. **Permissão + consentimento**: app → Permissões de API → Adicionar →
   **APIs que minha organização usa** → *Office 365 Exchange Online* →
   **Permissões de aplicativo** → `SMTP.SendAsApp`. Depois clique em
   **Conceder consentimento do administrador**. Precisa ser permissão de
   *aplicativo*, não *delegada*.

4. **Registrar o service principal no Exchange Online**:

   > Conecte com uma conta **Administrador do Exchange**, não com a
   > `gestaodeprojetos@`. A caixa de envio é o *alvo* da permissão (passo 5),
   > não a identidade que a concede: conectado como ela, o cmdlet nem aparece
   > na sessão.

   ```powershell
   Install-Module -Name ExchangeOnlineManagement
   Connect-ExchangeOnline -UserPrincipalName <admin@pernambucoconstrutora.com.br>

   New-ServicePrincipal -AppId <CLIENT_ID> -ObjectId <OBJECT_ID> -DisplayName "Gestao das Obras - envio de e-mail"
   ```

   > Rode cada comando em UMA linha. Continuação com crase quebra ao colar
   > (basta um espaço depois dela) e o PowerShell manda o bloco inteiro como
   > se fosse um único argumento — o erro que sai fala de "usuário não
   > encontrado", escondendo que o problema foi a colagem.

   O `OBJECT_ID` é o da **Enterprise Application** (Entra ID → Aplicativos
   empresariais → o app → Visão geral), **não** o da página de Registros de
   aplicativo. São dois objetos diferentes que o portal rotula igual, como
   "ID do Objeto". Usar o do registro falha com
   `AADServicePrincipalNotFound`. Para não depender do portal:

   ```powershell
   Install-Module Microsoft.Graph.Applications -Scope CurrentUser -Force
   Connect-MgGraph -Scopes "Application.Read.All"

   # O `Id` retornado é o OBJECT_ID correto.
   Get-MgServicePrincipal -Filter "appId eq '<CLIENT_ID>'" |
     Format-List DisplayName, Id, AppId
   ```

   Se não retornar nada, a Enterprise Application não existe — sinal de que
   o consentimento do admin (passo 3) não foi concedido, já que é ele que
   materializa o service principal. Confira o status verde "Concedido para
   \<organização\>" em Permissões de API, ou crie na mão com
   `New-MgServicePrincipal -AppId "<CLIENT_ID>"`.

   > **Se aparecer "New-ServicePrincipal não foi reconhecido":** no Exchange
   > Online PowerShell V3, cmdlets que o usuário não tem permissão de rodar
   > **não são carregados na sessão** — falta de RBAC aparece como "não
   > reconhecido", não como "acesso negado". Diagnostique na mesma janela:
   >
   > ```powershell
   > Get-ConnectionInformation                 # vazio = não conectado AQUI
   > Get-Command New-ServicePrincipal          # existe na sessão?
   > Get-Module ExchangeOnlineManagement -ListAvailable | Select Version
   > ```
   >
   > Em ordem de probabilidade: (a) a sessão caiu — ela expira com ~1h de
   > inatividade e vale só para a janela onde `Connect-ExchangeOnline` rodou;
   > (b) falta o papel **Role Management** (incluso em *Administrador do
   > Exchange* / *Organization Management*) — ser Administrador Global do
   > M365 **não basta**; (c) módulo anterior à 3.x.

5. **Dar acesso à caixa**:

   ```powershell
   Get-ServicePrincipal | Format-List DisplayName, ObjectId, AppId, Identity
   Add-MailboxPermission -Identity "gestaodeprojetos@pernambucoconstrutora.com.br" -User <OBJECT_ID> -AccessRights FullAccess
   ```

   O `Get-ServicePrincipal` da primeira linha faz duas coisas: confirma que o
   passo 4 completou (lista vazia = o service principal não existe, e não há a
   quem conceder) e devolve o `ObjectId` para a segunda linha. Localize a
   entrada pelo **AppId**, que bate com o `AZURE_CLIENT_ID` — não pelo
   `DisplayName`, que costuma vir vazio e faz o `-Identity` não encontrar nada.

   Confira que aplicou:

   ```powershell
   Get-MailboxPermission -Identity "gestaodeprojetos@pernambucoconstrutora.com.br" | Where-Object { $_.User -like "*<OBJECT_ID>*" }
   ```

### Configuração da aplicação

1. Aplique a migration `drizzle/0016_emails_enviados.sql` seguindo o
   `drizzle/RUNBOOK.md` (valide com `validate_0016.sql`).
2. Preencha `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
   `SMTP_FROM` e `CRON_SECRET` — ver `.env.example`.
3. Valide antes de publicar. O script testa as duas metades separadamente
   (Entra emite o token? o Exchange aceita o token?), que é o que distingue
   segredo errado de permissão de mailbox faltando:

   ```bash
   node scripts/testar-email.mjs                    # token + autenticação
   node scripts/testar-email.mjs voce@dominio.com   # + envio real
   ```
4. Publique as mesmas variáveis nas variáveis de ambiente da Vercel.

### Limite de envio

O client submission do Exchange Online corta em **30 mensagens por minuto** e
10.000 destinatários por dia. O transporter usa teto de 20/minuto: estourar o
limite devolve `4.7.x` no meio da rajada, e o aviso das 08h sairia pela
metade — com os itens do fim da fila silenciosamente sem e-mail.

### O agendador é trocável

A lógica vive numa rota HTTP protegida por `CRON_SECRET`, não num agendador
embutido — a hospedagem pode mudar sem tocar no código.

**Hoje (Vercel):** `vercel.json` agenda `0 11 * * *`. **11:00 UTC = 08:00 em
Recife** — Pernambuco não tem horário de verão, então o offset é fixo em -3 e
não há ajuste sazonal a fazer. O Vercel Cron manda o header
`Authorization: Bearer $CRON_SECRET` sozinho, bastando a variável existir.

> No plano **Hobby** o cron roda 1x/dia em horário **aproximado** dentro da hora
> (pode sair 08h40). Horário exato exige o plano **Pro**.

**Depois (VPS):** apague `vercel.json` e agende no crontab do sistema — em
horário local, sem conversão:

```cron
0 8 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO/api/cron/vencimentos
```

### Cobertura de e-mail

`projetistas.email` é anulável. Projetista sem e-mail **não recebe nada** e o
item nem entra na varredura. Antes de confiar no aviso, confira quem está sem
endereço:

```sql
SELECT nome, telefone FROM projetistas
 WHERE nullif(btrim(email), '') IS NULL
 ORDER BY nome;
```

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
