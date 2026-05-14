# Fitbit Healt Node

- **`frontend/`**: Next.js.
- **`supabase/migrations/`**: esquema Postgres (aplicar con Supabase CLI o SQL Editor).
- **Crons Vercel** (`vercel.json`): incluyen `informe-semanal` (domingo) y `retention-weekly` (lunes); requieren `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY`.
- **`scripts/build-rutina-seed.mjs`**: regenera la migración de seed de `rutina_oficial` desde `RUTINA_OFICIAL.md`.

Si Cursor/VS Code muestra errores en **`apps/web/tsconfig.json`**, es un remanente: **cierra ese archivo** y borra en el Explorador la carpeta **`apps`** del repo (el código Next está solo en **`frontend/`**). El `tsconfig` válido es **`frontend/tsconfig.json`** (y el de raíz que lo extiende).

Si usabas `web/.env` o `web/.env.local`, muévelos a **`frontend/.env.local`**. En Vercel, el **Root Directory** del proyecto debe ser **`frontend`** (el `vercel.json` con crons vive en `frontend/vercel.json`).

```bash
npm install --prefix frontend
npm run typecheck
node scripts/build-rutina-seed.mjs   # si cambias RUTINA_OFICIAL.md
```
