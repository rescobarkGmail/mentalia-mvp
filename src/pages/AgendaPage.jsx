import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatearFecha } from "../utils/formato";

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
  const dia = fecha.getDay() === 0 ? 7 : fecha.getDay();
  fecha.setDate(fecha.getDate() - dia + 1);
  return fecha;
}

function sumarDias(fecha, dias) {
  const nueva = new Date(fecha);
  nueva.setDate(nueva.getDate() + dias);
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
      {status}
    </span>
  );
}

export default function AgendaPage({ goBack, iniciarFlujo }) {
  const [view, setView] = useState("day");
  const [citas, setCitas] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [semanaBase, setSemanaBase] = useState(inicioSemana(new Date()));
  const [citaEditando, setCitaEditando] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  

  async function cargarCitas() {
    const { data, error } = await supabase
      .from("citas")
      .select(`
        *,
        pacientes (
          id,
          nombres,
          apellidos,
          email,
          telefono
        )
      `)
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const { data: disponibilidadData, error: disponibilidadError } = await supabase
      .from("disponibilidad_profesional")
      .select("*")
      .eq("activo", true);

    if (disponibilidadError) {
      alert(disponibilidadError.message);
      return;
    }

    setDisponibilidad(disponibilidadData || []);

    setCitas(data || []);
  }

  useEffect(() => {
    cargarCitas();
  }, []);

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
        cita.fecha?.slice(0, 10) === fecha &&
        cita.estado !== "cancelada"
    );
  }

  function abrirFlujo(cita) {
    iniciarFlujo({
      ...cita,
  
      patient: `${cita.pacientes?.nombres || ""} ${
        cita.pacientes?.apellidos || ""
      }`,
  
      paciente_id: cita.paciente_id,
  
      paciente: {
        id: cita.pacientes?.id,
        nombres: cita.pacientes?.nombres,
        apellidos: cita.pacientes?.apellidos,
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
      .eq("id", cita.id);

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
      const fechaInicio = item.fecha_inicio?.slice(0, 10);
      const fechaFin = item.fecha_fin?.slice(0, 10);
  
      return (
        item.dia_semana === diaJS &&
        fecha >= fechaInicio &&
        fecha <= fechaFin &&
        hora >= inicio &&
        horaFinNueva <= fin
      );
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
    alert("El horario seleccionado no está dentro de la disponibilidad configurada.");
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
    .eq("id", citaEditando.id);

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
          {cita.pacientes?.nombres} {cita.pacientes?.apellidos}
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

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">Agenda</h1>
            <p className="text-sm text-slate-500">
              {citas.length} citas registradas
            </p>
          </div>

          <button
            onClick={cargarCitas}
            className="rounded-xl border border-cyan-200 bg-white px-4 py-2 font-bold text-cyan-700"
          >
            Actualizar
          </button>
        </div>

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

            {citasHoy.length === 0 ? (
              <p className="text-center text-slate-500">
                No hay citas para hoy.
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
            <div className="mb-5 flex items-center justify-between gap-4">
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