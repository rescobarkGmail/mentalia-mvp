import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function StatusBadge({ status }) {
  const colors = {
    reservada: "bg-green-100 text-green-700",
    confirmada: "bg-green-100 text-green-700",
    pendiente: "bg-yellow-100 text-yellow-700",
    cancelada: "bg-red-100 text-red-700",
    reprogramada: "bg-blue-100 text-blue-700",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${colors[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default function AgendaPage({ goBack, iniciarFlujo }) {
  const [view, setView] = useState("day");
  const [citas, setCitas] = useState([]);

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

    setCitas(data || []);
  }

  useEffect(() => {
    cargarCitas();
  }, []);

  const hoy = new Date().toISOString().slice(0, 10);
  const citasHoy = citas.filter((c) => c.fecha === hoy);

  const citasPorFecha = citas.reduce((acc, cita) => {
    if (!acc[cita.fecha]) acc[cita.fecha] = [];
    acc[cita.fecha].push(cita);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-5xl">
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
            <h2 className="mb-5 text-xl font-black">
              Hoy - {hoy}
            </h2>

            {citasHoy.length === 0 ? (
              <p className="text-slate-500">No hay citas para hoy.</p>
            ) : (
              <div className="space-y-4">
                {citasHoy.map((cita) => (
                  <div
                    key={cita.id}
                    className="flex items-center justify-between rounded-2xl border border-cyan-100 bg-slate-50 p-4"
                  >
                    <div>
                      <div className="mb-2 flex items-center gap-3">
                        <span className="font-black text-cyan-700">
                          {cita.hora_inicio.slice(0, 5)}
                        </span>
                        <StatusBadge status={cita.estado} />
                      </div>

                      <p className="text-lg font-black">
                        {cita.pacientes?.nombres} {cita.pacientes?.apellidos}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">
                          {cita.origen}
                        </span>
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                          Consentimiento: Sí
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        iniciarFlujo({
                          ...cita,
                          patient: `${cita.pacientes?.nombres} ${cita.pacientes?.apellidos}`,
                        })
                      }
                      className="rounded-xl bg-[#18AFC1] px-5 py-3 font-black text-white shadow hover:bg-cyan-700"
                    >
                      Iniciar Atención
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {view === "week" && (
          <section className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow">
            <h2 className="mb-6 text-xl font-black">Vista semanal</h2>

            {Object.keys(citasPorFecha).length === 0 ? (
              <p className="text-slate-500">No hay citas registradas.</p>
            ) : (
              <div className="space-y-8">
                {Object.entries(citasPorFecha).map(([fecha, items]) => (
                  <div key={fecha}>
                    <h3 className="mb-3 font-black text-cyan-700">{fecha}</h3>

                    <div className="space-y-3">
                      {items.map((cita) => (
                        <div
                          key={cita.id}
                          className="flex items-center justify-between rounded-2xl border border-cyan-100 bg-slate-50 p-4"
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-black text-slate-500">
                              {cita.hora_inicio.slice(0, 5)}
                            </span>
                            <span className="font-black">
                              {cita.pacientes?.nombres} {cita.pacientes?.apellidos}
                            </span>
                          </div>

                          <StatusBadge status={cita.estado} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}