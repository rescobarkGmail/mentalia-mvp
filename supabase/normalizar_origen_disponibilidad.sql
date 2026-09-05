-- Ejecutar en el SQL Editor del proyecto Supabase.
-- Convierte las reglas históricas al origen canónico de Mentalia.
begin;

alter table public.disponibilidad_profesional
  add column if not exists descanso_minutos integer not null default 0;

alter table public.disponibilidad_profesional
  drop constraint if exists disponibilidad_profesional_descanso_minutos_check;

alter table public.disponibilidad_profesional
  add constraint disponibilidad_profesional_descanso_minutos_check
  check (descanso_minutos between 0 and 120);

update public.disponibilidad_profesional
set origen = 'mentalia'
where origen = 'google_calendar';

create or replace view public.v_disponibilidad_reserva_publica as
select
  id,
  profesional_id,
  dia_semana,
  hora_inicio,
  hora_fin,
  duracion_minutos,
  fecha_inicio,
  fecha_fin,
  activo,
  origen
from public.disponibilidad_profesional
where activo = true
  and origen = 'mentalia';

commit;
