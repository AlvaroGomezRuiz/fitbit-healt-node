# Estado del proyecto — visión ejecutiva y técnica

**Fecha del documento:** 2026-05-18  
**Alcance:** síntesis de `docs/*.md`, estructura actual del repositorio y del arco de trabajo reciente (Supabase, Next.js, IA, operación). Sustituye como “mapa vivo” a fragmentos desactualizados de fases puntuales cuando entren en conflicto con el código.

---

## 1. Resumen ejecutivo

El repositorio **Fitbit-Healt-Node** combina:

| Capa | Tecnología | Rol hoy |
|------|------------|---------|
| Backend clásico | Python / FastAPI (`src/`), Docker | Núcleo histórico; ingest y lógica de dominio; despliegue tipo Cloud Run. |
| Datos cloud | **Supabase** (Postgres + Storage + Auth) | Fuente de verdad nueva para biometría, rutina, entrenos, telemetría, informes, memoria IA, perfiles. |
| Web | **Next.js 15** App Router en `apps/web/` | PWA mobile-first, rutas Inicio / Nutrición / Entrenador / Salud (`/health`), login Supabase, Server Actions. |
| IA | **DeepSeek** (`lib/ai/`, reexport en web) | Cascada Pro→Flash, crons pre-entreno / resumen noche, smoke, resumen Lyfta, lista de compra domingo, prompts nutrición. |
| Migración datos | `scripts/migrate_from_drive.ts` | Volcado idempotente desde Google Drive hacia Supabase (OAuth + service role). |

**Estado global:** la **fase de cáscara “solo mock”** descrita en `phase3-shell.md` **ya no describe la realidad**: la web está cableada a Supabase, RLS, flags Fitbit y varias acciones de IA. Ese fichero debe leerse como **histórico de arranque**, no como estado actual.

---

## 2. Mapa del repositorio (rápido)

| Ruta | Contenido relevante |
|------|------------------------|
| `apps/web/` | Next: `app/page.tsx` (inicio), `nutrition/`, `trainer/`, `health/`, `login/`, `auth/`, `api/cron/*`, `api/health/*`, `api/fitbit/*`. |
| `apps/web/lib/` | Supabase server/service clients, datos por tabla (`lib/data/*`), Fitbit, prompts IA bajo `lib/ai/`. |
| `lib/ai/` (raíz) | Cliente DeepSeek compartido con scripts (`deepseek-cascade.ts`, etc.). |
| `supabase/migrations/` | DDL fase 1 + evolución (anon biometría singleton, anon update/select entrenos, seed rutina, revoke RPC, etc.). |
| `scripts/` | `migrate_from_drive.ts`, utilidades Python listadas en README. |
| `docs/` | Runbooks: `NEXT_STEPS.md`, fases 2/3, higiene, cursorignore; **este documento**. |
| `vercel.json` | Crons UTC → `/api/cron/pre-entreno`, `/api/cron/resumen-noche`. |

---

## 3. Qué dice cada doc existente (y vigencia)

| Documento | Idea central | Vigencia / nota |
|-------------|----------------|-----------------|
| `NEXT_STEPS.md` | Orden de migraciones SQL, env, crons, webhook, Fitbit, checklist build. | **Sigue siendo la referencia operativa**; conviene alinear §2–4 con lo ya implementado (Lyfta upsert, prompts nutrición, lista domingo) en una futura edición menor. |
| `phase2-ai.md` | API `runDeepSeekCascade`, env, smoke `smoke:deepseek`. | **Válido** para el módulo TS raíz. |
| `phase3-shell.md` | UI solo presentación, sin Supabase ni IA. | **Obsoleto** respecto al producto actual; conservar solo como nota histórica. |
| `repo-hygiene-report.md` | Auditoría 2026-05-13, secretos, dos `package.json`, build bloqueado por `@repo/ai` en su momento. | **Parcialmente obsoleto**: el build web se corrigió (alias `zod`, `tsconfig`, reexport `@repo/ai`); el resto (secretos, estructura) sigue aplicando. |
| `cursorignore-patch.md` | Diff para apuntar `apps/web` en lugar de `frontend/`. | **Aplicable** si `.cursorignore` no se pudo escribir desde el IDE. |

---

## 4. Supabase — modelo y políticas (estado conceptual)

- **Tablas núcleo:** `biometria_maestro` (singleton), `rutina_oficial`, `entrenos_historico`, `memoria_ia`, `reportes_html`, `telemetria_diaria`, `profiles` (+ Storage `archivos_crudos`, `health_raw_json`).
- **RLS:** rol `authenticated` con políticas amplias en MVP single-user; rol `anon` con políticas **acotadas** para lecturas/escrituras desde Server Actions con clave pública (telemetría, rutina SELECT, Lyfta INSERT/UPDATE/SELECT según migraciones aplicadas).
- **Linter Supabase:** avisos `rls_policy_always_true` esperables en MVP; se endureció exposición RPC de funciones `SECURITY DEFINER` (migración revoke).
- **Operación:** cualquier migración nueva en `supabase/migrations/` debe aplicarse en **todos** los entornos (local, proyecto remoto). Desajustes entre código y SQL producen síntomas “vacío sin error” (p. ej. sin `anon` SELECT en biometría) o RLS en upsert.

---

## 5. Web (`apps/web`) — capacidades ya alineadas con el producto

- **Configuración:** validación estricta de `NEXT_PUBLIC_SUPABASE_URL` (host `*.supabase.co`, no dashboard); mensajes amigables si PostgREST devuelve HTML del Studio.
- **Supabase:** cliente cookie+anon para lecturas habituales; **`SUPABASE_SERVICE_ROLE_KEY`** para escrituras/lecturas que deben ignorar RLS (Lyfta, cron, análisis); `next.config` + recarga opcional de `.env` monorepo/servidor para que la service key sea visible en Server Actions.
- **Rutas principales:** `/` resumen Supabase; `/nutrition` día con biometría y telemetría (flags Fitbit); `/trainer` rutina + Lyfta + prueba IA; `/health` telemetría; login/callback Supabase.
- **Lyfta:** upsert por `(origen, row_fingerprint)`, título tipo “Sesión YYYY-MM-DD” o cabecera, preview sin jerga; resumen IA opcional; políticas anon/service según despliegue.
- **Nutrición:** objetivos desde `biometria_maestro`; **domingo (Europe/Madrid)** bloque lista de compra para el **lunes** con IA (`nutrition-shopping`, `SundayShoppingCard`); prompts fijos en `nutrition-diet-prompt.ts` y `nutrition-shopping-prompt.ts`.
- **IA:** DeepSeek con manejo de 401 legible; crons documentados en `NEXT_STEPS.md` y `vercel.json`.

---

## 6. Conversación / trabajo reciente — temas cerrados y lecciones

1. **URL Supabase:** confundir `supabase.com/dashboard/...` con la API rompe la app (HTML 404); la URL correcta es `https://<ref>.supabase.co`.
2. **Vercel / env:** variables sensibles requieren **redeploy**; en local hace falta **reiniciar** `next dev` tras cambiar `.env*`.
3. **Lyfta + RLS:** sin `SUPABASE_SERVICE_ROLE_KEY` en el proceso de Next o sin migración **anon UPDATE** para upsert, fallos opacos; con políticas y service role alineados, el flujo queda estable.
4. **Biometría “vacía” con datos en BD:** faltaba política `anon` SELECT al singleton; síntoma: `maybeSingle()` → null sin error.
5. **Documentación de fases:** el código avanzó más rápido que `phase3-shell.md` y parte de `NEXT_STEPS.md`; este `ESTADO-PROYECTO.md` reduce la deriva.

---

## 7. Pendientes explícitos (prioridad sugerida)

| Prioridad | Ítem | Notas |
|-----------|------|--------|
| Alta | **Cron diario ~08:50 Europe/Madrid** con plan “dieta + rutina del día” persistido y mostrado en Nutrición | Pedido por producto; **no** consta aún en `vercel.json` ni rutas `api/cron/` dedicadas en el repo al cierre de esta redacción. Requiere diseño: tabla o reutilización de `reportes_html`, `CRON_SECRET`, UTC vs DST. |
| Alta | **Sincronizar `NEXT_STEPS.md`** con lista real de migraciones y features (Lyfta upsert, domingo IA, prompts) | Evita doble verdad con código. |
| Media | **Completar datos** (`migrate_from_drive`, memoria, reportes HTML, telemetría) y flags **Fitbit** en Vercel | Depende de credenciales y política de coste IA (`FITBIT_ACTIVO`). |
| Media | **Multi-tenant / RLS estricta** | Sustituir políticas `USING (true)` por `auth.uid()` + `profiles` cuando deje de ser single-user. |
| Baja | **Actualizar `phase3-shell.md`** o archivarlo como `phase3-shell-ARCHIVE.md` | Reduce confusión onboarding. |

---

## 8. Checklist operativo (despliegue)

1. **Supabase:** todas las migraciones de `supabase/migrations/` aplicadas al proyecto activo.  
2. **Vercel (proyecto con root `apps/web`):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, `CRON_SECRET`, flags crons y Fitbit según `NEXT_STEPS.md`.  
3. **Tras cambiar secretos:** redeploy.  
4. **Local:** `.env` raíz para scripts; `apps/web/.env.local` para Next; reinicio de dev server.  
5. **No commitear:** `.env`, `token.json`, `APIS-CONTRASEÑAS.md`, credenciales (ver `repo-hygiene-report.md`).

---

## 9. Comandos de verificación (RTK)

```text
rtk npm run typecheck:scripts
rtk npm run typecheck:web
rtk npm run web:build
```

Smoke DeepSeek (raíz): `rtk npm run smoke:deepseek`

---

## 10. Referencias cruzadas

- Operación diaria y crons: `docs/NEXT_STEPS.md`  
- Cliente IA compartido: `docs/phase2-ai.md`  
- Higiene y secretos: `docs/repo-hygiene-report.md`  
- Cursor ignore: `docs/cursorignore-patch.md`

**Mantenimiento de este documento:** actualizar la fecha y las secciones 5–7 cuando cambie el alcance (nuevo cron, nueva tabla, cierre de deuda RLS).
