"use client";

import { useState } from "react";
import { ProjetistaFormModal } from "./ProjetistaFormModal";

export function NovoProjetistaButton() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setAberto(true)}>
        Novo projetista
      </button>
      {aberto && <ProjetistaFormModal onClose={() => setAberto(false)} />}
    </>
  );
}
