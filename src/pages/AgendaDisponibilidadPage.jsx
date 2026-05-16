import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AgendaDisponibilidadPage({ user, goBack }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data } = await supabase
      .from("disponibilidad_profesional")
      .select("*");

    setItems(data || []);
  }

  function generarSlots(horaInicio, horaFin, duracion) {
    const slots = [];

    let [h, m] = horaInicio.split(":").map(Number);
    const [hFin, mFin] = horaFin.split(":").map(Number);

    let inicio = new Date();
    inicio.setHours(h, m, 0);

    let fin = new Date();
    fin.setHours(hFin, mFin, 0);

    while (inicio < fin) {
      slots.push(inicio.toTimeString().slice(0, 5));
      inicio = new Date(inicio.getTime() + duracion * 60000);
    }

    return slots;
  }

  return (
    <main className="p-6">
      <button onClick={goBack}>← Volver</button>

      <h1 className="text-2xl font-black mb-6">Agenda</h1>

      {items.map((item) => (
        <div key={item.id} className="mb-6">
          <h2 className="font-black">Día {item.dia_semana}</h2>

          <div className="flex flex-wrap gap-2 mt-2">
            {generarSlots(
              item.hora_inicio,
              item.hora_fin,
              item.duracion_minutos
            ).map((slot) => (
              <button
                key={slot}
                className="px-4 py-2 border rounded-xl"
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}