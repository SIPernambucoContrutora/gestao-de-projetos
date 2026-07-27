import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Copie .env.example para .env.local e preencha.");
}

// Cliente HTTP serverless do Neon — 1 round-trip por query, ideal para reads
// e writes simples em Server Actions. NÃO suporta transações multi-statement.
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// Cliente com Pool (WebSocket) para operações que precisam de transação real
// (ex.: updateItem grava o item e N linhas de histórico atomicamente).
// Abra sob demanda e feche o pool no finally — ver lib/actions/itens.ts.
export function getTxDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const database = drizzlePool(pool, { schema });
  return { database, pool };
}

export type DB = typeof db;
export { schema };
