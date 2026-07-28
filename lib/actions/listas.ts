"use server";

import { asc } from "drizzle-orm";
import { db } from "@/db";
import { disciplinas, etapas } from "@/db/schema";
import type { Disciplina, Etapa } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

/** Disciplinas cadastradas (para filtros e selects), em ordem alfabética. */
export async function listDisciplinas(): Promise<Disciplina[]> {
  await requireUser();
  return db.select().from(disciplinas).orderBy(asc(disciplinas.nome));
}

/** Etapas cadastradas (para filtros e selects), em ordem alfabética. */
export async function listEtapas(): Promise<Etapa[]> {
  await requireUser();
  return db.select().from(etapas).orderBy(asc(etapas.nome));
}
