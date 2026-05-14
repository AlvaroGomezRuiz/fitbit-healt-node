-- Seed idempotente: rutina semanal (markdown alineado a RUTINA_OFICIAL.md).
begin;

delete from public.rutina_oficial;

insert into public.rutina_oficial (dia, nombre_dia, grupo_sesion, hidratacion_gym, ejercicios_markdown)
values
  ('MON', 'Lunes', 'PULL', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', $pull_md$# Rutina oficial Álvaro Gómez Ruiz — Mayo 2026

Microciclo semanal de 5 sesiones. Lunes-martes-miércoles-jueves-viernes. Sábado y domingo descanso.

| Día | Sesión | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sábado / Domingo | Descanso | – |

Suplementación diaria fija:
- **Creatina monohidrato 7 g/día** (siempre).
- **Magnesio + Omega-3**: OPCIONALES, todavía no comprados. La IA NO debe asumir que ya los toma.

Codificación de SET en Lyfta:
- `W` = Warm-up
- `F` = Feeder / Approximación
- `T` = Top Set
- `B` = Back-off
- `D` = Drop set
- Número (`1`, `2`, `3`) = Serie normal
- `@N` = RIR auto-reportado (Reps in Reserve)


---

## PULL — lunes y jueves

### 1) Barbell Lying Row on Rack — 3 series
- **Altura banco**: 4
- **Descanso**: 2:30
- Regla de progresión: si TS sale 8 reps a RIR 2, +2.5 kg la siguiente. Aguantar el peso hasta sacar 10 reps a RIR 2.
- **Últimos pesos**: T 70 kg × 12 @0 · T 70 kg × 9 @0 · B 70 kg × 10 @0

### 2) Lever High Row — 3 series
- **Altura asiento**: 5
- **Descanso**: 2:30
- **Últimos pesos**: T 90 kg × 12 @0 · B 80 kg × 12 @0 · 3 80 kg × 9 @0

### 3) Lever One Arm Low Row — 2 series
- **Altura asiento**: 5 viéndose, medio abajo altura sillín
- **Descanso**: 2:30
- **Últimos pesos**: T 70 kg × 9 @0 · 2 70 kg × 9 @0

### 4) Cable Unilateral Bicep Curl — 3 series
- **Descanso**: 2:30
- **Últimos pesos**: 1 25 kg × 8 @0 · 2 20 kg × 9 @0 · 3 20 kg × 9 @0

### 5) Close Grip Curl — 3 series
- **Descanso**: 2:30
- **Últimos pesos**: 1 15 kg × 11 · 2 17.5 kg × 9 · 3 15 kg × 10

### 6) Lever Seated Reverse Fly — 3 series
- **Altura asiento**: 1
- **Descanso**: 2:30
- **Últimos pesos**: 1 22.5 kg × 9 @1 · 2 22.5 kg × 9 @1 · 3 22.5 kg × 8 @0


## Reglas globales de progresión

- Progresión por **doble progresión** (reps primero, luego peso).
- Subida estándar: **+2.5 kg** cuando se alcanza el límite alto del rango (5/8/9/10 reps según ejercicio).
- En semanas con HRV bajo o sueño < 6 h: NO subir peso, mantener.
- En `Lever Belt Squat`: la progresión se valora SOLO sobre el TOP SET de 5 reps.
- En `Smith Deadlift`: progresión sobre el TOP SET de 9 reps.
$pull_md$),
  ('TUE', 'Martes', 'PUSH', 'Agua de coco', $push_md$# Rutina oficial Álvaro Gómez Ruiz — Mayo 2026

Microciclo semanal de 5 sesiones. Lunes-martes-miércoles-jueves-viernes. Sábado y domingo descanso.

| Día | Sesión | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sábado / Domingo | Descanso | – |

Suplementación diaria fija:
- **Creatina monohidrato 7 g/día** (siempre).
- **Magnesio + Omega-3**: OPCIONALES, todavía no comprados. La IA NO debe asumir que ya los toma.

Codificación de SET en Lyfta:
- `W` = Warm-up
- `F` = Feeder / Approximación
- `T` = Top Set
- `B` = Back-off
- `D` = Drop set
- Número (`1`, `2`, `3`) = Serie normal
- `@N` = RIR auto-reportado (Reps in Reserve)


## PUSH — martes y viernes

### 1) Lever Incline Chest Press — 4 series
- **Altura asiento**: 6
- **Descanso**: 2:30
- Regla de progresión: TS 8 reps RIR 2 = +2.5 kg
- **Últimos pesos**: W 40 kg × 12 · F 80 kg × 2 · T 100 kg × 6 @1 · B 80 kg × 9 @1

### 2) Lever Chest Press — 3 series
- **Altura asiento**: 4
- **Descanso**: 2:30
- **Últimos pesos**: 1 65 kg × 7 @0 · 2 55 kg × 8 @1 · 3 60 kg × 6 @0

### 3) Lever Shoulder Press — 4 series (la última es drop)
- **Altura asiento**: 5
- **Descanso**: 2:30
- **Últimos pesos**: 1 70 kg × 7 @1 · 2 70 kg × 8 @0 · 3 65 kg × 7 @0 · D 40 kg × 11 @0

### 4) High Pulley Overhead Tricep Extension — 3 series
- **Altura asiento**: 22 viéndose
- **Descanso**: 2:30
- **Últimos pesos**: 1 37.5 kg × 11 @0 · 2 37.5 kg × 8 @0 · 3 32.5 kg × 12 @1

### 5) Lever Triceps Extension — 3 series
- **Descanso**: 2:30
- **Últimos pesos**: 1 25 kg × 12 · 2 25 kg × 12 · 3 25 kg × 12

### 6) Lever Lateral Raise — **TRISERIE en DROPSET — NO confundir con 9 series**
- **IMPORTANTE estructural**: En Lyfta aparecen como 3 ejercicios separados de 3 series cada uno (= 9 series visibles). NO es así.
- **REALIDAD**: es **1 ejercicio con 3 series**. Cada "serie" es un dropset triserie sin descanso interno:
  - **10 reps @ 30 kg** → bajar peso → **10 reps @ 20 kg** → bajar peso → **10 reps @ 15 kg**
  - Total **30 reps por serie**, al fallo en cada peso.
- **Series totales**: 3 (no 9). Descanso 2:30 entre series.
- **Volumen total**: 90 reps de hombro lateral por sesión PUSH.


## Reglas globales de progresión

- Progresión por **doble progresión** (reps primero, luego peso).
- Subida estándar: **+2.5 kg** cuando se alcanza el límite alto del rango (5/8/9/10 reps según ejercicio).
- En semanas con HRV bajo o sueño < 6 h: NO subir peso, mantener.
- En `Lever Belt Squat`: la progresión se valora SOLO sobre el TOP SET de 5 reps.
- En `Smith Deadlift`: progresión sobre el TOP SET de 9 reps.
$push_md$),
  ('WED', 'Miércoles', 'LEG', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', $leg_md$# Rutina oficial Álvaro Gómez Ruiz — Mayo 2026

Microciclo semanal de 5 sesiones. Lunes-martes-miércoles-jueves-viernes. Sábado y domingo descanso.

| Día | Sesión | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sábado / Domingo | Descanso | – |

Suplementación diaria fija:
- **Creatina monohidrato 7 g/día** (siempre).
- **Magnesio + Omega-3**: OPCIONALES, todavía no comprados. La IA NO debe asumir que ya los toma.

Codificación de SET en Lyfta:
- `W` = Warm-up
- `F` = Feeder / Approximación
- `T` = Top Set
- `B` = Back-off
- `D` = Drop set
- Número (`1`, `2`, `3`) = Serie normal
- `@N` = RIR auto-reportado (Reps in Reserve)


## LEG — miércoles

### 1) Lever Belt Squat — 4 series (W + F + T + B)
- **Warm-up obligatorio**: 85 kg × 5 → 150 kg × 2 (descanso 5')
- **TOP SET**: explosivo. Si saco 5 reps, +2.5 kg la próxima semana.
- **Distribución**:
  - W: 45 kg / lado
  - W2: 77.5 kg / lado
  - TOP SET: 102.5 kg / lado
  - BACK OFF: 92.5 kg / lado
- **Descanso entre series**: 5 min
- **Últimos pesos**: W 90 × 5 @5 · F 155 × 2 @5 · T 205 × 5 @0 · B 185 × 5 @0

### 2) Smith Deadlift — 4 series (variante anti-cuádriceps)
**SETUP**:
- STRAPS obligatorios.
- STEP bajo los pies (si tocas topes).
- PESO: solo contar discos (barra = 0).

**TÉCNICA (ANTI-CUÁDRICEPS)**:
- RODILLAS: desbloquear y cemento (no se doblan al bajar).
- FOCO: tibias verticales + culo a la pared de atrás.
- SENSACIÓN: ardor en isquio, NADA en pierna delantera.

**APROXIMACIÓN (feeders, cero fatiga)**:
- F1: 40 kg (20/lado) × 5 reps (lento, sentir estiramiento).
- F2: 60 kg (30/lado) × 1 rep (explosiva, despertar SNC).

**ESTRUCTURA (hipertrofia)**:
- T (TOP SET): 70 kg (35/lado) × 6-9 reps al fallo técnico. Si saco 9 reps, +2.5 kg la próxima semana.
- B (BACK-OFF): 60 kg (30/lado) × 8-10 reps. Control, bombeo, bajada 3 s.

- **Descanso**: 5 min
- **Últimos pesos**: F 40 × 7 @5 · F 60 × 2 · T 65 × 8 @0 · B 60 × 8 @0

### 3) Lever Lying Leg Curl — 3 series en DROPSET
- **DROPSET**: 25 kg → 20 kg → 15 kg. Al fallo en todas. Sin descanso interno.
- Próxima sesión subir pesos (los actuales ya están actualizados).
- **Descanso entre series**: 3:30
- **Últimos pesos**: 1 25 × 15 @0 · D 20 × 9 @0 · D 15 × 7 @0


## Reglas globales de progresión

- Progresión por **doble progresión** (reps primero, luego peso).
- Subida estándar: **+2.5 kg** cuando se alcanza el límite alto del rango (5/8/9/10 reps según ejercicio).
- En semanas con HRV bajo o sueño < 6 h: NO subir peso, mantener.
- En `Lever Belt Squat`: la progresión se valora SOLO sobre el TOP SET de 5 reps.
- En `Smith Deadlift`: progresión sobre el TOP SET de 9 reps.
$leg_md$),
  ('THU', 'Jueves', 'PULL', 'Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)', $pull_md$# Rutina oficial Álvaro Gómez Ruiz — Mayo 2026

Microciclo semanal de 5 sesiones. Lunes-martes-miércoles-jueves-viernes. Sábado y domingo descanso.

| Día | Sesión | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sábado / Domingo | Descanso | – |

Suplementación diaria fija:
- **Creatina monohidrato 7 g/día** (siempre).
- **Magnesio + Omega-3**: OPCIONALES, todavía no comprados. La IA NO debe asumir que ya los toma.

Codificación de SET en Lyfta:
- `W` = Warm-up
- `F` = Feeder / Approximación
- `T` = Top Set
- `B` = Back-off
- `D` = Drop set
- Número (`1`, `2`, `3`) = Serie normal
- `@N` = RIR auto-reportado (Reps in Reserve)


---

## PULL — lunes y jueves

### 1) Barbell Lying Row on Rack — 3 series
- **Altura banco**: 4
- **Descanso**: 2:30
- Regla de progresión: si TS sale 8 reps a RIR 2, +2.5 kg la siguiente. Aguantar el peso hasta sacar 10 reps a RIR 2.
- **Últimos pesos**: T 70 kg × 12 @0 · T 70 kg × 9 @0 · B 70 kg × 10 @0

### 2) Lever High Row — 3 series
- **Altura asiento**: 5
- **Descanso**: 2:30
- **Últimos pesos**: T 90 kg × 12 @0 · B 80 kg × 12 @0 · 3 80 kg × 9 @0

### 3) Lever One Arm Low Row — 2 series
- **Altura asiento**: 5 viéndose, medio abajo altura sillín
- **Descanso**: 2:30
- **Últimos pesos**: T 70 kg × 9 @0 · 2 70 kg × 9 @0

### 4) Cable Unilateral Bicep Curl — 3 series
- **Descanso**: 2:30
- **Últimos pesos**: 1 25 kg × 8 @0 · 2 20 kg × 9 @0 · 3 20 kg × 9 @0

### 5) Close Grip Curl — 3 series
- **Descanso**: 2:30
- **Últimos pesos**: 1 15 kg × 11 · 2 17.5 kg × 9 · 3 15 kg × 10

### 6) Lever Seated Reverse Fly — 3 series
- **Altura asiento**: 1
- **Descanso**: 2:30
- **Últimos pesos**: 1 22.5 kg × 9 @1 · 2 22.5 kg × 9 @1 · 3 22.5 kg × 8 @0


## Reglas globales de progresión

- Progresión por **doble progresión** (reps primero, luego peso).
- Subida estándar: **+2.5 kg** cuando se alcanza el límite alto del rango (5/8/9/10 reps según ejercicio).
- En semanas con HRV bajo o sueño < 6 h: NO subir peso, mantener.
- En `Lever Belt Squat`: la progresión se valora SOLO sobre el TOP SET de 5 reps.
- En `Smith Deadlift`: progresión sobre el TOP SET de 9 reps.
$pull_md$),
  ('FRI', 'Viernes', 'PUSH', 'Agua de coco', $push_md$# Rutina oficial Álvaro Gómez Ruiz — Mayo 2026

Microciclo semanal de 5 sesiones. Lunes-martes-miércoles-jueves-viernes. Sábado y domingo descanso.

| Día | Sesión | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sábado / Domingo | Descanso | – |

Suplementación diaria fija:
- **Creatina monohidrato 7 g/día** (siempre).
- **Magnesio + Omega-3**: OPCIONALES, todavía no comprados. La IA NO debe asumir que ya los toma.

Codificación de SET en Lyfta:
- `W` = Warm-up
- `F` = Feeder / Approximación
- `T` = Top Set
- `B` = Back-off
- `D` = Drop set
- Número (`1`, `2`, `3`) = Serie normal
- `@N` = RIR auto-reportado (Reps in Reserve)


## PUSH — martes y viernes

### 1) Lever Incline Chest Press — 4 series
- **Altura asiento**: 6
- **Descanso**: 2:30
- Regla de progresión: TS 8 reps RIR 2 = +2.5 kg
- **Últimos pesos**: W 40 kg × 12 · F 80 kg × 2 · T 100 kg × 6 @1 · B 80 kg × 9 @1

### 2) Lever Chest Press — 3 series
- **Altura asiento**: 4
- **Descanso**: 2:30
- **Últimos pesos**: 1 65 kg × 7 @0 · 2 55 kg × 8 @1 · 3 60 kg × 6 @0

### 3) Lever Shoulder Press — 4 series (la última es drop)
- **Altura asiento**: 5
- **Descanso**: 2:30
- **Últimos pesos**: 1 70 kg × 7 @1 · 2 70 kg × 8 @0 · 3 65 kg × 7 @0 · D 40 kg × 11 @0

### 4) High Pulley Overhead Tricep Extension — 3 series
- **Altura asiento**: 22 viéndose
- **Descanso**: 2:30
- **Últimos pesos**: 1 37.5 kg × 11 @0 · 2 37.5 kg × 8 @0 · 3 32.5 kg × 12 @1

### 5) Lever Triceps Extension — 3 series
- **Descanso**: 2:30
- **Últimos pesos**: 1 25 kg × 12 · 2 25 kg × 12 · 3 25 kg × 12

### 6) Lever Lateral Raise — **TRISERIE en DROPSET — NO confundir con 9 series**
- **IMPORTANTE estructural**: En Lyfta aparecen como 3 ejercicios separados de 3 series cada uno (= 9 series visibles). NO es así.
- **REALIDAD**: es **1 ejercicio con 3 series**. Cada "serie" es un dropset triserie sin descanso interno:
  - **10 reps @ 30 kg** → bajar peso → **10 reps @ 20 kg** → bajar peso → **10 reps @ 15 kg**
  - Total **30 reps por serie**, al fallo en cada peso.
- **Series totales**: 3 (no 9). Descanso 2:30 entre series.
- **Volumen total**: 90 reps de hombro lateral por sesión PUSH.


## Reglas globales de progresión

- Progresión por **doble progresión** (reps primero, luego peso).
- Subida estándar: **+2.5 kg** cuando se alcanza el límite alto del rango (5/8/9/10 reps según ejercicio).
- En semanas con HRV bajo o sueño < 6 h: NO subir peso, mantener.
- En `Lever Belt Squat`: la progresión se valora SOLO sobre el TOP SET de 5 reps.
- En `Smith Deadlift`: progresión sobre el TOP SET de 9 reps.
$push_md$),
  ('SAT', 'Sábado', 'DESCANSO', null, $rest_md$# Rutina oficial Álvaro Gómez Ruiz — Mayo 2026

Microciclo semanal de 5 sesiones. Lunes-martes-miércoles-jueves-viernes. Sábado y domingo descanso.

| Día | Sesión | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sábado / Domingo | Descanso | – |

Suplementación diaria fija:
- **Creatina monohidrato 7 g/día** (siempre).
- **Magnesio + Omega-3**: OPCIONALES, todavía no comprados. La IA NO debe asumir que ya los toma.

Codificación de SET en Lyfta:
- `W` = Warm-up
- `F` = Feeder / Approximación
- `T` = Top Set
- `B` = Back-off
- `D` = Drop set
- Número (`1`, `2`, `3`) = Serie normal
- `@N` = RIR auto-reportado (Reps in Reserve)


## Descanso — sábado y domingo
Cardio suave opcional. Sin sesión de hipertrofia.

## Reglas globales de progresión

- Progresión por **doble progresión** (reps primero, luego peso).
- Subida estándar: **+2.5 kg** cuando se alcanza el límite alto del rango (5/8/9/10 reps según ejercicio).
- En semanas con HRV bajo o sueño < 6 h: NO subir peso, mantener.
- En `Lever Belt Squat`: la progresión se valora SOLO sobre el TOP SET de 5 reps.
- En `Smith Deadlift`: progresión sobre el TOP SET de 9 reps.
$rest_md$),
  ('SUN', 'Domingo', 'DESCANSO', null, $rest_md$# Rutina oficial Álvaro Gómez Ruiz — Mayo 2026

Microciclo semanal de 5 sesiones. Lunes-martes-miércoles-jueves-viernes. Sábado y domingo descanso.

| Día | Sesión | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sábado / Domingo | Descanso | – |

Suplementación diaria fija:
- **Creatina monohidrato 7 g/día** (siempre).
- **Magnesio + Omega-3**: OPCIONALES, todavía no comprados. La IA NO debe asumir que ya los toma.

Codificación de SET en Lyfta:
- `W` = Warm-up
- `F` = Feeder / Approximación
- `T` = Top Set
- `B` = Back-off
- `D` = Drop set
- Número (`1`, `2`, `3`) = Serie normal
- `@N` = RIR auto-reportado (Reps in Reserve)


## Descanso — sábado y domingo
Cardio suave opcional. Sin sesión de hipertrofia.

## Reglas globales de progresión

- Progresión por **doble progresión** (reps primero, luego peso).
- Subida estándar: **+2.5 kg** cuando se alcanza el límite alto del rango (5/8/9/10 reps según ejercicio).
- En semanas con HRV bajo o sueño < 6 h: NO subir peso, mantener.
- En `Lever Belt Squat`: la progresión se valora SOLO sobre el TOP SET de 5 reps.
- En `Smith Deadlift`: progresión sobre el TOP SET de 9 reps.
$rest_md$);

commit;
