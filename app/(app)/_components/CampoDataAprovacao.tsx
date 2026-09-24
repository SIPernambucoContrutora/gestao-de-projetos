"use client";

import type { FaseEmpreendimento } from "@/db/schema";
import { faseTemAprovacao, vencimentoAprovacao } from "@/lib/ui/aprovacao";
import { formatBR, hojeISORecife } from "@/lib/ui/status";

/**
 * Data de aprovação sugerida quando a fase muda no formulário: hoje, ao sair
 * de "Em estudo" sem data. Voltar para "Em estudo" só esconde o campo — o
 * valor fica no formulário (desfazer o clique o recupera) e o servidor o apaga.
 */
export function dataAprovacaoAoMudarFase(
  faseAnterior: FaseEmpreendimento | "",
  faseNova: FaseEmpreendimento | "",
  dataAtual: string,
): string {
  if (dataAtual || faseTemAprovacao(faseAnterior) || !faseTemAprovacao(faseNova)) return dataAtual;
  return hojeISORecife();
}

export function CampoDataAprovacao({
  fase,
  valor,
  onChange,
}: {
  fase: FaseEmpreendimento | "";
  valor: string;
  onChange: (valor: string) => void;
}) {
  if (!faseTemAprovacao(fase)) return null;
  return (
    <label className="field" style={{ marginTop: "12px" }}>
      <span className="field__label">Data de aprovação{fase === "aprovado" ? " *" : ""}</span>
      <input
        type="date"
        className="input"
        value={valor}
        max={hojeISORecife()}
        onChange={(e) => onChange(e.target.value)}
      />
      {fase === "aprovado" && valor && (
        <span className="field__hint">Aprovação válida até {formatBR(vencimentoAprovacao(valor))}.</span>
      )}
    </label>
  );
}
