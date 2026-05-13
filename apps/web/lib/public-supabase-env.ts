import { z } from "zod";

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;

export type PublicSupabaseEnvResult =
  | { readonly ok: true; readonly env: PublicSupabaseEnv }
  | { readonly ok: false; readonly reason: string };

/**
 * Valida URL pública y clave anon de Supabase (seguras para el bundle cliente si se prefijan con NEXT_PUBLIC_).
 * No incluye service role.
 */
export function parsePublicSupabaseEnv(
  input: Record<string, string | undefined>,
): PublicSupabaseEnvResult {
  const parsed = publicSupabaseEnvSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    return { ok: false, reason: issues.length > 0 ? issues : "variables_supabase_invalidas" };
  }
  return { ok: true, env: parsed.data };
}
