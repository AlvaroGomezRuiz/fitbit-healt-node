/**
 * Genera migración SQL de seed para `public.rutina_oficial`.
 * Ejecutar desde la raíz del repo: `node scripts/build-rutina-seed.mjs`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = join(root, "RUTINA_OFICIAL.md");
const outPath = join(root, "supabase", "migrations", "20260204120100_db01_seed_rutina_oficial.sql");

const full = readFileSync(mdPath, "utf8");

const lines = full.split(/\r?\n/);
const header = lines.slice(0, 26).join("\n"); // hasta codificación Lyfta
const pull = lines.slice(26, 59).join("\n"); // ## PULL … hasta reverse fly
const push = lines.slice(61, 96).join("\n"); // ## PUSH …
const leg = lines.slice(98, 139).join("\n"); // ## LEG …
const footer = lines.slice(141).join("\n"); // reglas globales

function combine(main) {
  return `${header}\n\n${main}\n\n${footer}`;
}

const mdPull = combine(pull);
const mdPush = combine(push);
const mdLeg = combine(leg);

function dollarQuote(tag, body) {
  if (body.includes(tag)) {
    throw new Error(`El cuerpo contiene el delimitador ${tag}`);
  }
  return tag + body + tag;
}

const qPull = dollarQuote("$pull_md$", mdPull);
const qPush = dollarQuote("$push_md$", mdPush);
const qLeg = dollarQuote("$leg_md$", mdLeg);
const qRest = dollarQuote(
  "$rest_md$",
  `${header}\n\n## Descanso — sábado y domingo\nCardio suave opcional. Sin sesión de hipertrofia.\n\n${footer}`,
);

const sql = `-- Seed idempotente: rutina semanal (markdown alineado a RUTINA_OFICIAL.md).
begin;

delete from public.rutina_oficial;

insert into public.rutina_oficial (dia, nombre_dia, grupo_sesion, hidratacion_gym, ejercicios_markdown)
values
  ('MON', 'Lunes', 'PULL', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', ${qPull}),
  ('TUE', 'Martes', 'PUSH', 'Agua de coco', ${qPush}),
  ('WED', 'Miércoles', 'LEG', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', ${qLeg}),
  ('THU', 'Jueves', 'PULL', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', ${qPull}),
  ('FRI', 'Viernes', 'PUSH', 'Agua de coco', ${qPush}),
  ('SAT', 'Sábado', 'DESCANSO', null, ${qRest}),
  ('SUN', 'Domingo', 'DESCANSO', null, ${qRest});

commit;
`;

writeFileSync(outPath, sql, "utf8");
console.log("Escrito:", outPath);
