-- Expone los datos necesarios para construir correctamente los bloques públicos.
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
  origen,
  descanso_minutos,
  modalidad
from public.disponibilidad_profesional
where activo = true
  and origen = 'mentalia';

grant select on public.v_disponibilidad_reserva_publica to anon, authenticated;
