-- Versión de la reserva pública utilizada por api-mentalia.
-- Mantiene la función anterior y agrega la modalidad como último parámetro.
create or replace function public.reservar_hora_publica(
  p_slug_publico text,
  p_fecha date,
  p_hora_inicio time,
  p_hora_fin time,
  p_nombres text,
  p_apellidos text,
  p_email text,
  p_telefono text,
  p_identificador text default null,
  p_primera_atencion text default null,
  p_canal_contacto text default null,
  p_modalidad text default 'presencial'
)
returns table(cita_id uuid, paciente_id uuid, estado text, mensaje text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profesional_id uuid;
  v_paciente_id uuid;
  v_cita_id uuid;
  v_dia_semana int;
  v_email text;
  v_identificador text;
  v_existe_disponibilidad boolean;
  v_existe_choque boolean;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  v_identificador := nullif(trim(coalesce(p_identificador, '')), '');

  if nullif(trim(coalesce(p_slug_publico, '')), '') is null then
    raise exception 'No se indicó el enlace público del profesional.';
  end if;
  if p_fecha is null or p_hora_inicio is null or p_hora_fin is null or p_hora_fin <= p_hora_inicio then
    raise exception 'La fecha y el horario seleccionados no son válidos.';
  end if;
  if nullif(trim(coalesce(p_nombres, '')), '') is null or nullif(trim(coalesce(p_apellidos, '')), '') is null then
    raise exception 'Debes ingresar nombre y apellido.';
  end if;
  if v_email = '' or nullif(trim(coalesce(p_telefono, '')), '') is null then
    raise exception 'Debes ingresar correo electrónico y teléfono.';
  end if;
  if coalesce(p_modalidad, 'presencial') not in ('presencial', 'online') then
    raise exception 'La modalidad seleccionada no es válida.';
  end if;

  select p.id into v_profesional_id
  from public.profesional p
  where p.slug_publico = lower(trim(p_slug_publico))
    and p.reserva_publica_activa = true
  limit 1;
  if v_profesional_id is null then
    raise exception 'No encontramos una agenda pública activa para este profesional.';
  end if;

  v_dia_semana := extract(isodow from p_fecha)::int;
  select exists (
    select 1 from public.disponibilidad_profesional d
    where d.profesional_id = v_profesional_id and d.activo = true
      and coalesce(d.origen, 'mentalia') = 'mentalia'
      and d.dia_semana = v_dia_semana
      and (d.fecha_inicio is null or p_fecha >= d.fecha_inicio)
      and (d.fecha_fin is null or p_fecha <= d.fecha_fin)
      and p_hora_inicio >= d.hora_inicio and p_hora_fin <= d.hora_fin
  ) into v_existe_disponibilidad;
  if not v_existe_disponibilidad then
    raise exception 'El horario seleccionado ya no está disponible.';
  end if;

  select exists (
    select 1 from public.citas c
    where c.profesional_id = v_profesional_id and c.fecha = p_fecha
      and coalesce(c.estado, '') not in ('cancelada', 'cancelada_paciente', 'cancelada_profesional')
      and p_hora_inicio < c.hora_fin and p_hora_fin > c.hora_inicio
  ) into v_existe_choque;
  if v_existe_choque then
    raise exception 'Ese horario acaba de ser reservado. Selecciona otro horario.';
  end if;

  select pa.id into v_paciente_id from public.pacientes pa
  where pa.profesional_id = v_profesional_id
    and ((v_identificador is not null and pa.identificador = v_identificador)
      or lower(coalesce(pa.email, '')) = v_email) limit 1;

  if v_paciente_id is null then
    insert into public.pacientes (profesional_id, nombres, apellidos, identificador, email, telefono)
    values (v_profesional_id, trim(p_nombres), trim(p_apellidos), v_identificador, v_email, trim(p_telefono))
    returning id into v_paciente_id;
  else
    update public.pacientes set nombres = trim(p_nombres), apellidos = trim(p_apellidos),
      identificador = coalesce(v_identificador, identificador), email = v_email, telefono = trim(p_telefono)
    where id = v_paciente_id;
  end if;

  insert into public.citas (profesional_id, paciente_id, fecha, hora_inicio, hora_fin, estado, origen, canal_contacto, primera_atencion, modalidad)
  values (v_profesional_id, v_paciente_id, p_fecha, p_hora_inicio, p_hora_fin, 'pendiente_confirmacion', 'reserva_publica',
    nullif(trim(coalesce(p_canal_contacto, '')), ''), nullif(trim(coalesce(p_primera_atencion, '')), ''), coalesce(p_modalidad, 'presencial'))
    returning id into v_cita_id;

  return query select v_cita_id, v_paciente_id, 'pendiente_confirmacion'::text,
    'Solicitud recibida. La reserva quedó pendiente de confirmación por parte del profesional.'::text;
end;
$$;

revoke execute on function public.reservar_hora_publica(text, date, time, time, text, text, text, text, text, text, text, text)
  from public;

grant execute on function public.reservar_hora_publica(text, date, time, time, text, text, text, text, text, text, text, text)
  to anon, authenticated;
