-- Lectura anónima acotada: solo filas Lyfta pegadas desde la app web (misma superficie que INSERT anon).
-- Riesgo single-tenant: cualquier cliente con anon_key puede leer todas las filas lyfta_raw.
-- En multi-tenant o API pública endurecer (auth.uid(), service_role desde servidor, o sin SELECT anon).

CREATE POLICY "anon_select_entrenos_historico_lyfta"
  ON public.entrenos_historico
  FOR SELECT
  TO anon
  USING (origen = 'lyfta_raw'::public.entreno_origen);

COMMENT ON POLICY "anon_select_entrenos_historico_lyfta" ON public.entrenos_historico IS
  'Permite leer de nuevo pegados Lyfta (p. ej. fetchEntrenoHistoricoById) con NEXT_PUBLIC_SUPABASE_ANON_KEY en servidor.';
