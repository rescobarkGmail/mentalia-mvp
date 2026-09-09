-- Consentimiento para grabación temporal y transcripción asistida por IA.
-- Mentalia no almacena el audio; esta tabla solo registra la autorización y su trazabilidad.

create table if not exists public.consentimientos_grabacion (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesional(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  cita_id uuid not null references public.citas(id) on delete cascade,
  estado text not null default 'pendiente',
  version text not null default 'v1',
  texto_snapshot text not null,
  token_hash text unique,
  token_expira timestamptz,
  solicitado_en timestamptz not null default now(),
  respondido_en timestamptz,
  canal text not null default 'correo',
  consentimiento_grabacion boolean,
  consentimiento_transcripcion_ia boolean,
  revocado_en timestamptz,
  ip_respuesta inet,
  user_agent_respuesta text,
  fecha_crea timestamptz not null default now(),
  fecha_actualiza timestamptz not null default now(),
  constraint consentimientos_grabacion_estado_check
    check (estado in ('pendiente', 'aceptado', 'rechazado', 'revocado', 'expirado')),
  constraint consentimientos_grabacion_canal_check
    check (canal in ('correo', 'portal', 'registro_profesional')),
  constraint consentimientos_grabacion_respuesta_check
    check (
      estado in ('pendiente', 'expirado')
      or (respondido_en is not null and consentimiento_grabacion is not null and consentimiento_transcripcion_ia is not null)
    )
);

create index if not exists consentimientos_grabacion_profesional_idx
  on public.consentimientos_grabacion (profesional_id, fecha_crea desc);

create index if not exists consentimientos_grabacion_paciente_cita_idx
  on public.consentimientos_grabacion (paciente_id, cita_id, fecha_crea desc);

alter table public.consentimientos_grabacion enable row level security;

drop policy if exists consentimientos_grabacion_select_own on public.consentimientos_grabacion;
create policy consentimientos_grabacion_select_own
  on public.consentimientos_grabacion for select
  to authenticated
  using (profesional_id = (select auth.uid()));

drop policy if exists consentimientos_grabacion_insert_own on public.consentimientos_grabacion;
create policy consentimientos_grabacion_insert_own
  on public.consentimientos_grabacion for insert
  to authenticated
  with check (profesional_id = (select auth.uid()));

drop policy if exists consentimientos_grabacion_update_own on public.consentimientos_grabacion;
create policy consentimientos_grabacion_update_own
  on public.consentimientos_grabacion for update
  to authenticated
  using (profesional_id = (select auth.uid()))
  with check (profesional_id = (select auth.uid()));

grant select, insert, update on public.consentimientos_grabacion to authenticated;
