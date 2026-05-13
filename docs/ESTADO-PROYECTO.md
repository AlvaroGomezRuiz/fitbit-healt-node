# Estado del proyecto — documento único (`docs/`)

**Fecha:** 2026-05-13  
**Alcance:** estado del código y del despliegue según revisión del repositorio; sustituye y absorbe el contenido útil de los antiguos `NEXT_STEPS.md`, `phase2-ai.md`, `phase3-shell.md`, `repo-hygiene-report.md` y `cursorignore-patch.md`. Lo marcado como **por verificar** conviene contrastarlo en tu máquina o en Vercel/Supabase.

---

## 1. Resumen ejecutivo

**Fitbit-Healt-Node** combina un backend Python histórico (`src/`, FastAPI, Docker), datos en **Supabase** (Postgres, Storage, Auth), una app **Next.js** (App Router) en `apps/web/`, cliente **DeepSeek** compartido (`lib/ai/` + reexport en web) y scripts TypeScript (p. ej. `scripts/migrate_from_drive.ts`).

La web ya está **cableada** a Supabase (lecturas con anon/cookies, escrituras sensibles con service role donde aplica), Server Actions, rutas de nutrición/entrenador/salud, crons en `vercel.json` y rutas bajo `apps/web/app/api/cron/`. La descripción de “solo mock sin datos” **ya no aplica** al producto actual.

---

## 2. Mapa del repositorio

| Ruta | Rol |
|------|-----|
| `src/` | FastAPI, dominio e ingest Python; imagen Docker mínima (no incluye `apps/web`). |
| `apps/web/` | Next: `app/` (rutas, `api/cron/*`, `api/health/*`, `api/fitbit/*`), Server Actions, `components/features/*`, `lib/data/*`, `lib/ai/*`, Supabase helpers. |
| `lib/ai/` (raíz) | Cliente DeepSeek y configuración compartidos con scripts (`smoke_deepseek.ts`, etc.). |
| `scripts/` | `migrate_from_drive.ts`, utilidades Python listadas en README. |
| `supabase/migrations/` | DDL y políticas RLS evolutivas (ver §6). |
| `vercel.json` (raíz) | Crons que invocan por GET rutas en `apps/web`. |

No hay carpetas top-level `frontend/` ni `web/`; la UI vive en **`apps/web/`**.

---

## 3. Qué está hecho (verificado en código)

- **Supabase en web:** clientes servidor/anon; `SUPABASE_SERVICE_ROLE_KEY` para operaciones que deben ignorar RLS (cron nutrición, Lyfta según acciones, etc.). Validación estricta de host `NEXT_PUBLIC_SUPABASE_URL` (no URL del dashboard).
- **Rutas principales:** inicio, `/nutrition` (día Madrid, biometría, telemetría con flag Fitbit, memoria compra, **`diario_plan_ia`** vía `fetchNutritionDay`), `/trainer` (rutina, Lyfta, IA), `/health`, login/callback Supabase.
- **Lyfta:** upsert en `entrenos_historico` con fingerprint; análisis IA opcional.
- **Nutrición:** prompts y acciones (`nutrition-shopping`, domingo Madrid); datos del plan diario IA desde tabla `diario_plan_ia`.
- **Cron `daily-nutrition-routine`:** `GET` valida `CRON_SECRET`, flag `CRON_DAILY_NUTRITION_DEEPSEEK`, llama a DeepSeek y hace **upsert** en `diario_plan_ia` (`fecha` Madrid + markdown). **Cron `pre-entreno`:** dos disparos UTC (`0 7` y `0 8`) con **guardia de ventana civil Madrid** `[08:55, 09:15)` (configurable con `CRON_PRE_ENTRENO_WINDOW`); solo dentro de la ventana, con `CRON_PRE_ENTRENO_DEEPSEEK` y datos Supabase, genera HTML y **upsert** en `reportes_html` (`PRE_ENTRENO`, `fecha` = hoy Madrid). **Cron `fitbit-telemetria-pull`:** `40 6` y `40 7` UTC + ventana `[08:35, 08:50)` Madrid; con `FITBIT_ACTIVO` + `FITBIT_INGEST_ENABLED` deja hook TODO hasta cliente de fetch (telemetría previa al pre-entreno). **Cron `resumen-noche`:** `handleCronDeepSeekGet` (requiere `FITBIT_ACTIVO` además de key y flag).
- **IA TS:** `runDeepSeekCascade` en `lib/ai/deepseek-cascade.ts`, reexport en web.
- **Fitbit / telemetría:** flags centralizados en `parseFitbitFeatureFlagsFromEnv` / maestro `FITBIT_ACTIVO` (`apps/web/lib/fitbit/config.ts`).
- **Webhook Google Health:** `POST /api/health/google` con `HEALTH_WEBHOOK_SECRET` (cabecera o query según implementación en `route.ts`).

---

## 4. Stack

| Capa | Tecnología |
|------|------------|
| Backend clásico | Python 3, FastAPI, Docker (`requirements.txt`, `Dockerfile`). |
| Datos | Supabase Postgres + Storage + Auth; migraciones versionadas en `supabase/migrations/`. |
| Web | Next.js App Router, React, Tailwind, Zod en límites. |
| IA | API DeepSeek (cascada configurable env). |
| Monorepo ligero | `package.json` en raíz (scripts TS + deps) y `apps/web/package.json` (Next). |

---

## 5. Variables de entorno (solo nombres; nunca valores en docs)

### `apps/web` (local `.env.local` / Vercel)

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Sitio:** `NEXT_PUBLIC_SITE_URL` (login/callback).
- **Crons:** `CRON_SECRET`; `CRON_PRE_ENTRENO_DEEPSEEK`, `CRON_PRE_ENTRENO_WINDOW` (opcional, formato `HH:MM-HH:MM` fin exclusivo; por defecto `08:55-09:15` civil Madrid), `CRON_RESUMEN_NOCHE_DEEPSEEK`, `CRON_DAILY_NUTRITION_DEEPSEEK` (valores tipo `1` / `true` / `yes` / `on`).
- **DeepSeek:** `DEEPSEEK_API_KEY`; opcionales `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL_CASCADE`, `DEEPSEEK_MODEL_COMPLEX`, `DEEPSEEK_MAX_RETRIES`, `DEEPSEEK_BACKOFF_BASE_MS`, `DEEPSEEK_BACKOFF_MAX_MS`, `DEEPSEEK_TIMEOUT_MS`.
- **Fitbit / telemetría UI:** `FITBIT_ACTIVO`; `NEXT_PUBLIC_FITBIT_UI_ENABLED`, `FITBIT_INGEST_ENABLED`, `FITBIT_SYNC_ENABLED` (comportamiento detallado en `parseFitbitFeatureFlagsFromEnv`).
- **Webhook salud:** `HEALTH_WEBHOOK_SECRET`.

### Raíz (scripts, p. ej. migración Drive)

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `FOLDER_SALUD_ID`, `GOOGLE_OAUTH_TOKEN_JSON` (o `token.json` en disco), opcional `FILE_ID_MAESTRO`
- Credenciales OAuth en `secrets/credenciales_oauth.json` si el token no trae `client_id` / `client_secret` (**no** versionar secretos).

### Smoke DeepSeek (raíz)

- `DEEPSEEK_API_KEY` y las opcionales de §5 (mismo módulo `lib/ai`).

### Checklist despliegue Vercel (solo nombres)

Comprueba en el panel de Vercel (Proyecto → Settings → Environment Variables) que existan las variables que usa el código en el entorno objetivo. Tras **crear o rotar** un secreto, fuerza un **redeploy** del último deployment; no asumas que crons ni Server Actions leen valores nuevos hasta que haya un despliegue activo con el env actualizado.

- **Supabase (app web):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Sitio / callbacks:** `NEXT_PUBLIC_SITE_URL`
- **Crons:** `CRON_SECRET`; `CRON_DAILY_NUTRITION_DEEPSEEK`, `CRON_PRE_ENTRENO_DEEPSEEK`, `CRON_PRE_ENTRENO_WINDOW` (opcional), `CRON_RESUMEN_NOCHE_DEEPSEEK`
- **IA:** `DEEPSEEK_API_KEY` (y, si las usas en prod, las opcionales de modelo/cascada listadas arriba en §5)
- **Fitbit / telemetría (si aplica):** `FITBIT_ACTIVO`, `FITBIT_INGEST_ENABLED`, `FITBIT_SYNC_ENABLED`, `NEXT_PUBLIC_FITBIT_UI_ENABLED`
- **Webhook salud:** `HEALTH_WEBHOOK_SECRET`

### `scripts/migrate_from_drive.ts` (Google Drive → Supabase)

**Ubicación:** `scripts/migrate_from_drive.ts`. **Ejecución (RTK):** desde la raíz del repo, `rtk npm run migrate:drive` (o con comprobación sin escrituras: `rtk npm run migrate:drive -- --dry-run`).

**Variables (raíz `.env`):** `FOLDER_SALUD_ID` (ID de la carpeta raíz «SALUD» en Drive), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. OAuth: `GOOGLE_OAUTH_TOKEN_JSON` (JSON en una línea o ruta a fichero) o `token.json` en la raíz del repo; si el token no incluye `client_id` / `client_secret`, el script puede usar `secrets/credenciales_oauth.json` (Desktop) — **no** versionar secretos. Opcional: `FILE_ID_MAESTRO` para `BIOMETRIA_MAESTRO.json`; si no se define, el script busca bajo la subcarpeta lógica `00_CONTEXTO_HISTORICO`.

**Estructura esperada en Google Drive (contrato del script):**

- **Raíz** = carpeta cuyo ID es `FOLDER_SALUD_ID` (típicamente «SALUD»).
- **Contexto fijo:** subcarpeta exacta `00_CONTEXTO_HISTORICO` con:
  - `BIOMETRIA_MAESTRO.json` (obligatorio salvo `FILE_ID_MAESTRO`),
  - opcional: un CSV cuyo nombre contenga `ENTRENOS` y termine en `.csv`,
  - opcional: `RUTINA_OFICIAL.md`.
- **Por año:** bajo la misma raíz SALUD, carpetas con nombre solo año `YYYY` (2000–2100).
- **Por mes:** dentro de cada año, carpetas `MM_<nombre>` (dos dígitos + `_` + nombre; admite tildes en el nombre).
- **Por día:** dentro de cada mes, carpetas con nombre **`DD_MM_YYYY`** (ej. `13_05_2026`).
- **Dentro de cada día:**
  - `01_LYFTA_RAW/` → archivos binarios (Lyfta),
  - `02_RESUMEN_DIARIO_IA/` → `.html` con nombres que indiquen `pre_entreno`, `post_entreno` o `resumen_noche` y fecha `YYYY-MM-DD`,
  - `04_HEALTH_RAW/` → archivos `.json` de snapshot salud,
- **Memoria IA:** archivos `HISTORICO_IA_*.txt` pueden colgar **directamente** del mes (no solo del día).

**OAuth (no 100 % automático):** hace falta un token de usuario con **`refresh_token`** (flujo Desktop/local; p. ej. `scripts/oauth_setup.py`). Sin ese refresh almacenado, el consentimiento en navegador no se puede sustituir por variables de entorno solas. El script valida al inicio que Google emite `access_token` (refresh implícito vía librería).

**Dry-run:** `rtk npm run migrate:drive -- --dry-run` — comprueba Drive + lectura mínima a Supabase **sin** escrituras.

**Plantillas env:** `.env.example` en la **raíz** del repo y `apps/web/.env.example` para la app Next.

**SQL:** el script **no** aplica migraciones de Postgres; antes deben estar aplicadas las de `supabase/migrations/` (§6).

---

## 6. Migraciones Supabase (`supabase/migrations/`)

### Inventario de archivos (10 en repo; orden por timestamp)

Aplicar en **todos** los entornos el conjunto que exista en `supabase/migrations/` al desplegar.

1. `20260513120000_phase1_core_tables.sql`
2. `20260513120100_phase1_storage_buckets.sql`
3. `20260513120500_phase1_anon_web_policies.sql`
4. `20260513120600_phase1_anon_telemetria_web_policies.sql`
5. `20260513120600_phase1_auth_profiles_stub.sql`
6. `20260515140000_phase1_seed_rutina_oficial_defaults.sql`
7. `20260516120000_phase1_revoke_public_rpc_trigger_helpers.sql`
8. `20260517120000_phase1_anon_biometria_singleton_entrenos_lyfta_update.sql`
9. `20260518100000_phase1_anon_select_entrenos_historico_lyfta.sql`
10. `20260518120000_phase1_diario_plan_ia.sql`

### Aplicar migraciones

- **CI (push a `main` / `master`):** el workflow `.github/workflows/supabase-migrations.yml` enlaza el proyecto con `supabase link --project-ref …` y ejecuta `supabase db push --linked` de forma no interactiva usando `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` (ver **Secrets GitHub** abajo). **No** sustituye revisar el SQL antes de fusionar PRs que toquen `supabase/migrations/`.
- **CLI local:** con [Supabase CLI](https://supabase.com/docs/guides/cli), tras `supabase link` contra el proyecto correcto, el flujo habitual es `supabase db push`. Revisa siempre el diff de migraciones antes de empujar a producción.
- **Aplicación manual / auditada:** ejecutar cada `.sql` **en el orden del inventario** copiando el contenido desde `supabase/migrations/` al **SQL Editor** del panel de Supabase o a una sesión `psql` con permisos adecuados — útil cuando no usas CLI o quieres trazabilidad por archivo.
- **Stack local:** según la guía oficial del CLI, `supabase start` / `supabase db reset` aplican migraciones al Postgres local; revisa la documentación actual y el impacto destructivo de `reset` antes de usarlo con datos que quieras conservar.

#### Secrets GitHub (solo nombres; valores en Settings → Secrets)

| Secreto | Uso |
|---------|-----|
| `SUPABASE_ACCESS_TOKEN` | Token personal de [Supabase Dashboard](https://supabase.com/dashboard/account/tokens) para la API de gestión (CLI en CI). |
| `SUPABASE_DB_PASSWORD` | Contraseña del Postgres del proyecto (la del panel del proyecto; el CLI la usa vía variable de entorno para no pedir prompt). |
| `SUPABASE_PROJECT_REF` | Identificador del proyecto (subdominio en `https://<ref>.supabase.co`). |

**Vercel:** el despliegue de `apps/web` sigue el flujo estándar de Vercel al hacer **git push** (salvo que lo desactives en el panel). Este workflow **no** fuerza redeploy ni duplica triggers de Vercel; solo aplica migraciones SQL al proyecto Supabase enlazado.

Si el panel y el código divergen (falta política `anon`, falta tabla `diario_plan_ia`), la UI puede quedar vacía o fallar de forma poco clara.

---

## 7. Crons Vercel (`vercel.json`)

Vercel programa crons en **UTC**. Para objetivos en **Europe/Madrid** sin duplicar trabajo de IA cuando hacen falta **dos** expresiones UTC (invierno vs verano), las rutas afectadas aplican una **ventana civil semiabierta** en Madrid: fuera de ella responden `skipped: outside_madrid_window` sin coste DeepSeek.

### Pre-entreno (~09:00, informe listo antes de ~09:10)

| Expresión UTC | Hora local aprox. |
|----------------|-------------------|
| `0 7 * * *` | 07:00 UTC → 08:00 CET / 09:00 CEST en Madrid |
| `0 8 * * *` | 08:00 UTC → 09:00 CET / 10:00 CEST en Madrid |

Solo **una** de las dos coincide cada día civil con la ventana por defecto **`[08:55, 09:15)`** (minutos `08:55` inclusive … `09:15` exclusive). La otra invocación termina en *skip* inmediato: **no hay doble generación** aunque Vercel dispare ambas rutas.

- Ruta: `GET /api/cron/pre-entreno` (`apps/web/app/api/cron/pre-entreno/route.ts`).
- Tras pasar ventana + `CRON_PRE_ENTRENO_DEEPSEEK`, lee `telemetria_diaria` para **D-1** (noche previa civil Madrid), último `reportes_html` tipo `RESUMEN_NOCHE`, cola `memoria_ia`, `biometria_maestro`; ejecuta `runDeepSeekCascade` y **upsert** `reportes_html` (`PRE_ENTRENO`, `fecha` = hoy Madrid).
- **Garantía 09:10:** la ventana llega hasta **09:15** (excl.); el disparo válido cae alrededor de **09:00** local, dejando margen para latencia de red/IA antes del corte operativo 09:10.

### Pull telemetría previa (opcional, datos frescos)

| Expresión UTC | Uso |
|---------------|-----|
| `40 6 * * *` | ~08:40 CEST |
| `40 7 * * *` | ~08:40 CET |

Ruta: `GET /api/cron/fitbit-telemetria-pull`. Ventana Madrid **`[08:35, 08:50)`** + `FITBIT_ACTIVO` + `FITBIT_INGEST_ENABLED`. Hoy devuelve `note: fetch_not_wired` (TODO fetch + `POST /api/fitbit/ingest`); cuando exista cliente, alinea la ingesta **antes** del pre-entreno.

### Otros crons (tabla breve)

| Ruta | Horario en repo (UTC) | Notas |
|------|------------------------|--------|
| `/api/cron/resumen-noche` | `0 21 * * *` | Stub DeepSeek vía `handleCronDeepSeekGet`; exige `FITBIT_ACTIVO` y flag §5. |
| `/api/cron/daily-nutrition-routine` | `50 7 * * *` | Un solo cron UTC: equivale a **08:50 hora estándar Madrid (CET, invierno)**. En **CEST (verano)** corre a **09:50** local (±1 h inevitable con un único UTC en Vercel). Dos entradas UTC distintas dispararían **dos veces al día** la misma ruta (doble DeepSeek) salvo lógica adicional; aquí no se duplica. |

Vercel envía `Authorization: Bearer <CRON_SECRET>`. Sin `CRON_SECRET` configurado, las rutas responden *skipped* (`missing_cron_secret_env`) sin llamar a IA ni Supabase de coste alto donde aplica.

---

## 8. Verificación en UI (manual)

- **`/trainer`:** lista `rutina_oficial` si env y RLS correctos; Lyfta: duplicado exacto falla por `UNIQUE (origen, row_fingerprint)` (mensaje en acción).
- **`/nutrition`:** fecha `?fecha=YYYY-MM-DD`; domingo Madrid activa flujo compra; plan IA del día si el cron o datos rellenan `diario_plan_ia`.
- **`/health`:** con `NEXT_PUBLIC_FITBIT_UI_ENABLED` y maestro Fitbit activo según política de flags.

---

## 9. Seguridad e higiene del repo

- **No commitear:** `.env`, `token.json`, `secrets/`, CSV u hojas bajo rutas ignoradas (`RUTINA/`, etc.). Revisar PRs por filtrado accidental.
- **Service role:** solo servidor/scripts; nunca en `NEXT_PUBLIC_*` ni en bundle cliente.
- **RLS:** políticas permisivas tipo MVP single-user; producción multiusuario requeriría endurecer (`auth.uid()`, `profiles`).
- **Dos `package.json`:** coherente (raíz tooling + app Next); no es error.
- **`@repo/ai`:** el front usa reexport bajo `apps/web/lib/ai/reexport.ts` hacia `lib/ai/`; un informe antiguo citaba build roto por paquete inexistente — **estado actual en código:** resuelto por alias/tsconfig; **por verificar** con `rtk npm run typecheck:web` / `web:build` tras cambios grandes.
- **`node_modules` en Windows:** si hace falta borrar `apps/web/node_modules`, cerrar procesos que bloqueen DLL nativas (avisos `EPERM` históricos).
- **`.dockerignore`:** excluye `*.md` del contexto de imagen Python; esperado para imagen mínima.

### Roadmap RLS multi-tenant (diseño)

Hoy las migraciones de fase 1 suelen dar a `anon` (y en parte al rol de la web) **lecturas/escrituras amplias** sobre tablas clave (nutrición, entrenos, telemetría, storage) asumiendo un **único operador** o confianza total en la clave anónima del cliente. Eso es coherente con un MVP, no con tenants aislados.

Para evolucionar a **multi-tenant** habría que, como mínimo: añadir `user_id` (o tenant id) en filas sensibles y en paths de Storage; reescribir políticas `USING` / `WITH CHECK` con `auth.uid()` y tablas puente (`profiles`); revisar que **ningún** flujo con `SUPABASE_SERVICE_ROLE_KEY` mezcle datos entre usuarios; endurecer RPC/triggers públicos ya acotados en migraciones recientes; y cubrir con pruebas por rol. Esto es **hoja de ruta** — la implementación concreta debe revisarse migración a migración cuando se aborde el cambio.

---

## 10. `.cursorignore` (parche manual)

Si el IDE no puede escribir `.cursorignore`, alinear rutas obsoletas `frontend/*` con **`apps/web/*`** (build outputs, Playwright, excepciones `!.env` para la app web). Diff de referencia lógico: `frontend/.next` → `apps/web/.next`, `frontend/test-results` → `apps/web/test-results`, `!frontend/.env` → `!apps/web/.env`, etc.

---

## 11. PWA / iconos

`app/layout.tsx` referencia `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/apple-touch-icon.png`. En el árbol actual bajo `apps/web/public/icons/` puede faltar el binario (solo instrucciones) — **por verificar**; añadir assets reales evita 404 en LCP/manifiesto.

---

## 12. Pendientes reales (prioridad orientativa)

| Prioridad | Ítem | Notas |
|-----------|------|--------|
| Alta | **Aplicar migraciones** al proyecto Supabase activo | §6: inventario + workflow GitHub en push a `main`/`master`; revisar SQL en PRs. |
| Alta | **Variables en Vercel** + redeploy tras rotar secretos | §5 **Checklist despliegue Vercel** (solo nombres). Crons sin `CRON_SECRET` o sin flags IA no ejecutan modelo; redeploy tras rotar secretos. |
| Media | **Completar migración Drive** y datos periféricos | §5: layout Drive, OAuth + `refresh_token`, `rtk npm run migrate:drive` / `--dry-run`. |
| Media | **`vercel.json` crons** | `daily-nutrition-routine`: un solo `50 7` UTC; matices CET/CEST en §7. |
| Media | **Iconos PWA** en `public/icons/` | Coherencia con `metadata.icons`. |
| Media | **Hard RLS multi-tenant** | §9 **Roadmap RLS multi-tenant**; implementación futura (sustituir políticas amplias). |
| Baja | **Plantillas `.env.example`** | Raíz (scripts/Python/Drive/Supabase) y `apps/web/.env.example` (Next); mantener nombres alineados con §5. |

---

## 13. Comandos útiles (política RTK del repo)

```text
rtk npm install
rtk npm run web:install
rtk npm run web:dev
rtk npm run typecheck:scripts
rtk npm run typecheck:web
rtk npm run web:build
rtk npm run migrate:drive
rtk npm run migrate:drive -- --dry-run
rtk npm run smoke:deepseek
```

Typecheck puntual web (si lo necesitas): `rtk npx tsc -p apps/web --noEmit`

---

## 14. Mantenimiento de este documento

Al cambiar crons, tablas, flags de env o flujos de nutrición/Lyfta: actualizar **fecha**, §3, §5–§7, §9 y §12; si cambias migraciones o CI de Supabase, §6 y `.github/workflows/`. Este fichero es la **única** fuente bajo `docs/`; no recrear múltiples guías contradictorias.
