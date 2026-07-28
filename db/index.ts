import "@/lib/server-only-guard";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Copie .env.example para .env e preencha.");
}

// Cliente HTTP serverless do Neon — 1 round-trip por query. Escritas atômicas
// multi-statement usam `db.batch([...])` (uma transação por HTTP), sem Pool —
// ver updateItem em lib/actions/itens.ts.
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

export type DB = typeof db;
export { schema };
