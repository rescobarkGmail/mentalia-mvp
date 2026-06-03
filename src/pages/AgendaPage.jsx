import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatearFecha } from "../utils/formato";
import {
  obtenerAccessTokenGoogleCalendar,
  obtenerEventosDelDia,
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

function StatusBadge({ status }) {
  const styles = {
    reservada: "bg-slate-700 text-white",
    confirmada: "bg-slate-700 text-white",
    pendiente: "bg-yellow-100 text-yellow-700",
    cancelada: "bg-red-100 text-red-700",
    reprogramada: "bg-blue-100 text-blue-700",
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

  async function cargarCitas() {
    if (!user?.id) {
      console.warn("AgendaPage: user.id aún no disponible.", user);
      setCargando(false);
      return;
    }

    console.log("AgendaPage - user recibido:", user);
    console.log("AgendaPage - profesional_id usado:", user.id);
    console.log("AgendaPage - refreshKey:", refreshKey);

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

      console.log("AgendaPage - citas encontradas:", data);
      console.log("AgendaPage - disponibilidad encontrada:", disponibilidadData);

      setCitas(data || []);
      setDisponibilidad(disponibilidadData || []);
    } catch (error) {
      console.error("AgendaPage - error inesperado:", error);
      alert("Error inesperado cargando agenda: " + error.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (user?.id) {
      cargarCitas();
    }
  }, [user?.id, refreshKey]);

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

  async function cargarAgendaDesdeGoogleCalendar() {
    setCargandoGoogleCalendar(true);
    setErrorGoogleCalendar("");

    try {
      const accessToken = await obtenerAccessTokenGoogleCalendar();

      const eventos = await obtenerEventosDelDia({
        accessToken,
        fecha: new Date(),
      });

      setEventosGoogleCalendar(eventos);

      console.log("Eventos Google Calendar:", eventos);
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

  function renderEventoGoogleCalendar(evento) {
    return (
      <div
        key={evento.id}
        className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"
      >
        <div className="mb-2 flex flex-col items-start gap-2">
          <span className="text-lg font-black text-blue-700">
            {evento.hora_inicio || "Todo el día"}
            {evento.hora_fin ? ` - ${evento.hora_fin}` : ""}
          </span>

          <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase text-blue-700">
            Google Calendar
          </span>
        </div>

        <p className="font-black text-slate-800">
          {evento.titulo || "Evento sin título"}
        </p>

        {evento.ubicacion && (
          <p className="mt-1 text-xs text-slate-500">{evento.ubicacion}</p>
        )}

        <p className="mt-2 text-xs text-slate-400">
          ID evento: {evento.google_calendar_event_id}
        </p>

        {evento.link_google_calendar && (
          <a
            href={evento.link_google_calendar}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-sm font-bold text-blue-600 hover:underline"
          >
            Ver en Google Calendar
          </a>
        )}
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
          {cita.pacientes?.nombres || "Paciente"}{" "}
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
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-7xl">
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
              onClick={cargarAgendaDesdeGoogleCalendar}
              disabled={cargandoGoogleCalendar}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargandoGoogleCalendar
                ? "Cargando Google Calendar..."
                : "Cargar agenda desde Google Calendar"}
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

        {eventosGoogleCalendar.length > 0 && (
          <section className="mb-6 rounded-[28px] border border-blue-100 bg-blue-50 p-6 shadow">
            <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black text-blue-900">
                  Eventos desde Google Calendar
                </h2>

                <p className="text-sm text-blue-700">
                  Eventos de hoy cargados en modo solo lectura.
                </p>
              </div>

              <p className="text-xs font-bold text-blue-700">
                {eventosGoogleCalendar.length} evento(s)
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {eventosGoogleCalendar.map((evento) =>
                renderEventoGoogleCalendar(evento)
              )}
            </div>
          </section>
        )}

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

            {cargando ? (
              <p className="text-center text-slate-500">Cargando citas...</p>
            ) : citasHoy.length === 0 ? (
              <p className="text-center text-slate-500">
                No hay citas para hoy en Mentalia.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {citasHoy.map((cita) => renderCita(cita))}
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

              <h2 className="text-center font-black">
                Semana {formatearFecha(fechaTexto(semanaBase))} al{" "}
                {formatearFecha(fechaTexto(finSemana))}
              </h2>

              <button
                onClick={() => setSemanaBase(sumarDias(semanaBase, 7))}
                className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
              >
                Semana siguiente →
              </button>
            </div>

            {cargando ? (
              <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                Cargando agenda...
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-7">
                {diasSemana.map((fechaObj) => {
                  const fecha = fechaTexto(fechaObj);
                  const dia = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
                  const citasDia = citasDelDia(fechaObj);

                  return (
                    <div
                      key={fecha}
                      className="min-h-[260px] rounded-2xl border bg-slate-50 p-3"
                    >
                      <h3 className="text-center text-lg font-black text-cyan-700">
                        {dias.find((d) => d.id === dia)?.nombre}
                      </h3>

                      <p className="mb-3 text-center text-xs text-slate-500">
                        {formatearFecha(fecha)}
                      </p>

                      {citasDia.length === 0 ? (
                        <p className="text-center text-xs text-slate-400">
                          Sin citas
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {citasDia.map((cita) => renderCita(cita))}
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
              {citaEditando.pacientes?.nombres}{" "}
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
    </main>
  );
}