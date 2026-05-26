import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatearFecha } from "../utils/formato";

export default function PreSesionPage({
  user,
  cita,
  iniciarSesionClinica,
  goBack,
}) {
  const [ultimaSesion, setUltimaSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarPreSesion();
  }, []);

  async function cargarPreSesion() {
    setCargando(true);

    const pacienteId = cita.paciente_id || cita.paciente?.id || cita.pacientes?.id;

    if (!pacienteId) {
      setCargando(false);
      alert("No se pudo identificar el paciente para cargar la pre-sesión.");
      return;
    }

    const { data, error } = await supabase
      .from("sesiones_clinicas")
      .select("*")
      .eq("profesional_id", user.id)
      .eq("paciente_id", pacienteId)
      .order("fecha_crea", { ascending: false })
      .limit(1)
      .maybeSingle();

    setCargando(false);

    if (error) {
      alert(error.message);
      return;
    }

    setUltimaSesion(data || null);
  }

  function continuarSesion() {
    iniciarSesionClinica({
      ...cita,
      paciente_id: cita.paciente_id || cita.paciente?.id || cita.pacientes?.id,
    });
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-5xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <section className="mb-6 rounded-3xl bg-white p-6 shadow">
          <h1 className="text-3xl font-black text-slate-900">Pre-sesión</h1>

          <p className="mt-2 text-xl font-bold text-cyan-700">
            {cita.patient}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-800">
                Fecha atención
              </p>
              <p className="text-sm text-slate-600">
                {formatearFecha(cita.fecha)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-800">Hora</p>
              <p className="text-sm text-slate-600">
                {cita.hora_inicio?.slice(0, 5)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-800">Estado cita</p>
              <p className="text-sm text-slate-600">
                {cita.estado || "reservada"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-slate-900">
              Contexto clínico previo
            </h2>

            <p className="text-sm text-slate-500">
              Resumen de la última sesión registrada del paciente.
            </p>
          </div>

          {cargando ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-500">
              Cargando información clínica...
            </p>
          ) : !ultimaSesion ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="font-black text-slate-700">
                Primera sesión del paciente
              </p>

              <p className="mt-2 text-sm text-slate-500">
                No existen sesiones clínicas previas registradas.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-black text-cyan-800">
                    Última sesión registrada
                  </p>

                  <p className="text-sm text-slate-500">
                    {formatearFecha(ultimaSesion.fecha)}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                  {ultimaSesion.estado || "borrador"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4">
                  <p className="mb-1 font-black text-slate-800">
                    Motivo de consulta
                  </p>

                  <p className="whitespace-pre-line text-sm text-slate-600">
                    {ultimaSesion.motivo_consulta || "Sin registro"}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="mb-1 font-black text-slate-800">
                    Observaciones
                  </p>

                  <p className="whitespace-pre-line text-sm text-slate-600">
                    {ultimaSesion.observaciones || "Sin registro"}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4 md:col-span-2">
                  <p className="mb-1 font-black text-slate-800">
                    Notas clínicas
                  </p>

                  <p className="whitespace-pre-line text-sm text-slate-600">
                    {ultimaSesion.notas_clinicas || "Sin registro"}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4 md:col-span-2">
                  <p className="mb-1 font-black text-slate-800">
                    Tareas / acuerdos previos
                  </p>

                  <p className="whitespace-pre-line text-sm text-slate-600">
                    {ultimaSesion.tareas_acuerdos || "Sin registro"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={continuarSesion}
              className="w-full rounded-2xl bg-[#18AFC1] px-6 py-4 text-lg font-black text-white"
            >
              Continuar a sesión clínica
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}