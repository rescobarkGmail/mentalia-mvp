import React, { useEffect, useState } from "react";
import { obtenerSolicitudConsentimientoPublica, responderSolicitudConsentimientoPublica } from "../lib/mentaliaApi";

export default function ConsentimientoPublicoPage({ token }) {
  const [solicitud, setSolicitud] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  useEffect(() => { obtenerSolicitudConsentimientoPublica(token).then(setSolicitud).catch((error) => setMensaje(error.message)).finally(() => setCargando(false)); }, [token]);
  async function enviar() {
    setGuardando(true); setMensaje("");
    try { setSolicitud(await responderSolicitudConsentimientoPublica(token, respuestas)); setMensaje("Tus respuestas fueron registradas correctamente."); }
    catch (error) { setMensaje(error.message || "No fue posible registrar tus respuestas."); }
    finally { setGuardando(false); }
  }
  if (cargando) return <main className="min-h-screen bg-[#eef8fb] p-6"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow">Cargando solicitud...</div></main>;
  if (!solicitud) return <main className="min-h-screen bg-[#eef8fb] p-6"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-black text-slate-900">Solicitud no disponible</h1><p className="mt-2 text-slate-600">{mensaje || "El enlace no existe o expiró."}</p></div></main>;
  function salir() { window.location.href = window.location.origin; }
  return <main className="min-h-screen bg-[#eef8fb] p-6"><div className="mx-auto max-w-3xl"><section className="rounded-3xl bg-white p-6 shadow"><div className="flex items-start justify-between"><p className="text-sm font-bold text-cyan-700">FluyePro</p><button type="button" onClick={salir} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Salir</button></div><h1 className="mt-2 text-3xl font-black text-slate-900">Consentimientos de atención</h1><p className="mt-2 text-slate-600">Hola {solicitud.paciente?.nombres || ""}. Revisa cada autorización y selecciona aceptar o rechazar.</p><div className="mt-5 space-y-3">{solicitud.consentimientos.map((item) => { const tipo = item.consentimiento_tipos || {}; const value = respuestas[item.codigo] || (item.estado === "aceptado" || item.estado === "rechazado" ? item.estado : ""); return <article key={item.codigo} className="rounded-2xl border border-slate-200 p-4"><h2 className="font-black text-slate-900">{tipo.titulo || item.codigo}</h2><p className="mt-1 text-sm text-slate-600">{tipo.descripcion || item.texto_snapshot}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setRespuestas((prev) => ({ ...prev, [item.codigo]: "aceptado" }))} className={`rounded-xl px-4 py-2 text-sm font-black ${value === "aceptado" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800"}`}>Acepto</button><button type="button" onClick={() => setRespuestas((prev) => ({ ...prev, [item.codigo]: "rechazado" }))} className={`rounded-xl px-4 py-2 text-sm font-black ${value === "rechazado" ? "bg-red-600 text-white" : "bg-red-50 text-red-800"}`}>No acepto</button></div></article>; })}</div>{mensaje && <p className="mt-4 rounded-xl bg-cyan-50 p-3 text-sm text-cyan-800">{mensaje}</p>}<button type="button" onClick={enviar} disabled={guardando} className="mt-5 w-full rounded-xl bg-cyan-600 px-4 py-3 font-black text-white disabled:opacity-50">{guardando ? "Registrando..." : "Guardar mis respuestas"}</button><p className="mt-3 text-xs text-slate-500">Solicitud asociada al profesional: {solicitud.profesional?.nombres || ""} {solicitud.profesional?.apellidos || ""}</p></section></div></main>;
}
