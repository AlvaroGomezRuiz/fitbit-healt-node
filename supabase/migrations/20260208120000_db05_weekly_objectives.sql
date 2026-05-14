-- DB-05: objetivos semanales estructurados (peso semanal + PRs).
-- semana_inicio = lunes civil en Europe/Madrid (convención igual que `reporte_semanal`).
-- HTML largo del domingo sigue en `reporte_semanal` (DB-02).

begin;

create table public.weekly_objective (
  semana_inicio date primary key,
  target_weight_kg numeric check (target_weight_kg is null or target_weight_kg > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weekly_objective is
  'Objetivos de la semana (una fila por lunes Madrid). Rellenado tras informe dominical o manual.';

create table public.weekly_pr_target (
  id uuid primary key default gen_random_uuid(),
  semana_inicio date not null references public.weekly_objective (semana_inicio) on delete cascade,
  exercise_name text not null,
  target_weight_kg numeric not null check (target_weight_kg >= 0),
  target_reps integer not null check (target_reps > 0),
  priority smallint not null default 0,
  unique (semana_inicio, exercise_name)
);

comment on table public.weekly_pr_target is
  'PR objetivo por ejercicio y semana. priority para ordenar en UI (mayor = más importante).';

create index idx_weekly_pr_target_semana on public.weekly_pr_target (semana_inicio, priority desc);

create index idx_weekly_objective_updated on public.weekly_objective (updated_at desc);

-- RLS: lectura pública demo; escritura usuario logueado (crons con service_role bypass).
alter table public.weekly_objective enable row level security;

alter table public.weekly_pr_target enable row level security;

create policy "db05_weekly_objective_select_anon_auth"
  on public.weekly_objective for select to anon, authenticated using (true);

create policy "db05_weekly_objective_write_auth"
  on public.weekly_objective for insert to authenticated with check (true);

create policy "db05_weekly_objective_update_auth"
  on public.weekly_objective for update to authenticated using (true) with check (true);

create policy "db05_weekly_objective_delete_auth"
  on public.weekly_objective for delete to authenticated using (true);

create policy "db05_weekly_pr_target_select_anon_auth"
  on public.weekly_pr_target for select to anon, authenticated using (true);

create policy "db05_weekly_pr_target_insert_auth"
  on public.weekly_pr_target for insert to authenticated with check (true);

create policy "db05_weekly_pr_target_update_auth"
  on public.weekly_pr_target for update to authenticated using (true) with check (true);

create policy "db05_weekly_pr_target_delete_auth"
  on public.weekly_pr_target for delete to authenticated using (true);

grant select on table public.weekly_objective to anon, authenticated;

grant insert, update, delete on table public.weekly_objective to authenticated;

grant select on table public.weekly_pr_target to anon, authenticated;

grant insert, update, delete on table public.weekly_pr_target to authenticated;

grant all on table public.weekly_objective to service_role;

grant all on table public.weekly_pr_target to service_role;

commit;
