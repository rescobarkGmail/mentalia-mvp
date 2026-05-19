import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SesionClinicaPage({
  user,
  cita,
  goBack,
}) {
  const [guardando, setGuardando] = useState(false);

  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [notasClinicas, setNotasClinicas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [tareasAcuerdos, setTareasAcuerdos] = useState("");

  useEffect(() => {
    cargarSesion();
  }, []);

  async function cargarSesion() {
    const { data } = await supabase
      .from("sesiones_clinicas")
      .select("*")
      .eq("cita_id", cita.id)
      .maybeSingle();

    if (data) {
      setMotivoConsulta(data.motivo_consulta || "");
      setNotasClinicas(data.notas_clinicas || "");
      setObservaciones(data.observaciones || "");
      setTareasAcuerdos(data.tareas_acuerdos || "");
    }
  }

  async function guardarSesion(estado = "borrador") {
    setGuardando(true);

    const payload = {
      cita_id: cita.id,
      profesional_id: user.id,
      paciente_id: cita.paciente_id,

      motivo_consulta: motivoConsulta,
      notas_clinicas: notasClinicas,
      observaciones: observaciones,
      tareas_acuerdos: tareasAcuerdos,

      estado,
    };

    const { data: existente } = await supabase
      .from("sesiones_clinicas")
      .select("id")
      .eq("cita_id", cita.id)
      .maybeSingle();

    let error;

    if (existente) {
      const response = await supabase
        .from("sesiones_clinicas")
        .update(payload)
        .eq("id", existente.id);

      error = response.error;
    } else {
      const response = await supabase
        .from("sesiones_clinicas")
        .insert([payload]);

      error = response.error;
    }

    setGuardando(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      estado === "finalizada"
        ? "Sesión finalizada correctamente."
        : "Borrador guardado."
    );

    if (estado === "finalizada") {
      goBack();
    }
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-4xl">

        <button
          onClick={goBack}
          className="mb-4 font-bold text-cyan-700"
        >
          ← Volver
        </button>

        <div className="rounded-3xl bg-white p-6 shadow">

          <div className="mb-6 border-b pb-4">

            <h1 className="text-3xl font-black text-slate-800">
              Sesión Clínica
            </h1>

            <p className="mt-2 text-slate-500">
              {cita.patient}
            </p>

            <p className="text-sm text-slate-400">
              {cita.fecha} · {cita.hora_inicio}
            </p>

          </div>

          <div className="space-y-5">

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                Motivo de consulta
              </label>

              <textarea
                value={motivoConsulta}
                onChange={(e) =>
                  setMotivoConsulta(e.target.value)
                }
                rows={3}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                Notas clínicas
              </label>

              <textarea
                value={notasClinicas}
                onChange={(e) =>
                  setNotasClinicas(e.target.value)
                }
                rows={8}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                Observaciones
              </label>

              <textarea
                value={observaciones}
                onChange={(e) =>
                  setObservaciones(e.target.value)
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                Tareas / acuerdos
              </label>

              <textarea
                value={tareasAcuerdos}
                onChange={(e) =>
                  setTareasAcuerdos(e.target.value)
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
            </div>

          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row">

            <button
              onClick={() => guardarSesion("borrador")}
              disabled={guardando}
              className="flex-1 rounded-2xl border border-slate-300 px-6 py-4 font-black text-slate-700"
            >
              Guardar borrador
            </button>

            <button
              onClick={() => guardarSesion("finalizada")}
              disabled={guardando}
              className="flex-1 rounded-2xl bg-[#18AFC1] px-6 py-4 font-black text-white"
            >
              Finalizar sesión
            </button>

          </div>

        </div>
      </div>
    </main>
  );
}