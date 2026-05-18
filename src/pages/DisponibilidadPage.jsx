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
  return fecha.toISOString().slice(0, 10);
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

function generarSlots(horaInicio, horaFin, duracion) {
  const slots = [];
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);

  let actual = new Date();
  actual.setHours(hi, mi, 0, 0);

  const fin = new Date();
  fin.setHours(hf, mf, 0, 0);

  while (actual < fin) {
    slots.push(actual.toTimeString().slice(0, 5));
    actual = new Date(actual.getTime() + Number(duracion) * 60000);
  }

  return slots;
}

export default function DisponibilidadPage({ user, goBack }) {
  const hoy = fechaTexto(new Date());

  const [items, setItems] = useState([]);
  const [citas, setCitas] = useState([]);
  const [semanaBase, setSemanaBase] = useState(inicioSemana(new Date()));

  const [diaSemana, setDiaSemana] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [duracion, setDuracion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [modal, setModal] = useState({
    visible: false,
    title: "",
    message: "",
  });

  function mostrarModal(title, message) {
    setModal({ visible: true, title, message });
  }

  async function cargar() {
    const { data: disponibilidad } = await supabase
      .from("disponibilidad_profesional")
      .select("*")
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });

    const { data: citasData } = await supabase
      .from("citas")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true });

    setItems(disponibilidad || []);
    setCitas(citasData || []);
  }

  function resetFormulario() {
    setDiaSemana("");
    setHoraInicio("");
    setHoraFin("");
    setDuracion("");
    setFechaInicio("");
    setFechaFin("");
  }

  async function guardar() {
    if (guardando) return;

    if (!diaSemana || !fechaInicio || !fechaFin || !horaInicio || !horaFin || !duracion) {
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

    const { error } = await supabase.from("disponibilidad_profesional").insert([
      {
        profesional_id: user.id,
        dia_semana: Number(diaSemana),
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        duracion_minutos: Number(duracion),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      },
    ]);

    setGuardando(false);

    if (error) {
      mostrarModal("Error", error.message);
      return;
    }

    await cargar();
    resetFormulario();
    mostrarModal("Disponibilidad", "Disponibilidad guardada correctamente.");
  }

  async function eliminar(id) {
    const confirma = window.confirm("¿Estás seguro de eliminar esta disponibilidad?");
    if (!confirma) return;

    const { error } = await supabase
      .from("disponibilidad_profesional")
      .delete()
      .eq("id", id);

    if (error) {
      mostrarModal("Error", error.message);
      return;
    }

    await cargar();
    mostrarModal("Disponibilidad", "Disponibilidad eliminada correctamente.");
  }

  function estaReservado(fecha, hora) {
    return citas.some(
      (cita) =>
        cita.fecha === fecha &&
        cita.hora_inicio.slice(0, 5) === hora &&
        cita.estado !== "cancelada"
    );
  }

  function slotsDelDia(fechaObj) {
    const fecha = fechaTexto(fechaObj);
    const diaJS = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();

    const reglas = items.filter(
      (item) =>
        item.dia_semana === diaJS &&
        item.fecha_inicio <= fecha &&
        item.fecha_fin >= fecha
    );

    const slots = [];

    reglas.forEach((regla) => {
      generarSlots(
        regla.hora_inicio,
        regla.hora_fin,
        regla.duracion_minutos
      ).forEach((hora) => {
        slots.push({
          hora,
          reservado: estaReservado(fecha, hora),
        });
      });
    });

    return slots;
  }

  function renderSlot(slot, tipo, fecha, index) {
    return (
      <div
        key={`${tipo}-${formatearFecha(fecha)}-${slot.hora}-${index}`}
        className={`rounded-xl px-3 py-2 text-center text-sm font-bold ${
          slot.reservado
            ? "bg-green-100 text-green-700"
            : tipo === "AM"
            ? "bg-cyan-50 text-cyan-700"
            : "bg-orange-50 text-orange-700"
        }`}
      >
        {slot.hora}
        <br />
        <span className="text-[11px]">
          {slot.reservado ? "Reservado" : "Disponible"}
        </span>
      </div>
    );
  }

  function renderBloqueHorario(titulo, tipo) {
    const finSemana = sumarDias(semanaBase, 6);

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

        <div className="grid gap-3 md:grid-cols-7">
          {diasSemana.map((fechaObj) => {
            const fecha = fechaTexto(fechaObj);
            const dia = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
            const slots = slotsDelDia(fechaObj);

            const slotsFiltrados =
              tipo === "AM"
                ? slots.filter((s) => Number(s.hora.slice(0, 2)) < 14)
                : slots.filter((s) => Number(s.hora.slice(0, 2)) >= 14);

            return (
              <div key={`${tipo}-${formatearFecha(fecha)}`} className="rounded-2xl border bg-slate-50 p-3">
                <h4 className="text-center font-black text-cyan-700">
                  {dias.find((d) => d.id === dia)?.nombre}
                </h4>

                <p className="mb-3 text-center text-xs text-slate-500">
                  {formatearFecha(fecha)}
                </p>

                {slotsFiltrados.length === 0 ? (
                  <p className="text-center text-xs text-slate-400">
                    Sin disponibilidad
                  </p>
                ) : (
                  <div className="space-y-2">
                    {slotsFiltrados.map((slot, index) =>
                      renderSlot(slot, tipo, fecha, index)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  useEffect(() => {
    cargar();
  }, []);

  const diasSemana = Array.from({ length: 7 }, (_, i) => sumarDias(semanaBase, i));
  const finSemana = sumarDias(semanaBase, 6);

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-7xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <h1 className="mb-6 text-center text-3xl font-black">
          Disponibilidad
        </h1>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-center font-black">
            Agregar horario disponible
          </h2>

          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={diaSemana}
              onChange={(e) => setDiaSemana(e.target.value)}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Seleccionar día</option>
              {dias.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
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
              <option value="">Duración</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </select>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              onClick={guardar}
              disabled={guardando}
              className="rounded-xl bg-[#18AFC1] px-6 py-3 font-black text-white disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar disponibilidad"}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
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

          {renderBloqueHorario("AM", "AM")}
          {renderBloqueHorario("PM", "PM")}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-center font-black">
            Reglas de disponibilidad configuradas
          </h2>

          {items.length === 0 ? (
            <p className="text-center text-slate-500">
              Aún no tienes disponibilidad configurada.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <p className="font-black">
                      {dias.find((d) => d.id === item.dia_semana)?.nombre}
                    </p>

                    <p className="text-sm text-slate-500">
                      {item.hora_inicio.slice(0, 5)} -{" "}
                      {item.hora_fin.slice(0, 5)} ·{" "}
                      {item.duracion_minutos} min
                    </p>

                    <p className="text-sm text-slate-500">
                    Desde {formatearFecha(item.fecha_inicio)} hasta{" "}
{formatearFecha(item.fecha_fin)}
                    </p>
                  </div>

                  <button
                    onClick={() => eliminar(item.id)}
                    className="rounded-xl border px-4 py-2 font-bold text-red-600"
                  >
                    Eliminar
                  </button>
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

            <p className="mb-6 leading-6 text-slate-600">
              {modal.message}
            </p>

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