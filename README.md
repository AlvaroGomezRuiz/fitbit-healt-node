# Fitbit Healt Node

- **`frontend/`**: Next.js.
- **`supabase/migrations/`**: esquema Postgres (aplicar con Supabase CLI o SQL Editor).
- **Crons Vercel** (`vercel.json`): incluyen `informe-semanal` (domingo) y `retention-weekly` (lunes); requieren `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY`.
- **`scripts/build-rutina-seed.mjs`**: regenera la migración de seed de `rutina_oficial` desde `RUTINA_OFICIAL.md`.

Si usabas `web/.env` o `web/.env.local`, muévelos a **`frontend/.env.local`**. En Vercel, ajusta **Root Directory** del proyecto a **`frontend`** si estaba en `web`.

```bash
npm install --prefix frontend
npm run typecheck
node scripts/build-rutina-seed.mjs   # si cambias RUTINA_OFICIAL.md
```
