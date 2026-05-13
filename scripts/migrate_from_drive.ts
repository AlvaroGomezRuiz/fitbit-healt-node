/**
 * Migra datos desde Google Drive → Supabase (Postgres + Storage).
 *
 * Requiere:
 * - `FOLDER_SALUD_ID` (carpeta raíz SALUD).
 * - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (migración ignora RLS).
 * - OAuth Drive: `GOOGLE_OAUTH_TOKEN_JSON` (JSON en una línea, o ruta a fichero) o `token.json` en la raíz;
 *   si faltan `client_id`/`client_secret` en el token, usa `secrets/credenciales_oauth.json` (Desktop).
 * - Opcional: `FILE_ID_MAESTRO` para BIOMETRIA_MAESTRO.json; si no, se busca en `00_CONTEXTO_HISTORICO`.
 *
 * Ejecución (política RTK del workspace):
 *   rtk npm install
 *   rtk npx tsx scripts/migrate_from_drive.ts
 *
 * No aplica migraciones SQL: ejecutar antes en Supabase los ficheros en `supabase/migrations/`.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env"), override: true });

const TOKEN_ENV = "GOOGLE_OAUTH_TOKEN_JSON";
const FOLDER_SALUD_ENV = "FOLDER_SALUD_ID";
const FILE_ID_MAESTRO_ENV = "FILE_ID_MAESTRO";

const DAY_FOLDER_RE = /^\d{2}_\d{2}_\d{4}$/;
const YEAR_FOLDER_RE = /^\d{4}$/;
const MONTH_FOLDER_RE = /^\d{2}_[A-Za-zÁÉÍÓÚÑáéíóúñ]+$/;

const SUB_LYFTA = "01_LYFTA_RAW";
const SUB_REPORTES = "02_RESUMEN_DIARIO_IA";
const SUB_HEALTH_RAW = "04_HEALTH_RAW";
const CTX = "00_CONTEXTO_HISTORICO";

type ReporteHtmlTipo = "PRE_ENTRENO" | "POST_ENTRENO" | "RESUMEN_NOCHE";
type GrupoMuscular = "PUSH" | "PULL" | "LEG" | "DESCANSO";
type DiaSemana = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
type EntrenoOrigen = "drive_csv" | "lyfta_raw";

const IdentidadSchema = z.object({
  nombre: z.string(),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  edad_anos: z.coerce.number().int().nonnegative(),
  sexo: z.enum(["M", "F"]),
  altura_cm: z.coerce.number(),
});

const BiometriaActualSchema = z.object({
  peso_kg: z.coerce.number(),
  fecha_ultimo_pesaje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  imc: z.coerce.number(),
  body_fat_estimado_pct: z.coerce.number(),
  masa_libre_grasa_kg: z.coerce.number(),
  tendencia_peso_7dias_kg: z.coerce.number(),
});

const ObjetivoSchema = z.object({
  tipo: z.enum([
    "CUTTING_AGRESIVO",
    "CUTTING_SUAVE",
    "MANTENIMIENTO",
    "VOLUMEN_LIMPIO",
    "VOLUMEN_AGRESIVO",
  ]),
  kcal_target: z.coerce.number().int(),
  proteina_g: z.coerce.number().int(),
  grasa_g: z.coerce.number().int(),
  carbos_g: z.coerce.number().int(),
  creatina_g: z.coerce.number().int(),
  agua_l: z.coerce.number(),
  fecha_ultimo_recalculo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const GuardarrailesSchema = z.object({
  hrv_baseline_7d: z.union([z.number(), z.null()]).optional(),
  peso_baseline_2sem: z.union([z.number(), z.null()]).optional(),
  ultimo_top_set_squat: z.union([z.number(), z.null()]).optional(),
  ultimo_top_set_press: z.union([z.number(), z.null()]).optional(),
  bandera_roja: z.boolean(),
  motivo_bandera_roja: z.string().nullable().optional(),
  ultimo_chequeo: z.string(),
});

const MemoriaCortaSchema = z.object({
  sueno_h: z.array(z.coerce.number()).max(14),
  hrv_ms: z.array(z.coerce.number()).max(14),
  rpe_promedio: z.array(z.coerce.number()).max(14),
  adherencia_kcal_pct: z.array(z.coerce.number()).max(14),
});

const BiometriaMaestroJsonSchema = z.object({
  identidad: IdentidadSchema,
  biometria_actual: BiometriaActualSchema,
  objetivo: ObjetivoSchema,
  guardarrailes_activos: GuardarrailesSchema,
  memoria_corta_7dias: MemoriaCortaSchema.default({
    sueno_h: [],
    hrv_ms: [],
    rpe_promedio: [],
    adherencia_kcal_pct: [],
  }),
});

const GoogleAuthorizedUserSchema = z.object({
  type: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  refresh_token: z.string(),
  access_token: z.string().optional(),
  expiry_date: z.number().optional(),
});

const InstalledClientSecretsSchema = z.object({
  installed: z.object({
    client_id: z.string(),
    client_secret: z.string(),
  }),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function loadJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  return parsed;
}

function mergeOAuthCredentials(): OAuth2Client {
  let tokenRaw: unknown;
  const envTok = process.env[TOKEN_ENV]?.trim();
  const tokenPath = path.join(REPO_ROOT, "token.json");
  if (envTok) {
    if (envTok.startsWith("{")) {
      const parsed: unknown = JSON.parse(envTok);
      tokenRaw = parsed;
    } else {
      const p = path.isAbsolute(envTok) ? envTok : path.join(REPO_ROOT, envTok);
      tokenRaw = loadJsonFile(p);
    }
  } else if (existsSync(tokenPath)) {
    tokenRaw = loadJsonFile(tokenPath);
  } else {
    const altPaths = [
      path.join(REPO_ROOT, "credenciales_oauth.json"),
      path.join(REPO_ROOT, "secrets", "token.json"),
    ];
    for (const altToken of altPaths) {
      if (!existsSync(altToken)) {
        continue;
      }
      const candidate = loadJsonFile(altToken);
      const parsed = GoogleAuthorizedUserSchema.safeParse(candidate);
      if (parsed.success) {
        tokenRaw = candidate;
        break;
      }
    }
  }
  if (tokenRaw === undefined) {
    throw new Error(
      `Falta OAuth: define ${TOKEN_ENV}, o token.json / credenciales_oauth.json (token usuario) en la raíz, o secrets/credenciales_oauth.json junto a token parcial (ver scripts/oauth_setup.py).`,
    );
  }

  const base = GoogleAuthorizedUserSchema.parse(tokenRaw);
  let clientId = base.client_id?.trim();
  let clientSecret = base.client_secret?.trim();

  if (!clientId || !clientSecret) {
    const credPath = path.join(REPO_ROOT, "secrets", "credenciales_oauth.json");
    if (!existsSync(credPath)) {
      throw new Error(
        "Token sin client_id/secret y no existe secrets/credenciales_oauth.json (Desktop OAuth).",
      );
    }
    const installed = InstalledClientSecretsSchema.parse(loadJsonFile(credPath));
    clientId = installed.installed.client_id;
    clientSecret = installed.installed.client_secret;
  }

  const oauth2 = new OAuth2Client(clientId, clientSecret);
  oauth2.setCredentials({
    refresh_token: base.refresh_token,
    access_token: base.access_token,
    expiry_date: base.expiry_date,
  });
  return oauth2;
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Variable de entorno obligatoria: ${name}`);
  }
  return v;
}

function createSupabase(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function rowFingerprint(parts: readonly string[]): string {
  const h = createHash("sha256");
  for (const p of parts) {
    h.update("|");
    h.update(p);
  }
  return h.digest("hex");
}

function parseWeightKg(weightRaw: string): number | null {
  const t = weightRaw.trim().replace(",", ".");
  if (!t || t === "—") {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function mapGrupoTabla(raw: string): GrupoMuscular {
  const u = raw.trim().toUpperCase();
  if (u === "PUSH" || u === "PULL" || u === "LEG") {
    return u;
  }
  if (u.includes("DESCANSO")) {
    return "DESCANSO";
  }
  return "DESCANSO";
}

function normalizeDiaKey(dia: string): string {
  return dia
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function diaOrdFromNombre(dia: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  const key = normalizeDiaKey(dia);
  const map: Readonly<Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7>> = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    domingo: 7,
  };
  return map[key] ?? null;
}

function diaEnumFromOrd(ord: 1 | 2 | 3 | 4 | 5 | 6 | 7): DiaSemana {
  const map: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, DiaSemana> = {
    1: "MON",
    2: "TUE",
    3: "WED",
    4: "THU",
    5: "FRI",
    6: "SAT",
    7: "SUN",
  };
  return map[ord];
}

function splitDiasCelda(diaNombre: string): string[] {
  if (diaNombre.includes("/")) {
    return diaNombre
      .split("/")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
  return [diaNombre.trim()];
}

interface RutinaDiaRow {
  dia: DiaSemana;
  nombre_dia: string;
  grupo_sesion: GrupoMuscular;
  hidratacion_gym: string | null;
  ejercicios_markdown: string;
}

function extractMarkdownSections(md: string): Map<string, string> {
  const sections = new Map<string, string>();
  const labels = ["PULL", "PUSH", "LEG"] as const;
  for (const lab of labels) {
    const token = `## ${lab}`;
    const i0 = md.indexOf(token);
    if (i0 === -1) {
      continue;
    }
    let i1 = md.length;
    for (const other of labels) {
      if (other === lab) {
        continue;
      }
      const t2 = `## ${other}`;
      const j = md.indexOf(t2, i0 + token.length);
      if (j !== -1 && j < i1) {
        i1 = j;
      }
    }
    sections.set(lab, md.slice(i0 + token.length, i1).trim());
  }
  return sections;
}

function parseRutinaOficialMarkdown(md: string): RutinaDiaRow[] {
  const sections = extractMarkdownSections(md);
  const rows: RutinaDiaRow[] = [];
  const lines = md.split(/\r?\n/);
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.toLowerCase().includes("dia") && trimmed.toLowerCase().includes("sesion")) {
      inTable = true;
      continue;
    }
    if (inTable && trimmed.startsWith("|")) {
      if (/^\|[\s-:|]+\|$/.test(trimmed.replace(/\s/g, ""))) {
        continue;
      }
      const cells = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length < 3) {
        continue;
      }
      const diaNombre = cells[0];
      const grupoTxt = cells[1];
      const hid = cells[2];
      if (diaNombre.toLowerCase().includes("dia")) {
        continue;
      }
      for (const parte of splitDiasCelda(diaNombre)) {
        const ord = diaOrdFromNombre(parte);
        if (ord === null) {
          continue;
        }
        const grupo = mapGrupoTabla(grupoTxt);
        const grupoKey: "PULL" | "PUSH" | "LEG" | null =
          grupo === "DESCANSO" ? null : grupo;
        const ejercicios =
          grupoKey !== null ? sections.get(grupoKey) ?? "" : "";
        rows.push({
          dia: diaEnumFromOrd(ord),
          nombre_dia: parte,
          grupo_sesion: grupo,
          hidratacion_gym: hid === "–" || hid === "-" ? null : hid,
          ejercicios_markdown: ejercicios,
        });
      }
    }
    if (inTable && trimmed.length === 0) {
      break;
    }
  }
  return rows;
}

function parseReporteHtmlNombre(
  nombre: string,
): { tipo: ReporteHtmlTipo; fecha: string } | null {
  const lower = nombre.toLowerCase();
  let tipo: ReporteHtmlTipo | null = null;
  if (lower.includes("pre_entreno")) {
    tipo = "PRE_ENTRENO";
  } else if (lower.includes("post_entreno")) {
    tipo = "POST_ENTRENO";
  } else if (lower.includes("resumen_noche")) {
    tipo = "RESUMEN_NOCHE";
  }
  if (tipo === null) {
    return null;
  }
  const m2 = nombre.match(/(\d{4}-\d{2}-\d{2})/u);
  if (!m2 || m2[1] === undefined) {
    return null;
  }
  return { tipo, fecha: m2[1] };
}

function parseHistoricoIaLineas(
  texto: string,
): Array<{ line_index: number; event_ts: string | null; contenido_linea: string }> {
  const lines = texto.split(/\r?\n/);
  const out: Array<{ line_index: number; event_ts: string | null; contenido_linea: string }> = [];
  const re = /^\[([^\]]+)\]\s*(.*)$/;
  for (let i = 0; i < lines.length; i += 1) {
    const contenido_linea = lines[i] ?? "";
    const mm = re.exec(contenido_linea);
    const event_ts = mm !== null && mm[1] !== undefined ? mm[1] : null;
    out.push({ line_index: i, event_ts, contenido_linea });
  }
  return out;
}

function extractTelemetriaCritica(snapshot: Record<string, unknown>): Record<string, unknown> {
  const resumen: Record<string, unknown> = {
    sueno_horas: null,
    sueno_eficiencia: null,
    sueno_rem_min: null,
    sueno_profundo_min: null,
    hrv_diario: null,
    frecuencia_reposo_bpm: null,
    spo2_promedio_pct: null,
    pasos: null,
    calorias_total: null,
    active_zone_min: null,
    vo2_max: null,
    peso_actual_kg: null,
  };

  const sesiones = snapshot["sesiones"];
  if (isRecord(sesiones)) {
    const sleepArr = sesiones["sleep"];
    if (Array.isArray(sleepArr) && sleepArr.length > 0) {
      const first = sleepArr[0];
      if (isRecord(first)) {
        const sleepObj = first["sleep"];
        if (isRecord(sleepObj)) {
          const summary = sleepObj["summary"];
          if (isRecord(summary)) {
            const asleep = Number(summary["minutesAsleep"]);
            const inBed = Number(summary["minutesInSleepPeriod"]) || 1;
            if (Number.isFinite(asleep)) {
              resumen["sueno_horas"] = Math.round((asleep / 60) * 100) / 100;
              resumen["sueno_eficiencia"] = Math.round((asleep / inBed) * 1000) / 10;
            }
            const stages = summary["stagesSummary"];
            if (Array.isArray(stages)) {
              for (const st of stages) {
                if (isRecord(st) && st["type"] === "REM" && typeof st["minutes"] === "number") {
                  resumen["sueno_rem_min"] = st["minutes"];
                }
                if (isRecord(st) && st["type"] === "DEEP" && typeof st["minutes"] === "number") {
                  resumen["sueno_profundo_min"] = st["minutes"];
                }
              }
            }
          }
        }
      }
    }
  }

  const cardio = snapshot["cardio_respiratorio"];
  if (isRecord(cardio)) {
    const hrvDaily = cardio["daily-heart-rate-variability"];
    if (Array.isArray(hrvDaily) && hrvDaily.length > 0) {
      const last = hrvDaily[hrvDaily.length - 1];
      if (isRecord(last)) {
        const d = last["dailyHeartRateVariability"];
        if (isRecord(d) && typeof d["rmssdMilliseconds"] === "number") {
          resumen["hrv_diario"] = d["rmssdMilliseconds"];
        }
      }
    }
    const rhr = cardio["daily-resting-heart-rate"];
    if (Array.isArray(rhr) && rhr.length > 0) {
      const last = rhr[rhr.length - 1];
      if (isRecord(last)) {
        const d = last["dailyRestingHeartRate"];
        if (isRecord(d) && typeof d["beatsPerMinute"] === "number") {
          resumen["frecuencia_reposo_bpm"] = d["beatsPerMinute"];
        }
      }
    }
    const spo2 = cardio["daily-oxygen-saturation"];
    if (Array.isArray(spo2) && spo2.length > 0) {
      const last = spo2[spo2.length - 1];
      if (isRecord(last)) {
        const d = last["dailyOxygenSaturation"];
        if (isRecord(d) && typeof d["averagePercentage"] === "number") {
          resumen["spo2_promedio_pct"] = d["averagePercentage"];
        }
      }
    }
  }

  const resumenes = snapshot["resumenes_diarios"];
  if (isRecord(resumenes)) {
    const steps = resumenes["steps"];
    if (isRecord(steps)) {
      const rollup = steps["rollupDataPoints"];
      if (Array.isArray(rollup) && rollup.length > 0) {
        const p0 = rollup[0];
        if (isRecord(p0)) {
          const st = p0["steps"];
          if (isRecord(st) && typeof st["countSum"] === "number") {
            resumen["pasos"] = st["countSum"];
          }
        }
      }
    }
    const cal = resumenes["total-calories"];
    if (isRecord(cal)) {
      const rollup = cal["rollupDataPoints"];
      if (Array.isArray(rollup) && rollup.length > 0) {
        const p0 = rollup[0];
        if (isRecord(p0)) {
          const tc = p0["totalCalories"];
          if (isRecord(tc) && typeof tc["caloriesKcalSum"] === "number") {
            resumen["calorias_total"] = Math.round(tc["caloriesKcalSum"] * 10) / 10;
          }
        }
      }
    }
    const azm = resumenes["active-zone-minutes"];
    if (isRecord(azm)) {
      const rollup = azm["rollupDataPoints"];
      if (Array.isArray(rollup) && rollup.length > 0) {
        const p0 = rollup[0];
        if (isRecord(p0)) {
          const z = p0["activeZoneMinutes"];
          if (isRecord(z) && typeof z["minutesSum"] === "number") {
            resumen["active_zone_min"] = z["minutesSum"];
          }
        }
      }
    }
  }

  const rend = snapshot["rendimiento"];
  if (isRecord(rend)) {
    const vo2 = rend["daily-vo2-max"];
    if (Array.isArray(vo2) && vo2.length > 0) {
      const last = vo2[vo2.length - 1];
      if (isRecord(last)) {
        const d = last["dailyVo2Max"];
        if (isRecord(d) && typeof d["mlPerKgPerMin"] === "number") {
          resumen["vo2_max"] = d["mlPerKgPerMin"];
        }
      }
    }
  }

  const corp = snapshot["corporales"];
  if (isRecord(corp)) {
    const pesos = corp["weight"];
    if (Array.isArray(pesos) && pesos.length > 0) {
      const last = pesos[pesos.length - 1];
      if (isRecord(last)) {
        const w = last["weight"];
        if (isRecord(w) && typeof w["weightKilograms"] === "number") {
          resumen["peso_actual_kg"] = Math.round(w["weightKilograms"] * 10) / 10;
        }
      }
    }
  }

  return resumen;
}

async function listChildren(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<readonly drive_v3.Schema$File[]> {
  const q = `'${escapeDriveQueryLiteral(parentId)}' in parents and trashed=false`;
  const out: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 1000,
      pageToken,
    });
    const files = res.data.files;
    if (Array.isArray(files)) {
      out.push(...files);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

function isFolder(f: drive_v3.Schema$File): boolean {
  return f.mimeType === "application/vnd.google-apps.folder";
}

async function downloadText(drive: drive_v3.Drive, fileId: string): Promise<string> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" },
  );
  if (typeof res.data !== "string") {
    throw new Error(`Descarga texto inesperada para fileId=${fileId}`);
  }
  return res.data;
}

async function downloadBuffer(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  const d = res.data;
  if (d instanceof ArrayBuffer) {
    return Buffer.from(d);
  }
  if (Buffer.isBuffer(d)) {
    return d;
  }
  throw new Error(`Descarga binaria inesperada para fileId=${fileId}`);
}

async function findChildFolderId(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string | null> {
  const children = await listChildren(drive, parentId);
  for (const f of children) {
    if (f.id && f.name === name && isFolder(f)) {
      return f.id;
    }
  }
  return null;
}

async function resolveContextFolder(drive: drive_v3.Drive, rootId: string): Promise<string> {
  const id = await findChildFolderId(drive, rootId, CTX);
  if (!id) {
    throw new Error(`No se encontró carpeta ${CTX} bajo FOLDER_SALUD_ID.`);
  }
  return id;
}

async function upsertBiometria(
  supabase: SupabaseClient,
  rawJson: unknown,
  driveFileId: string | null,
): Promise<void> {
  const data = BiometriaMaestroJsonSchema.parse(rawJson);
  const row = {
    id: "singleton",
    nombre: data.identidad.nombre,
    fecha_nacimiento: data.identidad.fecha_nacimiento,
    edad_anos: data.identidad.edad_anos,
    sexo: data.identidad.sexo,
    altura_cm: data.identidad.altura_cm,
    peso_kg: data.biometria_actual.peso_kg,
    fecha_ultimo_pesaje: data.biometria_actual.fecha_ultimo_pesaje,
    imc: data.biometria_actual.imc,
    body_fat_estimado_pct: data.biometria_actual.body_fat_estimado_pct,
    masa_libre_grasa_kg: data.biometria_actual.masa_libre_grasa_kg,
    tendencia_peso_7dias_kg: data.biometria_actual.tendencia_peso_7dias_kg,
    objetivo_tipo: data.objetivo.tipo,
    kcal_target: data.objetivo.kcal_target,
    proteina_g: data.objetivo.proteina_g,
    grasa_g: data.objetivo.grasa_g,
    carbos_g: data.objetivo.carbos_g,
    creatina_g: data.objetivo.creatina_g,
    agua_l: data.objetivo.agua_l,
    fecha_ultimo_recalculo: data.objetivo.fecha_ultimo_recalculo,
    hrv_baseline_7d: data.guardarrailes_activos.hrv_baseline_7d ?? null,
    peso_baseline_2sem: data.guardarrailes_activos.peso_baseline_2sem ?? null,
    ultimo_top_set_squat: data.guardarrailes_activos.ultimo_top_set_squat ?? null,
    ultimo_top_set_press: data.guardarrailes_activos.ultimo_top_set_press ?? null,
    bandera_roja: data.guardarrailes_activos.bandera_roja,
    motivo_bandera_roja: data.guardarrailes_activos.motivo_bandera_roja ?? null,
    ultimo_chequeo: data.guardarrailes_activos.ultimo_chequeo,
    memoria_corta_7dias: data.memoria_corta_7dias,
    drive_file_id: driveFileId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("biometria_maestro").upsert(row, { onConflict: "id" });
  if (error) {
    throw new Error(`Upsert biometria_maestro: ${error.message}`);
  }
}

function csvCell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === undefined || v === null) {
    return "";
  }
  if (typeof v === "string") {
    return v;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v);
  }
  return "";
}

async function ingestCsvEntrenos(
  supabase: SupabaseClient,
  csvText: string,
  driveFileId: string,
): Promise<number> {
  const recordsUnknown: unknown = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  const records = z.array(z.record(z.unknown())).parse(recordsUnknown);

  let n = 0;
  for (const row of records) {
    const dateRaw = csvCell(row, "Date").trim();
    if (dateRaw.length < 10) {
      continue;
    }
    const sessionDate = dateRaw.slice(0, 10);
    const title = csvCell(row, "Title").trim();
    const duration = csvCell(row, "Duration").trim();
    const exercise = csvCell(row, "Exercise").trim();
    const setType = csvCell(row, "Set Type").trim();
    const weight = csvCell(row, "Weight").trim();
    const reps = csvCell(row, "Reps").trim();
    const fp = rowFingerprint([
      "drive_csv",
      driveFileId,
      sessionDate,
      title,
      exercise,
      setType,
      weight,
      reps,
    ]);
    const weightKg = parseWeightKg(weight);
    const payload: Record<string, unknown> = { ...row };
    const { error } = await supabase.from("entrenos_historico").upsert(
      {
        origen: "drive_csv",
        drive_file_id: driveFileId,
        row_fingerprint: fp,
        session_date: sessionDate,
        session_title: title,
        duration_text: duration,
        exercise,
        set_type: setType,
        weight_raw: weight,
        weight_kg: weightKg,
        reps,
        raw_payload: payload,
      },
      { onConflict: "origen,row_fingerprint" },
    );
    if (error) {
      throw new Error(`Upsert entrenos_historico CSV: ${error.message}`);
    }
    n += 1;
  }
  return n;
}

async function uploadStoragePath(
  supabase: SupabaseClient,
  bucket: "health_raw_json" | "archivos_crudos",
  objectPath: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(objectPath, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Storage ${bucket}/${objectPath}: ${error.message}`);
  }
}

function storagePathParts(year: string, monthFolder: string, dayFolder: string, sub: string, fileName: string): string {
  return `${year}/${monthFolder}/${dayFolder}/${sub}/${fileName}`.replace(/\/+/g, "/");
}

function pickNum(r: Record<string, unknown>, k: string): number | null {
  const v = r[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickInt(r: Record<string, unknown>, k: string): number | null {
  const v = r[k];
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}

async function processHealthRawJsonFile(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
  year: string,
  monthFolder: string,
  dayFolder: string,
): Promise<void> {
  if (!file.id || !file.name) {
    return;
  }
  const buf = await downloadBuffer(drive, file.id);
  const rawUnknown: unknown = JSON.parse(buf.toString("utf-8"));
  if (!isRecord(rawUnknown)) {
    throw new Error(`JSON health inválido: ${file.name}`);
  }
  const fechaVal = rawUnknown["fecha"];
  const fecha =
    typeof fechaVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaVal) ? fechaVal : null;
  const generadoVal = rawUnknown["generado_en"];
  const generado_en = typeof generadoVal === "string" ? generadoVal : null;
  const pulseraVal = rawUnknown["pulsera_activa"];
  const pulsera_activa = typeof pulseraVal === "boolean" ? pulseraVal : false;
  const resumen = extractTelemetriaCritica(rawUnknown);

  const objectPath = storagePathParts(year, monthFolder, dayFolder, "snapshots", file.name);
  await uploadStoragePath(supabase, "health_raw_json", objectPath, buf, "application/json");

  if (!fecha) {
    return;
  }
  const { error } = await supabase.from("telemetria_diaria").upsert(
    {
      fecha,
      pulsera_activa,
      generado_en,
      sueno_horas: pickNum(resumen, "sueno_horas"),
      sueno_eficiencia: pickNum(resumen, "sueno_eficiencia"),
      sueno_rem_min: pickInt(resumen, "sueno_rem_min"),
      sueno_profundo_min: pickInt(resumen, "sueno_profundo_min"),
      hrv_diario: pickNum(resumen, "hrv_diario"),
      frecuencia_reposo_bpm: pickInt(resumen, "frecuencia_reposo_bpm"),
      spo2_promedio_pct: pickNum(resumen, "spo2_promedio_pct"),
      pasos: pickInt(resumen, "pasos"),
      calorias_total: pickNum(resumen, "calorias_total"),
      active_zone_min: pickInt(resumen, "active_zone_min"),
      vo2_max: pickNum(resumen, "vo2_max"),
      peso_actual_kg: pickNum(resumen, "peso_actual_kg"),
      resumen_critico: resumen,
      snapshot_completo: rawUnknown,
      drive_json_file_id: file.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fecha" },
  );
  if (error) {
    throw new Error(`Upsert telemetria_diaria: ${error.message}`);
  }
}

async function processLyftaRawFile(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
  year: string,
  monthFolder: string,
  dayFolder: string,
): Promise<void> {
  if (!file.id || !file.name) {
    return;
  }
  const buf = await downloadBuffer(drive, file.id);
  const objectPath = storagePathParts(year, monthFolder, dayFolder, "lyfta_raw", file.name);
  const mime = file.mimeType ?? "application/octet-stream";
  await uploadStoragePath(supabase, "archivos_crudos", objectPath, buf, mime);

  const origen: EntrenoOrigen = "lyfta_raw";
  const fp = rowFingerprint([origen, file.id, file.name]);
  const isoFromName = (() => {
    const m = file.name.match(/(\d{2})_(\d{2})_(\d{4})/);
    if (!m || !m[1] || !m[2] || !m[3]) {
      return null;
    }
    const dd = m[1];
    const mm = m[2];
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  })();
  const { error } = await supabase.from("entrenos_historico").upsert(
    {
      origen,
      drive_file_id: file.id,
      row_fingerprint: fp,
      session_date: isoFromName ?? "1970-01-01",
      session_title: file.name,
      duration_text: "",
      exercise: "",
      set_type: "",
      weight_raw: "",
      weight_kg: null,
      reps: "",
      raw_payload: { fileName: file.name, storagePath: objectPath },
    },
    { onConflict: "origen,row_fingerprint" },
  );
  if (error) {
    throw new Error(`Upsert entrenos_historico LYFTA raw: ${error.message}`);
  }
}

async function processReporteHtml(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
): Promise<void> {
  if (!file.id || !file.name) {
    return;
  }
  const meta = parseReporteHtmlNombre(file.name);
  if (!meta) {
    return;
  }
  const html = await downloadText(drive, file.id);
  const { error } = await supabase.from("reportes_html").upsert(
    {
      fecha: meta.fecha,
      tipo: meta.tipo,
      nombre_archivo: file.name,
      drive_file_id: file.id,
      html_content: html,
    },
    { onConflict: "fecha,tipo" },
  );
  if (error) {
    throw new Error(`Upsert reportes_html: ${error.message}`);
  }
}

async function processMemoriaIa(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
): Promise<void> {
  if (!file.id || !file.name) {
    return;
  }
  const txt = await downloadText(drive, file.id);
  const lineas = parseHistoricoIaLineas(txt);
  for (const ln of lineas) {
    const eventTsIso = ((): string | null => {
      if (ln.event_ts === null) {
        return null;
      }
      const ms = Date.parse(ln.event_ts);
      if (Number.isNaN(ms)) {
        return null;
      }
      return new Date(ms).toISOString();
    })();
    const { error } = await supabase.from("memoria_ia").upsert(
      {
        drive_file_id: file.id,
        source_filename: file.name,
        line_index: ln.line_index,
        event_ts: eventTsIso,
        contenido_linea: ln.contenido_linea,
      },
      { onConflict: "drive_file_id,line_index" },
    );
    if (error) {
      throw new Error(`Upsert memoria_ia: ${error.message}`);
    }
  }
}

async function processDayFolder(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
  dayFolderId: string,
  year: string,
  monthFolder: string,
  dayFolderName: string,
): Promise<void> {
  const children = await listChildren(drive, dayFolderId);
  const sub = (name: string) => children.find((c) => c.name === name && isFolder(c));

  const lyfta = sub(SUB_LYFTA);
  if (lyfta?.id) {
    const files = await listChildren(drive, lyfta.id);
    for (const f of files) {
      if (isFolder(f) || !f.id || !f.name) {
        continue;
      }
      await processLyftaRawFile(supabase, drive, f, year, monthFolder, dayFolderName);
    }
  }

  const rep = sub(SUB_REPORTES);
  if (rep?.id) {
    const files = await listChildren(drive, rep.id);
    for (const f of files) {
      if (isFolder(f) || !f.id || !f.name) {
        continue;
      }
      if (f.name.toLowerCase().endsWith(".html")) {
        await processReporteHtml(supabase, drive, f);
      }
    }
  }

  const health = sub(SUB_HEALTH_RAW);
  if (health?.id) {
    const files = await listChildren(drive, health.id);
    for (const f of files) {
      if (isFolder(f) || !f.id || !f.name) {
        continue;
      }
      if (f.name.toLowerCase().endsWith(".json")) {
        await processHealthRawJsonFile(supabase, drive, f, year, monthFolder, dayFolderName);
      }
    }
  }
}

async function processMonthFolder(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
  monthFolderId: string,
  year: string,
  monthFolderName: string,
): Promise<void> {
  const children = await listChildren(drive, monthFolderId);
  for (const f of children) {
    if (!f.id || !f.name) {
      continue;
    }
    if (isFolder(f) && DAY_FOLDER_RE.test(f.name)) {
      await processDayFolder(supabase, drive, f.id, year, monthFolderName, f.name);
    }
    if (!isFolder(f) && f.name.startsWith("HISTORICO_IA_") && f.name.toLowerCase().endsWith(".txt")) {
      await processMemoriaIa(supabase, drive, f);
    }
  }
}

async function processYearFolder(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
  yearFolderId: string,
  yearName: string,
): Promise<void> {
  const children = await listChildren(drive, yearFolderId);
  for (const f of children) {
    if (f.id && isFolder(f) && MONTH_FOLDER_RE.test(f.name ?? "")) {
      await processMonthFolder(supabase, drive, f.id, yearName, f.name ?? "");
    }
  }
}

async function resolveMaestroFileId(
  drive: drive_v3.Drive,
  ctxId: string,
): Promise<string> {
  const envId = process.env[FILE_ID_MAESTRO_ENV]?.trim();
  if (envId) {
    return envId;
  }
  const children = await listChildren(drive, ctxId);
  const hit = children.find((c) => c.name === "BIOMETRIA_MAESTRO.json" && !isFolder(c));
  if (hit?.id) {
    return hit.id;
  }
  throw new Error(
    `No se encontró BIOMETRIA_MAESTRO.json en ${CTX} y ${FILE_ID_MAESTRO_ENV} no está definido.`,
  );
}

async function resolveCsvFileId(drive: drive_v3.Drive, ctxId: string): Promise<string | null> {
  const children = await listChildren(drive, ctxId);
  const hit = children.find(
    (c) => !isFolder(c) && (c.name ?? "").includes("ENTRENOS") && (c.name ?? "").toLowerCase().endsWith(".csv"),
  );
  return hit?.id ?? null;
}

async function resolveRutinaFileId(drive: drive_v3.Drive, ctxId: string): Promise<string | null> {
  const children = await listChildren(drive, ctxId);
  const hit = children.find((c) => !isFolder(c) && c.name === "RUTINA_OFICIAL.md");
  return hit?.id ?? null;
}

async function main(): Promise<void> {
  const oauth2 = mergeOAuthCredentials();
  const drive = google.drive({ version: "v3", auth: oauth2 });
  const supabase = createSupabase();
  const rootId = requireEnv(FOLDER_SALUD_ENV);

  const ctxId = await resolveContextFolder(drive, rootId);
  console.log(`[ctx] ${CTX} id=${ctxId}`);

  const maestroId = await resolveMaestroFileId(drive, ctxId);
  const maestroJsonText = await downloadText(drive, maestroId);
  const maestroUnknown: unknown = JSON.parse(maestroJsonText);
  await upsertBiometria(supabase, maestroUnknown, maestroId);
  console.log("[ok] biometria_maestro");

  const csvId = await resolveCsvFileId(drive, ctxId);
  if (csvId) {
    const csvText = await downloadText(drive, csvId);
    const n = await ingestCsvEntrenos(supabase, csvText, csvId);
    console.log(`[ok] entrenos_historico (csv filas upsert=${n})`);
  } else {
    console.warn("[skip] No se encontró CSV ENTRENOS*.csv en contexto.");
  }

  const rutinaId = await resolveRutinaFileId(drive, ctxId);
  if (rutinaId) {
    const md = await downloadText(drive, rutinaId);
    const dias = parseRutinaOficialMarkdown(md);
    for (const d of dias) {
      const { error } = await supabase.from("rutina_oficial").upsert(
        {
          dia: d.dia,
          nombre_dia: d.nombre_dia,
          grupo_sesion: d.grupo_sesion,
          hidratacion_gym: d.hidratacion_gym,
          ejercicios_markdown: d.ejercicios_markdown,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: "dia" },
      );
      if (error) {
        throw new Error(`Upsert rutina_oficial: ${error.message}`);
      }
    }
    console.log(`[ok] rutina_oficial (${dias.length} filas)`);
  } else {
    console.warn("[skip] RUTINA_OFICIAL.md no encontrado en Drive.");
  }

  const rootChildren = await listChildren(drive, rootId);
  for (const f of rootChildren) {
    if (f.id && isFolder(f) && YEAR_FOLDER_RE.test(f.name ?? "")) {
      const y = f.name ?? "";
      const yNum = Number(y);
      if (yNum >= 2000 && yNum <= 2100) {
        await processYearFolder(supabase, drive, f.id, y);
        console.log(`[ok] año ${y} procesado`);
      }
    }
  }

  console.log("[fin] Migración completada (re-ejecutable: upserts idempotentes).");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[error]", msg);
  process.exitCode = 1;
});
