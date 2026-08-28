import type { PrioridadeItem } from "@/db/schema";
import { ROTULO_PRIORIDADE, TOM_PRIORIDADE, type Tom } from "@/lib/ui/status";

/** Badge de status. A classe de cor vem do tom já derivado. */
export function StatusBadge({ tom, rotulo }: { tom: Tom; rotulo: string }) {
  return (
    <span className={`badge badge--${tom}`}>
      <span className="badge__dot" />
      {rotulo}
    </span>
  );
}

/** Prioridade do item. O tom é fixo por valor (não depende de prazos). */
export function PrioridadeBadge({ prioridade }: { prioridade: PrioridadeItem }) {
  return (
    <span className={`badge badge--${TOM_PRIORIDADE[prioridade]}`}>
      <span className="badge__dot" />
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

/** Indica se o item já foi enviado para o Autodoc. Só para visualização. */
export function AutodocBadge({ enviado }: { enviado: boolean }) {
  if (!enviado) return <span className="td-muted">—</span>;
  return (
    <span className="badge badge--verde">
      <span className="badge__dot" />
      Enviado
    </span>
  );
}

/** Campo de desvio preenchido. O tom já vem derivado por `derivarStatus`. */
export function DesvioBadge({ tom, texto }: { tom: Tom; texto: string }) {
  if (texto === "—") return <span className="td-muted">—</span>;
  return <span className={`desvio desvio--${tom}`}>{texto}</span>;
}
