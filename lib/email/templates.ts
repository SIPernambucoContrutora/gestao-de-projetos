/**
 * Montagem das mensagens. Sem dependência de banco ou de rede: recebe os
 * dados prontos e devolve assunto + corpo, o que mantém os templates
 * testáveis e legíveis.
 *
 * HTML de e-mail não é HTML de página: clientes como Outlook ignoram
 * folhas de estilo externas e boa parte do CSS moderno, então tudo aqui
 * é `style` inline e tabela — feio de ler, mas é o que chega inteiro.
 */

const TEAL = "#007481";
const ACCENT = "#0099A5";

/**
 * Escapa texto que veio de digitação humana antes de interpolar no HTML.
 *
 * A solicitação de revisão é digitada livremente na interface: sem
 * escape, um `<` no texto ("prazo < 5 dias") quebra a mensagem, e um
 * trecho colado de outro lugar pode injetar marcação arbitrária no
 * e-mail que sai em nome da empresa.
 */
export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto digitado → parágrafos HTML, preservando as quebras de linha. */
function paragrafos(texto: string): string {
  return escaparHtml(texto)
    .split(/\n{2,}/)
    .map(
      (bloco) =>
        `<p style="margin:0 0 12px;line-height:1.6;color:#1f2937">${bloco.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function moldura(titulo: string, chamada: string, miolo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <tr><td style="background:${TEAL};padding:20px 24px">
      <div style="color:#ffffff;font-size:18px;font-weight:600">${escaparHtml(titulo)}</div>
      <div style="color:#a7d8dd;font-size:13px;margin-top:4px">${escaparHtml(chamada)}</div>
    </td></tr>
    <tr><td style="padding:24px">${miolo}</td></tr>
    <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5">
      Mensagem automática do painel Gestão de Projetos — Pernambuco Construtora.<br>
      Em caso de dúvida, responda este e-mail.
    </td></tr>
  </table>
</body></html>`;
}

function linha(rotulo: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap">${escaparHtml(rotulo)}</td>
    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">${escaparHtml(valor)}</td>
  </tr>`;
}

export type DadosItem = {
  projetistaNome: string;
  empreendimento: string;
  disciplina: string;
  etapa: string;
  itemNumero: number | null;
  planta: string | null;
  prazoBR: string;
};

export type Mensagem = { assunto: string; html: string; texto: string };

/**
 * O escopo citado no corpo ("o projeto X"). A planta é o nome que o
 * projetista reconhece; sem ela, disciplina + etapa é o mais próximo
 * disso — deixar a frase com um vazio no meio seria pior.
 */
function escopo(d: Pick<DadosItem, "planta" | "disciplina" | "etapa">): string {
  return d.planta?.trim() || `${d.disciplina} — ${d.etapa}`;
}

/** Aviso das 08h: o prazo do item vence HOJE. */
export function mensagemVencimento(d: DadosItem): Mensagem {
  const identificacao = d.itemNumero ? `Item ${d.itemNumero}` : d.disciplina;
  const alvo = escopo(d);

  const assunto = `[Gestão de Projetos] Vence hoje: ${identificacao} — ${d.empreendimento}`;

  const p = (conteudo: string) =>
    `<p style="margin:0 0 16px;line-height:1.6;color:#1f2937">${conteudo}</p>`;

  const html = moldura(
    // Mesma ordem do e-mail de revisão: o empreendimento situa o
    // projetista de imediato, o tipo do aviso desce para a linha apagada.
    d.empreendimento,
    `Lembrete de prazo — vence em ${d.prazoBR}`,
    [
      p(`Olá, ${escaparHtml(d.projetistaNome)},`),
      p(
        `Passando para lembrar que, conforme combinamos, a data prevista para o envio do projeto <strong>${escaparHtml(alvo)}</strong> é hoje, <strong>${escaparHtml(d.prazoBR)}</strong>.`,
      ),
      p("Pedimos, por gentileza, que realize o envio do projeto dentro do prazo combinado."),
      p(
        "Caso não seja possível realizar o envio hoje, solicitamos que entre em contato conosco para informar a situação e alinharmos um novo prazo para o envio.",
      ),
      p("Caso o projeto já tenha sido enviado, desconsidere este lembrete."),
      `<p style="margin:24px 0 0;line-height:1.6;color:#1f2937">Atenciosamente,<br><strong>Setor de Projetos de Incorporação</strong><br><strong>Pernambuco Construtora</strong></p>`,
    ].join(""),
  );

  const texto = [
    `Olá, ${d.projetistaNome},`,
    "",
    `Passando para lembrar que, conforme combinamos, a data prevista para o envio do projeto ${alvo} é hoje, ${d.prazoBR}.`,
    "",
    "Pedimos, por gentileza, que realize o envio do projeto dentro do prazo combinado.",
    "",
    "Caso não seja possível realizar o envio hoje, solicitamos que entre em contato conosco para informar a situação e alinharmos um novo prazo para o envio.",
    "",
    "Caso o projeto já tenha sido enviado, desconsidere este lembrete.",
    "",
    "Atenciosamente,",
    "Pernambuco Construtora",
  ].join("\n");

  return { assunto, html, texto };
}

/** Disparo da revisão: o texto digitado na solicitação é o corpo. */
export function mensagemRevisao(
  d: Omit<DadosItem, "prazoBR">,
  numeroRevisao: string,
  solicitacao: string,
): Mensagem {
  const identificacao = d.itemNumero ? `Item ${d.itemNumero}` : d.disciplina;

  const assunto = `[Gestão de Projetos] ${numeroRevisao} solicitada: ${identificacao} — ${d.empreendimento}`;

  const tabela = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
    ${linha("Empreendimento", d.empreendimento)}
    ${linha("Disciplina", d.disciplina)}
    ${linha("Etapa", d.etapa)}
    ${d.planta ? linha("Planta", d.planta) : ""}
    ${linha("Revisão", numeroRevisao)}
  </table>`;

  const html = moldura(
    // O empreendimento vem em cima e em destaque: é o que situa o
    // projetista de imediato. O tipo do e-mail desce para a linha
    // apagada — quem abriu já sabe que é uma revisão pelo assunto.
    d.empreendimento,
    `Solicitação de revisão — ${numeroRevisao}`,
    `<p style="margin:0 0 16px;line-height:1.6;color:#1f2937">Olá, ${escaparHtml(d.projetistaNome)}.</p>
     <p style="margin:0 0 16px;line-height:1.6;color:#1f2937">Foi aberta uma revisão para o item abaixo.</p>
     ${tabela}
     <div style="border-left:3px solid ${ACCENT};background:#f9fafb;padding:12px 16px;margin:0 0 20px">
       <div style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">O que foi solicitado</div>
       ${paragrafos(solicitacao)}
     </div>
     <p style="margin:0;line-height:1.6;color:#1f2937">O prazo desta revisão será combinado com a equipe de gestão de projetos.</p>`,
  );

  const texto = [
    `Olá, ${d.projetistaNome}.`,
    "",
    `Foi aberta uma revisão para o item abaixo.`,
    "",
    `Empreendimento: ${d.empreendimento}`,
    `Disciplina: ${d.disciplina}`,
    `Etapa: ${d.etapa}`,
    d.planta ? `Planta: ${d.planta}` : null,
    "",
    "O que foi solicitado:",
    solicitacao,
    "",
    "Favor retornar com o prazo previsto para esta revisão.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { assunto, html, texto };
}
