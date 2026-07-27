import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// drizzle-kit lê daqui para `generate`/`migrate`/`studio`.
// NOTA: o fluxo aprovado é gerar o DDL e rodá-lo manualmente no Neon via
// branch temporária (ver drizzle/RUNBOOK.md). Este config existe para que
// você POSSA usar drizzle-kit localmente depois, se quiser.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
