-- Configuración del enlace público de reserva por profesional.
alter table public.profesional
  add column if not exists slug_publico text,
  add column if not exists reserva_publica_activa boolean not null default false;

create unique index if not exists profesional_slug_publico_unique
  on public.profesional (lower(slug_publico))
  where slug_publico is not null and length(trim(slug_publico)) > 0;

-- La vista pública debe exponer, como mínimo, estos campos:
-- id, nombres, apellidos, slug_publico, reserva_publica_activa,
-- profesion/especialidad_publica, modalidad_atencion,
-- duracion_sesion_minutos y condiciones_reserva.
