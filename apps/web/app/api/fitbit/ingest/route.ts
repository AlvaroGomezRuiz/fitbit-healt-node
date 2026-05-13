import { parseFitbitFeatureFlagsFromEnv, parseFitbitMasterFromEnv } from "@/lib/fitbit/config";
import { telemetriaIngestBodySchema } from "@/lib/fitbit/ingest-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function jsonUnknown(data: unknown, init: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!parseFitbitMasterFromEnv(process.env)) {
    return jsonUnknown({ accepted: false as const, reason: "FITBIT_ACTIVO" }, { status: 503 });
  }
  const flags = parseFitbitFeatureFlagsFromEnv(process.env);
  if (!flags.ingestEnabled) {
    return jsonUnknown(
      { accepted: false as const, reason: "FITBIT_INGEST_ENABLED=false" },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return jsonUnknown(
      { accepted: false as const, reason: "missing_supabase_public_env" },
      { status: 503 },
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return jsonUnknown({ accepted: false as const, reason: "invalid_json" }, { status: 400 });
  }

  const parsed = telemetriaIngestBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return jsonUnknown(
      {
        accepted: false as const,
        reason: "validation_error",
        issues: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  const body = parsed.data;
  const row: Record<string, string | number | boolean | null | Record<string, unknown>> = {
    fecha: body.fecha,
    pulsera_activa: body.pulsera_activa ?? false,
    resumen_critico: body.resumen_critico ?? {},
    snapshot_completo: body.snapshot_completo ?? {},
  };

  if (body.hrv_diario !== undefined) {
    row.hrv_diario = body.hrv_diario;
  }
  if (body.peso_actual_kg !== undefined) {
    row.peso_actual_kg = body.peso_actual_kg;
  }
  if (body.sueno_horas !== undefined) {
    row.sueno_horas = body.sueno_horas;
  }
  if (body.sueno_eficiencia !== undefined) {
    row.sueno_eficiencia = body.sueno_eficiencia;
  }

  const { error } = await supabase.from("telemetria_diaria").upsert(row, { onConflict: "fecha" });
  if (error !== null) {
    return jsonUnknown(
      { accepted: false as const, reason: "supabase_error", message: error.message },
      { status: 502 },
    );
  }

  return jsonUnknown({ accepted: true as const, fecha: body.fecha }, { status: 200 });
}
