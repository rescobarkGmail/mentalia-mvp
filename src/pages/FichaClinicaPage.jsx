import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatearFecha } from "../utils/formato";
import {
  obtenerAccessTokenGoogle,
  leerJsonSesionDrive,
  actualizarJsonSesionDrive,
} from "../lib/googleDriveClient";

export default function FichaClinicaPage({ user, paciente, goBack }) {
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [editandoSesion, setEditandoSesion] = useState(null);
  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [notasClinicas, setNotasClinicas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [tareasAcuerdos, setTareasAcuerdos] = useState("");
  const [resumenSesion, setResumenSesion] = useState("");
  const [focoTrabajado, setFocoTrabajado] = useState("");
  const [proximaSesion, setProximaSesion] = useState("");
  const [estado, setEstado] = useState("borrador");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarFicha();
  }, []);

  async function cargarFicha() {
    setCargando(true);

    const { data, error } = await supabase
      .from("sesiones_clinicas")
      .select("*")
      .eq("profesional_id", user.id)
      .eq("paciente_id", paciente.id)
      .order("fecha", { ascending: false });

    if (error) {
      setCargando(false);
      alert(error.message);
      return;
    }

    let sesionesFinales = data || [];

    const sesionesDrive = sesionesFinales.filter(
      (s) =>
        s.clinical_data_external === true &&
        s.storage_provider === "google_drive" &&
        s.storage_file_id
    );

    if (sesionesDrive.length > 0) {
      try {
        const accessToken = await obtenerAccessTokenGoogle();

        sesionesFinales = await Promise.all(
          sesionesFinales.map(async (s) => {
            if (
              s.clinical_data_external === true &&
              s.storage_provider === "google_drive" &&
              s.storage_file_id
            ) {
              const jsonDrive = await leerJsonSesionDrive({
                accessToken,
                fileId: s.storage_file_id,
              });

              return {
                ...s,
                ...(jsonDrive.sesion || {}),
                origen_datos: "google_drive",
                drive_json: jsonDrive,
              };
            }

            return {
              ...s,
              origen_datos: "mentalia_cloud",
            };
          })
        );
      } catch (errorDrive) {
        alert(
          "No fue posible leer una o más sesiones desde Google Drive: " +
            errorDrive.message
        );
      }
    }

    setSesiones(sesionesFinales);
    setCargando(false);
  }

  function abrirEdicion(sesion) {
    setEditandoSesion(sesion);
    setMotivoConsulta(sesion.motivo_consulta || "");
    setNotasClinicas(sesion.notas_clinicas || "");
    setObservaciones(sesion.observaciones || "");
    setTareasAcuerdos(sesion.tareas_acuerdos || "");
    setResumenSesion(sesion.resumen_sesion || "");
    setFocoTrabajado(sesion.foco_trabajado || "");
    setProximaSesion(sesion.proxima_sesion || "");
    setEstado(sesion.estado || "borrador");
  }

  function cerrarEdicion() {
    setEditandoSesion(null);
    setMotivoConsulta("");
    setNotasClinicas("");
    setObservaciones("");
    setTareasAcuerdos("");
    setResumenSesion("");
    setFocoTrabajado("");
    setProximaSesion("");
    setEstado("borrador");
  }

  async function guardarCambios() {
    if (!editandoSesion) return;

    setGuardando(true);

    const sesionActualizada = {
      motivo_consulta: motivoConsulta,
      notas_clinicas: notasClinicas,
      observaciones,
      tareas_acuerdos: tareasAcuerdos,
      resumen_sesion: resumenSesion,
      foco_trabajado: focoTrabajado,
      proxima_sesion: proximaSesion,
      estado,
    };

    if (
      editandoSesion.clinical_data_external &&
      editandoSesion.storage_provider === "google_drive"
    ) {
      try {
        const accessToken = await obtenerAccessTokenGoogle();

        const jsonActualizado = {
          ...(editandoSesion.drive_json || {}),
          sesion: sesionActualizada,
          auditoria: {
            ...(editandoSesion.drive_json?.auditoria || {}),
            fecha_actualizacion: new Date().toISOString(),
            actualizado_por: user.id,
          },
        };

        await actualizarJsonSesionDrive({
          accessToken,
          fileId: editandoSesion.storage_file_id,
          contenido: jsonActualizado,
        });

        const { error } = await supabase
          .from("sesiones_clinicas")
          .update({
            estado,
            storage_provider: "google_drive",
            clinical_data_external: true,
          })
          .eq("id", editandoSesion.id)
          .eq("profesional_id", user.id);

        if (error) {
          throw error;
        }

        setSesiones((prev) =>
          prev.map((s) =>
            s.id === editandoSesion.id
              ? {
                  ...s,
                  ...sesionActualizada,
                  drive_json: jsonActualizado,
                  origen_datos: "google_drive",
                }
              : s
          )
        );

        cerrarEdicion();
        alert("Sesión actualizada correctamente en Google Drive.");
      } catch (error) {
        alert("Error al actualizar sesión en Google Drive: " + error.message);
      }

      setGuardando(false);
      return;
    }

    const { error } = await supabase
      .from("sesiones_clinicas")
      .update(sesionActualizada)
      .eq("id", editandoSesion.id)
      .eq("profesional_id", user.id);

    setGuardando(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSesiones((prev) =>
      prev.map((s) =>
        s.id === editandoSesion.id
          ? {
              ...s,
              ...sesionActualizada,
            }
          : s
      )
    );

    cerrarEdicion();
    alert("Ficha clínica actualizada correctamente.");
  }

  function BadgeOrigen({ sesion }) {
    if (
      sesion.clinical_data_external &&
      sesion.storage_provider === "google_drive"
    ) {
      return (
        <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
          Google Drive
        </span>
      );
    }

    return (
      <span className="w-fit rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">
        Mentalia Cloud
      </span>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#eef8fb] p-6">
        <div className="mx-auto max-w-6xl">
          <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
            ← Volver
          </button>

          <section className="mb-6 rounded-3xl bg-white p-6 shadow">
            <h1 className="text-3xl font-black text-slate-900">
              Ficha clínica
            </h1>

            <p className="mt-2 text-xl font-bold text-cyan-700">
              {paciente.nombres} {paciente.apellidos}
            </p>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-black text-slate-800">Identificador</p>
                <p>{paciente.identificador || "Sin registro"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-black text-slate-800">Email</p>
                <p>{paciente.email || "Sin registro"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-black text-slate-800">Teléfono</p>
                <p>{paciente.telefono || "Sin registro"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Historial de sesiones
                </h2>
                <p className="text-sm text-slate-500">
                  {sesiones.length} sesiones registradas
                </p>
              </div>

              <button
                onClick={cargarFicha}
                className="rounded-xl border border-cyan-200 bg-white px-4 py-2 font-bold text-cyan-700"
              >
                Actualizar
              </button>
            </div>

            {cargando ? (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-500">
                Cargando ficha clínica...
              </p>
            ) : sesiones.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-500">
                Este paciente aún no tiene sesiones clínicas registradas.
              </p>
            ) : (
              <div className="space-y-4">
                {sesiones.map((s) => (
                  <article
                    key={s.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-black text-cyan-700">
                          {formatearFecha(s.fecha)}
                        </p>

                        <p className="text-sm text-slate-500">
                          Estado:{" "}
                          <span className="font-bold">
                            {s.estado || "borrador"}
                          </span>
                        </p>

                        {s.storage_path && (
                          <p className="mt-1 text-xs text-slate-400">
                            {s.storage_path}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 md:items-end">
                        <BadgeOrigen sesion={s} />

                        <button
                          onClick={() => abrirEdicion(s)}
                          className="rounded-xl bg-[#18AFC1] px-4 py-2 text-sm font-black text-white"
                        >
                          Editar sesión
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-white p-4">
                        <p className="mb-1 font-black text-slate-800">
                          Motivo de consulta
                        </p>
                        <p className="whitespace-pre-line text-sm text-slate-600">
                          {s.motivo_consulta || "Sin registro"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-4">
                        <p className="mb-1 font-black text-slate-800">
                          Observaciones
                        </p>
                        <p className="whitespace-pre-line text-sm text-slate-600">
                          {s.observaciones || "Sin registro"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-4 md:col-span-2">
                        <p className="mb-1 font-black text-slate-800">
                          Notas clínicas
                        </p>
                        <p className="whitespace-pre-line text-sm text-slate-600">
                          {s.notas_clinicas || "Sin registro"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-4 md:col-span-2">
                        <p className="mb-1 font-black text-slate-800">
                          Tareas / acuerdos
                        </p>
                        <p className="whitespace-pre-line text-sm text-slate-600">
                          {s.tareas_acuerdos || "Sin registro"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-4 md:col-span-2">
                        <p className="mb-1 font-black text-slate-800">
                          Resumen de sesión
                        </p>
                        <p className="whitespace-pre-line text-sm text-slate-600">
                          {s.resumen_sesion || "Sin registro"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-4 md:col-span-2">
                        <p className="mb-1 font-black text-slate-800">
                          Foco trabajado
                        </p>
                        <p className="whitespace-pre-line text-sm text-slate-600">
                          {s.foco_trabajado || "Sin registro"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-4 md:col-span-2">
                        <p className="mb-1 font-black text-slate-800">
                          Próxima sesión sugerida
                        </p>
                        <p className="whitespace-pre-line text-sm text-slate-600">
                          {s.proxima_sesion || "Sin registro"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {editandoSesion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900">
              Editar sesión clínica
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {paciente.nombres} {paciente.apellidos} ·{" "}
              {formatearFecha(editandoSesion.fecha)}
            </p>

            {editandoSesion.clinical_data_external && (
              <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-black">Edición en Google Drive</p>
                <p>
                  Al guardar, se actualizará el archivo JSON en Drive. Supabase
                  mantendrá solo metadatos.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Estado
                </label>

                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="borrador">Borrador</option>
                  <option value="finalizada">Finalizada</option>
                  <option value="actualizada">Actualizada</option>
                </select>
              </div>

              <textarea
                placeholder="Motivo de consulta"
                value={motivoConsulta}
                onChange={(e) => setMotivoConsulta(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border px-4 py-3"
              />

              <textarea
                placeholder="Notas clínicas"
                value={notasClinicas}
                onChange={(e) => setNotasClinicas(e.target.value)}
                rows={7}
                className="w-full rounded-2xl border px-4 py-3"
              />

              <textarea
                placeholder="Observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border px-4 py-3"
              />

              <textarea
                placeholder="Tareas / acuerdos"
                value={tareasAcuerdos}
                onChange={(e) => setTareasAcuerdos(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border px-4 py-3"
              />

              <textarea
                placeholder="Resumen de sesión"
                value={resumenSesion}
                onChange={(e) => setResumenSesion(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border px-4 py-3"
              />

              <textarea
                placeholder="Foco trabajado"
                value={focoTrabajado}
                onChange={(e) => setFocoTrabajado(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border px-4 py-3"
              />

              <textarea
                placeholder="Próxima sesión sugerida"
                value={proximaSesion}
                onChange={(e) => setProximaSesion(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border px-4 py-3"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <button
                onClick={cerrarEdicion}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700"
              >
                Cancelar
              </button>

              <button
                onClick={guardarCambios}
                disabled={guardando}
                className="flex-1 rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}