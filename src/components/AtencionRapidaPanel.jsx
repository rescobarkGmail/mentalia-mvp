import DocumentoCampos from "./DocumentoCampos";
import { claveDocumento, errorDocumento } from "../../supabase/functions/_shared/documento.js";
import { useEffect, useRef, useState } from "react";
import { crearAtencionRapida, obtenerPacientes, obtenerPerfilProfesional } from "../lib/mentaliaApi";
import { ahoraSantiago, conflictoEvento, finAtencion, formatearRutChileno, normalizarRut, rutValido, seSuperponen } from "../utils/atencionRapida";

export default function AtencionRapidaPanel({ inicio, citas, eventos = [], onClose, onCreated }) {
  const dialogRef = useRef(null);
  const busyRef = useRef(false);
  const solicitudRef = useRef(crypto.randomUUID());
  const intentoRef = useRef(null);
  const [pacientes, setPacientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [datos, setDatos] = useState({ nombres: "", apellidos: "", identificador: "", tipo_identificador: "", pais_emisor_identificador: "", fecha_nacimiento: "" });
  const [horario, setHorario] = useState({ ...inicio, duracion_minutos: 50, modalidad: "" });
  const [confirmarConflicto, setConfirmarConflicto] = useState(false);
  const [conflictoServidor, setConflictoServidor] = useState(false);

  useEffect(() => {
    let active = true;
    const dialog = dialogRef.current;
    dialog.showModal();
    Promise.all([obtenerPacientes(), obtenerPerfilProfesional().catch(() => null)]).then(([items, perfil]) => {
      if (!active) return;
      setPacientes(items || []);
      const duracion = Number(perfil?.profile?.duracion_sesion_minutos);
      if (Number.isInteger(duracion) && duracion >= 15 && duracion <= 240) setHorario((prev) => ({ ...prev, duracion_minutos: duracion }));
    })
      .catch(() => { if (active) setErrorCarga("No fue posible cargar pacientes. Cierra el panel y vuelve a intentarlo."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; dialog.close(); };
  }, []);

  const fin = finAtencion(horario.hora_inicio, horario.duracion_minutos);
  const conflictos = fin ? citas.filter((cita) => cita.estado !== "cancelada" && cita.fecha?.slice(0, 10) === horario.fecha && seSuperponen(horario.hora_inicio, fin, cita.hora_inicio, cita.hora_fin)) : [];
  const conflictosGoogle = fin ? eventos.filter((evento) => conflictoEvento(horario.fecha, horario.hora_inicio, fin, evento)) : [];
  const hayConflicto = conflictos.length > 0 || conflictosGoogle.length > 0 || conflictoServidor;
  const provisional = nuevo && (!datos.apellidos.trim() || !datos.identificador.trim() || !datos.fecha_nacimiento || !datos.tipo_identificador || !datos.pais_emisor_identificador);
  const rutChilenoSeleccionado = datos.tipo_identificador === "rut" && datos.pais_emisor_identificador === "CL";
  const rutInvalido = nuevo && rutChilenoSeleccionado && datos.identificador.trim() && !rutValido(datos.identificador);
  const duplicado = datos.identificador.trim() && pacientes.find((p) => claveDocumento(p) === claveDocumento(datos));
  const encontrados = pacientes.filter((p) => `${p.nombres || ""} ${p.apellidos || ""}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()) || (normalizarRut(busqueda) && normalizarRut(p.identificador).includes(normalizarRut(busqueda)))).slice(0, 15);
  const cambiarHorario = (key, value) => { setHorario((prev) => ({ ...prev, [key]: value })); setConfirmarConflicto(false); setConflictoServidor(false); };
  const cambiarDato = (key, value) => {
    const valor =
      key === "identificador" &&
      datos.tipo_identificador === "rut" &&
      datos.pais_emisor_identificador === "CL"
        ? formatearRutChileno(value)
        : value;

    setDatos((prev) => ({ ...prev, [key]: valor }));
  };

  async function guardar(event) {
    event.preventDefault();
    if (busyRef.current) return;
    setError("");
    if (!incierto) {
      if (nuevo && !datos.nombres.trim()) return setError("Escribe al menos un nombre de referencia.");
      if (nuevo && errorDocumento(datos)) return setError(errorDocumento(datos));
      if (nuevo && duplicado) return setError("Ya existe un paciente con este documento. Selecciónalo para evitar duplicarlo.");
      if (!nuevo && !pacienteId) return setError("Selecciona un paciente.");
      if (!horario.modalidad) return setError("Elige la modalidad de atención.");
      if (!fin) return setError("La atención debe terminar antes de medianoche. Ajusta su duración.");
      if (hayConflicto && !confirmarConflicto) return setError("Confirma el conflicto de horario o elige otro intervalo.");
      intentoRef.current = { ...horario, solicitud_id: solicitudRef.current, paciente_id: nuevo ? null : pacienteId, paciente: nuevo ? datos : null, confirmar_conflicto: confirmarConflicto };
    }
    busyRef.current = true;
    setGuardando(true);
    try {
      const cita = await crearAtencionRapida(intentoRef.current);
      onCreated({ ...cita, patient: `${cita.pacientes?.nombres || ""} ${cita.pacientes?.apellidos || ""}`.trim() });
    } catch (err) {
      setError(err.message || "No fue posible crear la atención.");
      const desconocido = err.resultadoIncierto === true || !err.status;
      setIncierto(desconocido);
      if (err.code === "QUICK_CONFLICT") { setConflictoServidor(true); setConfirmarConflicto(false); }
    } finally {
      busyRef.current = false;
      setGuardando(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2";
  return <dialog ref={dialogRef} aria-labelledby="titulo-atencion-rapida" onCancel={(event) => { event.preventDefault(); if (!busyRef.current && !incierto) onClose(); }} className="m-auto max-h-[90vh] w-[min(94vw,640px)] rounded-3xl p-6 text-slate-800 shadow-xl backdrop:bg-slate-950/45">
    <div className="mb-4 flex items-start justify-between gap-4"><div><h2 id="titulo-atencion-rapida" className="text-2xl font-black">Atención rápida</h2><p className="text-sm text-slate-500">Crea la cita y abre la sesión clínica.</p></div><button type="button" disabled={guardando || incierto} onClick={onClose} className="rounded-xl border px-3 py-2 disabled:opacity-50">Cerrar</button></div>
    <form onSubmit={guardar}>
      <fieldset disabled={guardando || incierto || cargando} className="space-y-4 disabled:opacity-60">
        <div className="flex gap-2"><button type="button" aria-pressed={!nuevo} onClick={() => setNuevo(false)} className={`rounded-xl border px-3 py-2 ${!nuevo ? "bg-cyan-100" : ""}`}>Paciente existente</button><button type="button" aria-pressed={nuevo} onClick={() => setNuevo(true)} className={`rounded-xl border px-3 py-2 ${nuevo ? "bg-cyan-100" : ""}`}>Paciente nuevo</button></div>
        {cargando && <p role="status">Cargando pacientes…</p>}
        {errorCarga && <p role="alert" className="text-red-700">{errorCarga}</p>}
        {!nuevo ? <div><label>Buscar por nombre o documento<input autoFocus value={busqueda} onChange={(event) => { setBusqueda(event.target.value); setPacienteId(""); }} className={inputClass} /></label><label className="mt-2 block">Paciente<select required value={pacienteId} onChange={(event) => setPacienteId(event.target.value)} className={inputClass}><option value="">Seleccionar paciente</option>{encontrados.map((p) => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos} · {p.identificador || "Documento pendiente"}</option>)}</select></label><p className="mt-1 text-xs text-slate-500">Se muestran hasta 15 coincidencias. Escribe para acotar la búsqueda.</p></div> : <div className="grid gap-3 sm:grid-cols-2">
          <DocumentoCampos datos={datos} onChange={setDatos} />
          {[['nombres', 'Nombre o nombre de referencia', 'text'], ['apellidos', 'Apellidos (pueden quedar pendientes)', 'text'], ['identificador', 'Número de documento (puede quedar pendiente)', 'text'], ['fecha_nacimiento', 'Fecha de nacimiento (puede quedar pendiente)', 'date']].map(([key, label, type]) => <label key={key} className="text-sm">{label}<input type={type} required={key === "nombres"} max={type === "date" ? ahoraSantiago().fecha : undefined} value={datos[key]} onChange={(event) => cambiarDato(key, event.target.value)} className={inputClass} /></label>)}
          {rutInvalido && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 sm:col-span-2">El RUT chileno no es válido. Revisa el dígito verificador.</p>}
          {provisional && <p className="rounded-xl bg-amber-50 p-3 text-sm sm:col-span-2">Registro provisional: podrás completar los datos desde Pacientes.</p>}
          {duplicado && <button type="button" onClick={() => { setPacienteId(duplicado.id); setBusqueda(duplicado.identificador); setNuevo(false); }} className="rounded-xl bg-cyan-100 p-3 text-sm sm:col-span-2">Usar paciente existente: {duplicado.nombres} {duplicado.apellidos}</button>}
        </div>}
        <label className="block">Modalidad<select required value={horario.modalidad} onChange={(event) => cambiarHorario("modalidad", event.target.value)} className={inputClass}><option value="">Seleccionar modalidad</option><option value="online">Online</option><option value="presencial">Presencial</option><option value="domicilio">Domicilio</option></select></label>
        <div className="grid grid-cols-2 gap-3"><label>Fecha<input required type="date" value={horario.fecha} onChange={(event) => cambiarHorario("fecha", event.target.value)} className={inputClass} /></label><label>Hora de inicio<input required type="time" value={horario.hora_inicio} onChange={(event) => cambiarHorario("hora_inicio", event.target.value)} className={inputClass} /></label><label>Duración (minutos)<input required type="number" min="15" max="240" value={horario.duracion_minutos} onChange={(event) => cambiarHorario("duracion_minutos", Number(event.target.value))} className={inputClass} /></label></div>
        <p className="text-sm text-slate-500">Puedes atender sin disponibilidad publicada. El enlace o la dirección, el pago y los consentimientos pueden quedar pendientes. Su estado no se modificará.</p>
        {hayConflicto && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3"><p className="font-bold">Este intervalo coincide con otra cita o un evento externo.</p><label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmarConflicto} onChange={(event) => setConfirmarConflicto(event.target.checked)} />Atender de todas formas en este intervalo, sin modificar los otros eventos.</label></div>}
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {incierto && <p className="mt-3 text-sm">No se pudo confirmar el resultado. Reintenta la misma operación para recuperar la cita sin duplicarla.</p>}
      <button disabled={guardando || cargando || !!errorCarga} type="submit" className="mt-5 w-full rounded-xl bg-cyan-600 px-4 py-3 font-black text-white disabled:opacity-50">{guardando ? "Creando atención…" : incierto ? "Reintentar y abrir atención" : "Crear cita e iniciar atención"}</button>
    </form>
  </dialog>;
}
