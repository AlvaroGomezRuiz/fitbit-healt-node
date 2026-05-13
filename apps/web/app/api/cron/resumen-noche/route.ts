import { NextResponse } from "next/server";

import { handleCronDeepSeekGet } from "@/lib/cron/handle-cron-deepseek-get";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  return handleCronDeepSeekGet({
    request,
    aiFlagEnv: "CRON_RESUMEN_NOCHE_DEEPSEEK",
    prompt:
      "Responde en una sola frase en español (stub cron resumen noche): confirma recepción del job sin datos personales.",
  });
}
