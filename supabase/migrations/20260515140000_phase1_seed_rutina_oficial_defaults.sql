-- Semana mínima alineada a `RUTINA_OFICIAL.md` en la raíz del repo.
-- `migrate_from_drive` puede sustituir filas (upsert por `dia`). Aquí solo rellenamos si faltan.

INSERT INTO public.rutina_oficial (dia, nombre_dia, grupo_sesion, hidratacion_gym, ejercicios_markdown)
VALUES
  ('MON', 'Lunes', 'PULL', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', ''),
  ('TUE', 'Martes', 'PUSH', 'Agua de coco', ''),
  ('WED', 'Miércoles', 'LEG', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', ''),
  ('THU', 'Jueves', 'PULL', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', ''),
  ('FRI', 'Viernes', 'PUSH', 'Agua de coco', ''),
  ('SAT', 'Sábado', 'DESCANSO', NULL, ''),
  ('SUN', 'Domingo', 'DESCANSO', NULL, '')
ON CONFLICT (dia) DO NOTHING;
