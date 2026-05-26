import React, { useEffect, useRef, useState } from "react";
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

  const [grabando, setGrabando] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [procesandoAudio, setProcesandoAudio] = useState(false);
  const [transcripcion, setTranscripcion] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    cargarConfiguracion();
    cargarPaciente();
    cargarSesion();
  }, []);

  async function cargarConfiguracion() {
    const { data } = await supabase
      .from("profesionales_config")
      .select("*")
      .eq("profesional_id", user.id)
      .maybeSingle();

    setStorageProvider(data?.storage_provider || "mentalia_cloud");
  }

  async function cargarPaciente() {
    const pacienteId = cita.paciente_id || cita.paciente?.id || cita.pacientes?.id;

    if (cita.paciente) return setPaciente(cita.paciente);
    if (cita.pacientes) return setPaciente(cita.pacientes);
    if (!pacienteId) return;

    const { data } = await supabase
      .from("pacientes")
      .select("*")
      .eq("id", pacienteId)
      .maybeSingle();

    setPaciente(data);
  }

  async function cargarSesion() {
    const { data } = await supabase
      .from("sesiones_clinicas")
      .select("*")
      .eq("cita_id", cita.id)
      .maybeSingle();

    if (!data || data.clinical_data_external) return;

    setMotivoConsulta(data.motivo_consulta || "");
    setNotasClinicas(data.notas_clinicas || "");
    setObservaciones(data.observaciones || "");
    setTareasAcuerdos(data.tareas_acuerdos || "");
    setResumenSesion(data.resumen_sesion || "");
    setFocoTrabajado(data.foco_trabajado || "");
    setProximaSesion(data.proxima_sesion || "");
  }

  async function iniciarGrabacion() {
    try {
      setAudioBlob(null);
      setAudioUrl("");
      setTranscripcion("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setGrabando(true);
    } catch (error) {
      alert("No se pudo iniciar la grabación: " + error.message);
    }
  }

  function detenerGrabacion() {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop();
      setGrabando(false);
    }
  }

  function descartarAudio() {
    setAudioBlob(null);
    setAudioUrl("");
    setTranscripcion("");
    audioChunksRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function procesarAudioConIA() {
    if (!audioBlob) {
      alert("Primero debes grabar un audio.");
      return;
    }

    setProcesandoAudio(true);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "sesion.webm");

      const { data, error } = await supabase.functions.invoke(
        "procesar-audio-clinico",
        {
          body: formData,
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTranscripcion(data.transcripcion || "");

      setNotasClinicas((prev) =>
        prev
          ? `${prev}\n\nTranscripción:\n${data.transcripcion || ""}`
          : data.transcripcion || ""
      );

      setResumenSesion(data.resumen_sesion || "");
      setFocoTrabajado(data.foco_trabajado || "");
      setObservaciones(data.observaciones || "");
      setTareasAcuerdos(data.tareas_acuerdos || "");
      setProximaSesion(data.proxima_sesion || "");

      alert("Audio procesado correctamente con IA.");
    } catch (error) {
      alert("Error al procesar audio con IA: " + error.message);
    }

    setProcesandoAudio(false);
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

    descartarAudio();

    alert(
      storageProvider === "google_drive"
        ? "Sesión guardada en Google Drive. Mentalia solo guardó metadatos."
        : estado === "finalizada"
        ? "Sesión finalizada correctamente."
        : "Borrador guardado."
    );

    if (estado === "finalizada") goBack();
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
                  Los datos clínicos se guardarán como JSON en Drive. Mentalia
                  solo almacenará metadatos.
                </p>
              </div>
            )}
          </div>

          <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-xl font-black text-amber-900">
              Procesamiento efímero de audio
            </h2>

            <p className="mt-1 text-sm text-amber-800">
              El audio se procesa temporalmente y no se guarda en Supabase ni en Drive.
            </p>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              {!grabando ? (
                <button
                  onClick={iniciarGrabacion}
                  className="flex-1 rounded-2xl bg-red-600 px-6 py-4 font-black text-white"
                >
                  🎙 Iniciar grabación
                </button>
              ) : (
                <button
                  onClick={detenerGrabacion}
                  className="flex-1 rounded-2xl bg-slate-900 px-6 py-4 font-black text-white"
                >
                  ⏹ Detener grabación
                </button>
              )}

              <button
                onClick={procesarAudioConIA}
                disabled={!audioBlob || procesandoAudio}
                className="flex-1 rounded-2xl bg-[#18AFC1] px-6 py-4 font-black text-white disabled:opacity-50"
              >
                {procesandoAudio ? "Procesando..." : "🧠 Procesar audio IA"}
              </button>

              <button
                onClick={descartarAudio}
                disabled={!audioBlob && !audioUrl}
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-6 py-4 font-black text-slate-700 disabled:opacity-50"
              >
                Descartar audio
              </button>
            </div>

            {audioUrl && (
              <div className="mt-5 rounded-2xl bg-white p-4">
                <p className="mb-2 text-sm font-black text-slate-700">
                  Audio capturado temporalmente
                </p>
                <audio controls src={audioUrl} className="w-full" />
              </div>
            )}

            {transcripcion && (
              <div className="mt-5 rounded-2xl bg-white p-4">
                <p className="mb-2 text-sm font-black text-slate-700">
                  Transcripción IA
                </p>
                <p className="whitespace-pre-line text-sm text-slate-600">
                  {transcripcion}
                </p>
              </div>
            )}
          </section>

          <section className="space-y-5">
            <h2 className="text-xl font-black text-slate-800">
              Registro de atención
            </h2>

            <textarea
              placeholder="Motivo de consulta"
              value={motivoConsulta}
              onChange={(e) => setMotivoConsulta(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            />

            <textarea
              placeholder="Notas clínicas"
              value={notasClinicas}
              onChange={(e) => setNotasClinicas(e.target.value)}
              rows={8}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            />

            <textarea
              placeholder="Observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            />

            <textarea
              placeholder="Tareas / acuerdos"
              value={tareasAcuerdos}
              onChange={(e) => setTareasAcuerdos(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            />
          </section>

          <section className="mt-8 rounded-3xl border border-cyan-100 bg-cyan-50 p-5">
            <h2 className="text-xl font-black text-cyan-900">
              Post-sesión / cierre clínico
            </h2>

            <div className="mt-5 space-y-5">
              <textarea
                placeholder="Resumen de sesión"
                value={resumenSesion}
                onChange={(e) => setResumenSesion(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3"
              />

              <textarea
                placeholder="Foco trabajado"
                value={focoTrabajado}
                onChange={(e) => setFocoTrabajado(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3"
              />

              <textarea
                placeholder="Próxima sesión sugerida"
                value={proximaSesion}
                onChange={(e) => setProximaSesion(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3"
              />
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