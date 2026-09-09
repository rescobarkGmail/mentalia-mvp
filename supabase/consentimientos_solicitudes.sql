-- Solicitud consolidada con enlace seguro para respuesta del paciente.
create table if not exists public.consentimientos_solicitudes (
  id uuid primary key,
  profesional_id uuid not null references public.profesional(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  token_hash text not null unique,
  expira_en timestamptz not null,
  respondida_en timestamptz,
  fecha_crea timestamptz not null default now()
);

create index if not exists consentimientos_solicitudes_patient_idx
  on public.consentimientos_solicitudes (profesional_id, paciente_id, fecha_crea desc);

alter table public.consentimientos_solicitudes enable row level security;

drop policy if exists consentimientos_solicitudes_select_own on public.consentimientos_solicitudes;
create policy consentimientos_solicitudes_select_own
  on public.consentimientos_solicitudes for select to authenticated
  using (profesional_id = (select auth.uid()));

grant select on public.consentimientos_solicitudes to authenticated;

drop policy if exists consentimientos_solicitudes_insert_own on public.consentimientos_solicitudes;
create policy consentimientos_solicitudes_insert_own
  on public.consentimientos_solicitudes for insert to authenticated
  with check (profesional_id = (select auth.uid()));

grant insert on public.consentimientos_solicitudes to authenticated;
