# Próximos pasos (integración Supabase + web)

## 1. Aplicar SQL en Supabase

1. En el panel de Supabase → SQL Editor, ejecuta en orden los ficheros de `supabase/migrations/`, en especial:
   - `20260513120000_phase1_core_tables.sql`
   - `20260513120500_phase1_anon_web_policies.sql` (lectura `rutina_oficial` e inserción `lyfta_raw` para rol `anon`)
   - `20260513120600_phase1_anon_telemetria_web_policies.sql` (opcional: `telemetria_diaria` con rol `anon` para `/health` e ingest)
2. Inserta datos mínimos en `rutina_oficial` (siete filas `MON`…`SUN`) si la tabla está vacía; sin filas la UI mostrará estado vacío pero válido.

## 2. Variables de entorno

1. Raíz del repo: copia `.env.example` → `.env` y rellena `SUPABASE_*`, Google, etc., para `scripts/migrate_from_drive.ts`.
2. **apps/web**: copia `apps/web/.env.example` → `apps/web/.env.local` con:
   - `NEXT_PUBLIC_SUPABASE_URL` (misma URL del proyecto)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave anon del dashboard; **no** uses service role en `NEXT_PUBLIC_*` ni en el cliente)
3. Opcional — Server Action de IA en web: añade `DEEPSEEK_API_KEY` (y opcionalmente `DEEPSEEK_BASE_URL`) en `apps/web/.env.local`. Next no carga automáticamente el `.env` de la raíz al ejecutar `next dev` dentro de `apps/web`.

## 3. Comandos útiles (con RTK)

- Instalar dependencias raíz: `rtk npm install`
- Instalar dependencias web: `rtk npm run web:install`
- Arrancar Next: `rtk npm run web:dev`
- Typecheck scripts (raíz): `rtk npm run typecheck:scripts`
- Typecheck web: `rtk npm run typecheck:web`
- Build web: `rtk npm run web:build`
- Migración desde Drive (requiere `.env` con variables del script, **sin** imprimir secretos en logs): `rtk npm run migrate:drive`

## 4. Verificación en UI

- Abre `/trainer`: debe listar `rutina_oficial` si env y RLS están bien; si falta env, verás aviso en español.
- Formulario Lyfta: intenta insertar en `entrenos_historico` con `origen = lyfta_raw`; si el texto es idéntico a un pegado previo, fallará por `UNIQUE (origen, row_fingerprint)` y la acción mostrará modo “stub” con el mensaje de error.

## 5. Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo en scripts/servidor fuera del bundle público; nunca en `NEXT_PUBLIC_*`.
- Las políticas `anon` son adecuadas para entorno personal; en producción multiusuario revisa RLS y autenticación (`authenticated`).

## 6. Crons Vercel y webhook Google Health (apps/web)

En la raíz del repo, `vercel.json` define dos crons (UTC) que llaman por **GET** a Next:

| Nombre lógico (referencia) | Ruta | Horario por defecto |
|----------------------------|------|---------------------|
| `cron-pre-entreno` | `/api/cron/pre-entreno` | `0 7 * * *` (07:00 UTC) |
| `cron-resumen-noche` | `/api/cron/resumen-noche` | `0 21 * * *` (21:00 UTC) |

**Variables en `apps/web` (p. ej. `.env.local` y proyecto Vercel):**

- **`CRON_SECRET`**: obligatorio en producción para aceptar el job. Vercel envía `Authorization: Bearer <CRON_SECRET>` al invocar el cron; sin variable configurada la ruta responde `{ "ok": true, "skipped": "missing_cron_secret_env" }` y no llama a DeepSeek.
- **`DEEPSEEK_API_KEY`**: si falta o está vacía, respuesta `{ "ok": true, "skipped": "missing_deepseek_api_key" }`.
- **`CRON_PRE_ENTRENO_DEEPSEEK`** / **`CRON_RESUMEN_NOCHE_DEEPSEEK`**: deben ser `1`, `true`, `yes` u `on` (case insensitive) para que el stub respectivo llame a `runDeepSeekCascade`; si no, `{ "ok": true, "skipped": "cron_ai_disabled" }` sin error de build.
- Opcionales DeepSeek: mismas que en la sección 2 (`DEEPSEEK_BASE_URL`, cascada de modelos, etc.).

**Webhook stub Google Health — `POST /api/health/google`:**

- **`HEALTH_WEBHOOK_SECRET`**: valor esperado; sin él la ruta responde `503` con `{ "ok": false, "error": "webhook_not_configured" }`.
- El cliente debe enviar el mismo secreto en cabecera **`x-health-webhook-secret`**, como **`Authorization: Bearer`** seguido del valor del secreto, o en query **`health_webhook_secret`** / **`secret`**.
- Cuerpo JSON opcional: si `Content-Type` incluye `application/json`, debe ser un objeto JSON (validado con Zod como registro clave→valor); no registrar PII en logs del servidor.

## 7. Telemetría / Fitbit (feature flag)

1. En `apps/web/.env.local`: `NEXT_PUBLIC_FITBIT_UI_ENABLED=true` (solo `true` o `1` activan) para ver en `/health` datos de `telemetria_diaria`.
2. Ingesta HTTP opcional: `FITBIT_INGEST_ENABLED=true` y `POST /api/fitbit/ingest` (JSON con `fecha` YYYY-MM-DD y campos opcionales). `FITBIT_SYNC_ENABLED` o, si está vacío, `FITBIT_ACTIVO` (legacy) marcan sync listo para tu cron/webhook.
3. SQL: aplica también `20260513120600_phase1_anon_telemetria_web_policies.sql` si lees/insertas con clave **anon** en servidor (igual que rutina/Lyfta).
4. Verificación: inserta filas en `telemetria_diaria` (SQL o ingest) y recarga `/health` con el flag en `true`.

## 8. Post-merge checklist (agentes en paralelo)

1. **Sin `pages/` junto a `app/`**: no añadas `pages/index.tsx`, `_app`, stubs de build, etc., si ya existe `app/page.tsx` — Next falla con conflicto y el repo es **solo App Router**.
2. **`.next` y typecheck web**: si `rtk npm run typecheck:web` lista TS6053 sobre ficheros bajo `.next/types/` que “no existen”, borra `apps/web/.next` y vuelve a ejecutar el typecheck (entradas huérfanas en caché incremental).
3. **`@repo/ai`**: el path en `apps/web/tsconfig.json` apunta a `apps/web/lib/ai/reexport.ts`, que reexporta desde `lib/ai/` en la raíz del repo. Mantén en `next.config.ts` `experimental.externalDir` y el `webpack.resolve.extensionAlias` para `.js` → `.ts` al empaquetar imports NodeNext del paquete compartido.
4. **Flags Fitbit**: usa `parseFitbitFeatureFlagsFromEnv` (`apps/web/lib/fitbit/config.ts`) como fuente única; `getFitbitFeatureFlags` (`apps/web/lib/fitbit/flags.ts`) solo delega (`uiEnabled` + `syncEnabled`).
5. **Build de release**: tras merges grandes, `rtk err cmd /c "if exist apps\web\.next rmdir /s /q apps\web\.next"` y luego `rtk npm run web:build` para evitar estados intermedios raros en Windows.
