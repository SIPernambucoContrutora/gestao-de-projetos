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
