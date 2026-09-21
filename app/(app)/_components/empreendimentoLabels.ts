import type { FaseEmpreendimento, TipoEmpreendimento } from "@/db/schema";

export const TIPOS_EMPREENDIMENTO: { valor: TipoEmpreendimento; rotulo: string }[] = [
  { valor: "prince", rotulo: "Prince" },
  { valor: "praia", rotulo: "Praia" },
];

export const FASES_EMPREENDIMENTO: { valor: FaseEmpreendimento; rotulo: string }[] = [
  { valor: "em_estudo", rotulo: "Em estudo" },
  { valor: "pre_lancamento", rotulo: "Pré-lançamento" },
  { valor: "aprovado", rotulo: "Aprovado" },
  { valor: "em_execucao", rotulo: "Em execução" },
  { valor: "executado", rotulo: "Pronto" },
];

export const ROTULO_TIPO: Record<TipoEmpreendimento, string> = {
  prince: "Prince",
  praia: "Praia",
};

export const ROTULO_FASE: Record<FaseEmpreendimento, string> = {
  em_estudo: "Em estudo",
  pre_lancamento: "Pré-lançamento",
  aprovado: "Aprovado",
  em_execucao: "Em execução",
  executado: "Pronto",
};
