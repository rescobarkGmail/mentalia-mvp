-- Plantillas personalizables para el correo de reserva aceptada.
-- Ejecutar después de notificaciones_config.sql en Supabase.
alter table public.notificaciones_config
  add column if not exists confirmacion_reserva_email_asunto text not null default 'Reserva confirmada con FluyePro',
  add column if not exists confirmacion_reserva_email_plantilla text not null default $$Hola {{nombre_paciente}},

Tu reserva con {{nombre_profesional}} fue confirmada.

Fecha: {{fecha}}
Hora: {{hora_inicio}} - {{hora_fin}}
Modalidad: {{modalidad}}

Información de pago
El pago aún no está habilitado. Esta sección es informativa y no se realizará ningún cobro.

Saludos,
FluyePro$$;
