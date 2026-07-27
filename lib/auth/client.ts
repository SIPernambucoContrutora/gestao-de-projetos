"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// Cliente de navegador do Neon Auth, consumido pelo NeonAuthUIProvider.
export const authClient = createAuthClient();
