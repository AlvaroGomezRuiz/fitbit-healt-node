-- Fase 1 — plan diario IA (nutrición + rutina gimnasio), generado por cron servidor.
--
-- Aplicar en Supabase (Dashboard → SQL o CLI): `rtk supabase db push` / migración local según tu flujo.
-- Horario Vercel: los crons son UTC; 08:50 Europe/Madrid ≈ 06:50 UTC (CEST) y 07:50 UTC (CET).
--   Ver `vercel.json`: dos entradas `50 6 * * *` y `50 7 * * *` apuntando al mismo path.

CREATE TABLE public.diario_plan_ia (
  fecha date PRIMARY KEY,
  markdown text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.diario_plan_ia IS
  'Plan del día (markdown ES) generado por cron con DeepSeek; lectura pública controlada por RLS.';

ALTER TABLE public.diario_plan_ia ENABLE ROW LEVEL SECURITY;

-- Rol `service_role` ignora RLS en PostgREST; el cron usa SUPABASE_SERVICE_ROLE_KEY para upsert.

CREATE POLICY "anon_select_diario_plan_ia"
  ON public.diario_plan_ia
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "anon_select_diario_plan_ia" ON public.diario_plan_ia IS
  'Single-user: anon puede leer planes históricos para la vista /nutrition.';

CREATE POLICY "authenticated_select_diario_plan_ia"
  ON public.diario_plan_ia
  FOR SELECT
  TO authenticated
  USING (true);
