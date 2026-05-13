-- Portada, contadores 7d y `/trainer` (historial): filas `drive_csv` no cumplían `origen = lyfta_raw` de la política previa.
-- MVP single-tenant: SELECT anónimo global. Endurecer con `auth.uid()` o revocar en API pública multi-tenant.

CREATE POLICY "anon_select_entrenos_historico_list"
  ON public.entrenos_historico
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "anon_select_entrenos_historico_list" ON public.entrenos_historico IS
  'Listado/última sesión/contaje con NEXT_PUBLIC_SUPABASE_ANON_KEY en servidor. Convive con anon_select_entrenos_historico_lyfta (OR en políticas permisivas).';
