-- DB-02: informe semanal (domingo 22h), digest de retención 120d (Madrid civil),
-- RPC `retention_run_purge`, endurecimiento RLS (anon sin escritura en tablas sensibles).
-- service_role (crons / admin) ignora RLS; la función es SECURITY DEFINER solo invocable por service_role.

begin;

-- ---------------------------------------------------------------------------
-- 1) Informe semanal largo (unicidad: lunes civil Madrid = semana_inicio)
-- ---------------------------------------------------------------------------
create table public.reporte_semanal (
  semana_inicio date primary key,
  html_content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reporte_semanal_created_at on public.reporte_semanal (created_at desc);

comment on table public.reporte_semanal is
  'Informe largo domingo 22:00. semana_inicio = lunes civil en Europe/Madrid (YYYY-MM-DD).';

-- ---------------------------------------------------------------------------
-- 2) Digest tras rollup lógico antes de borrar detalle (> N días Madrid)
-- ---------------------------------------------------------------------------
create table public.retention_digest (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (
    source_table in (
      'telemetria_diaria',
      'reportes_html',
      'memoria_ia',
      'diario_plan_ia',
      'entrenos_historico'
    )
  ),
  cutoff_madrid_date date not null,
  aggregates jsonb not null default '{}'::jsonb,
  deleted_row_count integer not null check (deleted_row_count >= 0),
  created_at timestamptz not null default now()
);

create index idx_retention_digest_created_at on public.retention_digest (created_at desc);

create index idx_retention_digest_source on public.retention_digest (source_table, cutoff_madrid_date desc);

-- ---------------------------------------------------------------------------
-- 3) RPC retención (MRAI: agrega → insert digest → delete detalle)
-- ---------------------------------------------------------------------------
create or replace function public.retention_run_purge(p_days integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff date;
  ag jsonb;
  del integer;
  out jsonb := '{}'::jsonb;
begin
  if p_days < 30 then
    raise exception 'retention_run_purge: p_days debe ser >= 30 (recibido %)', p_days;
  end if;

  v_cutoff := ((current_timestamp at time zone 'Europe/Madrid')::date - p_days);

  -- telemetria_diaria (PK fecha)
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.telemetria_diaria td where td.fecha < v_cutoff),
      'min_fecha',
      (select min(td.fecha) from public.telemetria_diaria td where td.fecha < v_cutoff),
      'max_fecha',
      (select max(td.fecha) from public.telemetria_diaria td where td.fecha < v_cutoff),
      'avg_pasos',
      (select round(avg(td.pasos)::numeric, 4) from public.telemetria_diaria td where td.fecha < v_cutoff and td.pasos is not null),
      'avg_sueno_horas',
      (select round(avg(td.sueno_horas)::numeric, 4) from public.telemetria_diaria td where td.fecha < v_cutoff and td.sueno_horas is not null)
    )
    into ag;

  delete from public.telemetria_diaria td where td.fecha < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('telemetria_diaria', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('telemetria_diaria', del);

  -- reportes_html
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.reportes_html rh where rh.fecha < v_cutoff),
      'min_fecha',
      (select min(rh.fecha) from public.reportes_html rh where rh.fecha < v_cutoff),
      'max_fecha',
      (select max(rh.fecha) from public.reportes_html rh where rh.fecha < v_cutoff),
      'by_tipo',
      coalesce(
        (
          select jsonb_object_agg(x.t, x.c)
          from (
            select rh2.tipo::text as t, count(*)::bigint as c
            from public.reportes_html rh2
            where rh2.fecha < v_cutoff
            group by rh2.tipo
          ) x
        ),
        '{}'::jsonb
      )
    )
    into ag;

  delete from public.reportes_html rh where rh.fecha < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('reportes_html', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('reportes_html', del);

  -- memoria_ia (usa corte por fecha civil Madrid del created_at UTC)
  select
    jsonb_build_object(
      'deleted_candidates',
      (
        select count(*)::bigint
        from public.memoria_ia mi
        where (mi.created_at at time zone 'Europe/Madrid')::date < v_cutoff
      )
    )
    into ag;

  delete from public.memoria_ia mi
  where (mi.created_at at time zone 'Europe/Madrid')::date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('memoria_ia', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('memoria_ia', del);

  -- diario_plan_ia
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.diario_plan_ia dp where dp.fecha < v_cutoff),
      'min_fecha',
      (select min(dp.fecha) from public.diario_plan_ia dp where dp.fecha < v_cutoff),
      'max_fecha',
      (select max(dp.fecha) from public.diario_plan_ia dp where dp.fecha < v_cutoff)
    )
    into ag;

  delete from public.diario_plan_ia dp where dp.fecha < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('diario_plan_ia', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('diario_plan_ia', del);

  -- entrenos_historico (filas detalle; dedupe Lyfta sigue vía origen + row_fingerprint en ventana reciente)
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.entrenos_historico eh where eh.session_date < v_cutoff),
      'min_session_date',
      (select min(eh.session_date) from public.entrenos_historico eh where eh.session_date < v_cutoff),
      'max_session_date',
      (select max(eh.session_date) from public.entrenos_historico eh where eh.session_date < v_cutoff)
    )
    into ag;

  delete from public.entrenos_historico eh where eh.session_date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('entrenos_historico', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('entrenos_historico', del);

  out := out || jsonb_build_object('cutoff_madrid_date', v_cutoff, 'p_days', p_days);
  return out;
end;
$$;

comment on function public.retention_run_purge(integer) is
  'Purga detalle >p_days (civil Madrid). Inserta filas en retention_digest por tabla. Ejecutar desde cron con service_role (p. ej. semanal).';

revoke all on function public.retention_run_purge(integer) from public;
grant execute on function public.retention_run_purge(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4) RLS endurecido: reemplazar políticas DB-01
-- ---------------------------------------------------------------------------
drop policy if exists "db01_biometria_all_anon_auth" on public.biometria_maestro;
drop policy if exists "db01_telemetria_all_anon_auth" on public.telemetria_diaria;
drop policy if exists "db01_reportes_all_anon_auth" on public.reportes_html;
drop policy if exists "db01_memoria_all_anon_auth" on public.memoria_ia;
drop policy if exists "db01_diario_all_anon_auth" on public.diario_plan_ia;
drop policy if exists "db01_rutina_select_anon_auth" on public.rutina_oficial;
drop policy if exists "db01_rutina_write_auth" on public.rutina_oficial;
drop policy if exists "db01_entrenos_all_anon_auth" on public.entrenos_historico;

-- biometria_maestro: lectura pública; escritura solo usuario autenticado
create policy "db02_biometria_select_anon_auth"
  on public.biometria_maestro for select to anon, authenticated using (true);

create policy "db02_biometria_write_auth"
  on public.biometria_maestro for all to authenticated using (true) with check (true);

-- telemetria: lectura pública; ingesta puede ser anon (ruta Fitbit sin sesión)
create policy "db02_telemetria_select_anon_auth"
  on public.telemetria_diaria for select to anon, authenticated using (true);

create policy "db02_telemetria_write_anon_auth"
  on public.telemetria_diaria for insert to anon, authenticated with check (true);

create policy "db02_telemetria_update_anon_auth"
  on public.telemetria_diaria for update to anon, authenticated using (true) with check (true);

create policy "db02_telemetria_delete_anon_auth"
  on public.telemetria_diaria for delete to anon, authenticated using (true);

-- reportes_html / memoria / diario: solo lectura anon; escritura usuario logueado
create policy "db02_reportes_select_anon_auth"
  on public.reportes_html for select to anon, authenticated using (true);

create policy "db02_reportes_write_auth"
  on public.reportes_html for insert to authenticated with check (true);

create policy "db02_reportes_update_auth"
  on public.reportes_html for update to authenticated using (true) with check (true);

create policy "db02_reportes_delete_auth"
  on public.reportes_html for delete to authenticated using (true);

create policy "db02_memoria_select_anon_auth"
  on public.memoria_ia for select to anon, authenticated using (true);

create policy "db02_memoria_insert_auth"
  on public.memoria_ia for insert to authenticated with check (true);

create policy "db02_memoria_update_auth"
  on public.memoria_ia for update to authenticated using (true) with check (true);

create policy "db02_memoria_delete_auth"
  on public.memoria_ia for delete to authenticated using (true);

create policy "db02_diario_select_anon_auth"
  on public.diario_plan_ia for select to anon, authenticated using (true);

create policy "db02_diario_insert_auth"
  on public.diario_plan_ia for insert to authenticated with check (true);

create policy "db02_diario_update_auth"
  on public.diario_plan_ia for update to authenticated using (true) with check (true);

create policy "db02_diario_delete_auth"
  on public.diario_plan_ia for delete to authenticated using (true);

-- rutina oficial (poco cambio)
create policy "db02_rutina_select_anon_auth"
  on public.rutina_oficial for select to anon, authenticated using (true);

create policy "db02_rutina_write_auth"
  on public.rutina_oficial for all to authenticated using (true) with check (true);

-- entrenos: Lyfta sin service_role sigue pudiendo upsert como anon
create policy "db02_entrenos_select_anon_auth"
  on public.entrenos_historico for select to anon, authenticated using (true);

create policy "db02_entrenos_insert_anon_auth"
  on public.entrenos_historico for insert to anon, authenticated with check (true);

create policy "db02_entrenos_update_anon_auth"
  on public.entrenos_historico for update to anon, authenticated using (true) with check (true);

create policy "db02_entrenos_delete_anon_auth"
  on public.entrenos_historico for delete to anon, authenticated using (true);

-- Nuevas tablas
alter table public.reporte_semanal enable row level security;
alter table public.retention_digest enable row level security;

create policy "db02_reporte_semanal_select"
  on public.reporte_semanal for select to anon, authenticated using (true);

create policy "db02_reporte_semanal_write_auth"
  on public.reporte_semanal for all to authenticated using (true) with check (true);

-- digest solo administración vía service_role (sin políticas = deny anon/auth)
-- service_role bypass RLS en Supabase.

-- Grants nuevos objetos
grant select, insert, delete, update on table public.reporte_semanal to anon, authenticated;

grant all on table public.reporte_semanal to service_role;
grant all on table public.retention_digest to service_role;

commit;
