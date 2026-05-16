import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function NuevaCitaPage({ user, goBack }) {
  const [pacientes, setPacientes] = useState([]);
  const [pacienteId, setPacienteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [duracion, setDuracion] = useState(60);

  useEffect(() => {
    cargarPacientes();
  }, []);

  async function cargarPacientes() {
    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .order("nombres", { ascending: true });

    if (!error) setPacientes(data || []);
  }

  function calcularHoraFin(hora, minutos) {
    const [h, m] = hora.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m + Number(minutos), 0);
    return date.toTimeString().slice(0, 5);
  }

  async function guardarCita() {
    if (!pacienteId || !fecha || !horaInicio) {
      alert("Selecciona paciente, fecha y hora.");
      return;
    }

    const horaFin = calcularHoraFin(horaInicio, duracion);

    const { error } = await supabase.from("citas").insert([
      {
        profesional_id: user.id,
        paciente_id: pacienteId,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        estado: "reservada",
        origen: "Mentalia",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Cita agendada correctamente.");
    goBack();
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-2xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="mb-6 text-2xl font-black">Nueva cita</h1>

          <div className="space-y-4">
            <select
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="">Seleccionar paciente</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombres} {p.apellidos}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <select
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
            </select>

            <button
              onClick={guardarCita}
              className="w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white"
            >
              Guardar cita
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}