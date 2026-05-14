-- DB-04: trazabilidad de ejecuciones LLM (informes) y crons HTTP (Vercel).
-- No modifica columnas de `reportes_html` / `reporte_semanal`.
-- Purga >120d: añadir estas tablas en DB-08 (`retention_run_purge` + allowlist `retention_digest`).

begin;

create type public.report_run_kind as enum (
  'PRE_ENTRENO',
  'POST_ENTRENO',
  'RESUMEN_NOCHE',
  'WEEKLY'
);

create type public.report_run_status as enum ('ok', 'error');

create table public.report_run (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  report_kind public.report_run_kind not null,
  target_madrid_date date,
  semana_inicio date,
  model_used text not null default '',
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  status public.report_run_status not null,
  error_message text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0)
);

comment on table public.report_run is
  'Metadatos por generación LLM. target_madrid_date = día del informe diario; semana_inicio = lunes Madrid si kind = WEEKLY.';

create index idx_report_run_run_at on public.report_run (run_at desc);

create index idx_report_run_kind_target on public.report_run (report_kind, target_madrid_date);

create index idx_report_run_kind_semana on public.report_run (report_kind, semana_inicio);

create table public.cron_invocation (
  id uuid primary key default gen_random_uuid(),
  route_path text not null,
  started_at timestamptz not null default now(),
  http_status smallint check (http_status is null or (http_status >= 100 and http_status <= 599)),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_summary text
);

comment on table public.cron_invocation is
  'Auditoría genérica de rutas cron (sin cuerpo HTML). error_summary debe ir acotado en aplicación (sin stack ni secretos).';

create index idx_cron_invocation_started on public.cron_invocation (started_at desc);

create index idx_cron_invocation_route on public.cron_invocation (route_path, started_at desc);

-- RLS: lectura pública para la app demo; escritura solo vía service_role (bypass) o authenticated si insertas desde sesión.
alter table public.report_run enable row level security;

alter table public.cron_invocation enable row level security;

create policy "db04_report_run_select_anon_auth"
  on public.report_run for select to anon, authenticated using (true);

create policy "db04_report_run_insert_auth"
  on public.report_run for insert to authenticated with check (true);

create policy "db04_report_run_update_auth"
  on public.report_run for update to authenticated using (true) with check (true);

create policy "db04_report_run_delete_auth"
  on public.report_run for delete to authenticated using (true);

create policy "db04_cron_invocation_select_anon_auth"
  on public.cron_invocation for select to anon, authenticated using (true);

create policy "db04_cron_invocation_insert_auth"
  on public.cron_invocation for insert to authenticated with check (true);

create policy "db04_cron_invocation_update_auth"
  on public.cron_invocation for update to authenticated using (true) with check (true);

create policy "db04_cron_invocation_delete_auth"
  on public.cron_invocation for delete to authenticated using (true);

grant usage on type public.report_run_kind to anon, authenticated;

grant usage on type public.report_run_status to anon, authenticated;

grant select on table public.report_run to anon, authenticated;

grant insert, update, delete on table public.report_run to authenticated;

grant all on table public.report_run to service_role;

grant select on table public.cron_invocation to anon, authenticated;

grant insert, update, delete on table public.cron_invocation to authenticated;

grant all on table public.cron_invocation to service_role;

commit;
