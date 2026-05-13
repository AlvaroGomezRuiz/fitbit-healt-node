import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const memoriaIaRowSchema = z.object({
  id: z.string().uuid(),
  drive_file_id: z.string(),
  source_filename: z.string(),
  line_index: z.number().int().nonnegative(),
  event_ts: z.string().nullable(),
  contenido_linea: z.string(),
  created_at: z.string(),
});

export type MemoriaIaRow = z.infer<typeof memoriaIaRowSchema>;

export type ListMemoriaIaRecentResult =
  | { readonly ok: true; readonly rows: readonly MemoriaIaRow[] }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

const memoriaSelect =
  "id,drive_file_id,source_filename,line_index,event_ts,contenido_linea,created_at" as const;

const SHOPPING_KEYWORDS: readonly RegExp[] = [
  /\bcompra\b/i,
  /\blista\b/i,
  /\bsupermercado\b/i,
  /\bmercado\b/i,
];

function lineLooksLikeShopping(text: string): boolean {
  return SHOPPING_KEYWORDS.some((re) => re.test(text));
}

/**
 * Líneas recientes de `memoria_ia` (orden por `created_at` desc).
 */
export async function listMemoriaIaRecent(params: {
  readonly limit: number;
}): Promise<ListMemoriaIaRecentResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en apps/web/.env.local.",
    };
  }
  const limit = Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 200) : 40;
  try {
    const { data, error } = await supabase
      .from("memoria_ia")
      .select(memoriaSelect)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      return { ok: false, code: "query_error", message: error.message };
    }
    const rows: MemoriaIaRow[] = [];
    for (const item of data ?? []) {
      const parsed = memoriaIaRowSchema.safeParse(item);
      if (!parsed.success) {
        return { ok: false, code: "row_shape", message: "Formato inesperado en memoria_ia." };
      }
      rows.push(parsed.data);
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer memoria_ia.";
    return { ok: false, code: "query_error", message };
  }
}

/**
 * Heurística: líneas que parecen lista de compra (sin inventar datos si no hay coincidencias).
 */
export async function listMemoriaIaShoppingCandidates(params: {
  readonly scanLimit: number;
  readonly maxMatches: number;
}): Promise<ListMemoriaIaRecentResult> {
  const recent = await listMemoriaIaRecent({ limit: params.scanLimit });
  if (!recent.ok) {
    return recent;
  }
  const maxMatches = Math.min(Math.max(params.maxMatches, 1), 50);
  const matches = recent.rows.filter((r) => lineLooksLikeShopping(r.contenido_linea)).slice(0, maxMatches);
  return { ok: true, rows: matches };
}
