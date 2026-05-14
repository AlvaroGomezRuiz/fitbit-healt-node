/**
 * Prompts y textos de sistema portados desde `src/engines/brain_engine.py`.
 * Sin I/O: el caller inyecta contexto inline (strings / JSON serializado).
 */

export const GUARDARRAILES_DOC = `
GUARDARRAÍLES CLÍNICOS DUROS (NO SUGERENCIAS, REGLAS):
1. Si HRV cae > 15% vs baseline 7d durante 3 días seguidos → ORDENAR deload obligatorio y +200 kcal ese día.
2. Si pérdida de peso > 1.0 kg/semana sostenida 2 semanas → REDUCIR déficit a -250 kcal (protege músculo).
3. Si TOP_SET cae > 10% en mismo ejercicio durante 2 sesiones consecutivas → BANDERA ROJA: subir proteína a 2.8 g/kg + revisar sueño.
4. Si sueño < 6h durante 3 días seguidos → POSPONER LEG day, sustituir por PULL ligero.
5. Si RPE auto-reportado >= 9 en 2 sesiones seguidas con HRV plano → SUBIR carbos a 220 g ese día (rebote glucógeno).
`.trim();

/** weekday 0=lunes … 6=domingo (igual que Python datetime.weekday). */
export const ROTACION_SEMANAL: Readonly<
  Record<number, Readonly<{ readonly grupo: string; readonly hidratacion: string }>>
> = {
  0: { grupo: "PULL", hidratacion: "Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)" },
  1: { grupo: "PUSH", hidratacion: "Agua de coco" },
  2: { grupo: "LEG", hidratacion: "Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)" },
  3: { grupo: "PULL", hidratacion: "Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)" },
  4: { grupo: "PUSH", hidratacion: "Agua de coco" },
  5: { grupo: "DESCANSO", hidratacion: "Solo agua mineral" },
  6: { grupo: "DESCANSO", hidratacion: "Solo agua mineral" },
};

export const NOMBRE_DIA_ES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export const NOMBRE_MES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function getWeekdayMon0EuropeMadrid(now: Date): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(now);
  const map: Readonly<Record<string, number>> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const wd = map[short];
  if (wd === undefined) {
    throw new Error(`Día de la semana inesperado: ${short}`);
  }
  return wd;
}

function getCalendarPartsMadrid(now: Date): { readonly day: number; readonly monthIndex0: number; readonly year: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(now);
  let day = 0;
  let month = 0;
  let year = 0;
  for (const p of parts) {
    if (p.type === "day") {
      day = Number.parseInt(p.value, 10);
    }
    if (p.type === "month") {
      month = Number.parseInt(p.value, 10);
    }
    if (p.type === "year") {
      year = Number.parseInt(p.value, 10);
    }
  }
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    throw new Error("No se pudo resolver la fecha en Europe/Madrid.");
  }
  return { day, monthIndex0: month - 1, year };
}

/**
 * Equivalente a `_bloque_fecha_y_rotacion` en Python (zona Europe/Madrid).
 */
export function buildBloqueFechaYRotacion(ahoraUtc: Date = new Date()): string {
  const wd = getWeekdayMon0EuropeMadrid(ahoraUtc);
  const rot = ROTACION_SEMANAL[wd];
  if (rot === undefined) {
    throw new Error("Rotación semanal no definida para el índice calculado.");
  }
  const { day, monthIndex0, year } = getCalendarPartsMadrid(ahoraUtc);
  const mes = NOMBRE_MES_ES[monthIndex0];
  if (mes === undefined) {
    throw new Error("Mes fuera de rango.");
  }
  const nombreDia = NOMBRE_DIA_ES[wd];
  if (nombreDia === undefined) {
    throw new Error("Día fuera de rango.");
  }
  const fechaHumana = `${nombreDia} ${String(day)} de ${mes} de ${String(year)}`;
  const esDomingo = wd === 6;
  const planCompra = esDomingo
    ? "HOY ES DOMINGO: incluye al final un bloque resumen de COMPRA SEMANAL (lista corta de alimentos clave para los 5 entrenos + descansos). Máx 8 viñetas."
    : "HOY NO ES DOMINGO: NO generes lista de la compra. La compra la gestiona el padre del atleta.";
  return `
FECHA Y CALENDARIO (FUENTE DE VERDAD — NO INVENTAR):
- Fecha local Madrid: ${fechaHumana}
- Día de la semana: ${nombreDia} (weekday=${String(wd)})
- Grupo muscular previsto hoy según rotación oficial: ${rot.grupo}
- Hidratación oficial en gimnasio para hoy: ${rot.hidratacion}

SUPLEMENTACIÓN DIARIA FIJA:
- Creatina monohidrato 7 g/día (siempre, no negociable).
- Magnesio y Omega-3: NO comprados aún. NO incluir en el plan hasta nuevo aviso.

POLÍTICA DE LISTA DE LA COMPRA:
- ${planCompra}
`.trim();
}

export interface ContextoAtletaInput {
  readonly nombre: string;
  readonly edad: number;
  readonly fechaNacimiento: string;
  readonly sexo: string;
  readonly alturaCm: number;
  readonly pesoKg: number;
  readonly imc: number;
  readonly bodyFatEstimadoPct: number;
  readonly masaLibreGrasaKg: number;
  readonly tendenciaPeso7diasKg: number;
  readonly objetivoTipo: string;
  readonly kcalTarget: number;
  readonly proteinaG: number;
  readonly grasaG: number;
  readonly carbosG: number;
  readonly creatinaG: number;
  readonly aguaL: number;
  readonly guardarrailesActivosJson: string;
  readonly rutinaOficial: string;
  readonly perfilAtleta: string;
  readonly memoriaLinealActual: string;
  readonly memoriaLinealMesAnterior: string;
}

/**
 * Equivalente a `_contexto_atleta` en Python; datos ya materializados por el caller.
 */
export function buildContextoAtleta(input: ContextoAtletaInput): string {
  return `
ATLETA:
- Nombre: ${input.nombre}
- Edad: ${String(input.edad)} años (FechaNac: ${input.fechaNacimiento})
- Sexo: ${input.sexo} | Altura: ${String(input.alturaCm)} cm
- Peso actual: ${String(input.pesoKg)} kg | IMC: ${String(input.imc)}
- Body fat estimado: ${String(input.bodyFatEstimadoPct)}%
- Masa libre de grasa: ${String(input.masaLibreGrasaKg)} kg
- Tendencia 7d: ${String(input.tendenciaPeso7diasKg)} kg

OBJETIVO ACTUAL (${input.objetivoTipo}):
- kcal target: ${String(input.kcalTarget)}
- Proteína: ${String(input.proteinaG)} g
- Grasa: ${String(input.grasaG)} g
- Carbos: ${String(input.carbosG)} g
- Creatina: ${String(input.creatinaG)} g (monohidrato)
- Agua: ${String(input.aguaL)} L

GUARDARRAÍLES ACTIVOS:
${input.guardarrailesActivosJson}

RUTINA OFICIAL VIGENTE (fuente de verdad para series, pesos y técnica):
${input.rutinaOficial}

PERFIL ATLETA (síntesis del histórico CSV):
${input.perfilAtleta}

MEMORIA LINEAL MES ACTUAL (últimos 3000 chars):
${input.memoriaLinealActual}

MEMORIA MES ANTERIOR (últimos 1500 chars):
${input.memoriaLinealMesAnterior}
`.trim();
}

export interface ReportePromptBaseInput {
  readonly bloqueFechaYRotacion: string;
  readonly contextoAtleta: string;
  readonly telemetriaJson: string;
}

export function buildPreEntrenoPrompt(input: ReportePromptBaseInput): string {
  return `
ROL: Eres un Senior Performance Architect + Nutricionista Clínico de élite.
TAREA: Briefing de Readiness diario (PRE-entreno) en formato HTML.

${input.bloqueFechaYRotacion}

${input.contextoAtleta}

TELEMETRÍA FITBIT AIR (últimas 24h):
${input.telemetriaJson}

${GUARDARRAILES_DOC}

INSTRUCCIONES:
1. Usa SIEMPRE la fecha y el día de la semana que aparecen en el bloque FECHA Y CALENDARIO arriba. Nunca inventes otra fecha.
2. Analiza fatiga del SNC con HRV, sueño y resting HR.
3. Decide si hoy entrena o descansa (aplica guardarraíles + rotación oficial).
4. Si entrena: usa el grupo muscular previsto del bloque FECHA Y CALENDARIO. Lista los ejercicios concretos de RUTINA OFICIAL VIGENTE con sus pesos y ajustes (RIR, +2.5 kg si toca).
5. Plan nutricional del día: desayuno, comida, cena, snack pre y post entreno con números exactos (g proteína, g carbos, g grasa). Suma debe cuadrar con kcal_target.
6. Hidratación en el gimnasio: usa EXACTAMENTE la bebida del bloque FECHA Y CALENDARIO (limonada casera o agua de coco según día).
7. Recordatorio creatina 7 g/día y momento ideal de tomarla. Magnesio/Omega-3 SOLO mencionar como "pendiente de compra".
8. Lista de la compra: aplica la POLÍTICA DE LISTA DE LA COMPRA del bloque FECHA Y CALENDARIO. Si hoy no es domingo, NO incluyas ninguna sección de compra.
9. Si los datos de la pulsera vienen NULL (todavía sin pulsera), trabaja solo con el JSON maestro y CSV histórico.

FORMATO DE SALIDA OBLIGATORIO:
- HTML PURO. Nada de markdown, nada de \`\`\`html.
- Usa <h2> títulos principales, <h3> subtítulos, <ul><li>, <b> para negrita, <table> con clase 'plan' para macros.
- Idioma: español clínico, directo, sin filler.
`.trim();
}

export interface PostEntrenoPromptInput extends ReportePromptBaseInput {
  readonly rawLyftaText: string;
}

export function buildPostEntrenoPrompt(input: PostEntrenoPromptInput): string {
  const raw = input.rawLyftaText.slice(0, 6000);
  return `
ROL: Senior Performance Architect + Nutricionista Clínico de élite.
TAREA: Auditoría POST-entreno + ajuste calórico/macros del resto del día.

${input.bloqueFechaYRotacion}

${input.contextoAtleta}

TELEMETRÍA FITBIT AIR HOY:
${input.telemetriaJson}

ENTRENO QUE ACABA DE REALIZAR (Lyfta TXT):
${raw}

${GUARDARRAILES_DOC}

INSTRUCCIONES:
1. Usa SIEMPRE la fecha y el día de la semana del bloque FECHA Y CALENDARIO. Nunca inventes otra fecha.
2. Audita el entreno: progresión vs PRs históricos, RPE estimado, calidad de la sesión.
3. Compara TOP_SETS con la última sesión del mismo grupo (aplica guardarraíl #3 si procede). Si hay Lateral Raise, recuerda que es TRISERIE en dropset (3 series × 30 reps = 90 reps totales), no 9 series independientes.
4. Calcula kcal y macros restantes del día (lo que ya consumió vs target).
5. Plan exacto de comida POST-entreno (g proteína, g carbos, ventana de 90 min).
6. Plan exacto de cena + snack nocturno si quedan macros pendientes.
7. Recordatorio creatina 7 g/día si no la ha tomado hoy. NO sugerir magnesio ni Omega-3 (pendientes de compra).
8. Predicción de progresión para la PRÓXIMA sesión del mismo grupo (basado en RUTINA OFICIAL VIGENTE).
9. NO incluyas lista de la compra: aplica la POLÍTICA del bloque FECHA Y CALENDARIO (solo el domingo).

FORMATO DE SALIDA OBLIGATORIO:
- HTML PURO. Nada de markdown.
- <h2>, <h3>, <ul>, <table class='plan'>.
- Español clínico.
`.trim();
}

export function buildResumenNochePrompt(input: ReportePromptBaseInput): string {
  return `
ROL: Senior Performance Architect + Nutricionista Clínico de élite.
TAREA: Cierre del día. Resumen general, comparativa vs target y predicción mañana.

${input.bloqueFechaYRotacion}

${input.contextoAtleta}

TELEMETRÍA FITBIT AIR FINAL DEL DÍA:
${input.telemetriaJson}

${GUARDARRAILES_DOC}

INSTRUCCIONES:
1. Usa SIEMPRE la fecha y el día de la semana del bloque FECHA Y CALENDARIO. Nunca inventes otra fecha.
2. Cierre nutricional: kcal y macros conseguidos vs target. % adherencia.
3. Cierre entreno: si entrenó hoy, calidad de sesión; si descansó, justificación.
4. Estado SNC: tendencia HRV 7d, sueño promedio 7d, banderas activadas.
5. Tendencias 7d (peso, fuerza media en TOP_SETS, sueño).
6. Plan de mañana: qué grupo toca (cruza FECHA+1 contra rotación oficial), qué hora dormir, qué desayuno preparar, qué hidratación llevar al gym.
7. Si guardarraíles disparan, ESCRIBE LA RECOMENDACIÓN COMO ORDEN, no sugerencia.
8. Lista de la compra: aplica la POLÍTICA del bloque FECHA Y CALENDARIO. SOLO el domingo incluye un resumen semanal corto (máx 8 viñetas) para que el padre lo compre el lunes.

FORMATO DE SALIDA OBLIGATORIO:
- HTML PURO. <h2>, <h3>, <ul>, <table>.
- Español clínico.
`.trim();
}

export interface MutacionPromptInput {
  readonly estadoActualJson: string;
  readonly workoutRawTail: string;
}

export function buildMutacionEstadoPrompt(input: MutacionPromptInput): string {
  const tail = input.workoutRawTail.slice(-1500);
  return `
ROL: Analizador biométrico estricto.
TAREA: Revisa el texto y devuelve el JSON maestro mutado SI hay cambios biométricos explícitos.

REGLAS:
1. Si el usuario menciona explícitamente nuevo peso ("peso 81kg", "peso ayunas 80"), actualiza biometria_actual.peso_kg.
2. Recalcula imc = peso / (altura_m^2).
3. Recalcula masa_libre_grasa_kg = peso * (1 - body_fat/100).
4. Recalcula tendencia_peso_7dias_kg = peso_nuevo - peso_baseline_2sem.
5. Si NO hay cambios explícitos, devuelve el JSON original SIN MODIFICAR.
6. Devuelve SOLO JSON crudo (sin \`\`\`json, sin texto extra).
7. NUNCA inventes campos nuevos. Estructura exacta igual al original.

CURRENT_STATE:
${input.estadoActualJson}

WORKOUT_RAW (últimos 1500 chars):
${tail}
`.trim();
}

export function buildPerfilAtletaPrompt(csvTexto: string): string {
  const csv = csvTexto.slice(0, 60000);
  return `
ROL: Senior S&C Coach analizando un historial de entrenamiento.
TAREA: Genera un PERFIL_ATLETA.md sintetizando el CSV. Formato Markdown.

CSV CRUDO (148 entrenos):
${csv}

PRODUCE EXACTAMENTE ESTAS SECCIONES (en Markdown):

# Perfil Atleta
## Nivel general
(1 frase con clasificación: principiante / intermedio / avanzado / competitivo amateur, justificando con ratios fuerza/peso)

## PRs principales (TOP_SETS)
| Ejercicio | Peso máx (kg) | Reps | Ratio/BW |
|---|---|---|---|
(top 10 ejercicios por peso máximo)

## Frecuencia y volumen
- Sesiones promedio/semana
- Distribución PUSH/PULL/LEG
- Duración media de sesión

## Tendencias de progresión
(3-5 viñetas con ejercicios que están subiendo o estancados)

## Puntos fuertes y débiles
(2 viñetas cada uno, comparando con estándares para 19 años y 82 kg BW)

## Recomendaciones de cara al cutting agresivo
(3 viñetas: cómo proteger fuerza, riesgos a vigilar, KPIs)

INSTRUCCIONES:
- Tono clínico, español, sin filler.
- Asume BW = 82 kg para ratios.
- NO inventes datos: si una métrica no es deducible, escribe "N/D".
- Devuelve SOLO el Markdown, sin texto introductorio.
`.trim();
}

export function buildExtraerMetadatosEntrenoPrompt(rawText: string): string {
  const head = rawText.slice(0, 800);
  return `Extrae JSON {"fecha":"YYYY-MM-DD","tipo":"PUSH|PULL|LEG"} del siguiente texto de entreno. Si no hay fecha clara devuelve "TODAY". Devuelve SOLO JSON sin markdown:\n\n${head}`;
}

export function limpiarHtml(raw: string): string {
  return raw.replaceAll("```html", "").replaceAll("```", "").trim();
}

export function limpiarJson(raw: string): string {
  return raw.replaceAll("```json", "").replaceAll("```", "").trim();
}
