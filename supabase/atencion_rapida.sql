-- Ejecutar primero en QA. Todo el cambio se aplica o revierte en conjunto.
do $migracion$
begin

alter table public.pacientes alter column apellidos drop not null;
alter table public.pacientes alter column identificador drop not null;
alter table public.pacientes alter column fecha_nacimiento drop not null;
alter table public.pacientes add column if not exists registro_provisional boolean not null default false;
alter table public.pacientes add column if not exists tipo_identificador text;
alter table public.pacientes add column if not exists pais_emisor_identificador text;
alter table public.pacientes drop constraint if exists pacientes_tipo_documento_check;
alter table public.pacientes add constraint pacientes_tipo_documento_check check (
  (tipo_identificador is null and pais_emisor_identificador is null)
  or (tipo_identificador is not null and pais_emisor_identificador is not null
    and tipo_identificador in ('rut', 'pasaporte', 'documento_nacional', 'otro')
    and pais_emisor_identificador ~ '^[A-Z]{2}$'
    and (tipo_identificador <> 'rut' or pais_emisor_identificador = 'CL'))
);

alter table public.citas add column if not exists atencion_rapida boolean not null default false;
alter table public.citas add column if not exists conflicto_horario_aceptado boolean not null default false;

-- El índice anterior no distingue tipos ni países. La nueva clave sí.
drop index if exists public.pacientes_profesional_rut_normalizado_uidx;
create or replace function public.normalizar_rut_guardado(valor text)
returns text language sql immutable set search_path = public as $rut$
  select case
    when upper(regexp_replace(valor, '[.[:space:]-]', '', 'g')) ~ '^[0-9]{1,8}[0-9K]$'
    then regexp_replace(upper(regexp_replace(valor, '[.[:space:]-]', '', 'g')), '^(.*)(.)$', '\1-\2')
    else nullif(btrim(valor), '')
  end;
$rut$;

create or replace function public.normalizar_documento_guardado(valor text, tipo text, pais text)
returns text language sql immutable set search_path = public as $documento$
  select case when tipo = 'rut' and pais = 'CL'
    then public.normalizar_rut_guardado(valor) else nullif(btrim(valor), '') end;
$documento$;

create or replace function public.normalizar_identificador_paciente()
returns trigger language plpgsql set search_path = public as $normalizar$
begin
  new.identificador := public.normalizar_documento_guardado(new.identificador, new.tipo_identificador, new.pais_emisor_identificador);
  return new;
end;
$normalizar$;
drop trigger if exists pacientes_normalizar_identificador on public.pacientes;
create trigger pacientes_normalizar_identificador before insert or update of identificador, tipo_identificador, pais_emisor_identificador on public.pacientes
for each row execute function public.normalizar_identificador_paciente();

-- Solo se clasifican los cuatro RUT confirmados explícitamente por el usuario.
-- Los demás documentos históricos permanecen sin clasificar y sin transformar.
update public.pacientes p set tipo_identificador = 'rut', pais_emisor_identificador = 'CL'
from (values
  ('b0cc9a8a-03a8-4f69-ae00-60cde35a14e1'::uuid, '12501143-8'),
  ('061f483a-5783-44c1-bd97-f8865cbfdd5d'::uuid, '8000008-1'),
  ('716ad8ca-b562-4f9c-a191-72e51544ffcb'::uuid, '8000010-3'),
  ('20acce7b-df3f-4bcc-892a-976c3e887c86'::uuid, '8000011-1')
) as confirmados(id, rut)
where p.id = confirmados.id and p.profesional_id = '82e91499-f13f-4865-ab1a-1c2809827266'
  and public.normalizar_rut_guardado(p.identificador) = confirmados.rut
  and p.tipo_identificador is null;

create unique index if not exists pacientes_documento_unico_idx on public.pacientes (
  profesional_id, coalesce(tipo_identificador, ''), coalesce(pais_emisor_identificador, ''),
  public.normalizar_documento_guardado(identificador, tipo_identificador, pais_emisor_identificador)
) where nullif(btrim(identificador), '') is not null;

create or replace function public.actualizar_estado_provisional()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.registro_provisional then
    new.registro_provisional := nullif(btrim(new.apellidos), '') is null
      or nullif(btrim(new.identificador), '') is null or new.fecha_nacimiento is null
      or new.tipo_identificador is null or new.pais_emisor_identificador is null;
  end if;
  return new;
end;
$$;
drop trigger if exists pacientes_estado_provisional on public.pacientes;
create trigger pacientes_estado_provisional before insert or update on public.pacientes
for each row execute function public.actualizar_estado_provisional();

create table if not exists public.atencion_rapida_solicitudes (
  profesional_id uuid not null,
  solicitud_id uuid not null,
  cita_id uuid not null references public.citas(id),
  payload_hash text not null,
  creada_en timestamptz not null default now(),
  primary key (profesional_id, solicitud_id)
);
alter table public.atencion_rapida_solicitudes enable row level security;
drop policy if exists atencion_rapida_propietario on public.atencion_rapida_solicitudes;
create policy atencion_rapida_propietario on public.atencion_rapida_solicitudes
  for all to authenticated using (profesional_id = auth.uid()) with check (profesional_id = auth.uid());
revoke all on public.atencion_rapida_solicitudes from public, anon, authenticated;
grant select, insert on public.atencion_rapida_solicitudes to authenticated;

create or replace function public.crear_atencion_rapida(p_datos jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_profesional uuid := auth.uid();
  v_solicitud uuid := (p_datos->>'solicitud_id')::uuid;
  v_paciente public.pacientes%rowtype;
  v_cita public.citas%rowtype;
  v_previa public.atencion_rapida_solicitudes%rowtype;
  v_fecha date := (p_datos->>'fecha')::date;
  v_inicio time := (p_datos->>'hora_inicio')::time;
  v_duracion integer := (p_datos->>'duracion_minutos')::integer;
  v_fin time;
  v_modalidad text := p_datos->>'modalidad';
  v_nuevo jsonb := p_datos->'paciente';
  v_rut text;
  v_tipo text;
  v_pais text;
  v_rut_compacto text;
  v_nacimiento date;
  v_suma integer := 0;
  v_factor integer := 2;
  v_digito integer;
  v_indice integer;
begin
  if v_profesional is null or not exists (select 1 from public.profesional where id = v_profesional and vigente is distinct from false) then
    raise exception 'QUICK_AUTH: Profesional no habilitado.';
  end if;
  if v_solicitud is null then raise exception 'QUICK_INVALID: Falta el identificador de la operación.'; end if;
  -- Serializa las solicitudes rápidas del profesional, incluso desde dos pestañas.
  perform pg_advisory_xact_lock(hashtextextended(v_profesional::text, 0));
  select * into v_previa from public.atencion_rapida_solicitudes
    where profesional_id = v_profesional and solicitud_id = v_solicitud;
  if found then
    if v_previa.payload_hash <> md5(p_datos::text) then raise exception 'QUICK_RETRY_CHANGED: Reintenta con los mismos datos de la operación original.'; end if;
    select * into strict v_cita from public.citas where id = v_previa.cita_id and profesional_id = v_profesional;
    select * into strict v_paciente from public.pacientes where id = v_cita.paciente_id and profesional_id = v_profesional;
    return to_jsonb(v_cita) || jsonb_build_object('pacientes', to_jsonb(v_paciente));
  end if;
  if v_fecha is null or v_inicio is null or v_duracion is null or v_duracion < 15 or v_duracion > 240
     or v_modalidad is null or v_modalidad not in ('presencial', 'online', 'domicilio') then
    raise exception 'QUICK_INVALID: Revisa fecha, hora, duración y modalidad.';
  end if;
  -- Permite la hora actual y los minutos transcurridos al completar el formulario.
  if v_fecha < (now() at time zone 'America/Santiago')::date then
    raise exception 'QUICK_INVALID: Selecciona hoy o una fecha posterior.';
  end if;
  if extract(epoch from v_inicio) / 60 + v_duracion >= 1440 then
    raise exception 'QUICK_INVALID: La atención debe terminar antes de medianoche.';
  end if;
  v_fin := v_inicio + make_interval(mins => v_duracion);
  if exists (select 1 from public.citas where profesional_id = v_profesional and fecha = v_fecha
    and coalesce(estado, '') not in ('cancelada', 'cancelada_paciente', 'cancelada_profesional') and hora_inicio < v_fin and hora_fin > v_inicio)
    and coalesce((p_datos->>'confirmar_conflicto')::boolean, false) = false then
    raise exception 'QUICK_CONFLICT: El horario coincide con otra cita. Confirma el conflicto o elige otro intervalo.';
  end if;
  if nullif(p_datos->>'paciente_id', '') is not null then
    select * into v_paciente from public.pacientes where id = (p_datos->>'paciente_id')::uuid
      and profesional_id = v_profesional and activo = true;
    if not found then raise exception 'QUICK_PATIENT: El paciente no está disponible para este profesional.'; end if;
  else
    if nullif(btrim(v_nuevo->>'nombres'), '') is null then raise exception 'QUICK_INVALID: Escribe un nombre de referencia.'; end if;
    v_tipo := nullif(v_nuevo->>'tipo_identificador', '');
    v_pais := nullif(v_nuevo->>'pais_emisor_identificador', '');
    if (v_tipo is null) <> (v_pais is null)
      or (v_tipo is not null and (v_tipo not in ('rut', 'pasaporte', 'documento_nacional', 'otro')
        or v_pais !~ '^[A-Z]{2}$' or (v_tipo = 'rut' and v_pais <> 'CL'))) then
      raise exception 'QUICK_INVALID: Revisa el tipo de documento y su país emisor.';
    end if;
    v_rut := public.normalizar_documento_guardado(v_nuevo->>'identificador', v_tipo, v_pais);
    v_nacimiento := nullif(v_nuevo->>'fecha_nacimiento', '')::date;
    if v_nacimiento > (now() at time zone 'America/Santiago')::date then raise exception 'QUICK_INVALID: Revisa la fecha de nacimiento.'; end if;
    if v_rut is not null and v_tipo = 'rut' then
      v_rut_compacto := upper(regexp_replace(v_rut, '[.[:space:]-]', '', 'g'));
      if v_rut_compacto !~ '^[0-9]{1,8}[0-9K]$' then raise exception 'QUICK_INVALID: El RUT no es válido.'; end if;
      for v_indice in reverse (length(v_rut_compacto)-1)..1 loop
        v_suma := v_suma + substring(v_rut_compacto, v_indice, 1)::integer * v_factor;
        v_factor := case when v_factor = 7 then 2 else v_factor + 1 end;
      end loop;
      v_digito := 11 - v_suma % 11;
      if right(v_rut_compacto, 1) <> (case when v_digito = 11 then '0' when v_digito = 10 then 'K' else v_digito::text end) then
        raise exception 'QUICK_INVALID: Revisa el dígito verificador del RUT.';
      end if;
    end if;
    if v_rut is not null and exists (select 1 from public.pacientes where profesional_id = v_profesional
      and tipo_identificador is not distinct from v_tipo and pais_emisor_identificador is not distinct from v_pais
      and public.normalizar_documento_guardado(identificador, tipo_identificador, pais_emisor_identificador) = v_rut) then
      raise exception 'QUICK_DUPLICATE: Ya existe un paciente con ese documento y país emisor. Usa el registro existente.';
    end if;
    insert into public.pacientes (profesional_id, nombres, apellidos, identificador, fecha_nacimiento, activo, registro_provisional, tipo_identificador, pais_emisor_identificador)
      values (v_profesional, btrim(v_nuevo->>'nombres'), nullif(btrim(v_nuevo->>'apellidos'), ''), v_rut, v_nacimiento, true, true, v_tipo, v_pais)
      returning * into v_paciente;
  end if;
  insert into public.citas (profesional_id, paciente_id, fecha, hora_inicio, hora_fin, estado, origen, modalidad, atencion_rapida, conflicto_horario_aceptado)
    values (v_profesional, v_paciente.id, v_fecha, v_inicio, v_fin, 'confirmada', 'Mentalia', v_modalidad, true, coalesce((p_datos->>'confirmar_conflicto')::boolean, false))
    returning * into v_cita;
  insert into public.atencion_rapida_solicitudes (profesional_id, solicitud_id, cita_id, payload_hash)
    values (v_profesional, v_solicitud, v_cita.id, md5(p_datos::text));
  return to_jsonb(v_cita) || jsonb_build_object('pacientes', to_jsonb(v_paciente));
end;
$$;
revoke all on function public.crear_atencion_rapida(jsonb) from public, anon;
grant execute on function public.crear_atencion_rapida(jsonb) to authenticated;
end;
$migracion$;
