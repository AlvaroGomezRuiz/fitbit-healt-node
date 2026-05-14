"use server";

import "server-only";

import { z } from "zod";

import { revalidateAfterNutritionWeekTablesWrite } from "@/lib/cache/revalidate-after-data-write";
import { nutritionShoppingItemsSchema } from "@/lib/schemas/nutrition-week";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NutritionWeekActionState = { readonly kind: "idle" } | { readonly kind: "ok"; readonly message: string } | { readonly kind: "error"; readonly message: string };

const initialWeekAction: NutritionWeekActionState = { kind: "idle" };

const semanaIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de semana no válida.");

const saveShoppingPayloadSchema = z.object({
  semana_inicio: semanaIsoSchema,
  items_json: z.string().min(2).max(400_000),
});

/**
 * Inserta o actualiza la lista de compra de la semana (JSONB `items`).
 */
export async function saveNutritionShoppingWeekAction(
  _prev: NutritionWeekActionState,
  formData: FormData,
): Promise<NutritionWeekActionState> {
  const rawSemana = formData.get("semana_inicio");
  const rawJson = formData.get("items_json");
  const parsedWrap = saveShoppingPayloadSchema.safeParse({
    semana_inicio: typeof rawSemana === "string" ? rawSemana.trim() : "",
    items_json: typeof rawJson === "string" ? rawJson : "",
  });
  if (!parsedWrap.success) {
    const msg = parsedWrap.error.flatten().fieldErrors.semana_inicio?.[0] ?? parsedWrap.error.flatten().fieldErrors.items_json?.[0] ?? "Datos no válidos.";
    return { kind: "error", message: typeof msg === "string" ? msg : "Datos no válidos." };
  }
  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(parsedWrap.data.items_json) as unknown;
  } catch {
    return { kind: "error", message: "JSON de ítems ilegible." };
  }
  const itemsParsed = nutritionShoppingItemsSchema.safeParse(parsedItems);
  if (!itemsParsed.success) {
    return { kind: "error", message: "La lista no cumple el contrato (name, quantity, priority)." };
  }

  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { kind: "error", message: "Supabase no configurado en servidor." };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return { kind: "error", message: "Inicia sesión para guardar la compra semanal." };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("nutrition_shopping_week").upsert(
    {
      semana_inicio: parsedWrap.data.semana_inicio,
      items: itemsParsed.data,
      updated_at: nowIso,
    },
    { onConflict: "semana_inicio" },
  );
  if (error !== null) {
    return { kind: "error", message: error.message };
  }
  revalidateAfterNutritionWeekTablesWrite();
  return { kind: "ok", message: "Lista de compra guardada." };
}

const memoryAddSchema = z.object({
  content: z.string().trim().min(1, "Escribe al menos un carácter.").max(8000),
});

export async function addNutritionMemoryNoteAction(
  _prev: NutritionWeekActionState,
  formData: FormData,
): Promise<NutritionWeekActionState> {
  const raw = formData.get("content");
  const parsed = memoryAddSchema.safeParse({
    content: typeof raw === "string" ? raw : "",
  });
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.content?.[0];
    return { kind: "error", message: typeof msg === "string" ? msg : "Contenido no válido." };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { kind: "error", message: "Supabase no configurado en servidor." };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return { kind: "error", message: "Inicia sesión para añadir notas." };
  }
  const { error } = await supabase.from("nutrition_memory_note").insert({
    content: parsed.data.content,
    pinned: false,
  });
  if (error !== null) {
    return { kind: "error", message: error.message };
  }
  revalidateAfterNutritionWeekTablesWrite();
  return { kind: "ok", message: "Nota añadida." };
}

const bannedAddSchema = z.object({
  label: z.string().trim().min(1, "Etiqueta vacía.").max(300),
});

export async function addNutritionBannedItemAction(
  _prev: NutritionWeekActionState,
  formData: FormData,
): Promise<NutritionWeekActionState> {
  const raw = formData.get("label");
  const parsed = bannedAddSchema.safeParse({ label: typeof raw === "string" ? raw : "" });
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.label?.[0];
    return { kind: "error", message: typeof msg === "string" ? msg : "Etiqueta no válida." };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { kind: "error", message: "Supabase no configurado en servidor." };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return { kind: "error", message: "Inicia sesión para añadir prohibidos." };
  }
  const { error } = await supabase.from("nutrition_banned_item").insert({ label: parsed.data.label });
  if (error !== null) {
    return { kind: "error", message: error.message };
  }
  revalidateAfterNutritionWeekTablesWrite();
  return { kind: "ok", message: "Prohibido añadido." };
}

const bannedDeleteSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteNutritionBannedItemAction(
  _prev: NutritionWeekActionState,
  formData: FormData,
): Promise<NutritionWeekActionState> {
  const raw = formData.get("id");
  const parsed = bannedDeleteSchema.safeParse({ id: typeof raw === "string" ? raw.trim() : "" });
  if (!parsed.success) {
    return { kind: "error", message: "Identificador no válido." };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { kind: "error", message: "Supabase no configurado en servidor." };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return { kind: "error", message: "Inicia sesión para eliminar prohibidos." };
  }
  const { error } = await supabase.from("nutrition_banned_item").delete().eq("id", parsed.data.id);
  if (error !== null) {
    return { kind: "error", message: error.message };
  }
  revalidateAfterNutritionWeekTablesWrite();
  return { kind: "ok", message: "Prohibido eliminado." };
}

export const nutritionWeekActionInitialState: NutritionWeekActionState = initialWeekAction;
