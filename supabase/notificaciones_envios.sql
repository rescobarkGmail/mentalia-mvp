-- Auditoría y control de duplicados para envíos de notificaciones.
-- Ejecutar antes de activar schedulers/cron de recordatorios.
create table if not exists public.notificaciones_envios (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesional(id) on delete cascade,
  paciente_id uuid references public.pacientes(id) on delete set null,
  cita_id uuid references public.citas(id) on delete cascade,
  canal text not null,
  tipo text not null,
  estado text not null default 'pendiente',
  proveedor text,
  destinatario text,
  plantilla text,
  detalle_error text,
  enviado_en timestamptz,
  fecha_crea timestamptz not null default now(),
  fecha_actualiza timestamptz not null default now(),
  constraint notificaciones_envios_canal_check
    check (canal in ('email', 'whatsapp')),
  constraint notificaciones_envios_tipo_check
    check (tipo in (
      'confirmacion_reserva',
      'reserva_reagendada',
      'reserva_cancelada',
      'recordatorio_27h',
      'recordatorio_60m'
    )),
  constraint notificaciones_envios_estado_check
    check (estado in ('pendiente', 'procesando', 'enviado', 'fallido', 'omitido'))
);

create unique index if not exists notificaciones_envios_cita_canal_tipo_uidx
  on public.notificaciones_envios (cita_id, canal, tipo)
  where cita_id is not null;

create index if not exists notificaciones_envios_profesional_fecha_idx
  on public.notificaciones_envios (profesional_id, fecha_crea desc);

alter table public.notificaciones_envios enable row level security;

drop policy if exists notificaciones_envios_select_own on public.notificaciones_envios;
create policy notificaciones_envios_select_own
  on public.notificaciones_envios for select
  to authenticated
  using (profesional_id = (select auth.uid()));

grant select on public.notificaciones_envios to authenticated;
