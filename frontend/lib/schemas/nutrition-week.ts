import { z } from "zod";

/** Elemento de `nutrition_shopping_week.items` (array JSONB). */
export const nutritionShoppingItemSchema = z.object({
  name: z.string().min(1).max(500),
  quantity: z.union([z.string().max(200), z.null()]).optional(),
  priority: z.union([z.number().int(), z.null()]).optional(),
});

export type NutritionShoppingItem = z.infer<typeof nutritionShoppingItemSchema>;

export const nutritionShoppingItemsSchema = z.array(nutritionShoppingItemSchema);

const MENU_DAY_KEYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type NutritionMenuDayKey = (typeof MENU_DAY_KEYS)[number];

export const NUTRITION_MENU_DAY_KEYS: readonly NutritionMenuDayKey[] = MENU_DAY_KEYS;

export function isNutritionMenuDayKey(value: string): value is NutritionMenuDayKey {
  return (MENU_DAY_KEYS as readonly string[]).includes(value);
}

/** Día del menú: secciones → contenido (estructura flexible validada como objeto). */
export const nutritionMenuDaySchema = z.record(z.string(), z.unknown());

export const nutritionMenuWeekDaysSchema = z.record(z.string(), nutritionMenuDaySchema);

export type NutritionMenuWeekDays = z.infer<typeof nutritionMenuWeekDaysSchema>;

export function parseNutritionShoppingItemsJson(raw: unknown): z.SafeParseReturnType<unknown, NutritionShoppingItem[]> {
  return nutritionShoppingItemsSchema.safeParse(raw);
}

export function parseNutritionMenuDaysJson(raw: unknown): z.SafeParseReturnType<unknown, NutritionMenuWeekDays> {
  return nutritionMenuWeekDaysSchema.safeParse(raw);
}

export const nutritionMemoryNoteRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  content: z.string(),
  pinned: z.boolean(),
});

export type NutritionMemoryNoteRow = z.infer<typeof nutritionMemoryNoteRowSchema>;

export const nutritionBannedItemRowSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
});

export type NutritionBannedItemRow = z.infer<typeof nutritionBannedItemRowSchema>;
