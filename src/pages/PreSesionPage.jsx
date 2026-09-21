import React, { useEffect, useState } from "react";
import { formatearFecha } from "../utils/formato";
import {  obtenerAccessTokenGoogle,  leerJsonSesionDrive,} from "../lib/googleDriveClient";
import { actualizarPacienteApi, obtenerUltimaSesionClinica, obtenerConsentimientosPaciente, solicitarConsentimientosPaciente } from "../lib/mentaliaApi";

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(`${String(fechaNacimiento).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const diferenciaMes = hoy.getMonth() - nacimiento.getMonth();
  if (diferenciaMes < 0 || (diferenciaMes === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1;
  return edad >= 0 ? edad : null;
}


export default function PreSesionPage({
  user,
  cita,
  iniciarSesionClinica,
  goBack,
}) {
  const [ultimaSesion, setUltimaSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pacienteAdministrativo, setPacienteAdministrativo] = useState(cita.paciente || cita.pacientes || {});
  const [editandoAdministrativos, setEditandoAdministrativos] = useState(false);
  const [guardandoAdministrativos, setGuardandoAdministrativos] = useState(false);
  const [datosAdministrativos, setDatosAdministrativos] = useState({});
  const [consentimientos, setConsentimientos] = useState([]);
  const [cargandoConsentimientos, setCargandoConsentimientos] = useState(true);
  const [solicitandoConsentimientos, setSolicitandoConsentimientos] = useState(false);
  const [mensajeConsentimientos, setMensajeConsentimientos] = useState("");
  const [enlaceConsentimientos, setEnlaceConsentimientos] = useState("");
  const puedeGrabarConversacion = consentimientos.find((item) => item.codigo === "grabacion_audio")?.estado === "aceptado" && consentimientos.find((item) => item.codigo === "transcripcion_ia")?.estado === "aceptado";

  useEffect(() => {
    cargarPreSesion();
    cargarConsentimientos();
  }, []);

  function obtenerPacienteId() {
    return cita.paciente_id || cita.paciente?.id || cita.pacientes?.id;
  }

  async function cargarConsentimientos() {
    const pacienteId = obtenerPacienteId();
    if (!pacienteId) { setCargandoConsentimientos(false); return; }
    try {
      setConsentimientos(await obtenerConsentimientosPaciente(pacienteId));
    } catch (error) {
      setMensajeConsentimientos(error.message || "No fue posible cargar los consentimientos.");
    } finally {
      setCargandoConsentimientos(false);
    }
  }

  async function solicitarConsentimientos() {
    const pacienteId = obtenerPacienteId();
    if (!pacienteId) return;
    setSolicitandoConsentimientos(true);
    setMensajeConsentimientos("");
    try {
      const resultado = await solicitarConsentimientosPaciente(pacienteId);
      setConsentimientos(resultado.consentimientos || []);
      setEnlaceConsentimientos(`${window.location.origin}/consentimiento/${resultado.enlace_token}`);
      const estadoCorreo = resultado.notification_status === "enviado" ? "Correo enviado al paciente." : resultado.notification_status === "sin_correo" ? "El paciente no tiene correo registrado." : "No fue posible enviar el correo; puedes usar el enlace generado.";
      setMensajeConsentimientos(`Solicitud creada. ${estadoCorreo}`);
    } catch (error) {
      setMensajeConsentimientos(error.message || "No fue posible preparar la solicitud.");
    } finally {
      setSolicitandoConsentimientos(false);
    }
  }

  async function cargarPreSesion() {
    setCargando(true);
  
    const pacienteId =
      cita.paciente_id ||
      cita.paciente?.id ||
      cita.pacientes?.id;
  
    if (!pacienteId) {
      setCargando(false);
  
      setMensajeConsentimientos("No se pudo identificar el paciente para cargar la pre-sesión.");
  
      return;
    }
  
    let data;
    try {
      data = await obtenerUltimaSesionClinica(pacienteId);
    } catch (error) {
      setCargando(false);
      setMensajeConsentimientos(error.message || "No fue posible cargar la sesión clínica.");
      return;
    }
  
    if (!data) {
      setUltimaSesion(null);
      setCargando(false);
      return;
    }
  
    let sesionFinal = data;
  
    try {
      if (
        data.clinical_data_external === true &&
        data.storage_provider === "google_drive" &&
        data.storage_file_id
      ) {
        const accessToken =
          await obtenerAccessTokenGoogle();
  
        const jsonDrive =
          await leerJsonSesionDrive({
            accessToken,
            fileId: data.storage_file_id,
          });
  
        sesionFinal = {
          ...data,
          ...(jsonDrive.sesion || {}),
          origen_datos: "google_drive",
        };
      }
    } catch (errorDrive) {
      setMensajeConsentimientos("No fue posible leer la sesión clínica desde Google Drive: " + errorDrive.message);
    }
  
    setUltimaSesion(sesionFinal);
  
    setCargando(false);
  }

  function editarDatosAdministrativos() {
    setDatosAdministrativos({
      nombres: pacienteAdministrativo.nombres || "",
      apellidos: pacienteAdministrativo.apellidos || "",
      identificador: pacienteAdministrativo.identificador || "",
      email: pacienteAdministrativo.email || "",
      telefono: pacienteAdministrativo.telefono || "",
      fecha_nacimiento: pacienteAdministrativo.fecha_nacimiento?.slice(0, 10) || "",
      genero: pacienteAdministrativo.genero || "",
    });
    setEditandoAdministrativos(true);
  }

  async function guardarDatosAdministrativos() {
    const pacienteId = cita.paciente_id || pacienteAdministrativo.id || cita.pacientes?.id;
    if (!pacienteId) return;
    setGuardandoAdministrativos(true);
    try {
      const actualizado = await actualizarPacienteApi(pacienteId, datosAdministrativos);
      setPacienteAdministrativo(actualizado);
      setEditandoAdministrativos(false);
    } catch (error) {
      setMensajeConsentimientos(error.message || "No fue posible actualizar los datos del paciente.");
    } finally {
      setGuardandoAdministrativos(false);
    }
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

        <section className={`mb-6 rounded-2xl border p-4 ${puedeGrabarConversacion ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-black text-slate-900">Estado para iniciar la atención</p><p className="text-sm text-slate-600">Cita: <span className="font-bold">{String(cita.estado || "reservada").replaceAll("_", " ")}</span></p></div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${puedeGrabarConversacion ? "bg-emerald-200 text-emerald-800" : "bg-amber-200 text-amber-800"}`}>{puedeGrabarConversacion ? "Grabación autorizada" : "Grabación no autorizada"}</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">{puedeGrabarConversacion ? "La conversación puede grabarse y transcribirse temporalmente." : "La conversación no puede grabarse. El profesional puede usar el resumen privado."}</p>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-6 shadow">
          <div className="mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Datos administrativos del paciente</h2>
                <p className="text-sm text-slate-500">Información entregada durante la reserva. No corresponde a antecedentes clínicos.</p>
              </div>
              {!editandoAdministrativos && <button type="button" onClick={editarDatosAdministrativos} className="rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-black text-cyan-700 hover:bg-cyan-50">Editar datos</button>}
            </div>
          </div>

          {editandoAdministrativos && <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><input value={datosAdministrativos.nombres || ""} onChange={(e) => setDatosAdministrativos((prev) => ({ ...prev, nombres: e.target.value }))} placeholder="Nombres" className="rounded-xl border border-slate-300 bg-white px-3 py-2" /><input value={datosAdministrativos.apellidos || ""} onChange={(e) => setDatosAdministrativos((prev) => ({ ...prev, apellidos: e.target.value }))} placeholder="Apellidos" className="rounded-xl border border-slate-300 bg-white px-3 py-2" /><input value={datosAdministrativos.identificador || ""} onChange={(e) => setDatosAdministrativos((prev) => ({ ...prev, identificador: e.target.value }))} placeholder="Identificador" className="rounded-xl border border-slate-300 bg-white px-3 py-2" /><input type="email" value={datosAdministrativos.email || ""} onChange={(e) => setDatosAdministrativos((prev) => ({ ...prev, email: e.target.value }))} placeholder="Correo electrónico" className="rounded-xl border border-slate-300 bg-white px-3 py-2" /><input value={datosAdministrativos.telefono || ""} onChange={(e) => setDatosAdministrativos((prev) => ({ ...prev, telefono: e.target.value }))} placeholder="Teléfono" className="rounded-xl border border-slate-300 bg-white px-3 py-2" /><input type="date" value={datosAdministrativos.fecha_nacimiento || ""} onChange={(e) => setDatosAdministrativos((prev) => ({ ...prev, fecha_nacimiento: e.target.value }))} aria-label="Fecha de nacimiento" className="rounded-xl border border-slate-300 bg-white px-3 py-2" /><select value={datosAdministrativos.genero || ""} onChange={(e) => setDatosAdministrativos((prev) => ({ ...prev, genero: e.target.value }))} aria-label="Género" className="rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="">Género</option><option value="femenino">Femenino</option><option value="masculino">Masculino</option><option value="otro">Otro</option><option value="prefiere_no_decir">Prefiere no decir</option></select></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setEditandoAdministrativos(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Cancelar</button><button type="button" onClick={guardarDatosAdministrativos} disabled={guardandoAdministrativos} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{guardandoAdministrativos ? "Guardando..." : "Guardar cambios"}</button></div></div>}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Nombre completo</p>
              <p className="mt-1 font-bold text-slate-800">{`${pacienteAdministrativo.nombres || ""} ${pacienteAdministrativo.apellidos || ""}`.trim() || cita.patient || "Sin registro"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Identificador</p>
              <p className="mt-1 font-bold text-slate-800">{pacienteAdministrativo.identificador || "No informado"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Correo electrónico</p>
              <p className="mt-1 break-words font-bold text-slate-800">{pacienteAdministrativo.email || "No informado"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Teléfono</p>
              <p className="mt-1 font-bold text-slate-800">{pacienteAdministrativo.telefono || "No informado"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Fecha de nacimiento</p>
              <p className="mt-1 font-bold text-slate-800">{pacienteAdministrativo.fecha_nacimiento ? `${String(pacienteAdministrativo.fecha_nacimiento).slice(0, 10)}${calcularEdad(pacienteAdministrativo.fecha_nacimiento) !== null ? ` · ${calcularEdad(pacienteAdministrativo.fecha_nacimiento)} años` : ""}` : "No informada"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Género</p>
              <p className="mt-1 font-bold text-slate-800">{pacienteAdministrativo.genero || "No informado"}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
              <p className="text-xs font-black uppercase text-cyan-700">Primera atención</p>
              <p className="mt-1 font-bold text-cyan-900">{cita.primera_atencion === "si" ? "Sí" : cita.primera_atencion === "no" ? "No" : "No informado"}</p>
            </div>
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
              <p className="text-xs font-black uppercase text-cyan-700">Canal preferido</p>
              <p className="mt-1 font-bold text-cyan-900">{cita.canal_contacto || "No informado"}</p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Consentimientos del paciente</h2>
              <p className="text-sm text-slate-500">Autorizaciones específicas para este paciente y este profesional.</p>
            </div>
            <button type="button" onClick={solicitarConsentimientos} disabled={solicitandoConsentimientos} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
              {solicitandoConsentimientos ? "Preparando..." : "Solicitar consentimientos"}
            </button>
          </div>
          {mensajeConsentimientos && <p className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">{mensajeConsentimientos}</p>}
          {enlaceConsentimientos && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-800">Enlace de prueba para el paciente (expira en 7 días)</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input readOnly value={enlaceConsentimientos} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700" /><a href={enlaceConsentimientos} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-600 px-3 py-2 text-center text-xs font-black text-white">Abrir enlace</a></div></div>}
          {cargandoConsentimientos ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Cargando autorizaciones...</p> : consentimientos.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Aún no hay consentimientos registrados para este profesional.</p> : <div className="space-y-2">{consentimientos.map((consentimiento) => { const tipo = consentimiento.consentimiento_tipos || {}; const estado = consentimiento.estado || "pendiente"; const color = estado === "aceptado" ? "bg-emerald-100 text-emerald-800" : estado === "rechazado" || estado === "revocado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"; return <div key={consentimiento.codigo} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800">{tipo.titulo || consentimiento.codigo}</p><p className="text-xs text-slate-500">{tipo.descripcion || "Consentimiento registrado para este profesional."}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${color}`}>{estado}</span></div>; })}</div>}
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
