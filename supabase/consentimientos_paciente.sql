-- Administrador de consentimientos granulares del paciente.
-- Convive con consentimientos_grabacion.sql; no elimina ni modifica sus datos.

create table if not exists public.consentimiento_tipos (
  codigo text primary key,
  titulo text not null,
  descripcion text not null,
  opcional boolean not null default true,
  activo boolean not null default true,
  fecha_crea timestamptz not null default now(),
  fecha_actualiza timestamptz not null default now()
);

insert into public.consentimiento_tipos (codigo, titulo, descripcion, opcional)
values
  ('datos_atencion', 'Tratamiento de datos para gestionar la atención', 'Autorizo el tratamiento de mis datos personales para coordinar, prestar y administrar mi atención profesional.', false),
  ('ficha_clinica', 'Registro y conservación de la ficha clínica', 'Autorizo el registro y conservación de la información necesaria en mi ficha clínica, conforme a la normativa aplicable.', false),
  ('grabacion_audio', 'Grabación temporal de audio', 'Autorizo la grabación temporal de la sesión. El audio no será almacenado como archivo permanente.', true),
  ('transcripcion_ia', 'Transcripción asistida por inteligencia artificial', 'Autorizo el procesamiento temporal del audio mediante un proveedor de inteligencia artificial para generar una transcripción clínica.', true),
  ('recordatorios_email', 'Recordatorios por correo electrónico', 'Autorizo el envío de recordatorios y avisos relacionados con mis citas al correo registrado.', true),
  ('recordatorios_whatsapp', 'Recordatorios por WhatsApp', 'Autorizo el envío de recordatorios y avisos relacionados con mis citas al número registrado.', true),
  ('comunicaciones_informativas', 'Comunicaciones informativas', 'Autorizo el envío de información relacionada con servicios y novedades de FluyePro/Mentalia.', true)
on conflict (codigo) do update set
  titulo = excluded.titulo,
  descripcion = excluded.descripcion,
  opcional = excluded.opcional,
  fecha_actualiza = now();

create table if not exists public.consentimientos_paciente (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesional(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  codigo text not null references public.consentimiento_tipos(codigo),
  estado text not null default 'pendiente',
  version text not null default 'v1',
  texto_snapshot text not null,
  solicitud_id uuid,
  otorgado_en timestamptz,
  revocado_en timestamptz,
  respondido_en timestamptz,
  canal text not null default 'portal',
  ip_respuesta inet,
  user_agent_respuesta text,
  fecha_crea timestamptz not null default now(),
  fecha_actualiza timestamptz not null default now(),
  constraint consentimientos_paciente_estado_check
    check (estado in ('pendiente', 'aceptado', 'rechazado', 'revocado', 'expirado')),
  constraint consentimientos_paciente_canal_check
    check (canal in ('correo', 'portal', 'registro_profesional')),
  constraint consentimientos_paciente_response_check
    check (
      estado in ('pendiente', 'expirado')
      or respondido_en is not null
    ),
  constraint consentimientos_paciente_unique_type
    unique (profesional_id, paciente_id, codigo)
);

create table if not exists public.consentimientos_paciente_eventos (
  id uuid primary key default gen_random_uuid(),
  consentimiento_id uuid not null references public.consentimientos_paciente(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  version text not null,
  canal text not null,
  ip_respuesta inet,
  user_agent_respuesta text,
  fecha_crea timestamptz not null default now()
);

create index if not exists consentimientos_paciente_lookup_idx
  on public.consentimientos_paciente (profesional_id, paciente_id, estado);

create index if not exists consentimientos_paciente_eventos_lookup_idx
  on public.consentimientos_paciente_eventos (consentimiento_id, fecha_crea desc);

alter table public.consentimiento_tipos enable row level security;
alter table public.consentimientos_paciente enable row level security;
alter table public.consentimientos_paciente_eventos enable row level security;

drop policy if exists consentimiento_tipos_select_authenticated on public.consentimiento_tipos;
create policy consentimiento_tipos_select_authenticated
  on public.consentimiento_tipos for select to authenticated using (activo = true);

drop policy if exists consentimientos_paciente_select_own on public.consentimientos_paciente;
create policy consentimientos_paciente_select_own
  on public.consentimientos_paciente for select to authenticated
  using (profesional_id = (select auth.uid()));

drop policy if exists consentimientos_paciente_insert_own on public.consentimientos_paciente;
create policy consentimientos_paciente_insert_own
  on public.consentimientos_paciente for insert to authenticated
  with check (profesional_id = (select auth.uid()));

drop policy if exists consentimientos_paciente_update_own on public.consentimientos_paciente;
create policy consentimientos_paciente_update_own
  on public.consentimientos_paciente for update to authenticated
  using (profesional_id = (select auth.uid()))
  with check (profesional_id = (select auth.uid()));

drop policy if exists consentimientos_paciente_eventos_select_own on public.consentimientos_paciente_eventos;
create policy consentimientos_paciente_eventos_select_own
  on public.consentimientos_paciente_eventos for select to authenticated
  using (exists (select 1 from public.consentimientos_paciente c where c.id = consentimiento_id and c.profesional_id = (select auth.uid())));

grant select on public.consentimiento_tipos to authenticated;
grant select, insert, update on public.consentimientos_paciente to authenticated;
grant select on public.consentimientos_paciente_eventos to authenticated;
