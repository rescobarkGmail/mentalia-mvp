import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const opciones = [
  {
    id: "mentalia_cloud",
    titulo: "Mentalia Cloud",
    descripcion: "Los datos clínicos se almacenan en la nube segura de Mentalia.",
  },
  {
    id: "google_drive",
    titulo: "Google Drive",
    descripcion: "Próximamente: almacenar documentos clínicos en Drive del profesional.",
  },
  {
    id: "onedrive",
    titulo: "OneDrive",
    descripcion: "Próximamente: almacenar documentos clínicos en OneDrive del profesional.",
  },
  {
    id: "local",
    titulo: "Equipo local",
    descripcion: "Próximamente: exportar y almacenar en el computador del profesional.",
  },
];

export default function ConfiguracionPage({ user, goBack }) {
  const [storageProvider, setStorageProvider] = useState("mentalia_cloud");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  async function cargarConfiguracion() {
    const { data, error } = await supabase
      .from("profesionales_config")
      .select("*")
      .eq("profesional_id", user.id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    if (data) {
      setStorageProvider(data.storage_provider || "mentalia_cloud");
    }
  }

  async function guardarConfiguracion(nuevoValor) {
    setStorageProvider(nuevoValor);
    setGuardando(true);

    const { data: existente } = await supabase
      .from("profesionales_config")
      .select("id")
      .eq("profesional_id", user.id)
      .maybeSingle();

    let error;

    if (existente) {
      const response = await supabase
        .from("profesionales_config")
        .update({
          storage_provider: nuevoValor,
        })
        .eq("id", existente.id)
        .eq("profesional_id", user.id);

      error = response.error;
    } else {
      const response = await supabase
        .from("profesionales_config")
        .insert([
          {
            profesional_id: user.id,
            storage_provider: nuevoValor,
          },
        ]);

      error = response.error;
    }

    setGuardando(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Configuración guardada correctamente.");
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-4xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <section className="rounded-3xl bg-white p-6 shadow">
          <h1 className="text-3xl font-black text-slate-900">
            Configuración
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Define dónde se almacenarán los datos clínicos del profesional.
          </p>

          <div className="mt-6 space-y-4">
            {opciones.map((opcion) => {
              const activo = storageProvider === opcion.id;

              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => guardarConfiguracion(opcion.id)}
                  disabled={guardando}
                  className={`w-full rounded-2xl border p-5 text-left transition ${
                    activo
                      ? "border-cyan-600 bg-cyan-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-slate-900">
                        {opcion.titulo}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {opcion.descripcion}
                      </p>
                    </div>

                    <div
                      className={`flex h-7 w-14 items-center rounded-full p-1 ${
                        activo ? "bg-[#18AFC1]" : "bg-slate-300"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white transition ${
                          activo ? "translate-x-7" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-5">
            <p className="font-black text-slate-800">
              Configuración actual:
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {opciones.find((o) => o.id === storageProvider)?.titulo}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}