-- Lectura e ingesta de telemetría diaria con rol `anon` (misma clave pública que apps/web en servidor).
-- Uso personal: en multi-tenant sustituir por `authenticated` + políticas por `auth.uid()`.

CREATE POLICY "anon_select_telemetria_diaria"
  ON public.telemetria_diaria
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_insert_telemetria_diaria"
  ON public.telemetria_diaria
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon_update_telemetria_diaria"
  ON public.telemetria_diaria
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "anon_select_telemetria_diaria" ON public.telemetria_diaria IS
  'Permite a apps/web listar telemetría con NEXT_PUBLIC_SUPABASE_ANON_KEY cuando FITBIT_UI está activo.';

COMMENT ON POLICY "anon_insert_telemetria_diaria" ON public.telemetria_diaria IS
  'Upsert vía API ingest (FITBIT_INGEST_ENABLED); revisar en despliegue público.';

COMMENT ON POLICY "anon_update_telemetria_diaria" ON public.telemetria_diaria IS
  'Parte del upsert PostgREST onConflict; revisar en despliegue público.';
