/**
 * Mensaje legible para errores típicos de PostgREST / RLS.
 */
export function friendlyQueryMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("permission denied") || lower.includes("jwt")) {
    return "Sin permiso de lectura (RLS). Inicia sesión en Supabase Auth o ajusta políticas para `anon`/`authenticated`.";
  }
  return message;
}
