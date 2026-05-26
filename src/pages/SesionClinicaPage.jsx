import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  obtenerAccessTokenGoogle,
  subirJsonSesionDrive,
} from "../lib/googleDriveClient";

export default function SesionClinicaPage({ user, cita, goBack }) {
  const [guardando, setGuardando] = useState(false);
  const [storageProvider, setStorageProvider] = useState("mentalia_cloud");
  const [paciente, setPaciente] = useState(null);

  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [notasClinicas, setNotasClinicas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [tareasAcuerdos, setTareasAcuerdos] = useState("");
  const [resumenSesion, setResumenSesion] = useState("");
  const [focoTrabajado, setFocoTrabajado] = useState("");
  const [proximaSesion, setProximaSesion] = useState("");

  useEffect(() => {
    cargarConfiguracion();
    cargarPaciente();
    cargarSesion();
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

    setStorageProvider(data?.storage_provider || "mentalia_cloud");
  }

  async function cargarPaciente() {
    const pacienteId = cita.paciente_id || cita.paciente?.id || cita.pacientes?.id;

    if (cita.paciente) {
      setPaciente(cita.paciente);
      return;
    }

    if (cita.pacientes) {
      setPaciente(cita.pacientes);
      return;
    }

    if (!pacienteId) return;

    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .eq("id", pacienteId)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    setPaciente(data);
  }

  async function cargarSesion() {
    const { data } = await supabase
      .from("sesiones_clinicas")
      .select("*")
      .eq("cita_id", cita.id)
      .maybeSingle();

    if (!data) return;

    if (data.clinical_data_external) return;

    setMotivoConsulta(data.motivo_consulta || "");
    setNotasClinicas(data.notas_clinicas || "");
    setObservaciones(data.observaciones || "");
    setTareasAcuerdos(data.tareas_acuerdos || "");
    setResumenSesion(data.resumen_sesion || "");
    setFocoTrabajado(data.foco_trabajado || "");
    setProximaSesion(data.proxima_sesion || "");
  }

  function construirSesionClinica(estado) {
    return {
      motivo_consulta: motivoConsulta,
      notas_clinicas: notasClinicas,
      observaciones,
      tareas_acuerdos: tareasAcuerdos,
      resumen_sesion: resumenSesion,
      foco_trabajado: focoTrabajado,
      proxima_sesion: proximaSesion,
      estado,
    };
  }

  async function guardarSesion(estado = "borrador") {
    setGuardando(true);

    const pacienteId = cita.paciente_id || cita.paciente?.id || cita.pacientes?.id;
    const pacienteFinal = paciente || cita.paciente || cita.pacientes;

    if (!pacienteId) {
      setGuardando(false);
      alert("No se pudo identificar el paciente.");
      return;
    }

    if (storageProvider === "google_drive" && !pacienteFinal) {
      setGuardando(false);
      alert("No se pudo cargar la información del paciente para guardar en Drive.");
      return;
    }

    const sesionClinica = construirSesionClinica(estado);

    const { data: existente } = await supabase
      .from("sesiones_clinicas")
      .select("id")
      .eq("cita_id", cita.id)
      .maybeSingle();

    let payload;

    if (storageProvider === "google_drive") {
      try {
        const accessToken = await obtenerAccessTokenGoogle();

        const archivoDrive = await subirJsonSesionDrive({
          accessToken,
          paciente: pacienteFinal,
          cita,
          sesion: sesionClinica,
        });

        payload = {
          cita_id: cita.id,
          profesional_id: user.id,
          paciente_id: pacienteId,
          estado,

          storage_provider: "google_drive",
          storage_file_id: archivoDrive.fileId,
          storage_path: archivoDrive.path,
          clinical_data_external: true,

          motivo_consulta: null,
          notas_clinicas: null,
          observaciones: null,
          tareas_acuerdos: null,
          resumen_sesion: null,
          foco_trabajado: null,
          proxima_sesion: null,
        };
      } catch (error) {
        setGuardando(false);
        alert("Error al guardar en Google Drive: " + error.message);
        return;
      }
    } else {
      payload = {
        cita_id: cita.id,
        profesional_id: user.id,
        paciente_id: pacienteId,
        estado,

        storage_provider: "mentalia_cloud",
        storage_file_id: null,
        storage_path: null,
        clinical_data_external: false,

        ...sesionClinica,
      };
    }

    let error;

    if (existente) {
      const response = await supabase
        .from("sesiones_clinicas")
        .update(payload)
        .eq("id", existente.id)
        .eq("profesional_id", user.id);

      error = response.error;
    } else {
      const response = await supabase.from("sesiones_clinicas").insert([payload]);
      error = response.error;
    }

    setGuardando(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      storageProvider === "google_drive"
        ? "Sesión guardada en Google Drive. Mentalia solo guardó metadatos."
        : estado === "finalizada"
        ? "Sesión finalizada correctamente."
        : "Borrador guardado."
    );

    if (estado === "finalizada") {
      goBack();
    }
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-5xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <div className="rounded-3xl bg-white p-6 shadow">
          <div className="mb-6 border-b pb-4">
            <h1 className="text-3xl font-black text-slate-800">
              Sesión Clínica
            </h1>

            <p className="mt-2 text-slate-500">{cita.patient}</p>

            <p className="text-sm text-slate-400">
              {cita.fecha} · {cita.hora_inicio}
            </p>

            {storageProvider === "google_drive" && (
              <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-black">Modo Google Drive activo</p>
                <p>
                  Los datos clínicos se guardarán como archivo JSON en el Drive
                  del profesional. Mentalia solo almacenará metadatos.
                </p>
              </div>
            )}
          </div>

          <section className="space-y-5">
            <h2 className="text-xl font-black text-slate-800">
              Registro de atención
            </h2>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                Motivo de consulta
              </label>
              <textarea
                value={motivoConsulta}
                onChange={(e) => setMotivoConsulta(e.target.value)}
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
                onChange={(e) => setNotasClinicas(e.target.value)}
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
                onChange={(e) => setObservaciones(e.target.value)}
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
                onChange={(e) => setTareasAcuerdos(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-cyan-100 bg-cyan-50 p-5">
            <h2 className="text-xl font-black text-cyan-900">
              Post-sesión / cierre clínico
            </h2>

            <p className="mb-5 mt-1 text-sm text-slate-600">
              Completa el cierre de la atención para dejar una evolución clara y
              útil para la próxima pre-sesión.
            </p>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Resumen de sesión
                </label>
                <textarea
                  value={resumenSesion}
                  onChange={(e) => setResumenSesion(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Foco trabajado
                </label>
                <textarea
                  value={focoTrabajado}
                  onChange={(e) => setFocoTrabajado(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Próxima sesión sugerida
                </label>
                <textarea
                  value={proximaSesion}
                  onChange={(e) => setProximaSesion(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3"
                />
              </div>
            </div>
          </section>

          <div className="mt-8 flex flex-col gap-3 md:flex-row">
            <button
              onClick={() => guardarSesion("borrador")}
              disabled={guardando}
              className="flex-1 rounded-2xl border border-slate-300 px-6 py-4 font-black text-slate-700 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar borrador"}
            </button>

            <button
              onClick={() => guardarSesion("finalizada")}
              disabled={guardando}
              className="flex-1 rounded-2xl bg-[#18AFC1] px-6 py-4 font-black text-white disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Finalizar sesión"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}