import type { PrioridadeItem, StatusItem } from "@/db/schema";

/* ------------------------------------------------------------------ *
 * Derivação visual do status — porta a lógica `derive()` do protótipo.
 * A cor NUNCA é escolhida à mão: é derivada de (status + prazos + hoje).
 * Usado no servidor e no cliente, então é puro (sem I/O).
 * ------------------------------------------------------------------ */

export type Tom = "verde" | "ambar" | "vermelho" | "cinza" | "azul";

export const ROTULO_STATUS: Record<StatusItem, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  em_analise: "Em análise",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const ROTULO_PRIORIDADE: Record<PrioridadeItem, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

/** Ordem de exibição do seletor de prioridade (da menor para a maior). */
export const PRIORIDADES: PrioridadeItem[] = ["baixa", "media", "alta"];

/** Tom do badge de prioridade — fixo por valor, não derivado de prazos. */
export const TOM_PRIORIDADE: Record<PrioridadeItem, Tom> = {
  baixa: "cinza",
  media: "ambar",
  alta: "vermelho",
};

/**
 * Statuses que o usuário pode ESCOLHER num seletor. Ficam de fora os dois
 * que são DERIVADOS de datas e nunca uma escolha manual (ver resolverStatus):
 * 'pendente' (ausência de prazo previsto) e 'finalizado' (prazo realizado).
 */
export const STATUS_SELECIONAVEIS: StatusItem[] = [
  "em_andamento",
  "em_analise",
  "cancelado",
];

/**
 * Resolve o status efetivo de um item. Dois status não são escolhidos: são
 * EQUIVALÊNCIAS com datas, válidas nos dois sentidos.
 *
 *   prazo REALIZADO (tem precedência — é o fim da linha):
 *     · preenchido ⇒ 'finalizado', venha o item de onde vier (pendente,
 *       em andamento ou em análise);
 *     · limpo      ⇒ o item volta ao par pendente/em_andamento abaixo.
 *
 *   prazo PREVISTO (só vale sem realizado):
 *     · sem previsto ⇒ 'pendente'   (inclusive limpando o previsto depois)
 *     · com previsto ⇒ 'em_andamento'
 *
 * 'em_analise' e 'cancelado' seguem sendo escolhas explícitas: pôr em análise
 * um item sem previsto continua possível, e cancelar tem precedência sobre
 * tudo — um item que não será entregue não é finalizado por uma data.
 *
 * Função pura — roda no servidor (autoridade) e no cliente (para refletir a
 * regra na hora, sem esperar o round-trip).
 */
export function resolverStatus(
  desejado: StatusItem,
  prazoPrevisto: string | null | undefined,
  prazoRealizado?: string | null,
): StatusItem {
  if (desejado === "cancelado") return "cancelado";
  if (prazoRealizado) return "finalizado";
  // Sem realizado, 'finalizado' não se sustenta: cai de volta no par derivado
  // do previsto (é assim que se desfaz uma data preenchida por engano).
  if (desejado === "em_analise") return "em_analise";
  return prazoPrevisto ? "em_andamento" : "pendente";
}

/**
 * Prioridade de exibição por status (menor = mais acima nas listagens).
 * Pendente primeiro (é o que precisa ser programado com urgência) e
 * finalizado por último. Espelha o CASE do ORDER BY em lib/actions/itens.
 */
export const ORDEM_STATUS: Record<StatusItem, number> = {
  pendente: 0,
  em_andamento: 1,
  em_analise: 2,
  finalizado: 3,
  cancelado: 4,
};

/**
 * Nome curto de um usuário do Neon Auth para exibição ("Em análise por X").
 * Cai no trecho antes do @ do e-mail quando não há nome cadastrado.
 */
export function rotuloUsuario(
  name: string | null | undefined,
  email?: string | null,
): string {
  const n = name?.trim();
  if (n) return n;
  const e = email?.trim();
  if (e) return e.split("@")[0];
  return "usuário";
}

// Rótulos legíveis dos campos gravados no histórico (itens e empreendimentos).
export const ROTULO_CAMPO_HISTORICO: Record<string, string> = {
  status: "status",
  planta: "planta",
  item: "item",
  disciplina: "disciplina",
  etapa: "etapa",
  data_inicio: "data de início",
  prazo_previsto: "prazo previsto",
  prazo_reprogramado: "prazo reprogramado",
  prazo_realizado: "prazo realizado",
  usuario_analise: "usuário da análise",
  prioridade: "prioridade",
  // Marco do projetista: gravado junto com a ida para 'em_analise'.
  entrega_projetista: "entrega do projetista",
  // LEGADO: a meta saiu da interface; o rótulo fica para o histórico antigo.
  meta_dias: "meta",
  observacoes: "observações",
  nome: "nome",
  // Mantido só para o histórico antigo seguir legível: o campo 'responsavel'
  // do empreendimento não existe mais.
  responsavel: "responsável",
  revisao_atual: "revisão atual",
  data_revisao: "data da revisão",
  enviado_autodoc: "enviado para o Autodoc",
  // Marcos do fluxo de revisão (ver lib/actions/revisoes.ts).
  revisao_solicitada: "revisão solicitada",
  revisao_realizada: "revisão entregue",
  // Gravado por scripts/copiar-historico-item.mjs quando um item é recriado
  // e herda o passado do original.
  historico_importado: "histórico importado",
};

/**
 * Data de hoje em 'YYYY-MM-DD' no fuso de Pernambuco (America/Recife).
 * Usada pelas Server Actions para carimbar datas do fluxo de revisão sem
 * depender do TZ do servidor — em UTC, a virada do dia acontece 3h antes.
 */
export function hojeISORecife(): string {
  // 'en-CA' formata como YYYY-MM-DD, que é exatamente o formato de `date`.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());
}

/** Formata o número de uma revisão (1 → "R01"). */
export function rotuloRevisao(numero: number): string {
  return `R${String(numero).padStart(2, "0")}`;
}

export function rotuloCampo(campo: string | null | undefined): string {
  if (!campo) return "";
  return ROTULO_CAMPO_HISTORICO[campo] ?? campo;
}

/** Converte uma data ISO ('YYYY-MM-DD') em Date local, ou null se vazia. */
export function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Formata 'YYYY-MM-DD' como 'dd/mm/yyyy' (ou '—' se vazio). */
export function formatBR(s: string | null | undefined): string {
  const d = parseISO(s);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Formata um timestamp como 'dd/mm/aaaa hh:mm' no fuso de Pernambuco
 * (America/Recife, UTC-3). Determinístico — independe do TZ do servidor,
 * evitando divergência entre render no servidor e no cliente.
 */
export function formatDataHora(valor: string | Date): string {
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export type ItemDatas = {
  status: StatusItem;
  prazoPrevisto?: string | null;
  prazoReprogramado?: string | null;
  prazoRealizado?: string | null;
  // Nome de quem conduz a análise — usado no rótulo "Em análise por X".
  usuarioAnaliseNome?: string | null;
  // O envio para o Autodoc é o que FECHA o item: só depois dele o desvio
  // pode dizer "Finalizado" (ver derivarStatus).
  enviadoAutodoc?: boolean | null;
  // Há uma revisão EM ABERTO: o item voltou para a equipe depois de já ter
  // sido finalizado. Muda só o rótulo — o desvio segue a regra normal.
  emRevisao?: boolean | null;
};

export type StatusDerivado = {
  tom: Tom;
  rotulo: string;
  atrasado: boolean;
  desvio: string; // "Finalizado no prazo" | "3 dias para o vencimento do prazo" | "Atraso de 3 dias" | "—"
  desvioTom: Tom; // tom do campo de desvio (verde/vermelho/cinza)
};

function textoAtraso(dias: number, prefixo = ""): string {
  return `${prefixo}atraso de ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function textoAVencer(dias: number): string {
  if (dias === 0) return "Vence hoje";
  return `${dias} ${dias === 1 ? "dia" : "dias"} para o vencimento do prazo`;
}

/**
 * Deriva tom/rótulo/desvio de um item. `hoje` é injetável para manter
 * a renderização determinística (evita divergência server/client).
 */
export function derivarStatus(it: ItemDatas, hoje: Date): StatusDerivado {
  const alvo = parseISO(it.prazoReprogramado) ?? parseISO(it.prazoPrevisto);
  const real = parseISO(it.prazoRealizado);

  let tom: Tom = "cinza";
  let rotulo = ROTULO_STATUS[it.status];

  if (it.status === "finalizado") {
    tom = "verde";
  } else if (it.status === "cancelado") {
    // Cancelado sai do fluxo de prazos: vermelho, mas nunca conta como
    // atrasado — não há o que reprogramar num item que não será entregue.
    tom = "vermelho";
  } else if (it.status === "em_analise") {
    // Em análise tem cor e filtro próprios — não vira "Atrasado" mesmo com
    // o prazo vencido, já que o item está com o analista, não parado.
    tom = "azul";
  } else if (real) {
    // Já ENTREGUE: com prazo realizado preenchido o item está concluído,
    // mesmo que o status não tenha sido movido para 'finalizado' na mão.
    // "Atrasado" é só para o que ainda NÃO foi feito — a entrega fora do
    // prazo é reportada no desvio ("Finalizado com atraso de N dias").
    tom = "verde";
    rotulo = ROTULO_STATUS.finalizado;
  } else if (alvo && alvo < hoje) {
    tom = "vermelho";
    rotulo = "Atrasado";
  } else if (it.status === "em_andamento") {
    tom = "ambar";
  }

  // Em análise identifica QUEM analisa — a informação é mais útil que o
  // rótulo genérico, então prevalece sobre "Atrasado" (o tom vermelho fica).
  if (it.status === "em_analise" && it.usuarioAnaliseNome) {
    rotulo = `Em análise por ${it.usuarioAnaliseNome}`;
  }

  // Item com revisão EM ABERTO. Ao abrir a revisão os prazos são zerados,
  // então ele volta a 'pendente' — mas "Pendente" esconderia o fato de que
  // há trabalho em curso com o projetista. Aqui o par pendente/em andamento
  // deixa de valer: em revisão é sempre "Em andamento (Revisão)", mesmo sem
  // previsto. Estourar o prazo (quando já houver um) segue virando
  // "Atrasado", só que sem perder a marca de revisão.
  if (it.emRevisao && (it.status === "pendente" || it.status === "em_andamento")) {
    if (rotulo === "Atrasado") {
      rotulo = "Atrasado (Revisão)";
    } else {
      rotulo = "Em andamento (Revisão)";
      tom = "ambar";
    }
  }

  // Desvio: texto explícito + tom próprio.
  // O finalizado é medido contra o prazo PREVISTO (o original), não contra o
  // reprogramado — entregar na data reprogramada continua sendo atraso.
  //
  // Quem FECHA o item é o envio para o Autodoc, não a entrega do projetista:
  //  · em análise                       → azul   ("Em análise") — a análise é
  //    interna da equipe; o projetista já terminou a parte dele (fica no
  //    histórico), mas o item ainda não está finalizado;
  //  · fechado (Autodoc) até o previsto  → verde  ("Finalizado no prazo")
  //  · fechado (Autodoc) após o previsto → âmbar  ("Finalizado com atraso de N dias")
  //  · entregue/finalizado mas ainda fora do Autodoc
  //                               → cinza  ("Aguardando Autodoc")
  //  · em aberto, alvo no futuro  → cinza  ("N dias para o vencimento do prazo"),
  //    mas VERMELHO se houve reprogramação — o prazo original já estourou.
  //  · em aberto, previsto vencido e AINDA sem reprogramação
  //                               → vermelho ("Necessário reprogramar")
  //  · em aberto, reprogramado também vencido
  //                               → vermelho ("Atraso de N dias")
  const reprogramado = !!parseISO(it.prazoReprogramado);
  let desvio = "—";
  let desvioTom: Tom = "cinza";
  // Base do desvio de entrega: o previsto original (cai no alvo se não houver).
  const baseEntrega = parseISO(it.prazoPrevisto) ?? alvo;
  // Marcar o Autodoc num item ainda em andamento não o encerra: o fechamento
  // exige o item finalizado (ou com prazo realizado) E enviado.
  const fechado = !!it.enviadoAutodoc && (it.status === "finalizado" || !!real);
  if (it.status === "em_analise") {
    desvio = "Em análise";
    desvioTom = "azul";
  } else if (fechado) {
    if (real && baseEntrega) {
      const d = diffDias(real, baseEntrega);
      if (d > 0) {
        // Âmbar, não vermelho: já foi entregue — é atenção, não pendência.
        desvio = textoAtraso(d, "Finalizado com ");
        desvioTom = "ambar";
      } else {
        desvio = "Finalizado no prazo";
        desvioTom = "verde";
      }
    } else {
      // Enviado e finalizado, mas sem data de entrega para medir o desvio.
      desvio = "Finalizado";
      desvioTom = "verde";
    }
  } else if ((it.status === "finalizado" || real) && it.status !== "cancelado") {
    desvio = "Aguardando Autodoc";
    desvioTom = "cinza";
  } else if (alvo && it.status !== "cancelado") {
    // Item em aberto (os ramos acima já cobriram análise, fechado e
    // finalizado à espera do Autodoc).
    const d = diffDias(hoje, alvo);
    if (d > 0) {
      desvio = reprogramado ? `Atraso de ${d} ${d === 1 ? "dia" : "dias"}` : "Necessário reprogramar";
      desvioTom = "vermelho";
    } else {
      desvio = textoAVencer(-d);
      desvioTom = reprogramado ? "vermelho" : "cinza";
    }
  }

  const atrasado = tom === "vermelho" && it.status !== "cancelado";
  return { tom, rotulo, atrasado, desvio, desvioTom };
}
