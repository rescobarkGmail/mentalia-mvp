-- Configuración de avisos para reservas y recordatorios.
-- La entrega de mensajes se implementará en un paso posterior; esta tabla
-- permite dejar las preferencias listas y parametrizadas por profesional.
create table if not exists public.notificaciones_config (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesional(id) on delete cascade,
  confirmacion_reserva_email boolean not null default true,
  confirmacion_reserva_whatsapp boolean not null default false,
  cambios_reserva_email boolean not null default true,
  cambios_reserva_whatsapp boolean not null default false,
  recordatorio_email_activo boolean not null default true,
  recordatorio_whatsapp_activo boolean not null default false,
  horas_antes_recordatorio_email integer not null default 27,
  minutos_antes_recordatorio_whatsapp integer not null default 60,
  zona_horaria text not null default 'America/Santiago',
  fecha_crea timestamptz not null default now(),
  fecha_actualiza timestamptz not null default now(),
  constraint notificaciones_config_profesional_unique unique (profesional_id),
  constraint notificaciones_config_email_hours_check
    check (horas_antes_recordatorio_email between 1 and 168),
  constraint notificaciones_config_whatsapp_minutes_check
    check (minutos_antes_recordatorio_whatsapp between 5 and 1440)
);

alter table public.notificaciones_config enable row level security;

drop policy if exists notificaciones_config_select_own on public.notificaciones_config;
create policy notificaciones_config_select_own
  on public.notificaciones_config for select
  to authenticated
  using (profesional_id = (select auth.uid()));

drop policy if exists notificaciones_config_insert_own on public.notificaciones_config;
create policy notificaciones_config_insert_own
  on public.notificaciones_config for insert
  to authenticated
  with check (profesional_id = (select auth.uid()));

drop policy if exists notificaciones_config_update_own on public.notificaciones_config;
create policy notificaciones_config_update_own
  on public.notificaciones_config for update
  to authenticated
  using (profesional_id = (select auth.uid()))
  with check (profesional_id = (select auth.uid()));

grant select, insert, update on public.notificaciones_config to authenticated;
