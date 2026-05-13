# Informe de higiene del repositorio (auditoría)

Fecha: 2026-05-13. Árbol de trabajo: `c:\dev\Fitbit-Healt-Node`.

## 1. Mapa rápido

| Ruta | Rol |
|------|-----|
| `src/` | FastAPI + engines (Python), entrypoint Cloud Run `src.health_node:app` |
| `scripts/` | Python operación + TS auxiliares (`migrate_from_drive.ts`, `smoke_deepseek.ts`) |
| `lib/` | Módulos TS compartidos con scripts (`lib/ai/*`) |
| `apps/web/` | Next.js 15 (App Router), UI fase 3 |
| `docs/` | `phase2-ai.md`, `phase3-shell.md`, este informe |
| `supabase/migrations/` | SQL fase 1 |
| Raíz | `Dockerfile`, `requirements.txt`, `package.json` (scripts TS), `tsconfig.json` |

**No existen** carpetas top-level `app/`, `web/` ni `frontend/`; la UI vive en `apps/web/`.

## 2. Secretos y datos personales (no tocar / no commitear)

`.gitignore` excluye correctamente: `.env`, `token.json`, `secrets/`, `RUTINA/`, `payments/`, `debug_drive/`.

Archivos presentes en disco local (p. ej. `.env`, `token.json`, `secrets/credenciales_oauth.json`, CSV bajo `RUTINA/`) pueden existir en el workspace; **no deben borrarse** en una limpieza de repo y **no deben añadirse** a Git.

## 3. Hallazgos

### 3.1 Config y duplicados

- **Dos `package.json`**: raíz (tooling TS + scripts) y `apps/web/` (Next). Coherente con monorepo ligero; no es duplicado erróneo.
- **`tsconfig.json` raíz**: solo `scripts/**/*.ts` y `lib/**/*.ts` — correcto; Next usa `apps/web/tsconfig.json`.
- **`.dockerignore`**: excluye `scripts/`, `*.md`, `tests/` del contexto de build; la imagen solo copia `requirements.txt` + `src/`. Comportamiento esperado para imagen mínima.
- **`.cursorignore`**: aún referencia rutas `frontend/*` obsoletas; el parche aplicable está en **`docs/cursorignore-patch.md`** (la escritura directa en `.cursorignore` puede estar denegada por el entorno).

### 3.2 Estado Git (momento de la auditoría)

- Índice rastreado: sobre todo Python (`src/`, `scripts/*.py`, Docker, README).
- Cambios locales sin commit incluyen el front TS (`apps/web/`, `lib/`, `docs/`, `supabase/`, `package.json` raíz, etc.). Tras el primer commit de esa capa, conviene `rtk git status` limpio y CI si aplica.

### 3.3 Otros

- **`!.geo/`** en `.cursorignore`: carpeta opcional; inofensiva si no existe.
- **`RUTINA_OFICIAL.md`** en raíz: documentación de dominio referenciada en README; **no** consolidar con `RUTINA/` (datos ignorados).

## 4. Acciones aplicadas en esta pasada

- **`.gitignore`**: aseguradas entradas `node_modules/` y `dist-scripts/` (salida `tsc` raíz) para no commitear dependencias ni artefactos de compilación TS.
- **`Dockerfile`**: comentario alineado con scripts reales (`actualizar_contexto_drive` / flujo Drive), eliminada referencia a un `seed_drive.py` inexistente.

## 5. Diferido (sin borrar / sin mover)

| Ítem | Motivo |
|------|--------|
| Mover `lib/` bajo `apps/web/` | Rompería imports de `scripts/*.ts` y el `tsconfig` raíz; refactor innecesario. |
| Eliminar `.cursor/` o reglas locales | Fuera de alcance del producto; además `.cursor/` está en `.gitignore`. |
| Unificar un solo `package.json` | Requeriría workspaces (pnpm/turborepo) o duplicar deps; no es “mínimo”. |
| Borrar `node_modules/` | Regenerable con `rtk npm install`; no debe versionarse. |

## 6. Riesgos

- Cualquier commit accidental de `.env` o `token.json` sería crítico; mantener hooks/revisión de PR.
- `.dockerignore` ignora todos los `*.md`: si en el futuro el contenedor necesitara un `.md` embebido, habría que ajustar exclusiones.

## 7. Verificación sugerida

```powershell
rtk git status
rtk npm run typecheck:scripts
```

En `apps/web`: `rtk npm run build` cuando se integre CI del front.

---

## Limpieza total — 2026-05-13

### Inventario `package.json`

- **Total: 2** (únicos en el repo)
  - `package.json` (raíz: scripts `migrate:drive`, `smoke:deepseek`, `typecheck:scripts` + deps TS compartidas)
  - `apps/web/package.json` (Next.js)
- **Acción:** no se eliminó ninguno; no hay paquetes anidados huérfanos.

### Lockfiles

- `package-lock.json` (raíz) y `apps/web/package-lock.json`: coherentes con los dos raíces de paquete; **no** había `package-lock.json` duplicado en rutas incorrectas ni `pnpm-lock.yaml`.

### `.venv` (raíz `c:\dev\Fitbit-Healt-Node\.venv`)

- **No existe** el directorio en disco → no se ejecutó borrado ni `git rm --cached`.
- `rtk git ls-files .venv` → sin salida (no rastreado).
- `.gitignore` ya incluye `.venv/` y `venv/`.

### `node_modules`

- **Raíz:** eliminado con `Remove-Item -Recurse -Force`; restaurado con `rtk npm install` en la raíz.
- **`apps/web`:** el borrado inicial falló (`EPERM` / acceso denegado en `tailwindcss-oxide.win32-x64-msvc.node`, típico de proceso con archivo abierto). Se ejecutó `rtk npm install` en `apps/web` para reparar/actualizar dependencias; npm mostró avisos de limpieza sobre el mismo binario nativo.

### Regenerar entorno (después de clonar o borrar `node_modules`)

```powershell
cd c:\dev\Fitbit-Healt-Node
rtk npm install
cd apps\web
rtk npm install
cd ..\..
rtk npm run typecheck:scripts
cd apps\web
rtk npm run build
```

### `.cursorignore`

- La escritura automática en `.cursorignore` fue **denegada** por el entorno.
- Parche unificado para sustituir `frontend/` → `apps/web/`: **`docs/cursorignore-patch.md`**.

### Carpetas vacías / basura

- Búsqueda de directorios vacíos (excl. `.git`, `node_modules`, `RUTINA`, `secrets`, `.next`): aparecieron `.cursor\context` y `venv\Include`. **No se borraron** (contexto de Cursor y árbol `venv/` ignorado por git; evitar daño colateral).
- `rtk git ls-files "*.log"` → sin archivos `.log` versionados.

### Verificación ejecutada

| Comando | Resultado |
|--------|-----------|
| `rtk npm run typecheck:scripts` (raíz) | OK |
| `rtk npm run build` (`apps/web`) | Fallo: no resuelve el módulo `@repo/ai` (`app/actions/ai-smoke.ts`). Independiente de esta limpieza; el `package.json` de `apps/web` no declara workspace/`@repo/ai`. |

### Riesgos tras esta pasada

- Cerrar IDE/servidor que use `apps/web` antes de volver a borrar `node_modules` allí si se necesita limpieza total sin avisos `EPERM`.
- El build del front sigue bloqueado hasta enlazar o sustituir `@repo/ai`.
