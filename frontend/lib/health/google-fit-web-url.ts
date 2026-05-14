/**
 * URL pública opcional para abrir Google Fit en el navegador (perfil o actividad).
 * Solo `https:`; cualquier otro esquema se rechaza.
 */
export function parseGoogleFitWebUrlFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  const raw = env.NEXT_PUBLIC_GOOGLE_FIT_WEB_URL;
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  if (t.length === 0) {
    return null;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}
