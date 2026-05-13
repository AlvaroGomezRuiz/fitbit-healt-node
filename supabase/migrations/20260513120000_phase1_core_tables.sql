-- Fase 1 — esquema núcleo (Supabase Postgres)
-- Alineado a src/models.py (BiometriaMaestro), drive_engine.py, health_engine.py.
--
-- RLS: habilitado en todas las tablas. La clave JWT `service_role` (solo servidor)
-- ignora RLS en PostgREST/GoTrue: usar SUPABASE_SERVICE_ROLE_KEY en scripts Node
-- y workers. Los roles `anon` y `authenticated` quedan bloqueados salvo políticas
-- explícitas (plantilla single-user más abajo).
--
-- Autenticación single-user (sustituir UUID cuando exista perfil en auth.users):
--   CREATE POLICY "solo_propietario" ON public.biometria_maestro
--   FOR ALL TO authenticated
--   USING (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid)
--   WITH CHECK (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tipos enumerados ─────────────────────────────────────────────────────

CREATE TYPE public.reporte_html_tipo AS ENUM (
  'PRE_ENTRENO',
  'POST_ENTRENO',
  'RESUMEN_NOCHE'
);

CREATE TYPE public.dia_semana AS ENUM (
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN'
);

CREATE TYPE public.grupo_muscular_rutina AS ENUM (
  'PUSH',
  'PULL',
  'LEG',
  'DESCANSO'
);

CREATE TYPE public.objetivo_nutricion_tipo AS ENUM (
  'CUTTING_AGRESIVO',
  'CUTTING_SUAVE',
  'MANTENIMIENTO',
  'VOLUMEN_LIMPIO',
  'VOLUMEN_AGRESIVO'
);

CREATE TYPE public.entreno_origen AS ENUM (
  'drive_csv',
  'lyfta_raw'
);

-- ── BIOMETRÍA MAESTRO (1 fila; refleja BiometriaMaestro Pydantic) ──────────

CREATE TABLE public.biometria_maestro (
  id text PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),

  nombre text NOT NULL,
  fecha_nacimiento date NOT NULL,
  edad_anos integer NOT NULL CHECK (edad_anos >= 0 AND edad_anos < 130),
  sexo text NOT NULL CHECK (sexo IN ('M', 'F')),
  altura_cm double precision NOT NULL CHECK (altura_cm > 50 AND altura_cm < 280),

  peso_kg double precision NOT NULL CHECK (peso_kg > 20 AND peso_kg < 300),
  fecha_ultimo_pesaje date NOT NULL,
  imc double precision NOT NULL CHECK (imc > 10 AND imc < 60),
  body_fat_estimado_pct double precision NOT NULL CHECK (body_fat_estimado_pct >= 3 AND body_fat_estimado_pct <= 60),
  masa_libre_grasa_kg double precision NOT NULL CHECK (masa_libre_grasa_kg > 0 AND masa_libre_grasa_kg < 200),
  tendencia_peso_7dias_kg double precision NOT NULL CHECK (tendencia_peso_7dias_kg >= -5 AND tendencia_peso_7dias_kg <= 5),

  objetivo_tipo public.objetivo_nutricion_tipo NOT NULL,
  kcal_target integer NOT NULL CHECK (kcal_target > 800 AND kcal_target < 6000),
  proteina_g integer NOT NULL CHECK (proteina_g > 20 AND proteina_g < 500),
  grasa_g integer NOT NULL CHECK (grasa_g > 10 AND grasa_g < 300),
  carbos_g integer NOT NULL CHECK (carbos_g >= 0 AND carbos_g < 800),
  creatina_g integer NOT NULL CHECK (creatina_g >= 0 AND creatina_g <= 20),
  agua_l double precision NOT NULL CHECK (agua_l > 0 AND agua_l <= 10),
  fecha_ultimo_recalculo date NOT NULL,

  hrv_baseline_7d double precision,
  peso_baseline_2sem double precision,
  ultimo_top_set_squat double precision,
  ultimo_top_set_press double precision,
  bandera_roja boolean NOT NULL DEFAULT false,
  motivo_bandera_roja text,
  ultimo_chequeo text NOT NULL,

  memoria_corta_7dias jsonb NOT NULL DEFAULT '{}'::jsonb,

  drive_file_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.biometria_maestro IS
  'Estado maestro (BIOMETRIA_MAESTRO.json). service_role ignora RLS; anon sin políticas = denegado.';

-- ── RUTINA OFICIAL (día enum + grupo + hidratación + markdown) ────────────

CREATE TABLE public.rutina_oficial (
  dia public.dia_semana PRIMARY KEY,
  nombre_dia text NOT NULL,
  grupo_sesion public.grupo_muscular_rutina NOT NULL,
  hidratacion_gym text,
  ejercicios_markdown text NOT NULL DEFAULT '',
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rutina_oficial IS
  'Calendario semanal derivado de RUTINA_OFICIAL.md (PUSH/PULL/LEG/DESCANSO).';

-- ── ENTRENOS (CSV contexto + Lyfta crudo) ─────────────────────────────────

CREATE TABLE public.entrenos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen public.entreno_origen NOT NULL,
  drive_file_id text,
  row_fingerprint text NOT NULL,
  session_date date NOT NULL,
  session_title text NOT NULL DEFAULT '',
  duration_text text NOT NULL DEFAULT '',
  exercise text NOT NULL DEFAULT '',
  set_type text NOT NULL DEFAULT '',
  weight_raw text NOT NULL DEFAULT '',
  weight_kg double precision,
  reps text NOT NULL DEFAULT '',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origen, row_fingerprint)
);

CREATE INDEX entrenos_historico_session_date_idx ON public.entrenos_historico (session_date);
CREATE INDEX entrenos_historico_exercise_idx ON public.entrenos_historico (exercise);

COMMENT ON TABLE public.entrenos_historico IS
  'Origen drive_csv = filas ENTRENOS_*.csv (Title, Date, Duration, Exercise, Set Type, Weight, Reps). '
  'lyfta_raw = ficheros 01_LYFTA_RAW (payload en raw_payload).';

-- ── MEMORIA IA (HISTORICO_IA_*.txt) ───────────────────────────────────────

CREATE TABLE public.memoria_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL,
  source_filename text NOT NULL,
  line_index integer NOT NULL CHECK (line_index >= 0),
  event_ts timestamptz,
  contenido_linea text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drive_file_id, line_index)
);

CREATE INDEX memoria_ia_event_ts_idx ON public.memoria_ia (event_ts);

-- ── REPORTES HTML (02_RESUMEN_DIARIO_IA) ───────────────────────────────────

CREATE TABLE public.reportes_html (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  tipo public.reporte_html_tipo NOT NULL,
  nombre_archivo text NOT NULL,
  drive_file_id text,
  html_content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha, tipo)
);

CREATE INDEX reportes_html_fecha_idx ON public.reportes_html (fecha);

COMMENT ON TABLE public.reportes_html IS
  'Un registro por (fecha, tipo): PRE_ENTRENO / POST_ENTRENO / RESUMEN_NOCHE.';

-- ── TELEMETRÍA DIARIA ─────────────────────────────────────────────────────

CREATE TABLE public.telemetria_diaria (
  fecha date PRIMARY KEY,
  pulsera_activa boolean NOT NULL DEFAULT false,
  generado_en timestamptz,
  sueno_horas double precision,
  sueno_eficiencia double precision,
  sueno_rem_min integer,
  sueno_profundo_min integer,
  hrv_diario double precision,
  frecuencia_reposo_bpm integer,
  spo2_promedio_pct double precision,
  pasos integer,
  calorias_total double precision,
  active_zone_min integer,
  vo2_max double precision,
  peso_actual_kg double precision,
  resumen_critico jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_completo jsonb NOT NULL DEFAULT '{}'::jsonb,
  drive_json_file_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telemetria_diaria IS
  'Columnas alineadas a resumen_telemetria_critica(); snapshot_completo = snapshot_diario_completo (JSON).';

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.biometria_maestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutina_oficial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrenos_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoria_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_html ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetria_diaria ENABLE ROW LEVEL SECURITY;

-- Plantilla single-user: acceso completo a authenticated (sustituir por auth.uid() = … en multi-tenant).
CREATE POLICY "authenticated_rw_biometria_maestro"
  ON public.biometria_maestro FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_rw_rutina_oficial"
  ON public.rutina_oficial FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_rw_entrenos_historico"
  ON public.entrenos_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_rw_memoria_ia"
  ON public.memoria_ia FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_rw_reportes_html"
  ON public.reportes_html FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_rw_telemetria_diaria"
  ON public.telemetria_diaria FOR ALL TO authenticated USING (true) WITH CHECK (true);
