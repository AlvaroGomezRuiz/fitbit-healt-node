-- DB-07: telemetría granular Google Health / Fitbit Air (opción A).
-- Catálogo = 31 data types oficiales (parámetro filter snake_case). Fuente:
-- https://developers.google.com/health/data-types
-- `telemetria_diaria` (DB-01) sigue siendo agregado diario; aquí van puntos / intervalos crudos o normalizados en `payload`.

begin;

create table public.telemetry_data_type_catalog (
  filter_key text primary key,
  scope_kind text not null,
  label_es text not null
);

comment on table public.telemetry_data_type_catalog is
  'Claves filter API (snake_case) según documentación Google Health v4.';

insert into public.telemetry_data_type_catalog (filter_key, scope_kind, label_es)
values
  ('active_minutes', 'activity_and_fitness', 'Minutos activos'),
  ('active_zone_minutes', 'activity_and_fitness', 'Minutos en zona activa'),
  ('activity_level', 'activity_and_fitness', 'Nivel de actividad'),
  ('altitude', 'activity_and_fitness', 'Altitud'),
  ('body_fat', 'health_metrics_and_measurements', 'Grasa corporal'),
  ('calories_in_heart_rate_zone', 'activity_and_fitness', 'Calorías por zona FC'),
  ('daily_heart_rate_variability', 'health_metrics_and_measurements', 'VFC diaria'),
  ('daily_heart_rate_zones', 'health_metrics_and_measurements', 'Zonas FC diarias'),
  ('daily_oxygen_saturation', 'health_metrics_and_measurements', 'SpO2 diario'),
  ('daily_respiratory_rate', 'health_metrics_and_measurements', 'Frecuencia respiratoria diaria'),
  ('daily_resting_heart_rate', 'health_metrics_and_measurements', 'FC en reposo diaria'),
  ('daily_sleep_temperature_derivations', 'health_metrics_and_measurements', 'Variación temperatura sueño'),
  ('daily_vo2_max', 'activity_and_fitness', 'VO2 máx diario'),
  ('distance', 'activity_and_fitness', 'Distancia'),
  ('exercise', 'activity_and_fitness', 'Ejercicio / sesión'),
  ('floors', 'activity_and_fitness', 'Pisos'),
  ('heart_rate', 'health_metrics_and_measurements', 'Frecuencia cardíaca'),
  ('heart_rate_variability', 'health_metrics_and_measurements', 'Variabilidad FC (muestra)'),
  ('height', 'health_metrics_and_measurements', 'Altura'),
  ('hydration_log', 'nutrition', 'Hidratación'),
  ('oxygen_saturation', 'health_metrics_and_measurements', 'Saturación oxígeno'),
  ('respiratory_rate_sleep_summary', 'health_metrics_and_measurements', 'Respiración en sueño (resumen)'),
  ('run_vo2_max', 'activity_and_fitness', 'VO2 máx carrera'),
  ('sedentary_period', 'activity_and_fitness', 'Periodo sedentario'),
  ('sleep', 'sleep', 'Sueño'),
  ('steps', 'activity_and_fitness', 'Pasos'),
  ('swim_lengths_data', 'activity_and_fitness', 'Natación (largos)'),
  ('time_in_heart_rate_zone', 'activity_and_fitness', 'Tiempo en zona FC'),
  ('total_calories', 'activity_and_fitness', 'Calorías totales'),
  ('vo2_max', 'activity_and_fitness', 'VO2 máx (muestra)'),
  ('weight', 'health_metrics_and_measurements', 'Peso')
on conflict (filter_key) do nothing;

create table public.telemetry_datapoint (
  id uuid primary key default gen_random_uuid(),
  madrid_date date not null,
  data_type text not null references public.telemetry_data_type_catalog (filter_key) on delete restrict,
  interval_start timestamptz,
  interval_end timestamptz,
  payload jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  external_name text
);

comment on table public.telemetry_datapoint is
  'Puntos/intervalos por tipo. madrid_date = día civil Europe/Madrid. external_name = name recurso API si existe, para dedupe.';

create index idx_telemetry_datapoint_madrid_type on public.telemetry_datapoint (madrid_date desc, data_type);

create index idx_telemetry_datapoint_ingested on public.telemetry_datapoint (ingested_at desc);

create unique index idx_telemetry_datapoint_dedupe_external
  on public.telemetry_datapoint (data_type, external_name)
  where external_name is not null;

-- RLS: mismo patrón que `telemetria_diaria` (ingesta sin sesión).
alter table public.telemetry_data_type_catalog enable row level security;

alter table public.telemetry_datapoint enable row level security;

create policy "db07_catalog_select_anon_auth"
  on public.telemetry_data_type_catalog for select to anon, authenticated using (true);

-- Catálogo solo lectura para clientes (cambios vía migración).
create policy "db07_datapoint_select_anon_auth"
  on public.telemetry_datapoint for select to anon, authenticated using (true);

create policy "db07_datapoint_insert_anon_auth"
  on public.telemetry_datapoint for insert to anon, authenticated with check (true);

create policy "db07_datapoint_update_anon_auth"
  on public.telemetry_datapoint for update to anon, authenticated using (true) with check (true);

create policy "db07_datapoint_delete_anon_auth"
  on public.telemetry_datapoint for delete to anon, authenticated using (true);

grant select on table public.telemetry_data_type_catalog to anon, authenticated, service_role;

grant select, insert, update, delete on table public.telemetry_datapoint to anon, authenticated;

grant all on table public.telemetry_datapoint to service_role;

grant select on table public.telemetry_data_type_catalog to service_role;

commit;
