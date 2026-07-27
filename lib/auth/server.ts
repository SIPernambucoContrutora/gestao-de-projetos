import { createNeonAuth } from "@neondatabase/auth/next/server";

// Instância de servidor do Neon Auth (Managed Better Auth).
// Usada em Server Actions/Components e no route handler.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
