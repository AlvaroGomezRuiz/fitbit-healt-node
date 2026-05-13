-- Endurecimiento: el linter advierte que funciones SECURITY DEFINER en `public`
-- quedan expuestas como RPC vía PostgREST. Los triggers siguen funcionando sin
-- GRANT a `anon`/`authenticated`.
--
-- Políticas `authenticated_rw_*` con USING (true) siguen siendo WARN aceptado
-- en MVP single-user hasta migrar a `auth.uid()` + `profiles`.

REVOKE ALL ON FUNCTION public.handle_profiles_on_auth_user_created() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_profiles_on_auth_user_created() FROM anon, authenticated;

-- Función ajena al repo (p. ej. creada en Dashboard); solo revocar si existe.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated';
  END IF;
END;
$$;
