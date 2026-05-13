import { z } from "zod";

/** Mensaje único si la URL apunta a Studio/marketing o no es el host de API hospedado. */
const NEXT_PUBLIC_SUPABASE_URL_SHAPE_MESSAGE =
  "Usa la Project URL de Settings → API (https://<ref>.supabase.co con https), no la URL del Studio, dominios supabase.com ni rutas con /dashboard/.";

const supabaseProjectApiUrlSchema = z
  .string()
  .url()
  .superRefine((raw, ctx): void => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(raw);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: NEXT_PUBLIC_SUPABASE_URL_SHAPE_MESSAGE });
      return;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === "supabase.com" || hostname.endsWith(".supabase.com")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: NEXT_PUBLIC_SUPABASE_URL_SHAPE_MESSAGE });
      return;
    }

    if (parsedUrl.pathname.toLowerCase().includes("/dashboard/")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: NEXT_PUBLIC_SUPABASE_URL_SHAPE_MESSAGE });
      return;
    }

    if (parsedUrl.protocol !== "https:") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: NEXT_PUBLIC_SUPABASE_URL_SHAPE_MESSAGE });
      return;
    }

    const hostedProjectHost = /^[a-z0-9][a-z0-9-]*\.supabase\.co$/;
    if (!hostedProjectHost.test(hostname)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: NEXT_PUBLIC_SUPABASE_URL_SHAPE_MESSAGE });
    }
  });

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseProjectApiUrlSchema,
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
    const first = parsed.error.issues[0];
    const fromMessage =
      typeof first?.message === "string" && first.message.length > 0 ? first.message : undefined;
    const fromPaths = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    return {
      ok: false,
      reason: fromMessage ?? (fromPaths.length > 0 ? fromPaths : "variables_supabase_invalidas"),
    };
  }
  return { ok: true, env: parsed.data };
}
