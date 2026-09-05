import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatearFecha } from "../utils/formato";
import {
  obtenerAccessTokenGoogleCalendar,
  obtenerEventosDeLaSemana,
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

const TABLA_DISPONIBILIDAD = "disponibilidad_profesional";
const TABLA_RESERVAS_LEGACY = "citas";

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

function generarSlots(horaInicio, horaFin, duracion) {
  const slots = [];
  const [hi, mi] = horaInicio.slice(0, 5).split(":").map(Number);
  const [hf, mf] = horaFin.slice(0, 5).split(":").map(Number);

  let actual = new Date();
  actual.setHours(hi, mi, 0, 0);

  const fin = new Date();
  fin.setHours(hf, mf, 0, 0);

  while (actual < fin) {
    const siguiente = new Date(actual.getTime() + Number(duracion) * 60000);

    if (siguiente <= fin) {
      slots.push({
        hora_inicio: actual.toTimeString().slice(0, 5),
        hora_fin: siguiente.toTimeString().slice(0, 5),
      });
    }

    actual = siguiente;
  }

  return slots;
}

function crearFechaHora(fecha, hora) {
  return new Date(`${fecha}T${hora}:00`);
}

function hayCruceHorario(inicioA, finA, inicioB, finB) {
  return inicioA < finB && finA > inicioB;
}

function obtenerNombreDia(id) {
  return dias.find((dia) => dia.id === Number(id))?.nombre || "Día";
}

export default function DisponibilidadPage({ user, goBack }) {
  const hoy = fechaTexto(new Date());

  const [items, setItems] = useState([]);
  const [citas, setCitas] = useState([]);
  const [eventosGoogleCalendar, setEventosGoogleCalendar] = useState([]);
  const [semanaBase, setSemanaBase] = useState(inicioSemana(new Date()));

  const [diaSemana, setDiaSemana] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [duracion, setDuracion] = useState("60");
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [cargandoGoogleCalendar, setCargandoGoogleCalendar] = useState(false);
  const [errorGoogleCalendar, setErrorGoogleCalendar] = useState("");

  const [modal, setModal] = useState({
    visible: false,
    title: "",
    message: "",
  });

  const diasSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => sumarDias(semanaBase, i)),
    [semanaBase]
  );

  const finSemana = sumarDias(semanaBase, 6);

  function mostrarModal(title, message) {
    setModal({ visible: true, title, message });
  }

  async function cargar() {
    if (!user?.id) return;

    setCargandoDatos(true);

    try {
      const { data: disponibilidad, error: disponibilidadError } = await supabase
        .from(TABLA_DISPONIBILIDAD)
        .select("*")
        .eq("profesional_id", user.id)
        .order("dia_semana", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (disponibilidadError) {
        mostrarModal("Error", disponibilidadError.message);
        return;
      }

      const { data: citasData, error: citasError } = await supabase
        .from(TABLA_RESERVAS_LEGACY)
        .select("*")
        .eq("profesional_id", user.id)
        .order("fecha", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (citasError) {
        mostrarModal("Error", citasError.message);
        return;
      }

      setItems(disponibilidad || []);
      setCitas(citasData || []);
    } catch (error) {
      mostrarModal("Error", error.message || "No se pudieron cargar los datos.");
    } finally {
      setCargandoDatos(false);
    }
  }

  async function cargarEventosGoogleCalendar(fechaReferencia = semanaBase) {
    setCargandoGoogleCalendar(true);
    setErrorGoogleCalendar("");

    try {
      const accessToken = await obtenerAccessTokenGoogleCalendar({ loginHint: user?.email });
      const eventos = await obtenerEventosDeLaSemana({
        accessToken,
        fechaReferencia,
      });

      setEventosGoogleCalendar(eventos || []);
    } catch (error) {
      console.error("Error cargando Google Calendar:", error);
      setErrorGoogleCalendar(
        `No se pudo leer Google Calendar. Detalle: ${
          error.message || "Error desconocido"
        }`
      );
    } finally {
      setCargandoGoogleCalendar(false);
    }
  }

  useEffect(() => {
    if (user?.id) {
      cargar();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      cargarEventosGoogleCalendar(semanaBase);
    }
  }, [user?.id, semanaBase]);

  function resetFormulario() {
    setDiaSemana("");
    setHoraInicio("");
    setHoraFin("");
    setDuracion("60");
    setFechaInicio(hoy);
    setFechaFin("");
    setEditandoId(null);
  }

  function estaReservadoEnCitas(fecha, horaInicioSlot) {
    return citas.some((cita) => {
      const fechaCita = cita.fecha?.slice(0, 10);
      const horaCita = cita.hora_inicio?.slice(0, 5);

      return (
        fechaCita === fecha &&
        horaCita === horaInicioSlot &&
        cita.estado !== "cancelada"
      );
    });
  }

  function eventoGoogleQueBloquea(fecha, horaInicioSlot, horaFinSlot) {
    const inicioSlot = crearFechaHora(fecha, horaInicioSlot);
    const finSlot = crearFechaHora(fecha, horaFinSlot);

    return eventosGoogleCalendar.find((evento) => {
      if (!evento.fecha_inicio || !evento.fecha_fin) return false;
      if (evento.estado_google === "cancelled") return false;

      const inicioEvento = new Date(evento.fecha_inicio);
      const finEvento = new Date(evento.fecha_fin);

      if (Number.isNaN(inicioEvento.getTime()) || Number.isNaN(finEvento.getTime())) {
        return false;
      }

      return hayCruceHorario(inicioSlot, finSlot, inicioEvento, finEvento);
    });
  }

  function eventosGoogleDelDia(fecha) {
    return eventosGoogleCalendar
      .filter((evento) => {
        if (!evento.fecha_inicio) return false;
        if (evento.estado_google === "cancelled") return false;

        const inicioEvento = new Date(evento.fecha_inicio);
        if (Number.isNaN(inicioEvento.getTime())) return false;

        return fechaTexto(inicioEvento) === fecha;
      })
      .sort((a, b) => String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || "")));
  }

  function slotsDelDia(fechaObj) {
    const fecha = fechaTexto(fechaObj);
    const diaJS = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();

    const reglas = items.filter((item) => {
      const activo = item.activo === undefined || item.activo === null || item.activo === true;

      return (
        activo &&
        Number(item.dia_semana) === Number(diaJS) &&
        item.fecha_inicio <= fecha &&
        item.fecha_fin >= fecha
      );
    });

    const slots = [];

    reglas.forEach((regla) => {
      generarSlots(
        regla.hora_inicio,
        regla.hora_fin,
        regla.duracion_minutos
      ).forEach((slot) => {
        const eventoGoogle = eventoGoogleQueBloquea(
          fecha,
          slot.hora_inicio,
          slot.hora_fin
        );

        const reservadoInterno = estaReservadoEnCitas(fecha, slot.hora_inicio);

        slots.push({
          fecha,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          regla_id: regla.id,
          duracion_minutos: regla.duracion_minutos,
          estado: eventoGoogle || reservadoInterno ? "ocupado" : "disponible",
          motivo_ocupado: eventoGoogle
            ? "google_calendar"
            : reservadoInterno
            ? "mentalia"
            : null,
          eventoGoogle,
        });
      });
    });

    return slots.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }

  function tieneReservasVigentes(item) {
    return citas.some((cita) => {
      const fechaCita = cita.fecha?.slice(0, 10);
      const horaCita = cita.hora_inicio?.slice(0, 5);

      if (!fechaCita || !horaCita) return false;

      const fechaObj = new Date(`${fechaCita}T00:00:00`);
      const diaJS = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();

      const mismaRegla =
        fechaCita >= item.fecha_inicio &&
        fechaCita <= item.fecha_fin &&
        horaCita >= item.hora_inicio.slice(0, 5) &&
        horaCita < item.hora_fin.slice(0, 5) &&
        cita.estado !== "cancelada";

      return mismaRegla && diaJS === Number(item.dia_semana);
    });
  }

  function editar(item) {
    if (tieneReservasVigentes(item)) {
      mostrarModal(
        "No se puede modificar",
        "Esta disponibilidad tiene reservas vigentes. Para modificarla, primero debes cancelar o reagendar las citas asociadas."
      );
      return;
    }

    setEditandoId(item.id);
    setDiaSemana(String(item.dia_semana));
    setHoraInicio(item.hora_inicio.slice(0, 5));
    setHoraFin(item.hora_fin.slice(0, 5));
    setDuracion(String(item.duracion_minutos));
    setFechaInicio(item.fecha_inicio);
    setFechaFin(item.fecha_fin);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardar() {
    if (guardando) return;

    if (
      !diaSemana ||
      !fechaInicio ||
      !fechaFin ||
      !horaInicio ||
      !horaFin ||
      !duracion
    ) {
      mostrarModal("Campos incompletos", "Completa todos los campos de disponibilidad.");
      return;
    }

    if (horaInicio >= horaFin) {
      mostrarModal("Horario inválido", "La hora de inicio debe ser menor que la hora de fin.");
      return;
    }

    if (fechaInicio > fechaFin) {
      mostrarModal("Rango inválido", "La fecha de inicio debe ser menor o igual que la fecha de fin.");
      return;
    }

    setGuardando(true);

    const payload = {
      profesional_id: user.id,
      dia_semana: Number(diaSemana),
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      duracion_minutos: Number(duracion),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      activo: true,
    };

    console.log("Guardando regla de disponibilidad en Supabase:", {
      tabla: TABLA_DISPONIBILIDAD,
      payload,
      editandoId,
    });

    const { error } = editandoId
      ? await supabase
          .from(TABLA_DISPONIBILIDAD)
          .update(payload)
          .eq("id", editandoId)
          .eq("profesional_id", user.id)
      : await supabase.from(TABLA_DISPONIBILIDAD).insert([payload]);

    setGuardando(false);

    if (error) {
      mostrarModal("Error", error.message);
      return;
    }

    await cargar();
    resetFormulario();

    mostrarModal(
      "Disponibilidad",
      editandoId
        ? "Regla de disponibilidad actualizada correctamente en Supabase."
        : "Regla de disponibilidad guardada correctamente en Supabase."
    );
  }

  async function eliminar(item) {
    if (tieneReservasVigentes(item)) {
      mostrarModal(
        "No se puede eliminar",
        "Esta disponibilidad tiene reservas vigentes. Para eliminarla, primero debes cancelar o reagendar las citas asociadas."
      );
      return;
    }

    const confirma = window.confirm("¿Estás seguro de eliminar esta disponibilidad?");

    if (!confirma) return;

    const { error } = await supabase
      .from(TABLA_DISPONIBILIDAD)
      .delete()
      .eq("id", item.id)
      .eq("profesional_id", user.id);

    if (error) {
      mostrarModal("Error", error.message);
      return;
    }

    setItems((prev) => prev.filter((registro) => registro.id !== item.id));

    mostrarModal("Disponibilidad", "Disponibilidad eliminada correctamente.");
  }

  function cambiarSemana(cantidadDias) {
    setSemanaBase((prev) => inicioSemana(sumarDias(prev, cantidadDias)));
  }

  function renderSlot(slot) {
    const ocupado = slot.estado === "ocupado";
    const ocupadoGoogle = slot.motivo_ocupado === "google_calendar";

    return (
      <div
        key={`${slot.fecha}-${slot.hora_inicio}-${slot.regla_id}`}
        title={ocupadoGoogle ? slot.eventoGoogle?.titulo : "Disponible para reserva"}
        className={`rounded-xl px-3 py-2 text-sm font-bold leading-tight ${
          ocupado
            ? ocupadoGoogle
              ? "border border-slate-200 bg-slate-100 text-slate-500"
              : "border border-slate-900 bg-slate-700 text-white"
            : "border border-emerald-100 bg-emerald-50 text-emerald-700"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span>
            {slot.hora_inicio} - {slot.hora_fin}
          </span>
          <span className="text-[10px]">
            {ocupado ? "Ocupado" : "Libre"}
          </span>
        </div>

        <p className="mt-1 line-clamp-1 text-[11px] font-semibold">
          {ocupadoGoogle
            ? slot.eventoGoogle?.titulo || "Evento Google Calendar"
            : slot.motivo_ocupado === "mentalia"
            ? "Reserva Mentalia"
            : "Disponible para paciente"}
        </p>
      </div>
    );
  }

  function renderBloqueHorario(titulo, tipo) {
    return (
      <div className="mb-8">
        <h3
          className={`mb-4 rounded-2xl py-3 text-center text-xl font-black ${
            tipo === "AM"
              ? "bg-cyan-100 text-cyan-800"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          BLOQUE {titulo}
        </h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          {diasSemana.map((fechaObj) => {
            const fecha = fechaTexto(fechaObj);
            const dia = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
            const slots = slotsDelDia(fechaObj);

            const slotsFiltrados =
              tipo === "AM"
                ? slots.filter((slot) => Number(slot.hora_inicio.slice(0, 2)) < 14)
                : slots.filter((slot) => Number(slot.hora_inicio.slice(0, 2)) >= 14);

            const disponibles = slotsFiltrados.filter(
              (slot) => slot.estado === "disponible"
            ).length;

            return (
              <div
                key={`${tipo}-${fecha}`}
                className="min-h-[260px] rounded-2xl border bg-slate-50 p-3"
              >
                <h4 className="text-center font-black text-cyan-700">
                  {obtenerNombreDia(dia)}
                </h4>

                <p className="mb-2 text-center text-xs text-slate-500">
                  {formatearFecha(fecha)}
                </p>

                {slotsFiltrados.length > 0 && (
                  <p className="mb-3 rounded-full bg-white px-2 py-1 text-center text-[11px] font-bold text-emerald-700">
                    {disponibles} libres / {slotsFiltrados.length} bloques
                  </p>
                )}

                {eventosGoogleDelDia(fecha).length > 0 && (
                  <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 p-2">
                    <p className="mb-1 text-[10px] font-black uppercase text-blue-700">
                      Google Calendar ocupado
                    </p>
                    <div className="space-y-1">
                      {eventosGoogleDelDia(fecha).slice(0, 3).map((evento) => (
                        <p
                          key={evento.google_calendar_event_id || `${evento.fecha_inicio}-${evento.titulo}`}
                          className="line-clamp-1 text-[11px] font-semibold text-blue-800"
                          title={evento.titulo}
                        >
                          {evento.hora_inicio || "Todo el día"}
                          {evento.hora_fin ? ` - ${evento.hora_fin}` : ""} · {evento.titulo || "Evento Google"}
                        </p>
                      ))}
                      {eventosGoogleDelDia(fecha).length > 3 && (
                        <p className="text-[11px] font-bold text-blue-700">
                          +{eventosGoogleDelDia(fecha).length - 3} eventos más
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {slotsFiltrados.length === 0 ? (
                  <p className="rounded-xl bg-white p-3 text-center text-xs text-slate-400">
                    Sin disponibilidad
                  </p>
                ) : (
                  <div className="space-y-2">
                    {slotsFiltrados.map((slot) => renderSlot(slot))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] px-4 py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] px-2">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">
              Disponibilidad para reservas
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Define cuándo el profesional acepta reservas. Google Calendar se usa como agenda primaria para bloquear horarios ocupados, no para guardar estas reglas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => cargarEventosGoogleCalendar(semanaBase)}
            disabled={cargandoGoogleCalendar}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {cargandoGoogleCalendar ? "Leyendo Google Calendar..." : "Actualizar Google Calendar"}
          </button>
        </div>

        {errorGoogleCalendar && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorGoogleCalendar}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black text-slate-900">
            Modelo operativo de disponibilidad
          </h2>

          <div className="grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="font-black text-emerald-700">1. Reglas Mentalia</p>
              <p>Se guardan en Supabase, tabla disponibilidad_profesional. Definen los días y horarios que el profesional quiere ofrecer.</p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="font-black text-blue-700">2. Google Calendar</p>
              <p>Se lee como agenda primaria de ocupación. Sus eventos bloquean horas dentro de las reglas, pero no reemplazan las reglas.</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-black text-slate-700">3. Resultado para paciente</p>
              <p>El paciente verá solo los bloques libres resultantes: reglas disponibles menos eventos Google y reservas internas vigentes.</p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-center font-black text-slate-900">
            {editandoId ? "Editar regla de disponibilidad" : "Agregar regla de disponibilidad"}
          </h2>

          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
            Esta configuración se guarda en Supabase, tabla disponibilidad_profesional. Google Calendar se consulta para descontar reuniones, atenciones u otros eventos ocupados. El resultado visible para el paciente será: disponibilidad definida por el profesional menos eventos ocupados de Google Calendar y reservas internas vigentes.
          </div>

          {editandoId && (
            <div className="mb-4 rounded-2xl bg-yellow-50 p-4 text-center text-sm font-bold text-yellow-700">
              Estás editando una disponibilidad existente.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={diaSemana}
              onChange={(e) => setDiaSemana(e.target.value)}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Seleccionar día</option>
              {dias.map((dia) => (
                <option key={dia.id} value={dia.id}>
                  {dia.nombre}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              min={hoy}
              className="rounded-xl border px-4 py-3"
            />

            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              min={fechaInicio || hoy}
              className="rounded-xl border px-4 py-3"
            />

            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="rounded-xl border px-4 py-3"
            />

            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="rounded-xl border px-4 py-3"
            />

            <select
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              className="rounded-xl border px-4 py-3"
            >
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </select>
          </div>

          <div className="mt-4 flex flex-col justify-center gap-3 md:flex-row">
            <button
              onClick={guardar}
              disabled={guardando || cargandoDatos}
              className="rounded-xl bg-[#18AFC1] px-6 py-3 font-black text-white disabled:opacity-50"
            >
              {guardando
                ? "Guardando en Supabase..."
                : editandoId
                ? "Actualizar regla"
                : "Guardar regla"}
            </button>

            {editandoId && (
              <button
                onClick={resetFormulario}
                className="rounded-xl border px-6 py-3 font-black text-slate-600"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button
              onClick={() => cambiarSemana(-7)}
              className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
            >
              ← Semana anterior
            </button>

            <div className="text-center">
              <h2 className="font-black text-slate-900">
                Semana {formatearFecha(fechaTexto(semanaBase))} al {" "}
                {formatearFecha(fechaTexto(finSemana))}
              </h2>
              <p className="text-xs text-slate-500">
                {cargandoGoogleCalendar
                  ? "Leyendo eventos ocupados desde Google Calendar..."
                  : `${eventosGoogleCalendar.length} eventos Google Calendar detectados en la semana`}
              </p>
            </div>

            <button
              onClick={() => cambiarSemana(7)}
              className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
            >
              Semana siguiente →
            </button>
          </div>

          {renderBloqueHorario("AM", "AM")}
          {renderBloqueHorario("PM", "PM")}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-center font-black text-slate-900">
            Reglas Mentalia configuradas
          </h2>

          {items.length === 0 ? (
            <p className="text-center text-slate-500">
              Aún no tienes disponibilidad configurada.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-black text-slate-900">
                      {obtenerNombreDia(item.dia_semana)}
                    </p>

                    <p className="text-sm text-slate-500">
                      {item.hora_inicio.slice(0, 5)} - {" "}
                      {item.hora_fin.slice(0, 5)} · {item.duracion_minutos} min
                    </p>

                    <p className="text-sm text-slate-500">
                      Desde {formatearFecha(item.fecha_inicio)} hasta {" "}
                      {formatearFecha(item.fecha_fin)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => editar(item)}
                      className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminar(item)}
                      className="rounded-xl border px-4 py-2 font-bold text-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {modal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-xl font-black text-slate-900">
              {modal.title}
            </h2>

            <p className="mb-6 leading-6 text-slate-600">{modal.message}</p>

            <div className="flex justify-end">
              <button
                onClick={() => setModal({ ...modal, visible: false })}
                className="rounded-xl bg-[#18AFC1] px-6 py-3 font-black text-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
