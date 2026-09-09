-- Habilita el registro de auditoría cuando un profesional genera una solicitud.
drop policy if exists consentimientos_paciente_eventos_insert_own on public.consentimientos_paciente_eventos;
create policy consentimientos_paciente_eventos_insert_own
  on public.consentimientos_paciente_eventos for insert to authenticated
  with check (exists (
    select 1 from public.consentimientos_paciente c
    where c.id = consentimiento_id
      and c.profesional_id = (select auth.uid())
  ));

grant insert on public.consentimientos_paciente_eventos to authenticated;
