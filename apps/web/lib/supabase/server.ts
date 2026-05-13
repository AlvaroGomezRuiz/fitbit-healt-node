import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { parsePublicSupabaseEnv } from "@/lib/public-supabase-env";

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
