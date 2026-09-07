-- Modalidad elegida por el paciente (necesaria para sesiones híbridas).
alter table public.citas
  add column if not exists modalidad text not null default 'presencial';

alter table public.citas
  drop constraint if exists citas_modalidad_check;

alter table public.citas
  add constraint citas_modalidad_check
  check (modalidad in ('presencial', 'online', 'domicilio'));

-- La función pública reservar_hora_publica debe incorporar el parámetro
-- p_modalidad y asignarlo al insertar en public.citas.
