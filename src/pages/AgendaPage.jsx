import React, { useState } from "react";

const agendaDia = [
  {
    time: "09:00",
    patient: "María González",
    status: "confirmada",
    tags: ["Agenda Mental-IA", "Consentimiento: Sí"],
  },
  {
    time: "10:00",
    patient: "Carlos Rodríguez",
    status: "confirmada",
    tags: ["Google Calendar", "Consentimiento: Sí"],
  },
  {
    time: "11:00",
    patient: "Ana Martínez",
    status: "confirmada",
    tags: ["Agente Mental-IA", "Consentimiento: Sí"],
  },
];

const agendaSemana = [
  {
    date: "2026-04-18",
    items: [
      { time: "09:00", name: "María González", status: "confirmada" },
      { time: "10:00", name: "Carlos Rodríguez", status: "confirmada" },
      { time: "11:00", name: "Ana Martínez", status: "confirmada" },
      { time: "14:00", name: "Luis Pérez", status: "pendiente" },
    ],
  },
  {
    date: "2026-04-19",
    items: [
      { time: "09:00", name: "Diego Muñoz", status: "confirmada" },
      { time: "10:00", name: "Valentina Castro", status: "confirmada" },
    ],
  },
];

function StatusBadge({ status }) {
  const colors = {
    confirmada: "bg-green-100 text-green-700",
    pendiente: "bg-yellow-100 text-yellow-700",
    reprogramada: "bg-blue-100 text-blue-700",
  };

  return (
    <span className={`px-3 py-1 text-xs font-bold rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}

export default function AgendaPage({ goBack, iniciarFlujo }) {
  const [view, setView] = useState("day");

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black">Agenda</h1>
        <button className="bg-cyan-600 text-white px-4 py-2 rounded-xl">
          + Nueva Cita
        </button>
      </div>

      {/* SELECTOR */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView("day")}
          className={`px-6 py-2 rounded-full ${
            view === "day" ? "bg-cyan-600 text-white" : "bg-white"
          }`}
        >
          Día
        </button>

        <button
          onClick={() => setView("week")}
          className={`px-6 py-2 rounded-full ${
            view === "week" ? "bg-cyan-600 text-white" : "bg-white"
          }`}
        >
          Semana
        </button>
      </div>

      {/* VISTA DIA */}
      {view === "day" && (
        <div className="space-y-4">
          {agendaDia.map((item, i) => (
            <div
              key={i}
              className="flex justify-between items-center bg-white p-4 rounded-2xl shadow"
            >
              <div>
                <div className="flex gap-3 items-center mb-1">
                  <span className="font-bold text-cyan-700">{item.time}</span>
                  <StatusBadge status={item.status} />
                </div>

                <p className="font-black">{item.patient}</p>

                <div className="flex gap-2 mt-2">
                  {item.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-gray-100 px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => iniciarFlujo(item)}
                className="bg-cyan-600 text-white px-4 py-2 rounded-xl"
              >
                Iniciar Atención
              </button>
            </div>
          ))}
        </div>
      )}

      {/* VISTA SEMANA */}
      {view === "week" && (
        <div className="space-y-6">
          {agendaSemana.map((day, i) => (
            <div key={i}>
              <h2 className="font-bold text-cyan-700 mb-2">{day.date}</h2>

              <div className="space-y-2">
                {day.items.map((item, j) => (
                  <div
                    key={j}
                    className="flex justify-between bg-white p-3 rounded-xl shadow"
                  >
                    <span>{item.time} - {item.name}</span>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VOLVER */}
      <button
        onClick={goBack}
        className="mt-6 text-cyan-700 font-bold"
      >
        ← Volver
      </button>

    </main>
  );
}