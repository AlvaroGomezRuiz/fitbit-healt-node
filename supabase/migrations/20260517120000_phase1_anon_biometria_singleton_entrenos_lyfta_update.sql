-- Portada / nutrición con NEXT_PUBLIC_SUPABASE_ANON_KEY en servidor: `telemetria_diaria` ya tenía SELECT anon;
-- `biometria_maestro` no, así que PostgREST devolvía 0 filas (vacío) sin error explícito bajo RLS.
-- Upsert Lyfta vía PostgREST requiere UPDATE en conflicto además de la política INSERT existente.

CREATE POLICY "anon_select_biometria_maestro_singleton"
  ON public.biometria_maestro
  FOR SELECT
  TO anon
  USING (id = 'singleton');

COMMENT ON POLICY "anon_select_biometria_maestro_singleton" ON public.biometria_maestro IS
  'Lectura controlada de la fila maestra (PII). Misma filosofía que telemetria_diaria anon; revisar en despliegue público o multi-tenant (sustituir por authenticated + auth.uid()).';

CREATE POLICY "anon_update_entrenos_historico_lyfta"
  ON public.entrenos_historico
  FOR UPDATE
  TO anon
  USING (origen = 'lyfta_raw'::public.entreno_origen)
  WITH CHECK (origen = 'lyfta_raw'::public.entreno_origen);

COMMENT ON POLICY "anon_update_entrenos_historico_lyfta" ON public.entrenos_historico IS
  'Permite ON CONFLICT DO UPDATE en upserts PostgREST para origen lyfta_raw con rol anon.';
