import { createBrowserClient } from "@supabase/ssr";

import { parsePublicSupabaseEnv } from "@/lib/public-supabase-env";

/**
 * Cliente browser (solo componentes cliente). Usa la misma validación que servidor.
 */
export function createSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> | null {
  if (typeof window === "undefined") {
    return null;
  }
  const envResult = parsePublicSupabaseEnv(process.env);
  if (!envResult.ok) {
    return null;
  }
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = envResult.env;
  return createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
