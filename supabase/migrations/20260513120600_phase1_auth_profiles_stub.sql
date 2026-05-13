-- Opcional: tabla `profiles` 1:1 con `auth.users` para RLS futura con `auth.uid()`.
-- NO modifica ni elimina políticas `anon` existentes (aditivo).
--
-- Tras aplicar: en Supabase Dashboard → Authentication → URL configuration,
-- añade la URL de callback de la app, p. ej. `https://<host>/auth/callback`.

-- ── Tabla stub ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Perfil mínimo ligado a auth.users. Base para políticas USING (id = auth.uid()) en fases posteriores.';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ── Sincronizar fila al crear usuario en GoTrue ───────────────────────────

CREATE OR REPLACE FUNCTION public.handle_profiles_on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

CREATE TRIGGER on_auth_user_created_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profiles_on_auth_user_created();

-- ── Plantilla comentada (multi-tenant / RLS estricta) ──────────────────────
-- Sustituye políticas `authenticated_rw_*` genéricas cuando encaje el modelo:
--
-- CREATE POLICY "authenticated_select_biometria_own"
--   ON public.biometria_maestro
--   FOR SELECT
--   TO authenticated
--   USING (exists (select 1 from public.profiles p where p.id = auth.uid()));
--
-- CREATE POLICY "authenticated_update_biometria_own"
--   ON public.biometria_maestro
--   FOR UPDATE
--   TO authenticated
--   USING (exists (select 1 from public.profiles p where p.id = auth.uid()))
--   WITH CHECK (exists (select 1 from public.profiles p where p.id = auth.uid()));
