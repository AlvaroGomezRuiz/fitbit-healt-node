/**
 * Evita volcar HTML del Studio de Supabase cuando `NEXT_PUBLIC_SUPABASE_URL`
 * apunta a `supabase.com/dashboard` en lugar del host `*.supabase.co`.
 */
export function publicSupabaseQueryFailureMessage(raw: string): string {
  const isStudioHtml =
    raw.includes("<!DOCTYPE html>") ||
    raw.includes("Looking for something?") ||
    raw.includes('"page":"/404"') ||
    raw.includes("Supabase Studio");

  if (isStudioHtml) {
    return (
      "La URL de Supabase no es la de la API: en apps/web/.env.local usa NEXT_PUBLIC_SUPABASE_URL = " +
      "https://<ref>.supabase.co (Project URL en Settings → API), no la URL del dashboard (supabase.com/project/...)."
    );
  }

  const max = 1200;
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}
