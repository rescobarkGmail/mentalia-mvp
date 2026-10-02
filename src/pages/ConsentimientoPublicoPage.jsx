import React, { useEffect, useMemo, useState } from "react";
import {
  obtenerSolicitudConsentimientoPublica,
  responderSolicitudConsentimientoPublica,
} from "../lib/mentaliaApi";

function respuestaRegistrada(item, respuestas) {
  if (respuestas[item.codigo]) return respuestas[item.codigo];
  if (item.estado === "revocado") return "rechazado";

  return (
    item.estado === "aceptado" || item.estado === "rechazado" ? item.estado : ""
  );
}

export default function ConsentimientoPublicoPage({ token }) {
  const [solicitud, setSolicitud] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  useEffect(() => {
    obtenerSolicitudConsentimientoPublica(token)
      .then(setSolicitud)
      .catch((error) => setMensaje(error.message))
      .finally(() => setCargando(false));
  }, [token]);

  const consentimientosSinRespuesta = useMemo(() => {
    if (!solicitud?.consentimientos) return [];

    return solicitud.consentimientos.filter(
      (item) => !respuestaRegistrada(item, respuestas),
    );
  }, [solicitud, respuestas]);

  async function enviar() {
    if (guardado) return;

    setIntentoGuardar(true);

    if (consentimientosSinRespuesta.length > 0) {
      setMensaje(
        "Debes aceptar o rechazar cada consentimiento antes de guardar.",
      );
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      setSolicitud(
        await responderSolicitudConsentimientoPublica(token, respuestas),
      );
      setGuardado(true);
      setMensaje(
        "Tus respuestas fueron registradas correctamente. Puedes cerrar esta página.",
      );
    } catch (error) {
      setMensaje(error.message || "No fue posible registrar tus respuestas.");
    } finally {
      setGuardando(false);
    }
  }

  function salir() {
    window.location.href = window.location.origin;
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#eef8fb] p-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow">
          Cargando solicitud...
        </div>
      </main>
    );
  }

  if (!solicitud) {
    return (
      <main className="min-h-screen bg-[#eef8fb] p-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow">
          <h1 className="text-2xl font-black text-slate-900">
            Solicitud no disponible
          </h1>
          <p className="mt-2 text-slate-600">
            {mensaje || "El enlace no existe o expiró."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-3xl bg-white p-6 shadow">
          <div className="flex items-start justify-between">
            <p className="text-sm font-bold text-cyan-700">FluyePro</p>
            <button
              type="button"
              onClick={salir}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Salir
            </button>
          </div>

          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Consentimientos de atención
          </h1>
          <p className="mt-2 text-slate-600">
            Hola {solicitud.paciente?.nombres || ""}. Revisa cada autorización y
            selecciona aceptar o rechazar.
          </p>

          {consentimientosSinRespuesta.length > 0 && !guardado ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Faltan {consentimientosSinRespuesta.length} consentimiento(s) por
              responder. Para guardar, debes aceptar o rechazar cada uno.
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {solicitud.consentimientos.map((item) => {
              const tipo = item.consentimiento_tipos || {};
              const value = respuestaRegistrada(item, respuestas);
              const sinRespuesta = !value;
              const mostrarError = intentoGuardar && sinRespuesta;

              return (
                <article
                  key={item.codigo}
                  className={`rounded-2xl border p-4 ${
                    mostrarError
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-black text-slate-900">
                        {tipo.titulo || item.codigo}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {tipo.descripcion || item.texto_snapshot}
                      </p>
                    </div>
                    {sinRespuesta ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                        Sin respuesta
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={guardado}
                      onClick={() =>
                        setRespuestas((prev) => ({
                          ...prev,
                          [item.codigo]: "aceptado",
                        }))
                      }
                      className={`rounded-xl px-4 py-2 text-sm font-black ${
                        value === "aceptado"
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      Acepto
                    </button>
                    <button
                      type="button"
                      disabled={guardado}
                      onClick={() =>
                        setRespuestas((prev) => ({
                          ...prev,
                          [item.codigo]: "rechazado",
                        }))
                      }
                      className={`rounded-xl px-4 py-2 text-sm font-black ${
                        value === "rechazado"
                          ? "bg-red-600 text-white"
                          : "bg-red-50 text-red-800"
                      }`}
                    >
                      No acepto
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {mensaje ? (
            <p
              className={`mt-4 rounded-xl p-3 text-sm font-semibold ${
                mensaje.startsWith("Debes")
                  ? "bg-amber-50 text-amber-800"
                  : "bg-cyan-50 text-cyan-800"
              }`}
            >
              {mensaje}
            </p>
          ) : null}

          {guardado ? (
            <button
              type="button"
              onClick={salir}
              className="mt-5 w-full rounded-xl bg-cyan-600 px-4 py-3 font-black text-white"
            >
              Finalizar y salir
            </button>
          ) : (
            <button
              type="button"
              onClick={enviar}
              disabled={guardando}
              className="mt-5 w-full rounded-xl bg-cyan-600 px-4 py-3 font-black text-white disabled:opacity-50"
            >
              {guardando ? "Registrando..." : "Guardar mis respuestas"}
            </button>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Solicitud asociada al profesional:{" "}
            {solicitud.profesional?.nombres || ""}{" "}
            {solicitud.profesional?.apellidos || ""}
          </p>
        </section>
      </div>
    </main>
  );
}
