import type { Tom } from "@/lib/ui/status";

/** Badge de status. A classe de cor vem do tom já derivado. */
export function StatusBadge({ tom, rotulo }: { tom: Tom; rotulo: string }) {
  return (
    <span className={`badge badge--${tom}`}>
      <span className="badge__dot" />
      {rotulo}
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
