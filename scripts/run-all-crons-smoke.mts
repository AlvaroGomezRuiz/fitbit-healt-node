/**
 * Smoke HTTP: dispara GET de todas las rutas cron (vercel.json + árbol apps/web/app/api/cron).
 * Uso (servidor Next en marcha con mismas env): `rtk npm run cron:smoke` o `rtk npx tsx scripts/run-all-crons-smoke.mts` (alternativa `rtk node scripts/run-all-crons-smoke.mts` si tu Node ejecuta TS nativamente).
 */
import { config as loadDotenv } from "dotenv";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const vercelCronFileSchema = z.object({
  crons: z.array(z.object({ path: z.string(), schedule: z.string() })),
});

/** Orden sugerido para encadenar dependencias lógicas (telemetría → nutrición → informes). */
const PREFERRED_ORDER: readonly string[] = [
  "/api/cron/fitbit-telemetria-pull",
  "/api/cron/daily-nutrition-routine",
  "/api/cron/pre-entreno",
  "/api/cron/nutrition-shopping-weekly",
  "/api/cron/post-entreno",
  "/api/cron/resumen-noche",
];

function loadEnvFiles(): void {
  const webLocal = join(REPO_ROOT, "apps", "web", ".env.local");
  const rootEnv = join(REPO_ROOT, ".env");
  loadDotenv({ path: webLocal });
  loadDotenv({ path: rootEnv, override: false });
}

function resolveBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (fromEnv !== undefined && fromEnv !== "") {
    if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
      return fromEnv.replace(/\/+$/, "");
    }
    return `https://${fromEnv.replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

async function pathsFromVercelJson(): Promise<readonly string[]> {
  const raw = await readFile(join(REPO_ROOT, "vercel.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  const v = vercelCronFileSchema.safeParse(parsed);
  if (!v.success) {
    console.warn("[warn] vercel.json: sin array `crons` válido; solo rutas del árbol.");
    return [];
  }
  const unique = new Set<string>();
  for (const c of v.data.crons) {
    const p = c.path.startsWith("/") ? c.path : `/${c.path}`;
    unique.add(p);
  }
  return [...unique];
}

async function pathsFromAppTree(): Promise<readonly string[]> {
  const cronRoot = join(REPO_ROOT, "apps", "web", "app", "api", "cron");
  const out: string[] = [];
  try {
    const entries = await readdir(cronRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) {
        continue;
      }
      const seg = String(e.name);
      const routeFile = join(cronRoot, seg, "route.ts");
      try {
        await stat(routeFile);
      } catch {
        continue;
      }
      out.push(`/api/cron/${seg}`);
    }
  } catch {
    return out;
  }
  return out;
}

function sortCronPaths(paths: ReadonlySet<string>): string[] {
  const ordered: string[] = [];
  for (const p of PREFERRED_ORDER) {
    if (paths.has(p)) {
      ordered.push(p);
    }
  }
  const rest = [...paths].filter((p) => !ordered.includes(p)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

function truncateBody(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

async function smokeOne(params: {
  readonly baseUrl: string;
  readonly path: string;
  readonly secret: string | undefined;
}): Promise<void> {
  const url = `${params.baseUrl}${params.path}`;
  const headers: Record<string, string> = {};
  if (params.secret !== undefined && params.secret !== "") {
    headers.Authorization = `Bearer ${params.secret}`;
  }
  let status = 0;
  let text = "";
  try {
    const res = await fetch(url, { method: "GET", headers });
    status = res.status;
    text = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`${params.path}  ERROR  ${msg}`);
    return;
  }
  const preview = truncateBody(text.replace(/\s+/g, " ").trim(), 200);
  console.log(`${params.path}  ${String(status)}  ${preview}`);
  if (status < 200 || status >= 300) {
    if (text.length <= 2000) {
      console.log(`--- body (${params.path}) ---\n${text}\n---`);
    } else {
      console.log(`--- body truncado (${params.path}, len=${String(text.length)}) ---\n${truncateBody(text, 2000)}\n---`);
    }
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  const baseUrl = resolveBaseUrl();
  const secret = process.env.CRON_SECRET;
  if (secret === undefined || secret.trim() === "") {
    console.warn("[warn] CRON_SECRET vacío: muchas rutas responderán 401 o skipped.");
  }

  const fromVercel = await pathsFromVercelJson();
  const fromTree = await pathsFromAppTree();
  const merged = new Set<string>([...fromVercel, ...fromTree]);
  const ordered = sortCronPaths(merged);

  console.log(`Base: ${baseUrl}`);
  console.log(`Rutas (${String(ordered.length)}): ${ordered.join(", ")}`);
  for (const p of ordered) {
    await smokeOne({ baseUrl, path: p, secret });
  }
}

await main();
