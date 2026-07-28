"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEmpreendimento } from "@/lib/actions/empreendimentos";

export function ExcluirEmpreendimentoButton({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    const ok = window.confirm(
      `Excluir o empreendimento "${nome}" e TODOS os seus itens e histórico?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setExcluindo(true);
    try {
      await deleteEmpreendimento(id);
      router.push("/empreendimentos");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
      setExcluindo(false);
    }
  }

  return (
    <button type="button" className="btn-danger-soft" onClick={excluir} disabled={excluindo}>
      {excluindo ? "Excluindo…" : "Excluir empreendimento"}
    </button>
  );
}
