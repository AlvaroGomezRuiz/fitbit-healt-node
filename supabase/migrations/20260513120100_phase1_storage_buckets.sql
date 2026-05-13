-- Fase 1 — buckets de Storage (privados)
--
-- Convención de rutas (espejo lógico de drive_engine.py, sin leading slash):
--
--   health_raw_json
--     {anio}/{carpeta_mes}/{dd_mm_yyyy}/snapshots/{nombre_fichero}
--     Ej.: 2026/05_MAYO/12_05_2026/snapshots/snapshot_2300_2026-05-12_2300.json
--     Contenido: JSON de snapshot_diario_completo (04_HEALTH_RAW en Drive).
--
--   archivos_crudos
--     {anio}/{carpeta_mes}/{dd_mm_yyyy}/lyfta_raw/{nombre_fichero}
--     Ej.: 2026/05_MAYO/12_05_2026/lyfta_raw/HISTORICO_LYFTA_12_05_2026.txt
--     Contenido: export Lyfta (txt/pdf/csv) y volcados 01_LYFTA_RAW.
--
-- Migración desde Drive: el script TypeScript sube bytes idempotentes (upsert)
-- usando estas rutas para trazabilidad con la jerarquía AÑO / MM_MES / DD_MM_YYYY.
--
-- Seguridad: public = false. El cliente browser NO debe tener políticas permisivas;
-- lectura/escritura vía Edge Function o backend con service_role, o URLs firmadas.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'archivos_crudos',
    'archivos_crudos',
    false,
    52428800,
    ARRAY['text/plain', 'text/csv', 'application/pdf', 'application/octet-stream']::text[]
  ),
  (
    'health_raw_json',
    'health_raw_json',
    false,
    52428800,
    ARRAY['application/json']::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- storage.objects tiene RLS por defecto. El JWT `service_role` ignora RLS al usar
-- la API con SUPABASE_SERVICE_ROLE_KEY (p. ej. scripts/migrate_from_drive.ts).
-- Las políticas siguientes habilitan lectura/escritura para `authenticated` en app
-- single-user (ajustar a rutas por usuario cuando escale).

CREATE POLICY "authenticated_select_archivos_y_health"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('archivos_crudos', 'health_raw_json'));

CREATE POLICY "authenticated_insert_archivos_y_health"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('archivos_crudos', 'health_raw_json'));

CREATE POLICY "authenticated_update_archivos_y_health"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('archivos_crudos', 'health_raw_json'))
  WITH CHECK (bucket_id IN ('archivos_crudos', 'health_raw_json'));

CREATE POLICY "authenticated_delete_archivos_y_health"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('archivos_crudos', 'health_raw_json'));
