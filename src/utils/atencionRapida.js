export function ahoraSantiago(instante = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instante);
  const value = (key) => parts.find((part) => part.type === key).value;
  return { fecha: `${value("year")}-${value("month")}-${value("day")}`, hora_inicio: `${value("hour")}:${value("minute")}` };
}

export { normalizarRut, rutValido, rutParaGuardar } from "../../supabase/functions/_shared/rut.js";

export function minutos(hora) {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + m;
}

export function seSuperponen(inicio, fin, otroInicio, otroFin) {
  return minutos(inicio) < minutos(otroFin) && minutos(fin) > minutos(otroInicio);
}

export function finAtencion(inicio, duracion) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(inicio) || !Number.isInteger(Number(duracion)) || Number(duracion) < 15 || Number(duracion) > 240) return null;
  const total = minutos(inicio) + Number(duracion);
  if (!Number.isInteger(total) || total >= 1440) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function conflictoEvento(fecha, inicio, fin, evento) {
  function fechaLocal(valor) {
    if (!valor) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return `${valor}T00:00`;
    const instante = new Date(valor);
    if (Number.isNaN(instante.getTime())) return null;
    const local = ahoraSantiago(instante);
    return `${local.fecha}T${local.hora_inicio}`;
  }
  const desde = fechaLocal(evento.fecha_inicio);
  const hasta = fechaLocal(evento.fecha_fin);
  return !!(desde && hasta && `${fecha}T${inicio}` < hasta && `${fecha}T${fin}` > desde);
}
