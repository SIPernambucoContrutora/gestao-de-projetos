# Runbook de migrations — fluxo seguro por branch (Neon)

O Neon MCP **não está conectado** nesta sessão, então este runbook reproduz
manualmente o mesmo fluxo seguro (`prepare` → `validate` → `complete`) usando o
Neon CLI (`neonctl`) ou o console web. **Nunca** rode DDL direto na branch
principal (`production`/`main`) sem passar pela branch temporária.

## Pré-requisitos

```bash
npm i -g neonctl        # ou use o console: https://console.neon.tech
neonctl auth            # autentica no seu projeto
```

## Fluxo (equivale ao prepare_database_migration → complete_database_migration)

### 1. Criar branch temporária a partir da principal

```bash
neonctl branches create --name migracao-0000-init
neonctl connection-string migracao-0000-init   # copie a URL desta branch
```

### 2. Aplicar o DDL NA BRANCH TEMPORÁRIA (não na principal)

```bash
psql "<connection-string-da-branch-temporaria>" -f drizzle/0000_init.sql
psql "<connection-string-da-branch-temporaria>" -f drizzle/seed_listas.sql   # opcional
```

### 3. Validar (equivale ao run_sql) — confira colunas, tipos e constraints

```bash
psql "<connection-string-da-branch-temporaria>" -f drizzle/validate_0000.sql
```

Cheque na saída:
- 4 tabelas criadas: empreendimentos, disciplinas, etapas, itens_projeto;
- enum `status_item` com os 3 valores, e `status` com default `pendente`;
- `revisao_atual` default `R00`; `created_at` default `now()`;
- 3 FKs em itens_projeto (cascade no empreendimento, restrict nas listas);
- 4 índices em itens_projeto.

### 4. Só após a sua confirmação — aplicar na branch principal

Equivale a `complete_database_migration`. Duas opções:

**a) Promover a branch** (mantém os dados validados):
```bash
# revise antes; no console: Branches > migracao-0000-init > Set as default
```

**b) Reaplicar o DDL na principal e descartar a temporária:**
```bash
psql "<connection-string-PRINCIPAL>" -f drizzle/0000_init.sql
psql "<connection-string-PRINCIPAL>" -f drizzle/seed_listas.sql
neonctl branches delete migracao-0000-init
```

## Regra permanente

A cada alteração de schema, repita este ciclo (nova branch temporária →
aplicar → validar → confirmar → principal). Quando o Neon MCP estiver
conectado, os mesmos passos viram `prepare_database_migration` /
`run_sql` / `complete_database_migration`.
