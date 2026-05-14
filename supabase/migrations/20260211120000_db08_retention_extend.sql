-- DB-08: extender retención 120d (Madrid) a tablas DB-03/06/07/04/05 y agregados algo más ricos (opción B).
-- Reemplaza `retention_run_purge` y el CHECK de `retention_digest.source_table` (append-only; no editar DB-02).

begin;

alter table public.retention_digest drop constraint if exists retention_digest_source_table_check;

alter table public.retention_digest add constraint retention_digest_source_table_check check (
  source_table in (
    'telemetria_diaria',
    'reportes_html',
    'memoria_ia',
    'diario_plan_ia',
    'entrenos_historico',
    'workout_session',
    'telemetry_datapoint',
    'nutrition_shopping_week',
    'nutrition_menu_week',
    'nutrition_memory_note',
    'weekly_objective',
    'report_run',
    'cron_invocation'
  )
);

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

  -- telemetria_diaria (PK fecha) + agregados ampliados para digest LLM
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
      (select round(avg(td.sueno_horas)::numeric, 4) from public.telemetria_diaria td where td.fecha < v_cutoff and td.sueno_horas is not null),
      'min_peso_kg',
      (select min(td.peso_actual_kg) from public.telemetria_diaria td where td.fecha < v_cutoff and td.peso_actual_kg is not null),
      'max_peso_kg',
      (select max(td.peso_actual_kg) from public.telemetria_diaria td where td.fecha < v_cutoff and td.peso_actual_kg is not null),
      'avg_hrv',
      (select round(avg(td.hrv_diario)::numeric, 4) from public.telemetria_diaria td where td.fecha < v_cutoff and td.hrv_diario is not null)
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

  -- memoria_ia
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

  -- entrenos_historico
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.entrenos_historico eh where eh.session_date < v_cutoff),
      'min_session_date',
      (select min(eh.session_date) from public.entrenos_historico eh where eh.session_date < v_cutoff),
      'max_session_date',
      (select max(eh.session_date) from public.entrenos_historico eh where eh.session_date < v_cutoff),
      'distinct_sessions',
      (
        select count(*)::bigint
        from (
          select distinct eh2.session_date, eh2.session_title
          from public.entrenos_historico eh2
          where eh2.session_date < v_cutoff
        ) d
      )
    )
    into ag;

  delete from public.entrenos_historico eh where eh.session_date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('entrenos_historico', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('entrenos_historico', del);

  -- workout_session (CASCADE workout_set_line)
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.workout_session ws where ws.session_date < v_cutoff),
      'min_session_date',
      (select min(ws.session_date) from public.workout_session ws where ws.session_date < v_cutoff),
      'max_session_date',
      (select max(ws.session_date) from public.workout_session ws where ws.session_date < v_cutoff),
      'by_grupo',
      coalesce(
        (
          select jsonb_object_agg(x.g::text, x.c)
          from (
            select ws2.grupo as g, count(*)::bigint as c
            from public.workout_session ws2
            where ws2.session_date < v_cutoff
            group by ws2.grupo
          ) x
        ),
        '{}'::jsonb
      )
    )
    into ag;

  delete from public.workout_session ws where ws.session_date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('workout_session', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('workout_session', del);

  -- telemetry_datapoint
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.telemetry_datapoint td where td.madrid_date < v_cutoff),
      'min_madrid_date',
      (select min(td.madrid_date) from public.telemetry_datapoint td where td.madrid_date < v_cutoff),
      'max_madrid_date',
      (select max(td.madrid_date) from public.telemetry_datapoint td where td.madrid_date < v_cutoff),
      'by_data_type',
      coalesce(
        (
          select jsonb_object_agg(x.dt, x.c)
          from (
            select td2.data_type as dt, count(*)::bigint as c
            from public.telemetry_datapoint td2
            where td2.madrid_date < v_cutoff
            group by td2.data_type
          ) x
        ),
        '{}'::jsonb
      )
    )
    into ag;

  delete from public.telemetry_datapoint td where td.madrid_date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('telemetry_datapoint', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('telemetry_datapoint', del);

  -- nutrition_shopping_week
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.nutrition_shopping_week n where n.semana_inicio < v_cutoff),
      'min_semana_inicio',
      (select min(n.semana_inicio) from public.nutrition_shopping_week n where n.semana_inicio < v_cutoff),
      'max_semana_inicio',
      (select max(n.semana_inicio) from public.nutrition_shopping_week n where n.semana_inicio < v_cutoff)
    )
    into ag;

  delete from public.nutrition_shopping_week n where n.semana_inicio < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('nutrition_shopping_week', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('nutrition_shopping_week', del);

  -- nutrition_menu_week
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.nutrition_menu_week n where n.semana_inicio < v_cutoff),
      'min_semana_inicio',
      (select min(n.semana_inicio) from public.nutrition_menu_week n where n.semana_inicio < v_cutoff),
      'max_semana_inicio',
      (select max(n.semana_inicio) from public.nutrition_menu_week n where n.semana_inicio < v_cutoff)
    )
    into ag;

  delete from public.nutrition_menu_week n where n.semana_inicio < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('nutrition_menu_week', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('nutrition_menu_week', del);

  -- nutrition_memory_note (corte por fecha civil Madrid del created_at)
  select
    jsonb_build_object(
      'deleted_candidates',
      (
        select count(*)::bigint
        from public.nutrition_memory_note nm
        where (nm.created_at at time zone 'Europe/Madrid')::date < v_cutoff
      )
    )
    into ag;

  delete from public.nutrition_memory_note nm
  where (nm.created_at at time zone 'Europe/Madrid')::date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('nutrition_memory_note', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('nutrition_memory_note', del);

  -- weekly_objective (CASCADE weekly_pr_target)
  select
    jsonb_build_object(
      'deleted_candidates',
      (select count(*)::bigint from public.weekly_objective wo where wo.semana_inicio < v_cutoff),
      'min_semana_inicio',
      (select min(wo.semana_inicio) from public.weekly_objective wo where wo.semana_inicio < v_cutoff),
      'max_semana_inicio',
      (select max(wo.semana_inicio) from public.weekly_objective wo where wo.semana_inicio < v_cutoff),
      'avg_target_weight_kg',
      (select round(avg(wo.target_weight_kg)::numeric, 4) from public.weekly_objective wo where wo.semana_inicio < v_cutoff and wo.target_weight_kg is not null)
    )
    into ag;

  delete from public.weekly_objective wo where wo.semana_inicio < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('weekly_objective', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('weekly_objective', del);

  -- report_run
  select
    jsonb_build_object(
      'deleted_candidates',
      (
        select count(*)::bigint
        from public.report_run rr
        where (rr.run_at at time zone 'Europe/Madrid')::date < v_cutoff
      ),
      'by_kind',
      coalesce(
        (
          select jsonb_object_agg(x.k::text, x.c)
          from (
            select rr2.report_kind as k, count(*)::bigint as c
            from public.report_run rr2
            where (rr2.run_at at time zone 'Europe/Madrid')::date < v_cutoff
            group by rr2.report_kind
          ) x
        ),
        '{}'::jsonb
      )
    )
    into ag;

  delete from public.report_run rr
  where (rr.run_at at time zone 'Europe/Madrid')::date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('report_run', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('report_run', del);

  -- cron_invocation
  select
    jsonb_build_object(
      'deleted_candidates',
      (
        select count(*)::bigint
        from public.cron_invocation ci
        where (ci.started_at at time zone 'Europe/Madrid')::date < v_cutoff
      ),
      'by_route',
      coalesce(
        (
          select jsonb_object_agg(x.r, x.c)
          from (
            select ci2.route_path as r, count(*)::bigint as c
            from public.cron_invocation ci2
            where (ci2.started_at at time zone 'Europe/Madrid')::date < v_cutoff
            group by ci2.route_path
          ) x
        ),
        '{}'::jsonb
      )
    )
    into ag;

  delete from public.cron_invocation ci
  where (ci.started_at at time zone 'Europe/Madrid')::date < v_cutoff;
  get diagnostics del = row_count;
  if del > 0 then
    insert into public.retention_digest (source_table, cutoff_madrid_date, aggregates, deleted_row_count)
    values ('cron_invocation', v_cutoff, coalesce(ag, '{}'::jsonb), del);
  end if;
  out := out || jsonb_build_object('cron_invocation', del);

  out := out || jsonb_build_object('cutoff_madrid_date', v_cutoff, 'p_days', p_days);
  return out;
end;
$$;

comment on function public.retention_run_purge(integer) is
  'Purga detalle >p_days (civil Madrid). Incluye telemetría granular, entreno estructurado, nutrición semanal, memoria nutrición, objetivos semana, logs LLM/cron. Digest en retention_digest.';

commit;
