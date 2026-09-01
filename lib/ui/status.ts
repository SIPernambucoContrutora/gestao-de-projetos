import type { PrioridadeItem, StatusItem } from "@/db/schema";

/* ------------------------------------------------------------------ *
 * Derivação visual do status — porta a lógica `derive()` do protótipo.
 * A cor NUNCA é escolhida à mão: é derivada de (status + prazos + hoje).
 * Usado no servidor e no cliente, então é puro (sem I/O).
 * ------------------------------------------------------------------ */

// "rosa" é exclusivo do item que voltou da análise ("Em Ajustes, pós
// Análise") — não é derivado de prazo, marca uma etapa do fluxo.
export type Tom = "verde" | "ambar" | "vermelho" | "cinza" | "azul" | "rosa";

export const ROTULO_STATUS: Record<StatusItem, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  em_analise: "Em análise",
  finalizado: "Finalizado",
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
 * O ÚNICO status que o usuário escolhe, e só no drawer de um item já em
 * andamento (ver resolverStatus). Todo o resto é derivado das datas — o
 * formulário de novo item nem tem campo de status.
 */
export const STATUS_SELECIONAVEIS: StatusItem[] = ["em_andamento", "em_analise"];

/**
 * Resolve o status efetivo de um item. O status NÃO é um campo: é uma leitura
 * das datas, com uma única escolha manual no meio ('em_analise').
 *
 *   1. prazo REALIZADO preenchido ⇒ 'finalizado'  (tem precedência: é o fim
 *      da linha). Limpar a data reabre o item pelas regras abaixo.
 *   2. sem prazo PREVISTO         ⇒ 'pendente'    (nada foi programado ainda)
 *   3. com prazo previsto         ⇒ 'em_andamento'
 *
 * 'em_analise' é a única escolha manual e só existe a partir de 'em_andamento'
 * — ou seja, exige prazo previsto e nenhum realizado. Limpar o previsto de um
 * item em análise devolve ele para 'pendente'.
 *
 * "Atrasado" não aparece aqui: não é um status gravado, é derivação visual do
 * prazo vigente contra hoje (ver derivarStatus). Reprogramar para uma data
 * futura tira o item do vermelho sem mudar o status gravado.
 *
 * Função pura — roda no servidor (autoridade) e no cliente (para refletir a
 * regra na hora, sem esperar o round-trip).
 */
export function resolverStatus(
  desejado: StatusItem,
  prazoPrevisto: string | null | undefined,
  prazoRealizado?: string | null,
): StatusItem {
  if (prazoRealizado) return "finalizado";
  if (!prazoPrevisto) return "pendente";
  return desejado === "em_analise" ? "em_analise" : "em_andamento";
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
  // Marco da volta da análise: o item saiu de 'em_analise' para ajustes.
  ajustes_pos_analise: "ajustes pós análises",
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
  // O item VOLTOU da análise: saiu de 'em_analise' para 'em_andamento'
  // porque a equipe pediu correções. Como o emRevisao, muda só o rótulo
  // ('Ajustes pós análises') — o desvio segue a regra normal do prazo.
  ajustesPosAnalise?: boolean | null;
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

  // Voltou da análise: enquanto o item estiver em andamento depois de ter
  // sido devolvido pela equipe, o rótulo diz que o que está em curso são os
  // AJUSTES pedidos na análise, não um andamento qualquer — em ROSA, cor
  // exclusiva desta etapa. Só a aparência do status muda: o status gravado
  // segue 'em_andamento' (métricas, filtros e ordenação não sentem nada) e o
  // desvio é calculado adiante pela regra normal. Estourar o prazo continua
  // virando 'Atrasado' — aí o vermelho prevalece sobre o rosa, para o atraso
  // não se perder, mas o rótulo mantém a marca dos ajustes.
  if (it.ajustesPosAnalise && it.status === "em_andamento" && !real) {
    if (rotulo === "Atrasado") {
      rotulo = "Atrasado (Em Ajustes, pós Análise)";
    } else {
      rotulo = "Em Ajustes, pós Análise";
      tom = "rosa";
    }
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
  } else if (it.status === "finalizado" || real) {
    desvio = "Aguardando Autodoc";
    desvioTom = "cinza";
  } else if (alvo) {
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

  const atrasado = tom === "vermelho";
  return { tom, rotulo, atrasado, desvio, desvioTom };
}

/* ------------------------------------------------------------------ *
 * Ótica do PROJETISTA
 *
 * O ciclo do item e o ciclo do projetista terminam em momentos diferentes.
 * Quando o item vai para 'em_analise', o projetista JÁ MANDOU o projeto para
 * a nossa equipe de arquitetura — a análise que vem depois é interna. Então,
 * para ele, aquilo está FINALIZADO, mesmo com o item ainda aberto (o item só
 * fecha de fato no envio ao Autodoc).
 *
 * Este é um status à parte, exclusivo do menu de projetistas: nada é gravado,
 * é derivação da data de entrega (o marco 'entrega_projetista' na auditoria,
 * com o prazo realizado como retaguarda para os itens antigos).
 * ------------------------------------------------------------------ */

export type ItemDatasProjetista = ItemDatas & {
  /** Marco da entrega do projetista (ida para 'em_analise'). */
  entregaProjetista?: string | null;
  status: StatusItem;
};

/**
 * Deriva tom/rótulo/desvio de um item na ótica do projetista. O desvio da
 * entrega é medido contra o prazo PREVISTO original — entregar na data
 * reprogramada continua sendo atraso, igual à regra do item.
 */
export function derivarStatusProjetista(
  it: ItemDatasProjetista,
  hoje: Date,
): StatusDerivado {
  const alvo = parseISO(it.prazoReprogramado) ?? parseISO(it.prazoPrevisto);
  // A entrega do projetista fecha a parte dele; sem o marco (itens anteriores
  // ao registro dele), o prazo realizado responde pela data.
  const entrega = parseISO(it.entregaProjetista) ?? parseISO(it.prazoRealizado);
  const entregue =
    !!entrega || it.status === "em_analise" || it.status === "finalizado";

  let tom: Tom = "cinza";
  let rotulo = ROTULO_STATUS[it.status];
  let desvio = "—";
  let desvioTom: Tom = "cinza";

  if (entregue) {
    tom = "verde";
    rotulo = "Finalizado";
    const base = parseISO(it.prazoPrevisto) ?? alvo;
    if (entrega && base) {
      const d = Math.round((entrega.getTime() - base.getTime()) / 86400000);
      if (d > 0) {
        desvio = textoAtraso(d, "Entregue com ");
        desvioTom = "ambar";
      } else {
        desvio = "Entregue no prazo";
        desvioTom = "verde";
      }
    } else {
      desvio = "Entregue";
      desvioTom = "verde";
    }
  } else if (alvo && alvo < hoje) {
    tom = "vermelho";
    rotulo = "Atrasado";
    const d = Math.round((hoje.getTime() - alvo.getTime()) / 86400000);
    desvio = `Atraso de ${d} ${d === 1 ? "dia" : "dias"}`;
    desvioTom = "vermelho";
  } else if (alvo) {
    tom = "ambar";
    rotulo = ROTULO_STATUS.em_andamento;
    const d = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
    desvio = textoAVencer(d);
    // Prazo já reprogramado: o original estourou, então o alerta continua.
    desvioTom = it.prazoReprogramado ? "vermelho" : "cinza";
  }

  // Revisão em aberto: o item voltou para o projetista, então a parte dele
  // reabriu — a marca fica no rótulo, o desvio segue a regra acima.
  if (it.emRevisao && !entregue) {
    rotulo = rotulo === "Atrasado" ? "Atrasado (Revisão)" : "Em andamento (Revisão)";
  }

  return { tom, rotulo, atrasado: tom === "vermelho", desvio, desvioTom };
}
