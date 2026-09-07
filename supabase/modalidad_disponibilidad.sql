-- Modalidad ofrecida por cada regla de disponibilidad.
alter table public.disponibilidad_profesional
  add column if not exists modalidad text not null default 'presencial';

alter table public.disponibilidad_profesional
  drop constraint if exists disponibilidad_profesional_modalidad_check;

alter table public.disponibilidad_profesional
  add constraint disponibilidad_profesional_modalidad_check
  check (modalidad in ('presencial', 'online', 'hibrida', 'domicilio'));
