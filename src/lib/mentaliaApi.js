import { supabase } from "./supabaseClient";

const apiUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/api-mentalia`;

async function apiPublicRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible consultar la reserva pública.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export function obtenerProfesionalPublico(slug) {
  return apiPublicRequest(`/v1/public/professional?slug=${encodeURIComponent(slug)}`);
}

export function obtenerDisponibilidadPublica({ slug, from, to }) {
  return apiPublicRequest(`/v1/public/availability?slug=${encodeURIComponent(slug)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export function buscarPacientePublico(datos) {
  return apiPublicRequest("/v1/public/patient-lookup", { method: "POST", body: JSON.stringify(datos) });
}

export function reservarHoraPublica(datos) {
  return apiPublicRequest("/v1/public/booking", { method: "POST", body: JSON.stringify(datos) });
}

async function obtenerAccessToken() {
  try {
    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("getSession_timeout")), 3000);
    });
    const { data } = await Promise.race([supabase.auth.getSession(), timeout]);
    if (data?.session?.access_token) return data.session.access_token;
  } catch {
    // Supabase Auth puede mantener un lock mientras App.jsx procesa un evento.
  }

  const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
  const stored = localStorage.getItem(`sb-${projectRef}-auth-token`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token) return parsed.access_token;
    } catch {
      // La sesión almacenada no es JSON válido.
    }
  }

  const error = new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  error.code = "AUTH_REQUIRED";
  throw error;
}

async function apiGet(path) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible consultar la API.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export function obtenerCitas() {
  return apiGet("/v1/appointments");
}

export function obtenerDisponibilidad() {
  return apiGet("/v1/availability");
}

export async function crearDisponibilidad(datos) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}/v1/availability`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible guardar la disponibilidad.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export async function actualizarDisponibilidad(id, datos) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}/v1/availability/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible actualizar la disponibilidad.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export async function eliminarDisponibilidad(id) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}/v1/availability/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible eliminar la disponibilidad.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export function obtenerPacientes() {
  return apiGet("/v1/patients");
}

export function obtenerAgendaOperativa() {
  return apiGet("/v1/operational-agenda");
}

export async function vincularEventoPaciente(datos) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}/v1/operational-agenda/link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible vincular el evento.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export function obtenerUltimaSesionClinica(pacienteId) {
  return apiGet(`/v1/clinical-sessions/latest?patient_id=${encodeURIComponent(pacienteId)}`);
}

export function obtenerSesionClinicaPorCita(citaId) {
  return apiGet(`/v1/clinical-sessions/appointment/${encodeURIComponent(citaId)}`);
}

export async function guardarSesionClinica(datos) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}/v1/clinical-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible guardar la sesión clínica.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export async function crearPacienteApi(datos) {
  const accessToken = await obtenerAccessToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);
  console.info("[Mentalia API] creando paciente");
  let response;
  try {
    response = await fetch(`${apiUrl}/v1/patients`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("La API tardó demasiado en responder. Revisa la conexión y vuelve a intentar.");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
  console.info("[Mentalia API] respuesta creación paciente", response.status);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible crear el paciente.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export async function crearCita({ pacienteId, fecha, horaInicio, duracionMinutos }) {
  const accessToken = await obtenerAccessToken();

  const response = await fetch(`${apiUrl}/v1/appointments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paciente_id: pacienteId,
      fecha,
      hora_inicio: horaInicio,
      duracion_minutos: Number(duracionMinutos),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible crear la cita.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }

  return payload.data;
}

export async function reprogramarCita({ citaId, fecha, horaInicio }) {
  const accessToken = await obtenerAccessToken();

  const response = await fetch(`${apiUrl}/v1/appointments/${encodeURIComponent(citaId)}/reschedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fecha, hora_inicio: horaInicio }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible reprogramar la cita.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export async function cancelarCita(citaId) {
  const accessToken = await obtenerAccessToken();

  const response = await fetch(`${apiUrl}/v1/appointments/${encodeURIComponent(citaId)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible cancelar la cita.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export async function confirmarCita(citaId) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}/v1/appointments/${encodeURIComponent(citaId)}/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible aceptar la reserva.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}

export function obtenerConfiguracionNotificaciones() {
  return apiGet("/v1/notification-settings");
}

export async function guardarConfiguracionNotificaciones(configuracion) {
  const accessToken = await obtenerAccessToken();
  const response = await fetch(`${apiUrl}/v1/notification-settings`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(configuracion),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || "No fue posible guardar la configuración de notificaciones.");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    error.requestId = payload?.request_id;
    throw error;
  }
  return payload.data;
}
