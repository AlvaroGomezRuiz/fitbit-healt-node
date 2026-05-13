import * as React from "react";

import { NutritionDayView } from "@/components/features/nutrition-day-view";
import { getJsDayOfWeekMadrid, todayMadridIso } from "@/lib/data/date-madrid";
import { fetchNutritionDay } from "@/lib/data/nutrition-day";

export const dynamic = "force-dynamic";

interface NutritionPageProps {
  readonly searchParams?: Promise<{ readonly fecha?: string }>;
}

function parseFecha(raw: string | undefined): string {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  return todayMadridIso();
}

export default async function NutritionPage(props: NutritionPageProps): Promise<React.ReactElement> {
  const sp = props.searchParams !== undefined ? await props.searchParams : {};
  const fecha = parseFecha(sp.fecha);
  const payload = await fetchNutritionDay({ fecha });
  const isSundayMadrid = getJsDayOfWeekMadrid(fecha) === 0;
  return <NutritionDayView payload={payload} isSundayMadrid={isSundayMadrid} />;
}
