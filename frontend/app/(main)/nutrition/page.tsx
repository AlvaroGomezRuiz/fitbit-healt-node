import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { NutritionDayView } from "@/components/features/nutrition-day-view";
import { addDaysIsoUtc, todayMadridIso } from "@/lib/data/date-madrid";
import { fetchNutritionDay, type NutritionDayPayload } from "@/lib/data/nutrition-day";
import { SINGLE_USER_PLACEHOLDERS } from "@/lib/ui/single-user-placeholders";

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

function isNutritionDayColdStart(payload: NutritionDayPayload): boolean {
  const anyOk =
    payload.biometria.state === "ok" ||
    payload.shoppingLines.state === "ok" ||
    payload.diarioPlanIa.state === "ok" ||
    payload.nutritionShoppingWeek.state === "ok" ||
    payload.nutritionMenuWeek.state === "ok" ||
    payload.nutritionMemoryNotes.state === "ok" ||
    payload.nutritionWeekHistory.state === "ok" ||
    (payload.nutritionBannedItems.state === "ok" && payload.nutritionBannedItems.data.length > 0);
  return !anyOk;
}

interface NutritionColdStartPanelProps {
  readonly fecha: string;
}

function NutritionColdStartPanel(props: NutritionColdStartPanelProps): React.ReactElement {
  const prev = addDaysIsoUtc(props.fecha, -1);
  const next = addDaysIsoUtc(props.fecha, 1);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="nutrition-cold-heading">
      <header className="flex flex-col gap-2">
        <h1 id="nutrition-cold-heading" className="text-xl font-semibold tracking-tight text-foreground">
          {SINGLE_USER_PLACEHOLDERS.nutricion.titulo}
        </h1>
        <p className="text-sm text-muted-foreground">{SINGLE_USER_PLACEHOLDERS.sinDatosAun}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{SINGLE_USER_PLACEHOLDERS.nutricion.vacio}</p>
        <nav className="flex items-center justify-between gap-2" aria-label="Cambiar día">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/nutrition?fecha=${prev}`} prefetch={false}>
              Día anterior
            </Link>
          </Button>
          <p className="text-sm font-medium text-foreground">{props.fecha}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/nutrition?fecha=${next}`} prefetch={false}>
              Día siguiente
            </Link>
          </Button>
        </nav>
      </header>
    </section>
  );
}

export default async function NutritionPage(props: NutritionPageProps): Promise<React.ReactElement> {
  const sp = props.searchParams !== undefined ? await props.searchParams : {};
  const fecha = parseFecha(sp.fecha);
  const payload = await fetchNutritionDay({ fecha });
  if (isNutritionDayColdStart(payload)) {
    return <NutritionColdStartPanel fecha={fecha} />;
  }
  return <NutritionDayView payload={payload} />;
}
