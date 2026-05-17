import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const dias = [
  { id: 1, nombre: "Lunes" },
  { id: 2, nombre: "Martes" },
  { id: 3, nombre: "Miércoles" },
  { id: 4, nombre: "Jueves" },
  { id: 5, nombre: "Viernes" },
  { id: 6, nombre: "Sábado" },
  { id: 7, nombre: "Domingo" },
];

export default function DisponibilidadPage({ user, goBack }) {
  const [items, setItems] = useState([]);
  
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [duracion, setDuracion] = useState(60);
  const [guardando, setGuardando] = useState(false);
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaMas30 = new Date();
  fechaMas30.setDate(fechaMas30.getDate() + 30);
  const fechaMas30Texto = fechaMas30.toISOString().slice(0, 10);
  
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(fechaMas30Texto);

   function resetFormulario() {
    const hoyNuevo = new Date().toISOString().slice(0, 10);
  
    const fechaMas30Nueva = new Date();
    fechaMas30Nueva.setDate(fechaMas30Nueva.getDate() + 30);
    const fechaMas30NuevaTexto = fechaMas30Nueva.toISOString().slice(0, 10);
  
    setDiaSemana();
    setHoraInicio("");
    setHoraFin("");
    setDuracion(60);
    setFechaInicio(hoyNuevo);
    setFechaFin(fechaMas30NuevaTexto);
  }

  async function cargar() {
    const { data, error } = await supabase
      .from("disponibilidad_profesional")
      .select("*")
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (!error) setItems(data || []);
  }

 async function guardar() {
  if (guardando) return;

  if (horaInicio >= horaFin) {
    alert("La hora de inicio debe ser menor que la hora de fin.");
    return;
  }

  if (fechaInicio > fechaFin) {
    alert("La fecha de inicio debe ser menor o igual que la fecha de fin.");
    return;
  }

  setGuardando(true);

  const { error } = await supabase.from("disponibilidad_profesional").insert([
    {
      profesional_id: user.id,
      dia_semana: diaSemana,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      duracion_minutos: Number(duracion),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    },
  ]);

  setGuardando(false);

  if (error) {
    alert(error.message);
    return;
  }

  await cargar();
  resetFormulario();
  alert("Disponibilidad guardada correctamente.");
}

  async function eliminar(id) {
    const { error } = await supabase
      .from("disponibilidad_profesional")
      .delete()
      .eq("id", id);

    if (!error) cargar();
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-4xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <h1 className="mb-6 text-3xl font-black">Disponibilidad</h1>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 font-black">Agregar horario disponible</h2>

          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={diaSemana}
              onChange={(e) => setDiaSemana(Number(e.target.value))}
              className="rounded-xl border px-4 py-3"
            >
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
              className="rounded-xl border px-4 py-3"
            />

            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
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
          <button
            onClick={guardar}
            disabled={guardando}
            className="mt-4 rounded-xl bg-[#18AFC1] px-6 py-3 font-black text-white disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar disponibilidad"}
          </button>

        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 font-black">Mis horarios disponibles</h2>

          {items.length === 0 ? (
            <p className="text-slate-500">Aún no tienes disponibilidad configurada.</p>
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
                      {item.hora_inicio.slice(0, 5)} - {item.hora_fin.slice(0, 5)} ·{" "}
                      {item.duracion_minutos} min
                      <br />
                        Desde {item.fecha_inicio} hasta {item.fecha_fin}
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
    </main>
  );
}



