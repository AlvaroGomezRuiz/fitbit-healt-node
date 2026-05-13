-- Portada (`fetchHomeDashboard`): `createSupabaseServerClient` usa la clave pública (rol `anon`).
-- `memoria_ia` y `reportes_html` solo tenían políticas `authenticated_rw_*`; sin SELECT para `anon`
-- las consultas devolvían cero filas aunque existieran datos (cron / service_role ya insertan).

CREATE POLICY "anon_select_memoria_ia"
  ON public.memoria_ia
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "anon_select_memoria_ia" ON public.memoria_ia IS
  'Single-user MVP: lectura dashboard con anon; mismo criterio que diario_plan_ia / telemetria_diaria. Endurecer con auth.uid() en multi-tenant.';

CREATE POLICY "anon_select_reportes_html"
  ON public.reportes_html
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "anon_select_reportes_html" ON public.reportes_html IS
  'Single-user MVP: lectura dashboard con anon. Las escrituras siguen en service_role / authenticated.';
