import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthContext = { userId: string; email: string | null; profile: Record<string, unknown> | null };
class HttpError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
const requestId = () => crypto.randomUUID();
function allowedOrigins() { return (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",").map((v) => v.trim()).filter(Boolean); }
function corsHeaders(origin: string | null) { const h = new Headers({ Vary: "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" }); if (origin && allowedOrigins().includes(origin)) h.set("Access-Control-Allow-Origin", origin); return h; }
function json(body: unknown, status: number, origin: string | null, id: string) { const h = corsHeaders(origin); h.set("Content-Type", "application/json"); return new Response(JSON.stringify({ data: body, error: null, request_id: id }), { status, headers: h }); }
function failure(error: HttpError, origin: string | null, id: string) { const h = corsHeaders(origin); h.set("Content-Type", "application/json"); return new Response(JSON.stringify({ data: null, error: { code: error.code, message: error.message }, request_id: id }), { status: error.status, headers: h }); }
async function authenticate(req: Request, supabase: SupabaseClient): Promise<AuthContext> {
  const header = req.headers.get("Authorization"); if (!header?.startsWith("Bearer ")) throw new HttpError(401, "AUTH_REQUIRED", "Se requiere autenticación.");
  const token = header.slice(7).trim(); if (!token) throw new HttpError(401, "AUTH_REQUIRED", "Token inválido.");
  const { data: { user }, error } = await supabase.auth.getUser(token); if (error || !user) throw new HttpError(401, "AUTH_INVALID", "La sesión no es válida.");
  const { data: profile, error: profileError } = await supabase.from("profesional").select("id,nombres,apellidos,email,vigente").eq("id", user.id).maybeSingle();
  if (profileError) { console.error(JSON.stringify({ scope: "authenticate.profile", error: profileError.message, details: profileError.details, hint: profileError.hint })); throw new HttpError(500, "PROFILE_LOOKUP_FAILED", "No fue posible validar el perfil profesional."); }
  if (!profile || profile.vigente === false) throw new HttpError(403, "PROFESSIONAL_NOT_ACTIVE", "El profesional no está habilitado.");
  return { userId: user.id, email: user.email ?? null, profile };
}

function isDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function isTime(value: unknown): value is string { return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value); }
function minutes(value: string) { const [h, m] = value.split(":").map(Number); return h * 60 + m; }
function timeAfterMinutes(start: string, duration: number) { const total = minutes(start) + duration; if (total >= 24 * 60) throw new HttpError(400, "INVALID_TIME_RANGE", "La cita no puede terminar al día siguiente."); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
function localSantiago() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""; return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` }; }
function publicSupabaseClient() { const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"); return createClient(Deno.env.get("SUPABASE_URL")!, key!); }

function publicSlug(value: unknown) { const slug = typeof value === "string" ? value.trim().toLowerCase() : ""; if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, "INVALID_PUBLIC_SLUG", "El enlace público no es válido."); return slug; }

async function getPublicProfessional(supabase: SupabaseClient, slugValue: unknown) {
  const slug = publicSlug(slugValue);
  const { data, error } = await supabase.from("v_profesionales_reserva_publica").select("*").eq("slug_publico", slug).eq("reserva_publica_activa", true).maybeSingle();
  if (error) throw new HttpError(500, "PUBLIC_PROFILE_LOOKUP_FAILED", "No fue posible cargar el perfil público.");
  if (!data) throw new HttpError(404, "PUBLIC_PROFILE_NOT_FOUND", "El enlace de reserva no existe o no está activo.");
  return data;
}

async function listPublicBookingData(url: URL, supabase: SupabaseClient) {
  const professional = await getPublicProfessional(supabase, url.searchParams.get("slug"));
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isDate(from) || !isDate(to)) throw new HttpError(400, "INVALID_PUBLIC_DATE_RANGE", "El rango de fechas no es válido.");
  const [{ data: availability, error: availabilityError }, { data: occupied, error: occupiedError }] = await Promise.all([
    supabase.from("v_disponibilidad_reserva_publica").select("*").eq("profesional_id", professional.id).eq("activo", true).lte("fecha_inicio", to).gte("fecha_fin", from).order("dia_semana", { ascending: true }).order("hora_inicio", { ascending: true }),
    supabase.from("v_reservas_ocupadas_publicas").select("*").eq("profesional_id", professional.id).gte("fecha", from).lte("fecha", to),
  ]);
  if (availabilityError || occupiedError) throw new HttpError(500, "PUBLIC_AVAILABILITY_LOOKUP_FAILED", "No fue posible cargar los horarios públicos.");
  return { professional, availability: availability ?? [], occupied: occupied ?? [] };
}

async function lookupPublicPatient(req: Request, supabase: SupabaseClient) {
  let body: Record<string, unknown>; try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const slug = publicSlug(body.slug_publico);
  const rut = typeof body.rut === "string" ? body.rut.trim() : "";
  if (!rut) throw new HttpError(400, "INVALID_PATIENT_IDENTIFIER", "El RUT es obligatorio.");
  await getPublicProfessional(supabase, slug);
  const { data, error } = await supabase.rpc("buscar_paciente_publico_por_rut", { p_slug_publico: slug, p_rut: rut });
  if (error) throw new HttpError(500, "PUBLIC_PATIENT_LOOKUP_FAILED", "No fue posible buscar los datos del paciente.");
  return Array.isArray(data) ? (data[0] ?? null) : null;
}

async function createPublicBooking(req: Request, supabase: SupabaseClient) {
  let body: Record<string, unknown>; try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const slug = publicSlug(body.slug_publico);
  const required = ["fecha", "hora_inicio", "hora_fin", "nombres", "apellidos", "email", "telefono"];
  if (required.some((key) => typeof body[key] !== "string" || !(body[key] as string).trim())) throw new HttpError(400, "INVALID_PUBLIC_BOOKING", "Completa todos los datos obligatorios de la reserva.");
  if (!isDate(body.fecha) || !isTime(body.hora_inicio) || !isTime(body.hora_fin)) throw new HttpError(400, "INVALID_PUBLIC_BOOKING_TIME", "La fecha y el horario seleccionados no son válidos.");
  const modalidad = typeof body.modalidad === "string" && ["presencial", "online"].includes(body.modalidad) ? body.modalidad : "presencial";
  await getPublicProfessional(supabase, slug);
  const { data, error } = await supabase.rpc("reservar_hora_publica", { p_slug_publico: slug, p_fecha: body.fecha, p_hora_inicio: body.hora_inicio, p_hora_fin: body.hora_fin, p_nombres: body.nombres, p_apellidos: body.apellidos, p_email: body.email, p_telefono: body.telefono, p_identificador: body.identificador || null, p_primera_atencion: body.primera_atencion || null, p_canal_contacto: body.canal_contacto || null, p_modalidad: modalidad });
  if (error) throw new HttpError(409, "PUBLIC_BOOKING_FAILED", error.message || "No fue posible confirmar la reserva.");
  return Array.isArray(data) ? (data[0] ?? data) : data;
}

async function createAppointment(req: Request, supabase: SupabaseClient, auth: AuthContext) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const pacienteId = body.paciente_id;
  const fecha = body.fecha;
  const horaInicio = body.hora_inicio;
  const rawDuration = body.duracion_minutos ?? body.duracion;
  const duration = Number(rawDuration);
  if (typeof pacienteId !== "string" || !pacienteId || !isDate(fecha) || !isTime(horaInicio) || !Number.isInteger(duration) || duration < 15 || duration > 240) {
    throw new HttpError(400, "INVALID_APPOINTMENT", "paciente_id, fecha, hora_inicio y una duración entre 15 y 240 minutos son obligatorios.");
  }
  const horaFin = timeAfterMinutes(horaInicio, duration);
  const now = localSantiago();
  if (fecha < now.date || (fecha === now.date && horaInicio <= now.time)) throw new HttpError(400, "PAST_APPOINTMENT", "No puedes crear una cita en una fecha u hora pasada.");

  const { data: patient, error: patientError } = await supabase.from("pacientes").select("id").eq("id", pacienteId).eq("profesional_id", auth.userId).maybeSingle();
  if (patientError) { console.error(JSON.stringify({ scope: "createAppointment.patient", error: patientError.message, details: patientError.details, hint: patientError.hint })); throw new HttpError(500, "PATIENT_LOOKUP_FAILED", "No fue posible validar el paciente."); }
  if (!patient) throw new HttpError(404, "PATIENT_NOT_FOUND", "El paciente no existe o no pertenece al profesional autenticado.");

  const dayOfWeek = new Date(`${fecha}T00:00:00Z`).getUTCDay() || 7;
  const { data: availability, error: availabilityError } = await supabase.from("disponibilidad_profesional").select("hora_inicio,hora_fin,duracion_minutos,descanso_minutos").eq("profesional_id", auth.userId).eq("activo", true).eq("dia_semana", dayOfWeek).lte("fecha_inicio", fecha).gte("fecha_fin", fecha);
  if (availabilityError) throw new HttpError(500, "AVAILABILITY_LOOKUP_FAILED", "No fue posible validar la disponibilidad.");
  const fits = (availability ?? []).some((slot) => {
    if (!isTime(slot.hora_inicio) || !isTime(slot.hora_fin) || minutes(horaInicio) < minutes(slot.hora_inicio) || minutes(horaFin) > minutes(slot.hora_fin)) return false;
    const step = Number(slot.duracion_minutos || duration) + Number(slot.descanso_minutos || 0);
    return step > 0 && (minutes(horaInicio) - minutes(slot.hora_inicio)) % step === 0;
  });
  if (!fits) throw new HttpError(409, "OUTSIDE_AVAILABILITY", "El horario no está dentro de la disponibilidad configurada.");

  const { data: existing, error: conflictError } = await supabase.from("citas").select("id,hora_inicio,hora_fin").eq("profesional_id", auth.userId).eq("fecha", fecha).neq("estado", "cancelada");
  if (conflictError) throw new HttpError(500, "APPOINTMENT_LOOKUP_FAILED", "No fue posible verificar conflictos de horario.");
  const overlaps = (existing ?? []).some((item) => isTime(item.hora_inicio) && isTime(item.hora_fin) && minutes(horaInicio) < minutes(item.hora_fin) && minutes(horaFin) > minutes(item.hora_inicio));
  if (overlaps) throw new HttpError(409, "SLOT_ALREADY_BOOKED", "Ese horario se superpone con una cita existente.");

  const { data: appointment, error: insertError } = await supabase.from("citas").insert({ profesional_id: auth.userId, paciente_id: pacienteId, fecha, hora_inicio: horaInicio, hora_fin: horaFin, estado: "reservada", origen: "Mentalia" }).select("*").single();
  if (insertError) throw new HttpError(500, "APPOINTMENT_CREATE_FAILED", "No fue posible crear la cita.");
  return appointment;
}

async function rescheduleAppointment(req: Request, supabase: SupabaseClient, auth: AuthContext, appointmentId: string) {
  if (!appointmentId) throw new HttpError(400, "INVALID_APPOINTMENT_ID", "Falta el identificador de la cita.");
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const fecha = body.fecha;
  const horaInicio = body.hora_inicio;
  if (!isDate(fecha) || !isTime(horaInicio)) throw new HttpError(400, "INVALID_RESCHEDULE", "fecha y hora_inicio son obligatorios.");
  const { data: current, error: currentError } = await supabase.from("citas").select("id,fecha,hora_inicio,hora_fin,estado").eq("id", appointmentId).eq("profesional_id", auth.userId).maybeSingle();
  if (currentError) throw new HttpError(500, "APPOINTMENT_LOOKUP_FAILED", "No fue posible consultar la cita.");
  if (!current) throw new HttpError(404, "APPOINTMENT_NOT_FOUND", "La cita no existe o no pertenece al profesional autenticado.");
  if (current.estado === "cancelada") throw new HttpError(409, "CANCELLED_APPOINTMENT", "No se puede reprogramar una cita cancelada.");
  if (!isTime(current.hora_inicio) || !isTime(current.hora_fin)) throw new HttpError(500, "INVALID_STORED_APPOINTMENT", "La cita no tiene un rango horario válido.");
  const duration = minutes(current.hora_fin) - minutes(current.hora_inicio);
  if (duration <= 0) throw new HttpError(500, "INVALID_STORED_APPOINTMENT", "La duración almacenada de la cita no es válida.");
  const horaFin = timeAfterMinutes(horaInicio, duration);
  const now = localSantiago();
  if (fecha < now.date || (fecha === now.date && horaInicio <= now.time)) throw new HttpError(400, "PAST_APPOINTMENT", "No puedes reagendar una cita a una fecha u hora pasada.");

  const dayOfWeek = new Date(`${fecha}T00:00:00Z`).getUTCDay() || 7;
  const { data: availability, error: availabilityError } = await supabase.from("disponibilidad_profesional").select("hora_inicio,hora_fin,duracion_minutos,descanso_minutos").eq("profesional_id", auth.userId).eq("activo", true).eq("dia_semana", dayOfWeek).lte("fecha_inicio", fecha).gte("fecha_fin", fecha);
  if (availabilityError) throw new HttpError(500, "AVAILABILITY_LOOKUP_FAILED", "No fue posible validar la disponibilidad.");
  const fits = (availability ?? []).some((slot) => {
    if (!isTime(slot.hora_inicio) || !isTime(slot.hora_fin) || minutes(horaInicio) < minutes(slot.hora_inicio) || minutes(horaFin) > minutes(slot.hora_fin)) return false;
    const step = Number(slot.duracion_minutos || duration) + Number(slot.descanso_minutos || 0);
    return step > 0 && (minutes(horaInicio) - minutes(slot.hora_inicio)) % step === 0;
  });
  if (!fits) throw new HttpError(409, "OUTSIDE_AVAILABILITY", "El horario no está dentro de la disponibilidad configurada.");

  const { data: existing, error: conflictError } = await supabase.from("citas").select("id,hora_inicio,hora_fin").eq("profesional_id", auth.userId).eq("fecha", fecha).neq("estado", "cancelada").neq("id", appointmentId);
  if (conflictError) throw new HttpError(500, "APPOINTMENT_LOOKUP_FAILED", "No fue posible verificar conflictos de horario.");
  const overlaps = (existing ?? []).some((item) => isTime(item.hora_inicio) && isTime(item.hora_fin) && minutes(horaInicio) < minutes(item.hora_fin) && minutes(horaFin) > minutes(item.hora_inicio));
  if (overlaps) throw new HttpError(409, "SLOT_ALREADY_BOOKED", "Ese horario se superpone con una cita existente.");

  const { data: appointment, error: updateError } = await supabase.from("citas").update({ fecha, hora_inicio: horaInicio, hora_fin: horaFin, estado: "reprogramada" }).eq("id", appointmentId).eq("profesional_id", auth.userId).select("*").single();
  if (updateError) throw new HttpError(500, "APPOINTMENT_RESCHEDULE_FAILED", "No fue posible reprogramar la cita.");
  return appointment;
}

async function cancelAppointment(supabase: SupabaseClient, auth: AuthContext, appointmentId: string) {
  if (!appointmentId) throw new HttpError(400, "INVALID_APPOINTMENT_ID", "Falta el identificador de la cita.");
  const { data: current, error: currentError } = await supabase.from("citas").select("*").eq("id", appointmentId).eq("profesional_id", auth.userId).maybeSingle();
  if (currentError) throw new HttpError(500, "APPOINTMENT_LOOKUP_FAILED", "No fue posible consultar la cita.");
  if (!current) throw new HttpError(404, "APPOINTMENT_NOT_FOUND", "La cita no existe o no pertenece al profesional autenticado.");
  if (current.estado === "cancelada") return current;
  const { data: appointment, error: updateError } = await supabase.from("citas").update({ estado: "cancelada" }).eq("id", appointmentId).eq("profesional_id", auth.userId).select("*").single();
  if (updateError) throw new HttpError(500, "APPOINTMENT_CANCEL_FAILED", "No fue posible cancelar la cita.");
  return appointment;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

async function enviarCorreoConfirmacionReserva(appointment: Record<string, any>, auth: AuthContext, supabase: SupabaseClient) {
  const patient = appointment.pacientes;
  const email = typeof patient?.email === "string" ? patient.email.trim() : "";
  if (!email) return "sin_correo";
  const { data: settings, error: settingsError } = await supabase.from("notificaciones_config").select("confirmacion_reserva_email").eq("profesional_id", auth.userId).maybeSingle();
  if (settingsError) console.error(JSON.stringify({ scope: "sendConfirmationEmail.settings", error: settingsError.message }));
  if (settings?.confirmacion_reserva_email === false) return "desactivado";
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) { console.warn(JSON.stringify({ scope: "sendConfirmationEmail", status: "not_configured" })); return "no_configurado"; }
  const dateLabel = isDate(appointment.fecha) ? new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(new Date(`${appointment.fecha}T12:00:00-04:00`)) : appointment.fecha;
  const name = `${patient?.nombres || ""} ${patient?.apellidos || ""}`.trim() || "Paciente";
  const from = Deno.env.get("EMAIL_FROM") || "FluyePro <contacto@fluyepro.cl>";
  const professionalName = `${auth.profile?.nombres || ""} ${auth.profile?.apellidos || ""}`.trim() || "tu profesional";
  const html = `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2>Reserva confirmada</h2><p>Hola ${escapeHtml(name)},</p><p>Tu reserva con <strong>${escapeHtml(professionalName)}</strong> fue confirmada.</p><p><strong>Fecha:</strong> ${escapeHtml(dateLabel)}<br><strong>Hora:</strong> ${escapeHtml(String(appointment.hora_inicio || "").slice(0, 5))} - ${escapeHtml(String(appointment.hora_fin || "").slice(0, 5))}<br><strong>Modalidad:</strong> ${escapeHtml(appointment.modalidad || "presencial")}</p><p><strong>Información de pago</strong><br>El pago aún no está habilitado. Esta sección es informativa y no se realizará ningún cobro.</p><p>Saludos,<br>FluyePro</p></div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], reply_to: "contacto@fluyepro.cl", subject: "Reserva confirmada con FluyePro", html }) });
    if (!response.ok) { const detail = await response.text(); console.error(JSON.stringify({ scope: "sendConfirmationEmail.resend", status: response.status, detail })); return "fallido"; }
    return "enviado";
  } catch (error) { console.error(JSON.stringify({ scope: "sendConfirmationEmail.network", error: error instanceof Error ? error.message : String(error) })); return "fallido"; }
}

async function confirmAppointment(supabase: SupabaseClient, auth: AuthContext, appointmentId: string) {
  if (!appointmentId) throw new HttpError(400, "INVALID_APPOINTMENT_ID", "Falta el identificador de la cita.");
  const { data: current, error: currentError } = await supabase.from("citas").select("id,estado").eq("id", appointmentId).eq("profesional_id", auth.userId).maybeSingle();
  if (currentError) throw new HttpError(500, "APPOINTMENT_LOOKUP_FAILED", "No fue posible consultar la cita.");
  if (!current) throw new HttpError(404, "APPOINTMENT_NOT_FOUND", "La cita no existe o no pertenece al profesional autenticado.");
  if (current.estado === "cancelada") throw new HttpError(409, "CANCELLED_APPOINTMENT", "No se puede confirmar una cita cancelada.");
  if (current.estado === "confirmada") return current;
  if (current.estado !== "pendiente_confirmacion") throw new HttpError(409, "INVALID_APPOINTMENT_STATUS", "Solo se pueden aceptar reservas pendientes de confirmación.");
  const { data: appointment, error: updateError } = await supabase.from("citas").update({ estado: "confirmada" }).eq("id", appointmentId).eq("profesional_id", auth.userId).select("*, pacientes (id, nombres, apellidos, identificador, email, telefono)").single();
  if (updateError) throw new HttpError(500, "APPOINTMENT_CONFIRM_FAILED", "No fue posible aceptar la reserva.");
  const notificationStatus = await enviarCorreoConfirmacionReserva(appointment, auth, supabase);
  return { ...appointment, notification_status: notificationStatus };
}

async function listAppointments(supabase: SupabaseClient, auth: AuthContext) {
  const { data, error } = await supabase.from("citas").select(`
    *,
    pacientes (id, nombres, apellidos, identificador, email, telefono)
  `).eq("profesional_id", auth.userId).order("fecha", { ascending: true }).order("hora_inicio", { ascending: true });
  if (error) { console.error(JSON.stringify({ scope: "listAppointments", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "APPOINTMENTS_LIST_FAILED", "No fue posible cargar las citas."); }
  return data ?? [];
}

async function listAvailability(supabase: SupabaseClient, auth: AuthContext) {
  const { data, error } = await supabase.from("disponibilidad_profesional").select("*").eq("profesional_id", auth.userId).eq("activo", true).order("dia_semana", { ascending: true }).order("hora_inicio", { ascending: true });
  if (error) { console.error(JSON.stringify({ scope: "listAvailability", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "AVAILABILITY_LIST_FAILED", "No fue posible cargar la disponibilidad."); }
  return data ?? [];
}

const notificationSettingKeys = [
  "confirmacion_reserva_email",
  "confirmacion_reserva_whatsapp",
  "cambios_reserva_email",
  "cambios_reserva_whatsapp",
  "recordatorio_email_activo",
  "recordatorio_whatsapp_activo",
  "horas_antes_recordatorio_email",
  "minutos_antes_recordatorio_whatsapp",
  "zona_horaria",
] as const;

const notificationDefaults = {
  confirmacion_reserva_email: true,
  confirmacion_reserva_whatsapp: false,
  cambios_reserva_email: true,
  cambios_reserva_whatsapp: false,
  recordatorio_email_activo: true,
  recordatorio_whatsapp_activo: false,
  horas_antes_recordatorio_email: 27,
  minutos_antes_recordatorio_whatsapp: 60,
  zona_horaria: "America/Santiago",
};

function normalizarConfiguracionNotificaciones(data: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(notificationSettingKeys.map((key) => [key, data?.[key] ?? notificationDefaults[key]]));
}

async function obtenerConfiguracionNotificaciones(supabase: SupabaseClient, auth: AuthContext) {
  const { data, error } = await supabase.from("notificaciones_config").select("*").eq("profesional_id", auth.userId).maybeSingle();
  if (error) {
    console.error(JSON.stringify({ scope: "getNotificationSettings", error: error.message, details: error.details, hint: error.hint }));
    throw new HttpError(500, "NOTIFICATION_SETTINGS_LOOKUP_FAILED", "No fue posible cargar la configuración de notificaciones.");
  }
  return normalizarConfiguracionNotificaciones(data);
}

function validarConfiguracionNotificaciones(data: Record<string, unknown>) {
  const booleanKeys = [
    "confirmacion_reserva_email",
    "confirmacion_reserva_whatsapp",
    "cambios_reserva_email",
    "cambios_reserva_whatsapp",
    "recordatorio_email_activo",
    "recordatorio_whatsapp_activo",
  ];
  for (const key of booleanKeys) {
    if (key in data && typeof data[key] !== "boolean") {
      throw new HttpError(400, "INVALID_NOTIFICATION_SETTINGS", "Los interruptores de notificaciones deben ser booleanos.");
    }
  }

  const horas = Number(data.horas_antes_recordatorio_email ?? notificationDefaults.horas_antes_recordatorio_email);
  const minutos = Number(data.minutos_antes_recordatorio_whatsapp ?? notificationDefaults.minutos_antes_recordatorio_whatsapp);
  const zonaHoraria = typeof data.zona_horaria === "string" && data.zona_horaria.trim() ? data.zona_horaria.trim() : notificationDefaults.zona_horaria;

  if (!Number.isInteger(horas) || horas < 1 || horas > 168 || !Number.isInteger(minutos) || minutos < 5 || minutos > 1440) {
    throw new HttpError(400, "INVALID_NOTIFICATION_SETTINGS", "Los tiempos de recordatorio no tienen un valor válido.");
  }

  return {
    ...notificationDefaults,
    ...Object.fromEntries(notificationSettingKeys.filter((key) => key in data).map((key) => [key, data[key]])),
    horas_antes_recordatorio_email: horas,
    minutos_antes_recordatorio_whatsapp: minutos,
    zona_horaria: zonaHoraria,
  };
}

async function actualizarConfiguracionNotificaciones(req: Request, supabase: SupabaseClient, auth: AuthContext) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }

  const actual = await obtenerConfiguracionNotificaciones(supabase, auth);
  const configuracion = validarConfiguracionNotificaciones({ ...actual, ...body });
  const { data, error } = await supabase.from("notificaciones_config").upsert({
    profesional_id: auth.userId,
    ...configuracion,
    fecha_actualiza: new Date().toISOString(),
  }, { onConflict: "profesional_id" }).select("*").single();

  if (error) {
    console.error(JSON.stringify({ scope: "updateNotificationSettings", error: error.message, details: error.details, hint: error.hint }));
    throw new HttpError(500, "NOTIFICATION_SETTINGS_UPDATE_FAILED", "No fue posible guardar la configuración de notificaciones.");
  }
  return normalizarConfiguracionNotificaciones(data);
}

function validateAvailabilityPayload(body: Record<string, unknown>) {
  const day = Number(body.dia_semana);
  const start = body.hora_inicio;
  const end = body.hora_fin;
  const startDate = body.fecha_inicio;
  const endDate = body.fecha_fin;
  const duration = Number(body.duracion_minutos);
  const descanso = body.descanso_minutos === undefined || body.descanso_minutos === null || body.descanso_minutos === "" ? 0 : Number(body.descanso_minutos);
  const modalidad = typeof body.modalidad === "string" && ["presencial", "online", "hibrida", "domicilio"].includes(body.modalidad) ? body.modalidad : "presencial";
  if (!Number.isInteger(day) || day < 1 || day > 7 || !isTime(start) || !isTime(end) || !isDate(startDate) || !isDate(endDate) || !Number.isInteger(duration) || duration < 15 || duration > 240 || !Number.isInteger(descanso) || descanso < 0 || descanso > 120) {
    throw new HttpError(400, "INVALID_AVAILABILITY", "dia_semana, fechas, horas y una duración entre 15 y 240 minutos son obligatorios.");
  }
  if (start >= end || startDate > endDate) throw new HttpError(400, "INVALID_AVAILABILITY_RANGE", "La hora y fecha de inicio deben ser menores o iguales al término.");
  return { dia_semana: day, hora_inicio: start, hora_fin: end, fecha_inicio: startDate, fecha_fin: endDate, duracion_minutos: duration, descanso_minutos: descanso, modalidad };
}

async function ensureAvailabilityCanChange(supabase: SupabaseClient, auth: AuthContext, rule: Record<string, unknown>) {
  const now = localSantiago();
  const { data: appointments, error } = await supabase.from("citas").select("fecha,hora_inicio,estado").eq("profesional_id", auth.userId).neq("estado", "cancelada").gte("fecha", now.date);
  if (error) throw new HttpError(500, "APPOINTMENT_LOOKUP_FAILED", "No fue posible verificar las reservas asociadas.");
  const day = Number(rule.dia_semana);
  const start = String(rule.fecha_inicio);
  const end = String(rule.fecha_fin);
  const from = minutes(String(rule.hora_inicio));
  const to = minutes(String(rule.hora_fin));
  const hasFuture = (appointments ?? []).some((appointment) => {
    const date = String(appointment.fecha ?? "").slice(0, 10);
    if (!date || date < now.date || date < start || date > end || date === "") return false;
    const dateDay = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    const appointmentStart = isTime(appointment.hora_inicio) ? minutes(appointment.hora_inicio) : -1;
    return dateDay === day && appointmentStart >= from && appointmentStart < to;
  });
  if (hasFuture) throw new HttpError(409, "AVAILABILITY_HAS_FUTURE_APPOINTMENTS", "No se puede modificar esta disponibilidad porque tiene reservas vigentes desde hoy en adelante.");
}

async function createAvailability(req: Request, supabase: SupabaseClient, auth: AuthContext) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const days = Array.isArray(body.dias_semana) ? body.dias_semana : [body.dia_semana];
  if (days.length === 0 || days.some((day) => !Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > 7)) throw new HttpError(400, "INVALID_AVAILABILITY_DAYS", "Debes seleccionar al menos un día válido.");
  const base = validateAvailabilityPayload({ ...body, dia_semana: Number(days[0]) });
  const records = days.map((day) => ({ ...base, dia_semana: Number(day), profesional_id: auth.userId, activo: true, origen: typeof body.origen === "string" && body.origen.trim() ? body.origen.trim() : "mentalia", fecha_crea: new Date().toISOString() }));
  const { data, error } = await supabase.from("disponibilidad_profesional").insert(records).select("*").order("dia_semana", { ascending: true }).order("hora_inicio", { ascending: true });
  if (error) { console.error(JSON.stringify({ scope: "createAvailability", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "AVAILABILITY_CREATE_FAILED", "No fue posible guardar la disponibilidad."); }
  return data ?? [];
}

async function updateAvailability(req: Request, supabase: SupabaseClient, auth: AuthContext, availabilityId: string) {
  if (!availabilityId) throw new HttpError(400, "INVALID_AVAILABILITY_ID", "Falta el identificador de la disponibilidad.");
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const payload = validateAvailabilityPayload(body);
  const { data: current, error: currentError } = await supabase.from("disponibilidad_profesional").select("*").eq("id", availabilityId).eq("profesional_id", auth.userId).maybeSingle();
  if (currentError) throw new HttpError(500, "AVAILABILITY_LOOKUP_FAILED", "No fue posible consultar la disponibilidad.");
  if (!current) throw new HttpError(404, "AVAILABILITY_NOT_FOUND", "La disponibilidad no existe o no pertenece al profesional autenticado.");
  await ensureAvailabilityCanChange(supabase, auth, current);
  const { data, error } = await supabase.from("disponibilidad_profesional").update({ ...payload, activo: true }).eq("id", availabilityId).eq("profesional_id", auth.userId).select("*").maybeSingle();
  if (error) { console.error(JSON.stringify({ scope: "updateAvailability", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "AVAILABILITY_UPDATE_FAILED", "No fue posible actualizar la disponibilidad."); }
  return data;
}

async function deleteAvailability(supabase: SupabaseClient, auth: AuthContext, availabilityId: string) {
  if (!availabilityId) throw new HttpError(400, "INVALID_AVAILABILITY_ID", "Falta el identificador de la disponibilidad.");
  const { data: current, error: currentError } = await supabase.from("disponibilidad_profesional").select("*").eq("id", availabilityId).eq("profesional_id", auth.userId).maybeSingle();
  if (currentError) throw new HttpError(500, "AVAILABILITY_LOOKUP_FAILED", "No fue posible consultar la disponibilidad.");
  if (!current) throw new HttpError(404, "AVAILABILITY_NOT_FOUND", "La disponibilidad no existe o no pertenece al profesional autenticado.");
  await ensureAvailabilityCanChange(supabase, auth, current);
  const { data, error } = await supabase.from("disponibilidad_profesional").delete().eq("id", availabilityId).eq("profesional_id", auth.userId).select("id").maybeSingle();
  if (error) { console.error(JSON.stringify({ scope: "deleteAvailability", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "AVAILABILITY_DELETE_FAILED", "No fue posible eliminar la disponibilidad."); }
  if (!data) throw new HttpError(404, "AVAILABILITY_NOT_FOUND", "La disponibilidad no existe o no pertenece al profesional autenticado.");
  return { id: data.id, deleted: true };
}

async function listPatients(supabase: SupabaseClient, auth: AuthContext) {
  const { data, error } = await supabase.from("pacientes").select("*").eq("profesional_id", auth.userId).eq("activo", true).order("fecha_crea", { ascending: false });
  if (error) { console.error(JSON.stringify({ scope: "listPatients", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "PATIENTS_LIST_FAILED", "No fue posible cargar los pacientes."); }
  return data ?? [];
}

async function createPatient(req: Request, supabase: SupabaseClient, auth: AuthContext) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const nombres = typeof body.nombres === "string" ? body.nombres.trim() : "";
  const apellidos = typeof body.apellidos === "string" ? body.apellidos.trim() : "";
  const identificador = typeof body.identificador === "string" ? body.identificador.trim() : "";
  if (!nombres || !apellidos || !identificador) throw new HttpError(400, "INVALID_PATIENT", "Nombres, apellidos e identificador son obligatorios.");
  const { data: patient, error } = await supabase.from("pacientes").insert({ profesional_id: auth.userId, nombres, apellidos, identificador, email: body.email || null, telefono: body.telefono || null, fecha_nacimiento: body.fecha_nacimiento || null, genero: body.genero || null, contacto_urgencia: body.contacto_urgencia || null, telefono_emergencia: body.telefono_emergencia || null, activo: true }).select("*").single();
  if (error) { console.error(JSON.stringify({ scope: "createPatient", error: error.message, details: error.details, hint: error.hint })); if (error.code === "23505") throw new HttpError(409, "PATIENT_ALREADY_EXISTS", "Ya existe un paciente con ese identificador."); throw new HttpError(500, "PATIENT_CREATE_FAILED", "No fue posible crear el paciente."); }
  return patient;
}

async function listOperationalAgenda(supabase: SupabaseClient, auth: AuthContext) {
  const { data, error } = await supabase.from("agenda_operativa").select(`
    *,
    pacientes (id, nombres, apellidos, identificador, email, telefono)
  `).eq("profesional_id", auth.userId).order("google_calendar_inicio", { ascending: true });
  if (error) { console.error(JSON.stringify({ scope: "listOperationalAgenda", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "OPERATIONAL_AGENDA_LIST_FAILED", "No fue posible cargar la agenda operativa."); }
  return data ?? [];
}

async function linkOperationalAgenda(req: Request, supabase: SupabaseClient, auth: AuthContext) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const pacienteId = body.paciente_id;
  const eventId = body.google_calendar_event_id;
  if (typeof pacienteId !== "string" || !pacienteId || typeof eventId !== "string" || !eventId) throw new HttpError(400, "INVALID_OPERATIONAL_LINK", "paciente_id y google_calendar_event_id son obligatorios.");
  const { data: patient, error: patientError } = await supabase.from("pacientes").select("id").eq("id", pacienteId).eq("profesional_id", auth.userId).maybeSingle();
  if (patientError) throw new HttpError(500, "PATIENT_LOOKUP_FAILED", "No fue posible validar el paciente.");
  if (!patient) throw new HttpError(404, "PATIENT_NOT_FOUND", "El paciente no existe o no pertenece al profesional autenticado.");
  const record = { profesional_id: auth.userId, paciente_id: pacienteId, google_calendar_event_id: eventId, google_calendar_summary: body.google_calendar_summary || null, google_calendar_inicio: body.google_calendar_inicio || null, google_calendar_fin: body.google_calendar_fin || null, estado_operativo: "confirmada", consentimiento_ia: "no_registrado", origen: "google_calendar" };
  const { data, error } = await supabase.from("agenda_operativa").upsert(record, { onConflict: "profesional_id,google_calendar_event_id" }).select(`*, pacientes (id, nombres, apellidos, identificador, email, telefono)`).single();
  if (error) { console.error(JSON.stringify({ scope: "linkOperationalAgenda", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "OPERATIONAL_AGENDA_LINK_FAILED", "No fue posible vincular el paciente al evento."); }
  return data;
}

async function getLatestClinicalSession(supabase: SupabaseClient, auth: AuthContext, patientId: string) {
  if (!patientId) throw new HttpError(400, "INVALID_PATIENT_ID", "Falta el identificador del paciente.");
  const { data, error } = await supabase.from("sesiones_clinicas").select("*").eq("profesional_id", auth.userId).eq("paciente_id", patientId).order("fecha_crea", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new HttpError(500, "CLINICAL_SESSION_LOOKUP_FAILED", "No fue posible cargar la sesión clínica.");
  return data;
}

async function getClinicalSessionByAppointment(supabase: SupabaseClient, auth: AuthContext, appointmentId: string) {
  if (!appointmentId) throw new HttpError(400, "INVALID_APPOINTMENT_ID", "Falta el identificador de la cita.");
  const { data, error } = await supabase.from("sesiones_clinicas").select("*").eq("profesional_id", auth.userId).eq("cita_id", appointmentId).maybeSingle();
  if (error) throw new HttpError(500, "CLINICAL_SESSION_LOOKUP_FAILED", "No fue posible cargar la sesión clínica.");
  return data;
}

async function saveClinicalSession(req: Request, supabase: SupabaseClient, auth: AuthContext) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido."); }
  const citaId = body.cita_id;
  const patientId = body.paciente_id;
  if (typeof citaId !== "string" || !citaId || typeof patientId !== "string" || !patientId) throw new HttpError(400, "INVALID_CLINICAL_SESSION", "cita_id y paciente_id son obligatorios.");
  const { data: appointment } = await supabase.from("citas").select("id,paciente_id").eq("id", citaId).eq("profesional_id", auth.userId).maybeSingle();
  if (!appointment || appointment.paciente_id !== patientId) throw new HttpError(404, "APPOINTMENT_NOT_FOUND", "La cita no existe o no pertenece al profesional autenticado.");
  const allowed = ["estado", "storage_provider", "storage_file_id", "storage_path", "clinical_data_external", "motivo_consulta", "notas_clinicas", "observaciones", "tareas_acuerdos", "resumen_sesion", "foco_trabajado", "proxima_sesion"];
  const record: Record<string, unknown> = { cita_id: citaId, profesional_id: auth.userId, paciente_id: patientId };
  for (const key of allowed) if (key in body) record[key] = body[key];
  const { data: existing, error: findError } = await supabase.from("sesiones_clinicas").select("id").eq("profesional_id", auth.userId).eq("cita_id", citaId).maybeSingle();
  if (findError) throw new HttpError(500, "CLINICAL_SESSION_LOOKUP_FAILED", "No fue posible validar la sesión clínica.");
  let data; let error;
  if (existing) ({ data, error } = await supabase.from("sesiones_clinicas").update(record).eq("id", existing.id).eq("profesional_id", auth.userId).select("*").single());
  else ({ data, error } = await supabase.from("sesiones_clinicas").insert(record).select("*").single());
  if (error) { console.error(JSON.stringify({ scope: "saveClinicalSession", error: error.message, details: error.details, hint: error.hint })); throw new HttpError(500, "CLINICAL_SESSION_SAVE_FAILED", "No fue posible guardar la sesión clínica."); }
  return data;
}
async function handler(req: Request): Promise<Response> {
  const id = requestId(); const origin = req.headers.get("Origin"); if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  try {
    const url = new URL(req.url); const path = url.pathname.replace(/^\/functions\/v1\/api-mentalia/, "").replace(/^\/api-mentalia/, "") || "/";
    const authorization = req.headers.get("Authorization");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, authorization ? { global: { headers: { Authorization: authorization } } } : undefined);
    const publicDb = publicSupabaseClient();
    if (req.method === "GET" && path === "/v1/health") return json({ service: "api-mentalia", version: "v1", status: "ok" }, 200, origin, id);
    if (req.method === "GET" && path === "/v1/public/professional") return json(await getPublicProfessional(publicDb, url.searchParams.get("slug")), 200, origin, id);
    if (req.method === "GET" && path === "/v1/public/availability") return json(await listPublicBookingData(url, publicDb), 200, origin, id);
    if (req.method === "POST" && path === "/v1/public/patient-lookup") return json(await lookupPublicPatient(req, publicDb), 200, origin, id);
    if (req.method === "POST" && path === "/v1/public/booking") return json(await createPublicBooking(req, publicDb), 201, origin, id);
    if (req.method === "GET" && path === "/v1/me") { const auth = await authenticate(req, supabase); return json({ user_id: auth.userId, email: auth.email, profile: auth.profile }, 200, origin, id); }
    if (req.method === "GET" && path === "/v1/appointments") { const auth = await authenticate(req, supabase); return json(await listAppointments(supabase, auth), 200, origin, id); }
    if (req.method === "GET" && path === "/v1/availability") { const auth = await authenticate(req, supabase); return json(await listAvailability(supabase, auth), 200, origin, id); }
    if (req.method === "POST" && path === "/v1/availability") { const auth = await authenticate(req, supabase); return json(await createAvailability(req, supabase, auth), 201, origin, id); }
    const availabilityMatch = path.match(/^\/v1\/availability\/([^/]+)$/);
    if (req.method === "PATCH" && availabilityMatch) { const auth = await authenticate(req, supabase); return json(await updateAvailability(req, supabase, auth, availabilityMatch[1]), 200, origin, id); }
    if (req.method === "DELETE" && availabilityMatch) { const auth = await authenticate(req, supabase); return json(await deleteAvailability(supabase, auth, availabilityMatch[1]), 200, origin, id); }
    if (req.method === "GET" && path === "/v1/notification-settings") { const auth = await authenticate(req, supabase); return json(await obtenerConfiguracionNotificaciones(supabase, auth), 200, origin, id); }
    if (req.method === "PATCH" && path === "/v1/notification-settings") { const auth = await authenticate(req, supabase); return json(await actualizarConfiguracionNotificaciones(req, supabase, auth), 200, origin, id); }
    if (req.method === "GET" && path === "/v1/patients") { const auth = await authenticate(req, supabase); return json(await listPatients(supabase, auth), 200, origin, id); }
    if (req.method === "POST" && path === "/v1/patients") { const auth = await authenticate(req, supabase); return json(await createPatient(req, supabase, auth), 201, origin, id); }
    if (req.method === "GET" && path === "/v1/operational-agenda") { const auth = await authenticate(req, supabase); return json(await listOperationalAgenda(supabase, auth), 200, origin, id); }
    if (req.method === "POST" && path === "/v1/operational-agenda/link") { const auth = await authenticate(req, supabase); return json(await linkOperationalAgenda(req, supabase, auth), 200, origin, id); }
    const latestSessionMatch = url.searchParams.get("patient_id");
    if (req.method === "GET" && path === "/v1/clinical-sessions/latest") { const auth = await authenticate(req, supabase); return json(await getLatestClinicalSession(supabase, auth, latestSessionMatch ?? ""), 200, origin, id); }
    const sessionAppointmentMatch = path.match(/^\/v1\/clinical-sessions\/appointment\/([^/]+)$/);
    if (req.method === "GET" && sessionAppointmentMatch) { const auth = await authenticate(req, supabase); return json(await getClinicalSessionByAppointment(supabase, auth, sessionAppointmentMatch[1]), 200, origin, id); }
    if (req.method === "POST" && path === "/v1/clinical-sessions") { const auth = await authenticate(req, supabase); return json(await saveClinicalSession(req, supabase, auth), 200, origin, id); }
    if (req.method === "POST" && path === "/v1/appointments") { const auth = await authenticate(req, supabase); return json(await createAppointment(req, supabase, auth), 201, origin, id); }
    const rescheduleMatch = path.match(/^\/v1\/appointments\/([^/]+)\/reschedule$/);
    if (req.method === "POST" && rescheduleMatch) { const auth = await authenticate(req, supabase); return json(await rescheduleAppointment(req, supabase, auth, rescheduleMatch[1]), 200, origin, id); }
    const cancelMatch = path.match(/^\/v1\/appointments\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelMatch) { const auth = await authenticate(req, supabase); return json(await cancelAppointment(supabase, auth, cancelMatch[1]), 200, origin, id); }
    const confirmMatch = path.match(/^\/v1\/appointments\/([^/]+)\/confirm$/);
    if (req.method === "POST" && confirmMatch) { const auth = await authenticate(req, supabase); return json(await confirmAppointment(supabase, auth, confirmMatch[1]), 200, origin, id); }
    throw new HttpError(404, "ROUTE_NOT_FOUND", "Endpoint no encontrado.");
  } catch (error) { const e = error instanceof HttpError ? error : new HttpError(500, "INTERNAL_ERROR", "Error interno de la API."); console.error(JSON.stringify({ request_id: id, code: e.code, message: e.message })); return failure(e, origin, id); }
}
serve(handler);
