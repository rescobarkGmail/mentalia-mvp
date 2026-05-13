import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Pause,
  CircleStop,
  Mic,
  Signal,
  AudioLines,
  Activity,
} from "lucide-react";

export default function AtencionPage({ goBack, finalizarSesion }) {
  const [seconds, setSeconds] = useState(17);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [paused]);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <main className="min-h-screen bg-[#eef8fb] text-slate-800">
      <header className="flex items-center gap-4 border-b border-cyan-100 bg-white px-5 py-4">
        <button onClick={goBack} className="text-cyan-700">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-cyan-700">
          Atención en Curso
        </h1>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-2">
        {/* CONTROLES */}
        <div className="rounded-[24px] border border-cyan-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black">Controles de Sesión</h2>

          <div className="py-20 text-center">
            <p className="text-5xl font-light tracking-tight text-slate-900">
              {minutes}:{secs}
            </p>
            <p className="mt-3 text-slate-600">Tiempo transcurrido</p>

            <div className="mt-7 flex justify-center gap-3">
              <button
                onClick={() => setPaused(!paused)}
                className="flex items-center gap-2 rounded-xl border border-cyan-600 px-5 py-3 font-black text-cyan-700 hover:bg-cyan-50"
              >
                <Pause size={18} />
                {paused ? "Continuar" : "Pausar"}
              </button>

              <button
                onClick={finalizarSesion}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-black text-white shadow hover:bg-red-700"
              >
                <CircleStop size={18} />
                Finalizar Sesión
              </button>
            </div>
          </div>

          <div className="border-t border-cyan-100 pt-5">
            <div className="mb-3 flex items-center gap-3">
              <Mic className="text-green-600" size={22} />
              <p className="font-medium">Estado de captura:</p>
            </div>
            <p className="text-sm text-slate-600">
              Activa - Con consentimiento
            </p>
          </div>
        </div>

        {/* CALIDAD */}
        <div className="rounded-[24px] border border-cyan-100 bg-white p-6 shadow-sm">
          <div className="mb-7 flex items-center gap-3">
            <Signal className="text-cyan-700" size={22} />
            <h2 className="text-lg font-black">Calidad de Captura</h2>
          </div>

          <div className="mb-6 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="mb-2 font-black">Captura Efímera Activa</p>
            <p>
              Procesamiento temporal para apoyo documental.
              No se almacena audio ni transcripción completa.
            </p>
          </div>

          <div className="mb-4 rounded-2xl bg-cyan-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AudioLines className="text-green-600" />
                <p className="font-black">Calidad de Audio</p>
              </div>
              <p className="text-2xl font-black text-green-600">96%</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[96%] rounded-full bg-green-600" />
            </div>
            <p className="mt-3 text-sm text-slate-600">Excelente</p>
          </div>

          <div className="mb-4 rounded-2xl bg-cyan-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="text-cyan-700" />
                <p className="font-black">Nivel de Ruido</p>
              </div>
              <p className="text-2xl font-black text-cyan-700">14%</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[14%] rounded-full bg-cyan-700" />
            </div>
            <p className="mt-3 text-sm text-slate-600">Bajo - Óptimo</p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-slate-600">
            <Activity className="text-teal-500" size={20} />
            Captura en tiempo real activa
          </div>
        </div>
      </section>
    </main>
  );
}