"use client";

import { useState } from "react";
import { DisciplinaFormModal } from "./DisciplinaFormModal";

export function NovaDisciplinaButton() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setAberto(true)}>
        Nova disciplina
      </button>
      {aberto && <DisciplinaFormModal onClose={() => setAberto(false)} />}
    </>
  );
}
