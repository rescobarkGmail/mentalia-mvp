/*const CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";*/
const CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_KEY = "mentalia_google_calendar_access_token";
const TOKEN_EXPIRES_KEY = "mentalia_google_calendar_token_expira_en";

export function cargarGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = resolve;
    script.onerror = reject;

    document.body.appendChild(script);
  });
}

export async function obtenerAccessTokenGoogleCalendar() {
  await cargarGoogleIdentityScript();

  const tokenGuardado = localStorage.getItem(TOKEN_KEY);
  const expiraEn = localStorage.getItem(TOKEN_EXPIRES_KEY);

  if (tokenGuardado && expiraEn && Date.now() < Number(expiraEn)) {
    return tokenGuardado;
  }

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: CALENDAR_SCOPES,

      callback: (response) => {
        console.log("Respuesta OAuth Google Calendar:", response);

        if (response.error) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "No se pudo obtener autorización de Google Calendar."
            )
          );
          return;
        }

        const accessToken = response.access_token;
        const expiresInMs = (response.expires_in || 3600) * 1000;

        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(
          TOKEN_EXPIRES_KEY,
          String(Date.now() + expiresInMs - 60000)
        );

        resolve(accessToken);
      },
    });

    client.requestAccessToken({
      prompt: "",
    });
  });
}


export async function obtenerEventosCalendario({
  accessToken,
  calendarId = "primary",
  timeMin,
  timeMax,
  maxResults = 50,
} = {}) {
  if (!accessToken) {
    throw new Error("Falta accessToken para consultar Google Calendar.");
  }

  if (!timeMin || !timeMax) {
    throw new Error("Debes indicar timeMin y timeMax para consultar eventos.");
  }

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return (data.items || []).map(normalizarEventoGoogleCalendar);
}

export async function obtenerEventosDelDia({
  accessToken,
  fecha = new Date(),
  calendarId = "primary",
} = {}) {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(fecha);
  fin.setHours(23, 59, 59, 999);

  return obtenerEventosCalendario({
    accessToken,
    calendarId,
    timeMin: inicio.toISOString(),
    timeMax: fin.toISOString(),
    maxResults: 100,
  });
}

export async function obtenerEventosDeLaSemana({
  accessToken,
  fechaReferencia = new Date(),
  calendarId = "primary",
} = {}) {
  const fecha = new Date(fechaReferencia);
  const diaSemana = fecha.getDay(); // 0 domingo, 1 lunes, etc.

  const inicio = new Date(fecha);
  const diferenciaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  inicio.setDate(fecha.getDate() + diferenciaLunes);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 7);
  fin.setHours(0, 0, 0, 0);

  return obtenerEventosCalendario({
    accessToken,
    calendarId,
    timeMin: inicio.toISOString(),
    timeMax: fin.toISOString(),
    maxResults: 250,
  });
}

export async function obtenerCalendariosGoogle({ accessToken } = {}) {
  if (!accessToken) {
    throw new Error("Falta accessToken para consultar calendarios.");
  }

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return (data.items || []).map((calendario) => ({
    id: calendario.id,
    nombre: calendario.summary,
    descripcion: calendario.description || "",
    principal: Boolean(calendario.primary),
    zonaHoraria: calendario.timeZone,
    acceso: calendario.accessRole,
  }));
}

function normalizarEventoGoogleCalendar(evento) {
  const inicioOriginal = evento.start?.dateTime || evento.start?.date;
  const finOriginal = evento.end?.dateTime || evento.end?.date;

  const esTodoElDia = Boolean(evento.start?.date);

  return {
    id: evento.id,
    google_calendar_event_id: evento.id,

    calendario_id: evento.organizer?.email || "primary",

    titulo: evento.summary || "Sin título",
    descripcion: evento.description || "",
    ubicacion: evento.location || "",

    fecha_inicio: inicioOriginal,
    fecha_fin: finOriginal,

    hora_inicio: esTodoElDia
      ? ""
      : extraerHoraDesdeFechaISO(inicioOriginal),

    hora_fin: esTodoElDia
      ? ""
      : extraerHoraDesdeFechaISO(finOriginal),

    es_todo_el_dia: esTodoElDia,

    estado_google: evento.status,
    link_google_calendar: evento.htmlLink || "",

    organizador: evento.organizer?.email || "",
    creador: evento.creator?.email || "",

    actualizado_en_google: evento.updated || null,

    origen: "google_calendar",
  };
}

function extraerHoraDesdeFechaISO(fechaISO) {
  if (!fechaISO) return "";

  const fecha = new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) {
    return "";
  }

  return fecha.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function actualizarEventoGoogleCalendar({
  accessToken,
  eventId,
  calendarId = "primary",
  summary,
  description,
}) {
  if (!accessToken) {
    throw new Error("Falta accessToken para actualizar Google Calendar.");
  }

  if (!eventId) {
    throw new Error("Falta eventId para actualizar Google Calendar.");
  }

  const body = {};

  if (summary) {
    body.summary = summary;
  }

  if (description) {
    body.description = description;
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}