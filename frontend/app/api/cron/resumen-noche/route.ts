import { NextResponse } from "next/server";

import { handleCronDeepSeekGet } from "@/lib/cron/handle-cron-deepseek-get";
import { buildEntrenosHistoricoContextForPrompt } from "@/lib/data/build-entrenos-historico-context";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = createSupabaseServiceRoleClient();
  const entrenoBlock =
    supabase === null
      ? "Entrenos recientes: sin service_role (omitido)."
      : await buildEntrenosHistoricoContextForPrompt({
          supabase,
          maxSessions: 10,
          maxChars: 1600,
        });

  const prompt = [
    "Responde en una sola frase en español (stub cron resumen noche): confirma recepción del job sin datos personales.",
    "",
    "=== Entrenos recientes (compacto) ===",
    entrenoBlock,
  ].join("\n");

  return handleCronDeepSeekGet({
    request,
    aiFlagEnv: "CRON_RESUMEN_NOCHE_DEEPSEEK",
    prompt,
  });
}
