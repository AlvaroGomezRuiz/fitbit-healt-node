-- DB-01: esquema public alineado con `frontend/lib/data/*` (Zod + upserts de crons / actions).
-- Usuario único: RLS permisiva para `anon` + `authenticated` (home RSC sin sesión).
-- service_role (crons) ignora RLS en Supabase.

begin;

-- Enums ---------------------------------------------------------------------
create type public.dia_semana as enum ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

create type public.grupo_muscular_rutina as enum ('PUSH', 'PULL', 'LEG', 'DESCANSO');

create type public.reporte_html_tipo as enum ('PRE_ENTRENO', 'POST_ENTRENO', 'RESUMEN_NOCHE');

create type public.entreno_origen as enum ('drive_csv', 'lyfta_raw');

create type public.objetivo_nutricion_tipo as enum (
  'CUTTING_AGRESIVO',
  'CUTTING_SUAVE',
  'MANTENIMIENTO',
  'VOLUMEN_LIMPIO',
  'VOLUMEN_AGRESIVO'
);

-- Tablas --------------------------------------------------------------------
create table public.biometria_maestro (
  id text primary key check (id = 'singleton'),
  nombre text not null,
  fecha_nacimiento date not null,
  edad_anos integer not null,
  sexo char(1) not null check (sexo in ('M', 'F')),
  altura_cm integer not null,
  peso_kg numeric not null,
  fecha_ultimo_pesaje date not null,
  imc numeric not null,
  body_fat_estimado_pct numeric not null,
  masa_libre_grasa_kg numeric not null,
  tendencia_peso_7dias_kg numeric not null,
  objetivo_tipo public.objetivo_nutricion_tipo not null,
  kcal_target integer not null,
  proteina_g integer not null,
  grasa_g integer not null,
  carbos_g integer not null,
  creatina_g numeric not null,
  agua_l numeric not null,
  fecha_ultimo_recalculo date not null,
  hrv_baseline_7d numeric,
  peso_baseline_2sem numeric,
  ultimo_top_set_squat numeric,
  ultimo_top_set_press numeric,
  bandera_roja boolean not null default false,
  motivo_bandera_roja text,
  ultimo_chequeo date not null,
  memoria_corta_7dias jsonb not null default '{}'::jsonb,
  drive_file_id text,
  updated_at timestamptz not null default now()
);

create table public.telemetria_diaria (
  fecha date primary key,
  pulsera_activa boolean not null default false,
  generado_en timestamptz,
  sueno_horas numeric,
  sueno_eficiencia numeric,
  sueno_rem_min numeric,
  sueno_profundo_min numeric,
  hrv_diario numeric,
  frecuencia_reposo_bpm numeric,
  spo2_promedio_pct numeric,
  pasos integer,
  calorias_total numeric,
  active_zone_min integer,
  vo2_max numeric,
  peso_actual_kg numeric,
  resumen_critico jsonb not null default '{}'::jsonb,
  snapshot_completo jsonb not null default '{}'::jsonb,
  drive_json_file_id text,
  updated_at timestamptz not null default now()
);

create table public.reportes_html (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo public.reporte_html_tipo not null,
  nombre_archivo text not null,
  drive_file_id text,
  html_content text not null,
  created_at timestamptz not null default now(),
  unique (fecha, tipo)
);

create table public.memoria_ia (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null,
  source_filename text not null,
  line_index integer not null check (line_index >= 0),
  event_ts timestamptz,
  contenido_linea text not null,
  created_at timestamptz not null default now(),
  unique (drive_file_id, line_index)
);

create table public.diario_plan_ia (
  fecha date primary key,
  markdown text not null,
  updated_at timestamptz not null default now()
);

create table public.rutina_oficial (
  dia public.dia_semana primary key,
  nombre_dia text not null,
  grupo_sesion public.grupo_muscular_rutina not null,
  hidratacion_gym text,
  ejercicios_markdown text not null
);

create table public.entrenos_historico (
  id uuid primary key default gen_random_uuid(),
  origen public.entreno_origen not null,
  drive_file_id text,
  row_fingerprint text not null,
  session_date date not null,
  session_title text not null,
  duration_text text not null default '',
  exercise text not null default '',
  set_type text not null default '',
  weight_raw text not null default '',
  weight_kg numeric,
  reps text not null default '',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (origen, row_fingerprint)
);

-- Índices -------------------------------------------------------------------
create index idx_entrenos_historico_session_date on public.entrenos_historico (session_date desc);

create index idx_memoria_ia_created_at on public.memoria_ia (created_at desc);

create index idx_reportes_html_fecha on public.reportes_html (fecha desc);

-- RLS -----------------------------------------------------------------------
alter table public.biometria_maestro enable row level security;
alter table public.telemetria_diaria enable row level security;
alter table public.reportes_html enable row level security;
alter table public.memoria_ia enable row level security;
alter table public.diario_plan_ia enable row level security;
alter table public.rutina_oficial enable row level security;
alter table public.entrenos_historico enable row level security;

-- Políticas: usuario único / demos con anon (ajustar en DB-02 cuando login sea obligatorio).
create policy "db01_biometria_all_anon_auth"
  on public.biometria_maestro
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "db01_telemetria_all_anon_auth"
  on public.telemetria_diaria
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "db01_reportes_all_anon_auth"
  on public.reportes_html
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "db01_memoria_all_anon_auth"
  on public.memoria_ia
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "db01_diario_all_anon_auth"
  on public.diario_plan_ia
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "db01_rutina_select_anon_auth"
  on public.rutina_oficial
  for select
  to anon, authenticated
  using (true);

create policy "db01_rutina_write_auth"
  on public.rutina_oficial
  for all
  to authenticated
  using (true)
  with check (true);

create policy "db01_entrenos_all_anon_auth"
  on public.entrenos_historico
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Grants PostgREST -----------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant all on all tables in schema public to anon, authenticated;

grant all on all sequences in schema public to anon, authenticated;

grant usage on type public.dia_semana to anon, authenticated;
grant usage on type public.grupo_muscular_rutina to anon, authenticated;
grant usage on type public.reporte_html_tipo to anon, authenticated;
grant usage on type public.entreno_origen to anon, authenticated;
grant usage on type public.objetivo_nutricion_tipo to anon, authenticated;

commit;
