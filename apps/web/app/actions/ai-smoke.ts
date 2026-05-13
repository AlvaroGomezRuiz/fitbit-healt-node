"use server";

import "server-only";

import type { AiSmokeState } from "@/lib/actions/ai-state";
import { runDeepSeekCascade } from "@/lib/ai/reexport";

/**
 * Llamada mínima a la cascada DeepSeek (solo servidor). Requiere DEEPSEEK_API_KEY en el entorno de Next.
 */
export async function runAiSmokeAction(_prev: AiSmokeState, _formData: FormData): Promise<AiSmokeState> {
  void _prev;
  void _formData;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    return {
      status: "error",
      message:
        "Falta DEEPSEEK_API_KEY en el entorno de apps/web (p. ej. apps/web/.env.local). No se llama a la API.",
    };
  }
  try {
    const result = await runDeepSeekCascade({
      messages: [
        {
          role: "user",
          content:
            "Responde en una sola frase en español: confirma que la cascada DeepSeek está operativa en el monorepo.",
        },
      ],
      temperature: 0.2,
      signal: undefined,
    });
    return { status: "success", reply: result.text.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al invocar DeepSeek.";
    return { status: "error", message };
  }
}
