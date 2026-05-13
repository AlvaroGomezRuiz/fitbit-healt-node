import "server-only";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import path from "node:path";

import { parsePublicSupabaseEnv } from "@/lib/public-supabase-env";

let didReloadEnvForServiceRole = false;

/**
 * Si `SUPABASE_SERVICE_ROLE_KEY` no está en el proceso (p. ej. orden de carga con Turbopack),
 * reintenta cargar `.env*` de la raíz del monorepo y de `apps/web` usando `process.cwd()`.
 */
function reloadEnvLayersIfServiceRoleMissing(): void {
  if (didReloadEnvForServiceRole) {
    return;
  }
  didReloadEnvForServiceRole = true;
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof raw === "string" && raw.trim().length >= 20) {
    return;
  }
  const cwd = process.cwd();
  void loadEnvConfig(path.join(cwd, "..", ".."));
  void loadEnvConfig(cwd);
}

/**
 * Cliente Supabase para RSC / Route Handlers / Server Actions (cookies + anon).
 */
export async function createSupabaseServerClient(): Promise<
  ReturnType<typeof createServerClient> | null
> {
  const envResult = parsePublicSupabaseEnv(process.env);
  if (!envResult.ok) {
    return null;
  }
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = envResult.env;
  const cookieStore = await cookies();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: ReadonlyArray<{
          readonly name: string;
          readonly value: string;
          readonly options?: Readonly<Record<string, unknown>>;
        }>,
      ): void {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* set desde RSC puro puede fallar; ignorar */
        }
      },
    },
  });
}

/**
 * Cliente PostgREST con JWT `service_role`: **omite RLS** en Supabase.
 * Usar solo en Server Actions / Route Handlers de confianza.
 * Requiere `SUPABASE_SERVICE_ROLE_KEY` en el entorno del servidor (nunca `NEXT_PUBLIC_*` ni bundle cliente).
 */
export function createSupabaseServiceRoleClient(): SupabaseClient | null {
  reloadEnvLayersIfServiceRoleMissing();
  const envResult = parsePublicSupabaseEnv(process.env);
  if (!envResult.ok) {
    return null;
  }
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKey = typeof rawKey === "string" ? rawKey.trim() : "";
  if (serviceKey.length < 20) {
    return null;
  }
  return createClient(envResult.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
