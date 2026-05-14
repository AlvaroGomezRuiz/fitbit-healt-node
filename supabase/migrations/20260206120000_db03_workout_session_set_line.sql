-- DB-03: sesiones de entreno estructuradas (Lyfta pegado) + líneas de serie.
-- Complementa `entrenos_historico` (planos); no lo modifica.
-- Purga >120d: ampliar `retention_run_purge` en migración futura (DB-08) para incluir `workout_session`.

begin;

-- Origen de la fila de sesión (extensible sin romper filas existentes).
create type public.workout_session_source as enum ('lyfta_paste');

create table public.workout_session (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  grupo public.grupo_muscular_rutina not null,
  title text not null,
  raw_lyfta_text text not null default '',
  source public.workout_session_source not null default 'lyfta_paste',
  row_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (source, row_fingerprint)
);

comment on table public.workout_session is
  'Sesión de gimnasio (p. ej. texto Lyfta pegado). Fecha civil Europe/Madrid. Dedupe vía row_fingerprint.';

create index idx_workout_session_session_date on public.workout_session (session_date desc);

create index idx_workout_session_grupo_date on public.workout_session (grupo, session_date desc);

create table public.workout_set_line (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_session (id) on delete cascade,
  line_order integer not null check (line_order >= 0),
  exercise_name text not null default '',
  set_type text not null default '',
  weight_kg numeric,
  reps text not null default '',
  rir numeric,
  raw_line text not null default '',
  unique (session_id, line_order)
);

comment on table public.workout_set_line is
  'Series normalizadas por sesión. line_order establece el orden del pegado.';

create index idx_workout_set_line_session on public.workout_set_line (session_id);

create index idx_workout_set_line_exercise_date on public.workout_set_line (exercise_name, session_id);

-- RLS: mismo patrón que `entrenos_historico` (anon puede escribir para ingesta sin login en demo).
alter table public.workout_session enable row level security;

alter table public.workout_set_line enable row level security;

create policy "db03_workout_session_select_anon_auth"
  on public.workout_session for select to anon, authenticated using (true);

create policy "db03_workout_session_insert_anon_auth"
  on public.workout_session for insert to anon, authenticated with check (true);

create policy "db03_workout_session_update_anon_auth"
  on public.workout_session for update to anon, authenticated using (true) with check (true);

create policy "db03_workout_session_delete_anon_auth"
  on public.workout_session for delete to anon, authenticated using (true);

create policy "db03_workout_set_line_select_anon_auth"
  on public.workout_set_line for select to anon, authenticated using (true);

create policy "db03_workout_set_line_insert_anon_auth"
  on public.workout_set_line for insert to anon, authenticated with check (true);

create policy "db03_workout_set_line_update_anon_auth"
  on public.workout_set_line for update to anon, authenticated using (true) with check (true);

create policy "db03_workout_set_line_delete_anon_auth"
  on public.workout_set_line for delete to anon, authenticated using (true);

grant usage on type public.workout_session_source to anon, authenticated;

grant select, insert, update, delete on table public.workout_session to anon, authenticated;

grant select, insert, update, delete on table public.workout_set_line to anon, authenticated;

grant all on table public.workout_session to service_role;

grant all on table public.workout_set_line to service_role;

commit;
