-- DB-06: nutrición — compra semanal, menú semanal (JSONB), notas memoria, prohibidos.
-- semana_inicio = lunes civil Europe/Madrid (misma convención que `weekly_objective`).
-- Seed de prohibidos: lista base del producto (idempotente ON CONFLICT).

begin;

create table public.nutrition_shopping_week (
  semana_inicio date primary key,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_shopping_items_is_array check (jsonb_typeof(items) = 'array')
);

comment on table public.nutrition_shopping_week is
  'Lista compra semanal. items = array ordenado de objetos { "name", "quantity", "priority" } (validar en app con Zod).';

create table public.nutrition_menu_week (
  semana_inicio date primary key,
  days jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_menu_days_is_object check (jsonb_typeof(days) = 'object')
);

comment on table public.nutrition_menu_week is
  'Menú L–D. days = objeto con claves MON..SUN; cada día = secciones (desayuno, comida, etc.) con gramos (contrato en app).';

create table public.nutrition_memory_note (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  pinned boolean not null default false
);

comment on table public.nutrition_memory_note is
  'Caja de peticiones / memoria para prompts (gustos, aversiones, anotaciones).';

create index idx_nutrition_memory_note_created on public.nutrition_memory_note (created_at desc);

create index idx_nutrition_memory_note_pinned on public.nutrition_memory_note (pinned desc, created_at desc);

create table public.nutrition_banned_item (
  id uuid primary key default gen_random_uuid(),
  label text not null unique
);

comment on table public.nutrition_banned_item is
  'Alimentos/platos excluidos de compra y menú.';

create index idx_nutrition_shopping_updated on public.nutrition_shopping_week (updated_at desc);

create index idx_nutrition_menu_updated on public.nutrition_menu_week (updated_at desc);

-- RLS: lectura pública; escritura solo authenticated (crons service_role bypass).
alter table public.nutrition_shopping_week enable row level security;

alter table public.nutrition_menu_week enable row level security;

alter table public.nutrition_memory_note enable row level security;

alter table public.nutrition_banned_item enable row level security;

create policy "db06_nutrition_shopping_select_anon_auth"
  on public.nutrition_shopping_week for select to anon, authenticated using (true);

create policy "db06_nutrition_shopping_write_auth"
  on public.nutrition_shopping_week for insert to authenticated with check (true);

create policy "db06_nutrition_shopping_update_auth"
  on public.nutrition_shopping_week for update to authenticated using (true) with check (true);

create policy "db06_nutrition_shopping_delete_auth"
  on public.nutrition_shopping_week for delete to authenticated using (true);

create policy "db06_nutrition_menu_select_anon_auth"
  on public.nutrition_menu_week for select to anon, authenticated using (true);

create policy "db06_nutrition_menu_write_auth"
  on public.nutrition_menu_week for insert to authenticated with check (true);

create policy "db06_nutrition_menu_update_auth"
  on public.nutrition_menu_week for update to authenticated using (true) with check (true);

create policy "db06_nutrition_menu_delete_auth"
  on public.nutrition_menu_week for delete to authenticated using (true);

create policy "db06_nutrition_memory_select_anon_auth"
  on public.nutrition_memory_note for select to anon, authenticated using (true);

create policy "db06_nutrition_memory_insert_auth"
  on public.nutrition_memory_note for insert to authenticated with check (true);

create policy "db06_nutrition_memory_update_auth"
  on public.nutrition_memory_note for update to authenticated using (true) with check (true);

create policy "db06_nutrition_memory_delete_auth"
  on public.nutrition_memory_note for delete to authenticated using (true);

create policy "db06_nutrition_banned_select_anon_auth"
  on public.nutrition_banned_item for select to anon, authenticated using (true);

create policy "db06_nutrition_banned_insert_auth"
  on public.nutrition_banned_item for insert to authenticated with check (true);

create policy "db06_nutrition_banned_update_auth"
  on public.nutrition_banned_item for update to authenticated using (true) with check (true);

create policy "db06_nutrition_banned_delete_auth"
  on public.nutrition_banned_item for delete to authenticated using (true);

grant select on table public.nutrition_shopping_week to anon, authenticated;

grant insert, update, delete on table public.nutrition_shopping_week to authenticated;

grant select on table public.nutrition_menu_week to anon, authenticated;

grant insert, update, delete on table public.nutrition_menu_week to authenticated;

grant select on table public.nutrition_memory_note to anon, authenticated;

grant insert, update, delete on table public.nutrition_memory_note to authenticated;

grant select on table public.nutrition_banned_item to anon, authenticated;

grant insert, update, delete on table public.nutrition_banned_item to authenticated;

grant all on table public.nutrition_shopping_week to service_role;

grant all on table public.nutrition_menu_week to service_role;

grant all on table public.nutrition_memory_note to service_role;

grant all on table public.nutrition_banned_item to service_role;

-- Prohibidos base (producto). No inventa menús; solo catálogo fijo.
insert into public.nutrition_banned_item (label)
values
  ('Lechuga'),
  ('Tomate'),
  ('Huevo duro'),
  ('Huevo frito'),
  ('Huevo a la plancha'),
  ('Bonito'),
  ('Atún (lata o pescado)'),
  ('Hígado'),
  ('Casquería'),
  ('Ensaladilla rusa'),
  ('Ensaladas en general'),
  ('Comidas frías'),
  ('Gazpacho'),
  ('Salmorejo')
on conflict (label) do nothing;

commit;
