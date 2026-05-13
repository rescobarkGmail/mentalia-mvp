import React from "react";
import { FileText, Target, ArrowLeft } from "lucide-react";

export default function PreSesionPage({ paciente, goBack, iniciarSesion }) {
  return (
    <main className="min-h-screen bg-[#eef8fb] text-slate-800">
      <header className="flex items-center gap-4 border-b border-cyan-100 bg-white px-5 py-4">
        <button onClick={goBack} className="text-cyan-700">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-cyan-700">Preparación</h1>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-[28px] border border-cyan-100 bg-white p-8 shadow-sm">
          <div className="mb-8 flex items-center gap-3">
            <FileText className="text-cyan-700" />
            <h2 className="text-lg font-black">Resumen Pre-Atención</h2>
          </div>

          <h3 className="mb-3 text-lg font-black">Última Sesión</h3>
          <p className="mb-2 text-slate-600">Fecha: 2026-04-11</p>

          <div className="mb-8 rounded-2xl bg-cyan-100 p-4 leading-7">
            Paciente reportó mejora en manejo de ansiedad mediante técnicas de respiración.
            Se observó mayor apertura para discutir situaciones laborales estresantes.
          </div>

          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <Target className="text-slate-700" />
              <h3 className="text-lg font-black">Tareas y Objetivos</h3>
            </div>

            <ul className="space-y-4 text-slate-700">
              <li>• Continuar exploración de estrategias de afrontamiento</li>
              <li>• Evaluar aplicación de técnicas discutidas en sesión anterior</li>
              <li>• Abordar objetivos terapéuticos de mediano plazo</li>
            </ul>
          </div>

          <h3 className="mb-4 text-lg font-black">Puntos Clave</h3>

          <div className="space-y-3">
            <div className="rounded-2xl bg-cyan-100 p-4">
              Paciente sensible a temas laborales
            </div>
            <div className="rounded-2xl bg-cyan-100 p-4">
              Responde bien a técnicas cognitivo-conductuales
            </div>
            <div className="rounded-2xl bg-cyan-100 p-4">
              Importante validar avances antes de nuevos desafíos
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={iniciarSesion}
            className="rounded-2xl bg-[#18AFC1] px-8 py-4 font-black text-white shadow-lg hover:bg-cyan-700"
          >
            Iniciar Sesión
          </button>
        </div>
      </section>
    </main>
  );
}