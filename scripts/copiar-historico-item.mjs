// scripts/copiar-historico-item.mjs
// ------------------------------------------------------------------
// Copia o histórico de um item para outro — para quando um item precisa ser
// recriado (ex.: uma revisão aberta por engano) e a cópia deve herdar o
// passado do original, sem os eventos do acidente.
//
// O corte é por DATA: só entram os eventos ANTERIORES a --corte (default:
// hoje, no fuso America/Recife). Ou seja, tudo que aconteceu hoje — inclusive
// a revisão indevida e a criação da cópia — fica de fora.
//
// As linhas copiadas preservam autor (usuario_id), data (created_at), campo e
// valores do original; o contexto denormalizado (empreendimento/nº do
// item/disciplina) passa a ser o do DESTINO, que é a quem as linhas pertencem
// agora. Uma linha-marcador é gravada dizendo de onde o histórico veio — o log
// é auditoria, então a importação também fica registrada (--sem-marcador
// desliga).
//
// Uso (PowerShell) — identificando os itens pelo empreendimento + nº:
//   node scripts/copiar-historico-item.mjs --emp "Residencial X" --de 3 --para 14
//
// ...ou direto pelos UUIDs (--de-id / --para-id).
//
// Roda em DRY-RUN por padrão: mostra o que seria copiado e não escreve nada.
// Para gravar, repita o comando com --aplicar.
//
// Lê DATABASE_URL do .env.
// ------------------------------------------------------------------
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/* ---------------------------------------------------------------- *
 * Argumentos
 * ---------------------------------------------------------------- */

const argv = process.argv.slice(2);
const flag = (nome) => argv.includes(`--${nome}`);
const opt = (nome) => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const aplicar = flag("aplicar");
const semMarcador = flag("sem-marcador");
const emp = opt("emp");
const deNum = opt("de");
const paraNum = opt("para");
const deId = opt("de-id");
const paraId = opt("para-id");

// 'en-CA' formata como YYYY-MM-DD — mesma convenção de hojeISORecife().
const corte =
  opt("corte") ??
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida (copie .env.example para .env).");
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) {
  console.error(`--corte inválido: "${corte}". Use YYYY-MM-DD.`);
  process.exit(1);
}
if (!((deId && paraId) || (emp && deNum && paraNum))) {
  console.error(
    "Informe --emp <nome> --de <nº> --para <nº>, ou --de-id <uuid> --para-id <uuid>.",
  );
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

/* ---------------------------------------------------------------- *
 * Resolução dos itens
 * ---------------------------------------------------------------- */

/** Item + contexto denormalizável, pelo uuid ou pelo par (empreendimento, nº). */
async function acharItem(rotulo, id, numero) {
  const linhas = id
    ? await sql`
        select i.id, i.item, i.status, i.em_revisao, i.revisao_atual,
               e.nome as empreendimento_nome, d.nome as disciplina_nome, i.planta
          from itens_projeto i
          join empreendimentos e on e.id = i.empreendimento_id
          join disciplinas d on d.id = i.disciplina_id
         where i.id = ${id}`
    : await sql`
        select i.id, i.item, i.status, i.em_revisao, i.revisao_atual,
               e.nome as empreendimento_nome, d.nome as disciplina_nome, i.planta
          from itens_projeto i
          join empreendimentos e on e.id = i.empreendimento_id
          join disciplinas d on d.id = i.disciplina_id
         where e.nome ilike ${"%" + emp + "%"}
           and i.item = ${Number(numero)}`;

  if (linhas.length === 0) {
    throw new Error(`${rotulo}: nenhum item encontrado (${id ?? `${emp} / nº ${numero}`}).`);
  }
  if (linhas.length > 1) {
    throw new Error(
      `${rotulo}: ${linhas.length} itens casam com "${emp}" nº ${numero}. ` +
        `Use --${rotulo === "ORIGEM" ? "de-id" : "para-id"} com o uuid.`,
    );
  }
  return linhas[0];
}

function descrever(rotulo, it) {
  const n = it.item != null ? String(it.item).padStart(2, "0") : "s/nº";
  console.log(
    `  ${rotulo}: ${it.empreendimento_nome} · item ${n} · ${it.disciplina_nome}` +
      `${it.planta ? ` · ${it.planta}` : ""}`,
  );
  console.log(
    `          id=${it.id}  status=${it.status}` +
      `  revisao=${it.revisao_atual}${it.em_revisao ? " (EM REVISÃO)" : ""}`,
  );
}

/* ---------------------------------------------------------------- *
 * Execução
 * ---------------------------------------------------------------- */

async function main() {
  const origem = await acharItem("ORIGEM", deId, deNum);
  const destino = await acharItem("DESTINO", paraId, paraNum);

  if (origem.id === destino.id) {
    console.error("ORIGEM e DESTINO são o mesmo item.");
    process.exitCode = 1;
    return;
  }

  console.log(`\n${aplicar ? "APLICANDO" : "DRY-RUN (nada será gravado)"}`);
  console.log(`Corte: eventos ANTERIORES a ${corte} 00:00 (America/Recife)\n`);
  descrever("ORIGEM ", origem);
  descrever("DESTINO", destino);

  // O corte é interpretado no fuso de Pernambuco, não no do servidor: em UTC a
  // virada do dia acontece 3h antes, e arrastaria eventos da noite anterior.
  // A expressão fica literal em cada query porque o tag `sql` do driver Neon
  // interpola PARÂMETROS, não fragmentos de SQL.
  const aCopiar = await sql`
  select id, acao, usuario_id, campo, valor_antigo, valor_novo, created_at
    from historico_alteracoes
   where item_id = ${origem.id}
     and created_at < (${corte}::date::timestamp at time zone 'America/Recife')
   order by created_at asc`;

  const excluidos = await sql`
  select count(*)::int as total
    from historico_alteracoes
   where item_id = ${origem.id}
     and created_at >= (${corte}::date::timestamp at time zone 'America/Recife')`;

  console.log(`\nEventos do ORIGEM anteriores ao corte: ${aCopiar.length} (serão copiados)`);
  console.log(`Eventos do ORIGEM a partir do corte:   ${excluidos[0].total} (ficam de fora)\n`);

  if (aCopiar.length === 0) {
    console.log("Nada a copiar.");
    return;
  }

  for (const h of aCopiar) {
    const quando = new Date(h.created_at).toLocaleString("pt-BR", {
      timeZone: "America/Recife",
    });
    const alvo = h.acao === "criacao" ? "Item criado" : (h.campo ?? h.acao);
    const mudou =
      h.acao === "edicao" ? `  ${h.valor_antigo ?? "—"} → ${h.valor_novo ?? "—"}` : "";
    console.log(`  ${quando}  ${alvo}${mudou}`);
  }

  if (!aplicar) {
    console.log("\nDRY-RUN: nada foi gravado. Repita com --aplicar para copiar.");
    return;
  }

  // Uma instrução só: ou todas as linhas entram, ou nenhuma entra. O contexto
  // denormalizado passa a ser o do DESTINO — as linhas pertencem a ele agora.
  const inseridas = await sql`
  insert into historico_alteracoes
    (item_id, empreendimento_id, acao, usuario_id, campo, valor_antigo, valor_novo,
     empreendimento_nome, item_numero, disciplina_nome, created_at)
  select ${destino.id}::uuid,
         (select empreendimento_id from itens_projeto where id = ${destino.id}::uuid),
         h.acao, h.usuario_id, h.campo, h.valor_antigo, h.valor_novo,
         ${destino.empreendimento_nome}::text, ${destino.item}::integer,
         ${destino.disciplina_nome}::text,
         h.created_at
    from historico_alteracoes h
   where h.item_id = ${origem.id}
     and h.created_at < (${corte}::date::timestamp at time zone 'America/Recife')
  returning id`;

  console.log(`\n${inseridas.length} linhas copiadas para o item de destino.`);

  if (!semMarcador) {
    const numeroOrigem =
      origem.item != null ? String(origem.item).padStart(2, "0") : "s/nº";
    await sql`
    insert into historico_alteracoes
      (item_id, empreendimento_id, acao, usuario_id, campo, valor_antigo, valor_novo,
       empreendimento_nome, item_numero, disciplina_nome)
    select ${destino.id}::uuid,
           (select empreendimento_id from itens_projeto where id = ${destino.id}::uuid),
           'edicao'::acao_historico, 'sistema'::text, 'historico_importado'::text,
           null::text,
           ${`Histórico anterior a ${corte} importado do item ${numeroOrigem} (${origem.disciplina_nome})`}::text,
           ${destino.empreendimento_nome}::text, ${destino.item}::integer,
           ${destino.disciplina_nome}::text`;
    console.log("Marcador de importação gravado (use --sem-marcador para omitir).");
  }

  console.log("\nPronto.");
}

await main();
