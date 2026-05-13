-- Políticas opcionales para la app Next (clave anon en servidor sin sesión Supabase Auth).
-- Rutina semanal: lectura pública controlada (sin PII en columnas expuestas).
-- Entrenos: solo inserciones con origen lyfta_raw desde PostgREST anon (p. ej. Server Action).

CREATE POLICY "anon_select_rutina_oficial"
  ON public.rutina_oficial
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_insert_entrenos_historico_lyfta"
  ON public.entrenos_historico
  FOR INSERT
  TO anon
  WITH CHECK (origen = 'lyfta_raw'::public.entreno_origen);

COMMENT ON POLICY "anon_select_rutina_oficial" ON public.rutina_oficial IS
  'Permite a apps/web leer el calendario con NEXT_PUBLIC_SUPABASE_ANON_KEY (solo servidor recomendado).';

COMMENT ON POLICY "anon_insert_entrenos_historico_lyfta" ON public.entrenos_historico IS
  'Permite persistir pegados Lyfta con anon; revisar en multi-tenant o producción pública.';
