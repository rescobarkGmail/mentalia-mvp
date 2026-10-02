-- Repara consentimientos que fueron respondidos como rechazado/revocado
-- y luego quedaron reabiertos incorrectamente como pendiente al reenviar
-- una solicitud de consentimientos.
--
-- Uso recomendado:
-- 1) Ejecuta primero el SELECT de diagnóstico.
-- 2) Si los resultados calzan con los casos esperados, ejecuta el UPDATE.

-- Diagnóstico: muestra registros actualmente pendientes cuyo último cambio
-- a pendiente venía desde rechazado o revocado.
with ultimo_evento as (
  select distinct on (e.consentimiento_id)
    e.consentimiento_id,
    e.estado_anterior,
    e.estado_nuevo,
    e.fecha_crea
  from public.consentimientos_paciente_eventos e
  order by e.consentimiento_id, e.fecha_crea desc
)
select
  c.id,
  c.profesional_id,
  c.paciente_id,
  p.nombres,
  p.apellidos,
  c.codigo,
  c.estado as estado_actual,
  u.estado_anterior as estado_a_restaurar,
  u.fecha_crea as fecha_reapertura_erronea
from public.consentimientos_paciente c
join ultimo_evento u on u.consentimiento_id = c.id
left join public.pacientes p on p.id = c.paciente_id
where c.estado = 'pendiente'
  and u.estado_nuevo = 'pendiente'
  and u.estado_anterior in ('rechazado', 'revocado')
order by p.nombres, p.apellidos, c.codigo;

-- Reparación: restaura el último estado explícito del paciente.
-- Descomenta y ejecuta solo después de validar el SELECT anterior.
/*
with ultimo_evento as (
  select distinct on (e.consentimiento_id)
    e.consentimiento_id,
    e.estado_anterior,
    e.estado_nuevo,
    e.fecha_crea
  from public.consentimientos_paciente_eventos e
  order by e.consentimiento_id, e.fecha_crea desc
),
reparables as (
  select
    c.id,
    u.estado_anterior
  from public.consentimientos_paciente c
  join ultimo_evento u on u.consentimiento_id = c.id
  where c.estado = 'pendiente'
    and u.estado_nuevo = 'pendiente'
    and u.estado_anterior in ('rechazado', 'revocado')
)
update public.consentimientos_paciente c
set
  estado = r.estado_anterior,
  respondido_en = coalesce(c.respondido_en, now()),
  revocado_en = case
    when r.estado_anterior = 'revocado' then coalesce(c.revocado_en, now())
    else c.revocado_en
  end,
  fecha_actualiza = now()
from reparables r
where c.id = r.id;
*/
