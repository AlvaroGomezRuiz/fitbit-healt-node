import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { parsePublicSupabaseEnv } from "@/lib/public-supabase-env";

/**
 * Refresca la sesión de Supabase Auth en Middleware (cookies PKCE).
 * Si faltan URL/anon, devuelve la respuesta sin tocar cookies (compat sin Auth).
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const envResult = parsePublicSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!envResult.ok) {
    return response;
  }

  const supabase = createServerClient(
    envResult.env.NEXT_PUBLIC_SUPABASE_URL,
    envResult.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll(): ReturnType<NextRequest["cookies"]["getAll"]> {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: ReadonlyArray<{
            readonly name: string;
            readonly value: string;
            readonly options?: Readonly<Record<string, unknown>>;
          }>,
        ): void {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}
