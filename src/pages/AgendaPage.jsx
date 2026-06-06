import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatearFecha } from "../utils/formato";
import {
  obtenerAccessTokenGoogleCalendar,
  obtenerEventosDeLaSemana,
  actualizarEventoGoogleCalendar,
} from "../lib/googleCalendarClient";

const dias = [
  { id: 1, nombre: "Lunes" },
  { id: 2, nombre: "Martes" },
  { id: 3, nombre: "Miércoles" },
  { id: 4, nombre: "Jueves" },
  { id: 5, nombre: "Viernes" },
  { id: 6, nombre: "Sábado" },
  { id: 7, nombre: "Domingo" },
];

function fechaTexto(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inicioSemana(fechaBase) {
  const fecha = new Date(fechaBase);
  fecha.setHours(0, 0, 0, 0);

  const dia = fecha.getDay() === 0 ? 7 : fecha.getDay();
  fecha.setDate(fecha.getDate() - dia + 1);

  return fecha;
}

function sumarDias(fecha, cantidadDias) {
  const nueva = new Date(fecha);
  nueva.setDate(nueva.getDate() + cantidadDias);
  return nueva;
}

function calcularHoraFin(hora, minutos = 60) {
  const [h, m] = hora.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + Number(minutos), 0, 0);
  return date.toTimeString().slice(0, 5);
}

function extraerFechaDesdeISO(fechaISO) {
  if (!fechaISO) return null;
  return fechaISO.slice(0, 10);
}

function StatusBadge({ status }) {
  const styles = {
    reservada: "bg-slate-700 text-white",
    confirmada: "bg-slate-700 text-white",
    pendiente: "bg-yellow-100 text-yellow-700",
    cancelada: "bg-red-100 text-red-700",
    reprogramada: "bg-blue-100 text-blue-700",
    pendiente_vinculacion: "bg-amber-100 text-amber-700",
    no_presentada: "bg-orange-100 text-orange-700",
    realizada: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex max-w-full rounded-full px-2 py-1 text-[10px] font-bold uppercase leading-none ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status || "sin estado"}
    </span>
  );
}

export default function AgendaPage({
  user,
  refreshKey = 0,
  goBack,
  iniciarFlujo,
}) {
  const [view, setView] = useState("week");
  const [citas, setCitas] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [semanaBase, setSemanaBase] = useState(inicioSemana(new Date()));
  const [citaEditando, setCitaEditando] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [cargando, setCargando] = useState(false);

  const [eventosGoogleCalendar, setEventosGoogleCalendar] = useState([]);
  const [cargandoGoogleCalendar, setCargandoGoogleCalendar] = useState(false);
  const [errorGoogleCalendar, setErrorGoogleCalendar] = useState("");
  const [eventoGoogleSeleccionado, setEventoGoogleSeleccionado] =
    useState(null);

  const [pacientes, setPacientes] = useState([]);
  const [cargandoPacientes, setCargandoPacientes] = useState(false);
  const [pacienteSeleccionadoId, setPacienteSeleccionadoId] = useState("");
  const [busquedaPaciente, setBusquedaPaciente] = useState("");

  const [atencionGoogleVinculada, setAtencionGoogleVinculada] =
    useState(null);
  const [atencionesGoogleVinculadas, setAtencionesGoogleVinculadas] =
    useState([]);
  const [guardandoVinculacion, setGuardandoVinculacion] = useState(false);

  async function cargarCitas() {
    if (!user?.id) {
      console.warn("AgendaPage: user.id aún no disponible.", user);
      setCargando(false);
      return;
    }

    setCargando(true);

    try {
      const { data, error } = await supabase
        .from("citas")
        .select(`
          *,
          pacientes (
            id,
            nombres,
            apellidos,
            identificador,
            email,
            telefono
          )
        `)
        .eq("profesional_id", user.id)
        .order("fecha", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (error) {
        console.error("AgendaPage - error cargando citas:", error);
        alert("Error cargando citas: " + error.message);
        return;
      }

      const { data: disponibilidadData, error: disponibilidadError } =
        await supabase
          .from("disponibilidad_profesional")
          .select("*")
          .eq("profesional_id", user.id)
          .eq("activo", true);

      if (disponibilidadError) {
        console.error(
          "AgendaPage - error cargando disponibilidad:",
          disponibilidadError
        );
        alert("Error cargando disponibilidad: " + disponibilidadError.message);
        return;
      }

      setCitas(data || []);
      setDisponibilidad(disponibilidadData || []);
    } catch (error) {
      console.error("AgendaPage - error inesperado:", error);
      alert("Error inesperado cargando agenda: " + error.message);
    } finally {
      setCargando(false);
    }
  }

  async function cargarPacientes() {
    if (!user?.id) {
      console.warn("No se puede cargar pacientes: user.id no disponible.");
      setPacientes([]);
      setCargandoPacientes(false);
      return;
    }

    setCargandoPacientes(true);

    try {
      const { data, error } = await supabase
        .from("pacientes")
        .select(
          "id, nombres, apellidos, identificador, email, telefono, profesional_id"
        )
        .eq("profesional_id", user.id)
        .order("apellidos", { ascending: true, nullsFirst: false })
        .order("nombres", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Error cargando pacientes:", error);
        alert("No se pudieron cargar los pacientes: " + error.message);
        setPacientes([]);
        return;
      }

      const pacientesOrdenados = (data || []).sort((a, b) => {
        const nombreA = `${a.apellidos || ""} ${a.nombres || ""}`
          .trim()
          .toLowerCase();

        const nombreB = `${b.apellidos || ""} ${b.nombres || ""}`
          .trim()
          .toLowerCase();

        return nombreA.localeCompare(nombreB, "es");
      });

      setPacientes(pacientesOrdenados);
    } catch (error) {
      console.error("Error inesperado cargando pacientes:", error);
      alert("Error inesperado cargando pacientes: " + error.message);
      setPacientes([]);
    } finally {
      setCargandoPacientes(false);
    }
  }

  function normalizarAtencionOperativa(row) {
    const paciente = row.pacientes || row.paciente || null;

    return {
      id: row.id,
      agenda_operativa_id: row.id,
      google_calendar_event_id: row.google_calendar_event_id,
      origen: row.origen || "google_calendar",

      titulo: row.google_calendar_summary || "Atención Google Calendar",
      google_calendar_summary: row.google_calendar_summary,
      fecha_inicio: row.google_calendar_inicio,
      fecha_fin: row.google_calendar_fin,
      hora_inicio: row.google_calendar_inicio
        ? new Date(row.google_calendar_inicio).toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
      hora_fin: row.google_calendar_fin
        ? new Date(row.google_calendar_fin).toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",

      profesional_id: row.profesional_id,
      paciente_id: row.paciente_id,
      paciente,
      pacientes: paciente,
      patient: paciente
        ? `${paciente.nombres || ""} ${paciente.apellidos || ""}`.trim()
        : "Paciente vinculado",

      estado_operativo: row.estado_operativo,
      estado: row.estado_operativo,
      consentimiento_ia: row.consentimiento_ia,

      puede_iniciar_flujo_clinico: row.estado_operativo === "confirmada",
      requiere_vincular_paciente: false,

      fecha: row.google_calendar_inicio
        ? extraerFechaDesdeISO(row.google_calendar_inicio)
        : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async function cargarAtencionesOperativas() {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("agenda_operativa")
        .select(`
          *,
          pacientes (
            id,
            nombres,
            apellidos,
            identificador,
            email,
            telefono
          )
        `)
        .eq("profesional_id", user.id)
        .order("google_calendar_inicio", { ascending: true });

      if (error) {
        console.error("Error cargando agenda operativa:", error);
        return;
      }

      setAtencionesGoogleVinculadas(
        (data || []).map((row) => normalizarAtencionOperativa(row))
      );
    } catch (error) {
      console.error("Error inesperado cargando agenda operativa:", error);
    }
  }

  useEffect(() => {
    if (user?.id) {
      cargarCitas();
      cargarPacientes();
      cargarAtencionesOperativas();
    }
  }, [user?.id, refreshKey]);

  useEffect(() => {
    if (user?.id) {
      cargarAgendaDesdeGoogleCalendar(semanaBase);
    }
  }, [user?.id, semanaBase]);

  const hoy = fechaTexto(new Date());

  const citasHoy = citas.filter(
    (c) => c.fecha?.slice(0, 10) === hoy && c.estado !== "cancelada"
  );

  const diasSemana = Array.from({ length: 7 }, (_, i) =>
    sumarDias(semanaBase, i)
  );

  const finSemana = sumarDias(semanaBase, 6);

  function citasDelDia(fechaObj) {
    const fecha = fechaTexto(fechaObj);

    return citas.filter(
      (cita) =>
        cita.fecha?.slice(0, 10) === fecha && cita.estado !== "cancelada"
    );
  }

  function eventosGoogleDelDia(fechaObj) {
    const fecha = fechaTexto(fechaObj);

    return eventosGoogleCalendar.filter(
      (evento) => extraerFechaDesdeISO(evento.fecha_inicio) === fecha
    );
  }

  const eventosGoogleHoy = eventosGoogleDelDia(new Date());

  const pacientesFiltrados = pacientes.filter((paciente) => {
    const textoBusqueda = busquedaPaciente.trim().toLowerCase();

    if (!textoBusqueda) return true;

    const textoPaciente = [
      paciente.nombres,
      paciente.apellidos,
      paciente.identificador,
      paciente.email,
      paciente.telefono,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return textoPaciente.includes(textoBusqueda);
  });

  const pacienteSeleccionado = pacientes.find(
    (item) => String(item.id) === String(pacienteSeleccionadoId)
  );

  function obtenerAtencionVinculadaPorEvento(eventoId) {
    return atencionesGoogleVinculadas.find(
      (item) => String(item.google_calendar_event_id) === String(eventoId)
    );
  }

  function abrirFlujo(cita) {
    iniciarFlujo({
      ...cita,

      patient: `${cita.pacientes?.nombres || ""} ${
        cita.pacientes?.apellidos || ""
      }`.trim(),

      paciente_id: cita.paciente_id,

      paciente: {
        id: cita.pacientes?.id,
        nombres: cita.pacientes?.nombres,
        apellidos: cita.pacientes?.apellidos,
        identificador: cita.pacientes?.identificador,
        email: cita.pacientes?.email,
        telefono: cita.pacientes?.telefono,
      },
    });
  }

  async function cargarAgendaDesdeGoogleCalendar(fechaReferencia = semanaBase) {
    setCargandoGoogleCalendar(true);
    setErrorGoogleCalendar("");

    try {
      const accessToken = await obtenerAccessTokenGoogleCalendar();

      const eventos = await obtenerEventosDeLaSemana({
        accessToken,
        fechaReferencia,
      });

      setEventosGoogleCalendar(eventos);
      await cargarAtencionesOperativas();

      console.log("Eventos Google Calendar semana:", eventos);
    } catch (error) {
      console.error("Error al cargar Google Calendar:", error);

      setErrorGoogleCalendar(
        `No se pudo cargar la agenda desde Google Calendar. Detalle: ${
          error.message || "Error desconocido"
        }`
      );
    } finally {
      setCargandoGoogleCalendar(false);
    }
  }

  function seleccionarEventoGoogleCalendar(evento) {
    const atencionExistente = obtenerAtencionVinculadaPorEvento(
      evento.google_calendar_event_id
    );

    const atencionOperativa = {
      id: evento.id,
      google_calendar_event_id: evento.google_calendar_event_id,
      agenda_operativa_id: atencionExistente?.agenda_operativa_id || null,

      origen: "google_calendar",

      titulo: evento.titulo,
      fecha_inicio: evento.fecha_inicio,
      fecha_fin: evento.fecha_fin,
      hora_inicio: evento.hora_inicio,
      hora_fin: evento.hora_fin,

      estado_operativo: atencionExistente?.estado_operativo || "pendiente_vinculacion",
      consentimiento_ia: atencionExistente?.consentimiento_ia || "no_registrado",

      paciente_id: atencionExistente?.paciente_id || null,
      paciente: atencionExistente?.paciente || null,

      puede_iniciar_flujo_clinico: false,
      requiere_vincular_paciente: true,

      mensaje:
        "Este evento proviene de Google Calendar. Para continuar, debe vincularse a un paciente en Mentalia.",
    };

    setEventoGoogleSeleccionado(atencionOperativa);
    setPacienteSeleccionadoId(atencionExistente?.paciente_id || "");
    setBusquedaPaciente("");
    cargarPacientes();
  }

  async function vincularPacienteAEventoGoogle() {
    if (!eventoGoogleSeleccionado || guardandoVinculacion) return;

    if (!pacienteSeleccionadoId) {
      alert("Selecciona un paciente para vincular la atención.");
      return;
    }

    if (!user?.id) {
      alert("No se pudo identificar al profesional autenticado.");
      return;
    }

    const paciente = pacienteSeleccionado;

    if (!paciente) {
      alert("No se encontró el paciente seleccionado.");
      return;
    }

    setGuardandoVinculacion(true);

    const nuevoTituloGoogle = `Atención Mentalia - ${paciente.nombres || ""} ${
      paciente.apellidos || ""
    }`.trim();

    const registroAgendaOperativa = {
      profesional_id: user.id,
      paciente_id: paciente.id,
      google_calendar_event_id:
        eventoGoogleSeleccionado.google_calendar_event_id,
      google_calendar_summary: nuevoTituloGoogle,
      google_calendar_inicio: eventoGoogleSeleccionado.fecha_inicio,
      google_calendar_fin: eventoGoogleSeleccionado.fecha_fin,
      estado_operativo: "confirmada",
      consentimiento_ia: "no_registrado",
      origen: "google_calendar",
    };

    console.log("Intentando guardar agenda_operativa:", registroAgendaOperativa);

    try {
      const { data, error } = await supabase
        .from("agenda_operativa")
        .upsert(registroAgendaOperativa, {
          onConflict: "profesional_id,google_calendar_event_id",
        })
        .select("*")
        .single();

      console.log("Respuesta Supabase agenda_operativa:", { data, error });

      if (error) {
        console.error("Error guardando agenda_operativa:", error);
        alert("No se pudo guardar la vinculación en Mentalia: " + error.message);
        return;
      }

      let eventoGoogleActualizado = true;

      try {
        const accessToken = await obtenerAccessTokenGoogleCalendar();

        await actualizarEventoGoogleCalendar({
          accessToken,
          eventId: eventoGoogleSeleccionado.google_calendar_event_id,
          summary: nuevoTituloGoogle,
          description:
            "Evento asociado operativamente desde Mentalia. No contiene información clínica.",
        });

        console.log("Evento actualizado en Google Calendar:", nuevoTituloGoogle);

        setEventosGoogleCalendar((prev) =>
          prev.map((evento) =>
            String(evento.google_calendar_event_id) ===
            String(eventoGoogleSeleccionado.google_calendar_event_id)
              ? { ...evento, titulo: nuevoTituloGoogle }
              : evento
          )
        );
      } catch (errorGoogle) {
        eventoGoogleActualizado = false;
        console.error("No se pudo actualizar Google Calendar:", errorGoogle);
      }

      const atencionOperativa = {
        id: data.id,
        agenda_operativa_id: data.id,
        google_calendar_event_id: data.google_calendar_event_id,
        origen: data.origen || "google_calendar",

        titulo: data.google_calendar_summary || nuevoTituloGoogle,
        google_calendar_summary: data.google_calendar_summary,

        fecha_inicio: data.google_calendar_inicio,
        fecha_fin: data.google_calendar_fin,
        hora_inicio: eventoGoogleSeleccionado.hora_inicio,
        hora_fin: eventoGoogleSeleccionado.hora_fin,

        profesional_id: data.profesional_id,
        paciente_id: paciente.id,

        paciente: {
          id: paciente.id,
          nombres: paciente.nombres,
          apellidos: paciente.apellidos,
          identificador: paciente.identificador,
          email: paciente.email,
          telefono: paciente.telefono,
        },
        pacientes: {
          id: paciente.id,
          nombres: paciente.nombres,
          apellidos: paciente.apellidos,
          identificador: paciente.identificador,
          email: paciente.email,
          telefono: paciente.telefono,
        },

        patient: `${paciente.nombres || ""} ${
          paciente.apellidos || ""
        }`.trim(),

        estado_operativo: data.estado_operativo,
        estado: data.estado_operativo,
        consentimiento_ia: data.consentimiento_ia,

        puede_iniciar_flujo_clinico: data.estado_operativo === "confirmada",
        requiere_vincular_paciente: false,

        fecha: data.google_calendar_inicio
          ? data.google_calendar_inicio.slice(0, 10)
          : null,

        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setAtencionesGoogleVinculadas((prev) => {
        const existe = prev.some(
          (item) =>
            String(item.google_calendar_event_id) ===
            String(atencionOperativa.google_calendar_event_id)
        );

        if (existe) {
          return prev.map((item) =>
            String(item.google_calendar_event_id) ===
            String(atencionOperativa.google_calendar_event_id)
              ? atencionOperativa
              : item
          );
        }

        return [...prev, atencionOperativa];
      });

      setAtencionGoogleVinculada({
        ...atencionOperativa,
        eventoGoogleActualizado,
      });

      setEventoGoogleSeleccionado(null);
      setPacienteSeleccionadoId("");
      setBusquedaPaciente("");

      alert("Paciente vinculado correctamente en Mentalia.");
    } catch (error) {
      console.error("Error inesperado vinculando paciente:", error);
      alert("Error inesperado vinculando paciente: " + error.message);
    } finally {
      setGuardandoVinculacion(false);
    }
  }

  async function cancelarCita(cita) {
    const confirma = window.confirm("¿Estás seguro de cancelar esta cita?");
    if (!confirma) return;

    const { error } = await supabase
      .from("citas")
      .update({ estado: "cancelada" })
      .eq("id", cita.id)
      .eq("profesional_id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    setCitas((prev) =>
      prev.map((item) =>
        item.id === cita.id ? { ...item, estado: "cancelada" } : item
      )
    );
  }

  function horarioExisteEnDisponibilidad(fecha, hora) {
    const fechaObj = new Date(`${fecha}T00:00:00`);
    const diaJS = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
    const horaFinNueva = calcularHoraFin(hora, 60);

    return disponibilidad.some((item) => {
      const inicio = item.hora_inicio?.slice(0, 5);
      const fin = item.hora_fin?.slice(0, 5);

      if (!inicio || !fin) return false;

      const mismoDia = Number(item.dia_semana) === Number(diaJS);
      const dentroHora = hora >= inicio && horaFinNueva <= fin;

      const fechaInicio = item.fecha_inicio?.slice(0, 10);
      const fechaFin = item.fecha_fin?.slice(0, 10);

      const dentroRangoFecha =
        (!fechaInicio || fecha >= fechaInicio) &&
        (!fechaFin || fecha <= fechaFin);

      return mismoDia && dentroHora && dentroRangoFecha;
    });
  }

  function existeCitaEnHorario(fecha, hora, citaActualId) {
    return citas.some(
      (cita) =>
        cita.id !== citaActualId &&
        cita.fecha?.slice(0, 10) === fecha &&
        cita.hora_inicio?.slice(0, 5) === hora &&
        cita.estado !== "cancelada"
    );
  }

  function esFechaHoraPasada(fecha, hora) {
    const ahora = new Date();
    const fechaHora = new Date(`${fecha}T${hora}:00`);
    return fechaHora < ahora;
  }

  async function guardarReagenda() {
    if (!citaEditando || !nuevaFecha || !nuevaHora) {
      alert("Selecciona fecha y hora.");
      return;
    }

    if (esFechaHoraPasada(nuevaFecha, nuevaHora)) {
      alert("No puedes reagendar una cita a una fecha u hora pasada.");
      return;
    }

    if (existeCitaEnHorario(nuevaFecha, nuevaHora, citaEditando.id)) {
      alert("Ese horario ya está reservado. Selecciona otro horario.");
      return;
    }

    if (!horarioExisteEnDisponibilidad(nuevaFecha, nuevaHora)) {
      alert(
        "El horario seleccionado no está dentro de la disponibilidad configurada."
      );
      return;
    }

    const horaFin = calcularHoraFin(nuevaHora, 60);

    const { error } = await supabase
      .from("citas")
      .update({
        fecha: nuevaFecha,
        hora_inicio: nuevaHora,
        hora_fin: horaFin,
        estado: "reprogramada",
      })
      .eq("id", citaEditando.id)
      .eq("profesional_id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    setCitas((prev) =>
      prev.map((item) =>
        item.id === citaEditando.id
          ? {
              ...item,
              fecha: nuevaFecha,
              hora_inicio: nuevaHora,
              hora_fin: horaFin,
              estado: "reprogramada",
            }
          : item
      )
    );

    setCitaEditando(null);
    setNuevaFecha("");
    setNuevaHora("");
  }

  function renderEventoGoogleCalendar(evento) {
    const atencionVinculada = obtenerAtencionVinculadaPorEvento(
      evento.google_calendar_event_id
    );

    return (
      <div
        key={evento.id}
        className={`rounded-2xl border bg-white p-4 shadow-sm ${
          atencionVinculada ? "border-emerald-200" : "border-blue-100"
        }`}
      >
        <div className="mb-2 flex flex-col items-start gap-2">
          <span className="text-sm font-black text-blue-700">
            {evento.hora_inicio || "Todo el día"}
            {evento.hora_fin ? ` - ${evento.hora_fin}` : ""}
          </span>


          <span
            className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
              atencionVinculada
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {atencionVinculada ? "Paciente vinculado" : "Google Calendar"}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-800">
          {evento.titulo || "Evento sin título"}
        </p>

        {evento.ubicacion && (
          <p className="mt-1 text-xs text-slate-500">{evento.ubicacion}</p>
        )}

        {atencionVinculada && (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
              Asignado a
            </p>
            <p className="mt-1 font-black text-slate-900">
              {atencionVinculada.paciente?.nombres} {" "}
              {atencionVinculada.paciente?.apellidos}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Estado: {atencionVinculada.estado_operativo} · IA: {" "}
              {atencionVinculada.consentimiento_ia}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {evento.link_google_calendar && (
            <a
              href={evento.link_google_calendar}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-blue-600 hover:underline"
            >
              Ver en Google Calendar
            </a>
          )}

          <button
            type="button"
            onClick={() => seleccionarEventoGoogleCalendar(evento)}
            className={`w-full rounded-xl px-3 py-2 text-sm font-black text-white ${
              atencionVinculada
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-[#18AFC1] hover:bg-cyan-700"
            }`}
          >
            {atencionVinculada
              ? "Cambiar paciente asignado"
              : "Seleccionar atención"}
          </button>

          {atencionVinculada && (
            <button
              type="button"
              onClick={() => iniciarFlujo(atencionVinculada)}
              className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-black text-cyan-700 hover:bg-cyan-50"
            >
              Continuar a Pre-sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderCita(cita) {
    return (
      <div
        key={cita.id}
        className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm"
      >
        <div className="mb-2 flex flex-col items-start gap-2">
          <span className="text-lg font-black text-cyan-700">
            {cita.hora_inicio?.slice(0, 5)}
          </span>

          <StatusBadge status={cita.estado} />
        </div>

        <p className="font-black text-slate-800">
          {cita.pacientes?.nombres || "Paciente"} {" "}
          {cita.pacientes?.apellidos || ""}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {cita.origen || "Mentalia"}
        </p>

        <button
          onClick={() => abrirFlujo(cita)}
          className="mt-3 w-full rounded-xl bg-[#18AFC1] px-3 py-2 text-sm font-black text-white hover:bg-cyan-700"
        >
          Atender paciente
        </button>

        <button
          onClick={() => {
            setCitaEditando(cita);
            setNuevaFecha(cita.fecha?.slice(0, 10));
            setNuevaHora(cita.hora_inicio?.slice(0, 5));
          }}
          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-black text-blue-600 hover:bg-blue-50"
        >
          Reagendar
        </button>

        <button
          onClick={() => cancelarCita(cita)}
          className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-600 hover:bg-red-50"
        >
          Cancelar cita
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] px-4 py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] px-2">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Agenda</h1>

            <p className="text-sm text-slate-500">
              {cargando
                ? "Cargando agenda..."
                : `${citas.length} citas registradas en Mentalia`}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Profesional ID: {user?.id || "no disponible"}
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <button
              onClick={() => cargarAgendaDesdeGoogleCalendar(semanaBase)}
              disabled={cargandoGoogleCalendar}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargandoGoogleCalendar
                ? "Cargando Google Calendar..."
                : "Actualizar Google Calendar"}
            </button>

            <button
              onClick={cargarCitas}
              disabled={cargando}
              className="rounded-xl border border-cyan-200 bg-white px-4 py-2 font-bold text-cyan-700 disabled:opacity-50"
            >
              {cargando ? "Actualizando..." : "Actualizar Mentalia"}
            </button>
          </div>
        </div>

        {errorGoogleCalendar && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorGoogleCalendar}
          </div>
        )}

        <section className="mb-6 rounded-[24px] border border-blue-100 bg-blue-50 p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-blue-900">
                Google Calendar conectado
              </h2>

              <p className="text-sm text-blue-700">
                La agenda se carga automáticamente desde Google Calendar para la semana seleccionada.
              </p>
            </div>

            <p className="text-xs font-bold text-blue-700">
              {cargandoGoogleCalendar
                ? "Sincronizando..."
                : `${eventosGoogleCalendar.length} evento(s) en la semana`}
            </p>
          </div>
        </section>

        <div className="mb-6 flex rounded-full bg-cyan-100 p-1">
          <button
            onClick={() => setView("day")}
            className={`flex-1 rounded-full py-2 font-bold ${
              view === "day" ? "bg-white text-cyan-800" : "text-slate-500"
            }`}
          >
            Día
          </button>

          <button
            onClick={() => setView("week")}
            className={`flex-1 rounded-full py-2 font-bold ${
              view === "week" ? "bg-white text-cyan-800" : "text-slate-500"
            }`}
          >
            Semana
          </button>
        </div>

        {view === "day" && (
          <section className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow">
            <h2 className="mb-5 text-center text-xl font-black">
              Hoy - {formatearFecha(hoy)}
            </h2>

            {cargandoGoogleCalendar || cargando ? (
              <p className="text-center text-slate-500">Cargando agenda...</p>
            ) : eventosGoogleHoy.length === 0 && citasHoy.length === 0 ? (
              <p className="text-center text-slate-500">
                No hay eventos para hoy en Google Calendar ni citas internas en Mentalia.
              </p>
            ) : (
              <div className="space-y-6">
                {eventosGoogleHoy.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-blue-700">
                      Google Calendar
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {eventosGoogleHoy.map((evento) =>
                        renderEventoGoogleCalendar(evento)
                      )}
                    </div>
                  </div>
                )}

                {citasHoy.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-cyan-700">
                      Citas internas Mentalia
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {citasHoy.map((cita) => renderCita(cita))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {view === "week" && (
          <section className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                onClick={() => setSemanaBase(sumarDias(semanaBase, -7))}
                className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
              >
                ← Semana anterior
              </button>

              <div className="text-center">
                <h2 className="font-black">
                  Semana {formatearFecha(fechaTexto(semanaBase))} al {" "}
                  {formatearFecha(fechaTexto(finSemana))}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Fuente primaria: Google Calendar. Mentalia muestra la capa operativa y las vinculaciones de paciente.
                </p>
              </div>

              <button
                onClick={() => setSemanaBase(sumarDias(semanaBase, 7))}
                className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
              >
                Semana siguiente →
              </button>
            </div>

            {cargandoGoogleCalendar || cargando ? (
              <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                Cargando agenda semanal desde Google Calendar...
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-7">
                {diasSemana.map((fechaObj) => {
                  const fecha = fechaTexto(fechaObj);
                  const dia = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
                  const citasDia = citasDelDia(fechaObj);
                  const eventosGoogleDia = eventosGoogleDelDia(fechaObj);

                  return (
                    <div
                      key={fecha}
                      className="min-h-[320px] rounded-2xl border bg-slate-50 p-3"
                    >
                      <h3 className="text-center text-lg font-black text-cyan-700">
                        {dias.find((d) => d.id === dia)?.nombre}
                      </h3>

                      <p className="mb-3 text-center text-xs text-slate-500">
                        {formatearFecha(fecha)}
                      </p>

                      {eventosGoogleDia.length === 0 && citasDia.length === 0 ? (
                        <p className="text-center text-xs text-slate-400">
                          Sin eventos
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {eventosGoogleDia.map((evento) =>
                            renderEventoGoogleCalendar(evento)
                          )}

                          {citasDia.length > 0 && (
                            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-2">
                              <p className="mb-2 text-[10px] font-black uppercase text-cyan-700">
                                Citas internas Mentalia
                              </p>

                              <div className="space-y-2">
                                {citasDia.map((cita) => renderCita(cita))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {citaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-800">
              Reagendar cita
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {citaEditando.pacientes?.nombres} {" "}
              {citaEditando.pacientes?.apellidos}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-600">
                  Nueva fecha
                </label>

                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-600">
                  Nueva hora
                </label>

                <input
                  type="time"
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setCitaEditando(null)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold"
              >
                Cancelar
              </button>

              <button
                onClick={guardarReagenda}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-black text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {eventoGoogleSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-600">
                  Google Calendar
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Vincular atención a paciente
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEventoGoogleSeleccionado(null);
                  setPacienteSeleccionadoId("");
                  setBusquedaPaciente("");
                }}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-base font-black text-slate-900">
                  {eventoGoogleSeleccionado.titulo}
                </p>

                <p className="mt-1 text-sm font-bold text-blue-700">
                  {eventoGoogleSeleccionado.hora_inicio || "Todo el día"}
                  {eventoGoogleSeleccionado.hora_fin
                    ? ` - ${eventoGoogleSeleccionado.hora_fin}`
                    : ""}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <label className="text-sm font-bold text-cyan-900">
                  Buscar paciente
                </label>

                <input
                  type="text"
                  value={busquedaPaciente}
                  onChange={(e) => {
                    setBusquedaPaciente(e.target.value);
                    setPacienteSeleccionadoId("");
                  }}
                  placeholder="Nombre, apellido, RUT, email o teléfono"
                  className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-cyan-100"
                />

                <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-cyan-100 bg-white">
                  {cargandoPacientes ? (
                    <p className="p-4 text-sm text-slate-500">
                      Cargando pacientes...
                    </p>
                  ) : pacientesFiltrados.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      No se encontraron pacientes.
                    </p>
                  ) : (
                    pacientesFiltrados.map((paciente) => {
                      const seleccionado =
                        String(paciente.id) === String(pacienteSeleccionadoId);

                      return (
                        <button
                          key={paciente.id}
                          type="button"
                          onClick={() =>
                            setPacienteSeleccionadoId(String(paciente.id))
                          }
                          className={`w-full border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-cyan-50 ${
                            seleccionado ? "bg-cyan-100" : "bg-white"
                          }`}
                        >
                          <p className="font-black text-slate-800">
                            {paciente.apellidos || ""} {paciente.nombres || ""}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {paciente.identificador || "Sin identificador"}
                            {paciente.email ? ` · ${paciente.email}` : ""}
                            {paciente.telefono ? ` · ${paciente.telefono}` : ""}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {pacienteSeleccionado && (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Paciente seleccionado
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-900">
                    {pacienteSeleccionado.nombres || ""} {" "}
                    {pacienteSeleccionado.apellidos || ""}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {pacienteSeleccionado.identificador || "Sin identificador"}
                    {pacienteSeleccionado.email
                      ? ` · ${pacienteSeleccionado.email}`
                      : ""}
                    {pacienteSeleccionado.telefono
                      ? ` · ${pacienteSeleccionado.telefono}`
                      : ""}
                  </p>
                </div>
              )}

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Esta acción vincula el evento de Google Calendar con un paciente
                existente en Mentalia. No habilita IA automáticamente.
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-5 md:flex-row">
              <button
                type="button"
                onClick={() => {
                  setEventoGoogleSeleccionado(null);
                  setPacienteSeleccionadoId("");
                  setBusquedaPaciente("");
                }}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={vincularPacienteAEventoGoogle}
                disabled={!pacienteSeleccionadoId || guardandoVinculacion}
                className="flex-1 rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {guardandoVinculacion
                  ? "Guardando..."
                  : pacienteSeleccionado
                  ? `Asignar a ${pacienteSeleccionado.nombres || "paciente"}`
                  : "Asignar paciente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {atencionGoogleVinculada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
                Atención operativa creada
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Paciente vinculado correctamente
              </h2>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-800">
                Evento Google Calendar
              </p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {atencionGoogleVinculada.titulo}
              </p>

              <p className="mt-2 text-sm font-bold text-emerald-700">
                {atencionGoogleVinculada.hora_inicio || "Todo el día"}
                {atencionGoogleVinculada.hora_fin
                  ? ` - ${atencionGoogleVinculada.hora_fin}`
                  : ""}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-700">Paciente</p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {atencionGoogleVinculada.paciente?.nombres} {" "}
                {atencionGoogleVinculada.paciente?.apellidos}
              </p>

              {atencionGoogleVinculada.paciente?.identificador && (
                <p className="mt-1 text-xs text-slate-500">
                  Identificador: {" "}
                  {atencionGoogleVinculada.paciente.identificador}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                Estado del flujo
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-700">
                La atención quedó guardada en la agenda operativa de Mentalia.
                {atencionGoogleVinculada.eventoGoogleActualizado
                  ? " El evento también fue actualizado en Google Calendar."
                  : " No se pudo actualizar el evento en Google Calendar, pero la vinculación quedó guardada en Mentalia."}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={() => setAtencionGoogleVinculada(null)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => {
                  setAtencionGoogleVinculada(null);
                  iniciarFlujo(atencionGoogleVinculada);
                }}
                className="flex-1 rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white hover:bg-cyan-700"
              >
                Continuar a Pre-sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
