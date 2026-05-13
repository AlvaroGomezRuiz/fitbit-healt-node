import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parsePublicSupabaseEnv } from "@/lib/public-supabase-env";

const emailOtpTypeSchema = z.enum([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function safeNextPath(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const nextRaw = url.searchParams.get("next");
  const next = safeNextPath(typeof nextRaw === "string" ? nextRaw : "/");

  const envResult = parsePublicSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!envResult.ok) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("missing_env")}`, request.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    envResult.env.NEXT_PUBLIC_SUPABASE_URL,
    envResult.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
            /* Route Handler: set puede fallar en edge cases; middleware refresca sesión */
          }
        },
      },
    },
  );

  const code = url.searchParams.get("code");
  if (typeof code === "string" && code.length > 0) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error === null) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  const tokenHash = url.searchParams.get("token_hash");
  const typeRaw = url.searchParams.get("type");
  const typeParsed = emailOtpTypeSchema.safeParse(typeRaw);
  if (typeof tokenHash === "string" && tokenHash.length > 0 && typeParsed.success) {
    const { error } = await supabase.auth.verifyOtp({
      type: typeParsed.data,
      token_hash: tokenHash,
    });
    if (error === null) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
}
