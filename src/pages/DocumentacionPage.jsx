import React, { useState } from "react";

import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Home,
  LogOut,
} from "lucide-react";



export default function DocumentacionPage({ goBack, validarGuardar, goDashboard,onLogout }) {
const [showModal, setShowModal] = useState(false);
const [showSuccessModal, setShowSuccessModal] = useState(false);

  return (
    <main className="min-h-screen bg-[#eef8fb] text-slate-800">
      <header className="flex items-center justify-between border-b border-cyan-100 bg-white px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="text-cyan-700">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl font-black text-cyan-700">
            Documentación Asistida
          </h1>
        </div>

        <div className="flex items-center gap-4 text-cyan-700">
        <button
            onClick={goDashboard}
            className="p-2 rounded-lg hover:bg-cyan-50"
            >
            <Home size={20} />
        </button>


        <button onClick={onLogout} className="rounded-2xl bg-white p-3 shadow">
                <LogOut size={20} />
              </button>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
            BORRADOR
          </span>
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-slate-500">
            DEMO
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 rounded-2xl border border-cyan-100 bg-white p-4">
          <p className="font-black text-cyan-700">
            Agente de Resumen de Sesión
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Control humano obligatorio. Borrador generado desde transcripción efímera.
          </p>
        </div>

        <div className="rounded-[28px] border border-cyan-100 bg-white p-7 shadow-sm">
          <div className="mb-8 flex items-center gap-3">
            <FileText className="text-slate-700" />
            <h2 className="text-lg font-black">
              Borrador de Resumen de Sesión
            </h2>
          </div>

          <div className="space-y-7">
            <div>
              <h3 className="mb-3 font-black">Resumen de Sesión</h3>
              <textarea
                className="min-h-[100px] w-full resize-none rounded-2xl bg-cyan-50 p-4 leading-7 outline-none focus:ring-4 focus:ring-cyan-100"
                defaultValue="Sesión enfocada en trabajar patrones de pensamiento recurrentes. El paciente identificó tres situaciones donde logró aplicar técnicas de reestructuración cognitiva durante la semana."
              />
            </div>

            <div>
              <h3 className="mb-3 font-black">Observaciones Clínicas</h3>
              <textarea
                className="min-h-[100px] w-full resize-none rounded-2xl bg-cyan-50 p-4 leading-7 outline-none focus:ring-4 focus:ring-cyan-100"
                defaultValue="Mayor capacidad de auto-observación y registro de pensamientos automáticos. Se nota disposición activa para practicar ejercicios entre sesiones."
              />
            </div>

            <div>
              <h3 className="mb-3 font-black">Próximos Pasos</h3>
              <textarea
                className="min-h-[90px] w-full resize-none rounded-2xl bg-cyan-50 p-4 leading-7 outline-none focus:ring-4 focus:ring-cyan-100"
                defaultValue="Profundizar en el trabajo con creencias intermedias. Continuar con registro de situaciones y pensamientos."
              />
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <strong>Información importante:</strong> Ningún dato clínico se almacena en Mental-IA.
              Toda la información procesada es efímera y solo existe durante la sesión para asistir en la documentación.
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-[#18AFC1] px-7 py-4 font-black text-white shadow-lg hover:bg-cyan-700"
          >
            <CheckCircle2 size={20} />
            Validar y Guardar
          </button>
        </div>
      </section>
   
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            
            <h2 className="text-xl font-black mb-3">
                Validar Documentación
            </h2>

            <p className="text-sm text-slate-600 leading-6 mb-6">
                Al validar, confirma que la documentación es correcta y completa.
                Esta acción registrará un timestamp en la actividad del sistema.
                Después de validar, podrá exportar y emitir boleta.
            </p>

            <div className="flex justify-end gap-3">
                <button
                onClick={() => setShowModal(false)}
                className="rounded-xl border px-4 py-2 font-bold text-slate-600"
                >
                Cancelar
                </button>

                <button
                onClick={() => {
                    setShowModal(false);
                    setShowSuccessModal(true);
                  }}

                className="rounded-xl bg-[#18AFC1] px-5 py-2 font-bold text-white"
                >
                Validar
                </button>
            </div>
            </div>
        </div>
        )}

        {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">

            <h2 className="text-xl font-black mb-3">
                Documentación Guardada
            </h2>

            <p className="text-sm text-slate-600 leading-6 mb-6">
                El resumen de sesión ha sido guardado exitosamente en tu repositorio configurado.
                ¿Deseas emitir la boleta ahora?
            </p>

            <div className="flex justify-end gap-3">
                <button
                onClick={() => {
                    setShowSuccessModal(false);
                    validarGuardar(); // vuelve a agenda
                }}
                className="rounded-xl border px-4 py-2 font-bold text-slate-600"
                >
                Más Tarde
                </button>

                <button
                onClick={() => {
                    setShowSuccessModal(false);
                    alert("Ir a emisión de boleta (siguiente paso)");
                }}
                className="rounded-xl bg-[#18AFC1] px-5 py-2 font-bold text-white"
                >
                Emitir Boleta
                </button>
            </div>
            </div>
        </div>
        )}


    </main>
  );
}