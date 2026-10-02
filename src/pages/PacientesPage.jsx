import DocumentoCampos from "../components/DocumentoCampos";
import { documentoParaGuardar, errorDocumento, normalizarPasaporte } from "../../supabase/functions/_shared/documento.js";
import { normalizarRut } from "../utils/atencionRapida";
import React, { useEffect, useState } from "react";
import { actualizarPacienteApi, crearPacienteApi, obtenerPacientes, solicitarConsentimientosPaciente, obtenerConsentimientosPaciente } from "../lib/mentaliaApi";

function normalizarTelefonoChileno(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "";

  const digitos = texto.replace(/\D/g, "");

  if (/^569\d{8}$/.test(digitos)) return `+${digitos}`;
  if (/^9\d{8}$/.test(digitos)) return `+56${digitos}`;

  return texto;
}

function errorTelefonoChileno(valor, etiqueta = "teléfono") {
  const normalizado = normalizarTelefonoChileno(valor);
  if (!normalizado) return "";

  return /^\+569\d{8}$/.test(normalizado)
    ? ""
    : `El ${etiqueta} debe tener formato +56912345678.`;
}

function normalizarIdentificadorVisible(valor, tipo, pais) {
  if (tipo === "pasaporte") return normalizarPasaporte(valor);
  return valor;
}

export default function PacientesPage({ user, goBack, verFichaClinica }) {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [soloIncompletos, setSoloIncompletos] = useState(false);
  const [soloConsentimientosPendientes, setSoloConsentimientosPendientes] = useState(false);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [documento, setDocumento] = useState({ tipo_identificador: "", pais_emisor_identificador: "" });
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [genero, setGenero] = useState("");
  const [contactoUrgencia, setContactoUrgencia] = useState("");
  const [telefonoEmergencia, setTelefonoEmergencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensajeOperacion, setMensajeOperacion] = useState("");
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [pacienteEditando, setPacienteEditando] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({});
  const [mensajeEdicion, setMensajeEdicion] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [consentimientosPaciente, setConsentimientosPaciente] = useState(null);
  const [resumenConsentimientos, setResumenConsentimientos] = useState({});
  const [cargandoConsentimientos, setCargandoConsentimientos] = useState(false);

  async function solicitarConsentimientos(paciente) {
    setMensajeOperacion("");
    try {
      const resultado = await solicitarConsentimientosPaciente(paciente.id);
      if (resultado.enlace_token) {
        const enlace = `${window.location.origin}/consentimiento/${resultado.enlace_token}`;
        try { await navigator.clipboard.writeText(enlace); } catch { /* El enlace sigue disponible en el mensaje. */ }
        const estadoCorreo = resultado.notification_status === "enviado" ? "Correo enviado al paciente." : resultado.notification_status === "sin_correo" ? "El paciente no tiene correo registrado." : "No fue posible enviar el correo; utiliza el enlace copiado.";
        setMensajeOperacion(`Solicitud creada para ${paciente.nombres}. ${estadoCorreo} Enlace: ${enlace}`);
      }
      if (Array.isArray(resultado.consentimientos)) {
        const pendientes = resultado.consentimientos.filter(
          (item) => String(item?.estado || "").toLowerCase() === "pendiente",
        ).length;

        setResumenConsentimientos((actual) => ({
          ...actual,
          [paciente.id]: {
            total: resultado.consentimientos.length,
            pendientes,
          },
        }));
      }
    } catch (error) {
      setMensajeOperacion(error.message || "No fue posible crear la solicitud de consentimiento.");
    }
  }

  async function verConsentimientos(paciente) {
    try {
      const data = await obtenerConsentimientosPaciente(paciente.id);
      setConsentimientosPaciente({ paciente, items: data || [] });
    } catch (error) {
      setMensajeOperacion(error.message || "No fue posible cargar los consentimientos.");
    }
  }

  async function cargarPacientes() {
    try {
      const data = await obtenerPacientes();
      const pacientesCargados = data || [];
      setPacientes(pacientesCargados);
      cargarResumenConsentimientos(pacientesCargados);
    } catch (error) {
      alert(error.message || "No fue posible cargar los pacientes.");
    }
  }

  async function cargarResumenConsentimientos(pacientesBase) {
    const pacientesParaRevisar = (pacientesBase || []).slice(0, 50);
    setCargandoConsentimientos(true);

    try {
      const resultados = await Promise.allSettled(
        pacientesParaRevisar.map((paciente) =>
          obtenerConsentimientosPaciente(paciente.id),
        ),
      );

      const resumen = {};

      resultados.forEach((resultado, index) => {
        const paciente = pacientesParaRevisar[index];

        if (!paciente?.id || resultado.status !== "fulfilled") return;

        const items = Array.isArray(resultado.value) ? resultado.value : [];
        const pendientes = items.filter(
          (item) => String(item?.estado || "").toLowerCase() === "pendiente",
        ).length;

        resumen[paciente.id] = {
          total: items.length,
          pendientes,
        };
      });

      setResumenConsentimientos(resumen);
    } finally {
      setCargandoConsentimientos(false);
    }
  }

  async function crearPaciente() {
    setMensajeOperacion("");
    if (!nombres || !apellidos || !identificador) {
      setMensajeOperacion("Nombres, apellidos e identificador son obligatorios.");
      return;
    }

    const errorDoc = errorDocumento({ ...documento, identificador }, false);
    if (errorDoc) return setMensajeOperacion(errorDoc);
    const telefonoNormalizado = normalizarTelefonoChileno(telefono);
    const telefonoEmergenciaNormalizado =
      normalizarTelefonoChileno(telefonoEmergencia);
    const errorTelefono =
      errorTelefonoChileno(telefonoNormalizado) ||
      errorTelefonoChileno(
        telefonoEmergenciaNormalizado,
        "teléfono de emergencia",
      );
    if (errorTelefono) return setMensajeOperacion(errorTelefono);
    setGuardando(true);
    try {
      await crearPacienteApi({
        nombres,
        apellidos,
        ...documento,
        identificador: documentoParaGuardar(identificador, documento.tipo_identificador, documento.pais_emisor_identificador),
        email: email || null,
        telefono: telefonoNormalizado || null,
        fecha_nacimiento: fechaNacimiento || null,
        genero: genero || null,
        contacto_urgencia: contactoUrgencia || null,
        telefono_emergencia: telefonoEmergenciaNormalizado || null,
      });
    } catch (error) {
      if (error.code === "PATIENT_ALREADY_EXISTS") setMensajeOperacion("Ya existe un paciente con ese identificador.");
      else if (error.code === "AUTH_REQUIRED" || error.status === 401) setMensajeOperacion("Tu sesión expiró. Inicia sesión nuevamente.");
      else setMensajeOperacion(error.message || "No fue posible crear el paciente.");
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setNombres("");
    setApellidos("");
    setIdentificador("");
    setDocumento({ tipo_identificador: "", pais_emisor_identificador: "" });
    setEmail("");
    setTelefono("");
    setFechaNacimiento("");
    setGenero("");
    setContactoUrgencia("");
    setTelefonoEmergencia("");

    setMensajeOperacion("Paciente guardado correctamente.");
    setMostrarNuevo(false);
    await cargarPacientes();
  }

  function abrirFicha(paciente) {
    if (verFichaClinica) {
      verFichaClinica(paciente);
      return;
    }

    alert("Próximo paso: conectar FichaClinicaPage.jsx en App.jsx");
  }

  function abrirEdicion(paciente) {
    setPacienteEditando(paciente);
    setMensajeEdicion("");
    setDatosEdicion({ nombres: paciente.nombres || "", apellidos: paciente.apellidos || "", identificador: paciente.identificador || "", tipo_identificador: paciente.tipo_identificador || "", pais_emisor_identificador: paciente.pais_emisor_identificador || "", email: paciente.email || "", telefono: paciente.telefono || "", fecha_nacimiento: paciente.fecha_nacimiento?.slice(0, 10) || "", genero: paciente.genero || "", contacto_urgencia: paciente.contacto_urgencia || "", telefono_emergencia: paciente.telefono_emergencia || "" });
  }

  async function guardarEdicion() {
    if (!pacienteEditando) return;
    const errorDoc = errorDocumento(datosEdicion);
    const documentoCambio = datosEdicion.identificador !== pacienteEditando.identificador || (datosEdicion.tipo_identificador || null) !== pacienteEditando.tipo_identificador || (datosEdicion.pais_emisor_identificador || null) !== pacienteEditando.pais_emisor_identificador;
    if (errorDoc && documentoCambio) return setMensajeEdicion(errorDoc);
    const telefonoNormalizado = normalizarTelefonoChileno(datosEdicion.telefono);
    const telefonoEmergenciaNormalizado = normalizarTelefonoChileno(
      datosEdicion.telefono_emergencia,
    );
    const errorTelefono =
      errorTelefonoChileno(telefonoNormalizado) ||
      errorTelefonoChileno(
        telefonoEmergenciaNormalizado,
        "teléfono de emergencia",
      );
    if (errorTelefono) return setMensajeEdicion(errorTelefono);
    setGuardandoEdicion(true);
    setMensajeEdicion("");
    try {
      const actualizado = await actualizarPacienteApi(pacienteEditando.id, { ...datosEdicion, telefono: telefonoNormalizado || null, telefono_emergencia: telefonoEmergenciaNormalizado || null, identificador: documentoParaGuardar(datosEdicion.identificador, datosEdicion.tipo_identificador, datosEdicion.pais_emisor_identificador) });
      setPacientes((prev) => prev.map((p) => p.id === actualizado.id ? actualizado : p));
      setPacienteEditando(null);
    } catch (error) {
      setMensajeEdicion(error.message || "No fue posible actualizar el paciente.");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  useEffect(() => {
    cargarPacientes();
  }, []);

  function datosFaltantesPaciente(paciente) {
    const faltantes = [];

    if (!paciente?.identificador) faltantes.push("identificador");
    if (!paciente?.email) faltantes.push("correo");
    if (!paciente?.telefono) faltantes.push("teléfono");

    return faltantes;
  }

  const pacientesIncompletos = pacientes.filter(
    (p) => datosFaltantesPaciente(p).length > 0,
  );
  const pacientesConConsentimientosPendientes = pacientes.filter(
    (p) => (resumenConsentimientos[p.id]?.pendientes || 0) > 0,
  );

  const pacientesFiltrados = pacientes.filter((p) => {
    const texto = `${p.nombres || ""} ${p.apellidos || ""} ${
      p.identificador || ""
    } ${p.email || ""} ${p.telefono || ""}`.toLowerCase();

    const coincideBusqueda =
      texto.includes(busqueda.toLowerCase()) ||
      (!!normalizarRut(busqueda) &&
        normalizarRut(p.identificador).includes(normalizarRut(busqueda)));
    const coincideFiltroIncompletos =
      !soloIncompletos || datosFaltantesPaciente(p).length > 0;
    const coincideFiltroConsentimientos =
      !soloConsentimientosPendientes ||
      (resumenConsentimientos[p.id]?.pendientes || 0) > 0;

    return (
      coincideBusqueda &&
      coincideFiltroIncompletos &&
      coincideFiltroConsentimientos
    );
  });

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-7xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Pacientes</h1>
            <p className="text-sm text-slate-500">Busca, revisa y gestiona la información administrativa de tus pacientes.</p>
          </div>
          <button type="button" onClick={() => setMostrarNuevo((prev) => !prev)} className="rounded-xl bg-[#18AFC1] px-5 py-3 font-black text-white shadow-sm hover:bg-cyan-700">
            {mostrarNuevo ? "Cerrar formulario" : "+ Nuevo paciente"}
          </button>
        </div>

        {mostrarNuevo && <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 font-black">Nuevo paciente</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              placeholder="Nombres *"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Apellidos"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <DocumentoCampos datos={documento} onChange={setDocumento} />
            <input
              placeholder="Número de documento *"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              onBlur={() => setIdentificador(normalizarIdentificadorVisible(identificador, documento.tipo_identificador, documento.pais_emisor_identificador))}
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              placeholder="+56912345678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              onBlur={() => setTelefono(normalizarTelefonoChileno(telefono))}
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <select
              value={genero}
              onChange={(e) => setGenero(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="">Género</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
              <option value="prefiere_no_decir">Prefiere no decir</option>
            </select>

            <input
              placeholder="Contacto de urgencia"
              value={contactoUrgencia}
              onChange={(e) => setContactoUrgencia(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Teléfono emergencia +56912345678"
              value={telefonoEmergencia}
              onChange={(e) => setTelefonoEmergencia(e.target.value)}
              onBlur={() =>
                setTelefonoEmergencia(
                  normalizarTelefonoChileno(telefonoEmergencia),
                )
              }
              className="w-full rounded-xl border px-4 py-3 md:col-span-2"
            />
          </div>

          <button
            onClick={crearPaciente}
            disabled={guardando}
            className="mt-4 w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando paciente..." : "Guardar paciente"}
          </button>
          {mensajeOperacion && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              {mensajeOperacion}
            </p>
          )}
        </section>}

        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">Listado de pacientes</h2>
              <p className="text-sm text-slate-500">
                {pacientes.length} pacientes registrados · {pacientesIncompletos.length} con datos incompletos ·{" "}
                {cargandoConsentimientos
                  ? "revisando consentimientos..."
                  : `${pacientesConConsentimientosPendientes.length} con consentimientos pendientes`}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <button
                type="button"
                onClick={() => setSoloIncompletos((prev) => !prev)}
                className={`rounded-xl border px-4 py-3 text-sm font-black transition ${
                  soloIncompletos
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                }`}
              >
                {soloIncompletos ? "Ver todos" : "Ver incompletos"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setSoloConsentimientosPendientes((prev) => !prev)
                }
                className={`rounded-xl border px-4 py-3 text-sm font-black transition ${
                  soloConsentimientosPendientes
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                }`}
              >
                {soloConsentimientosPendientes
                  ? "Ver todos"
                  : "Ver consentimientos pendientes"}
              </button>

              <input
                placeholder="Buscar por nombre, RUT, correo o teléfono"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 md:w-80"
              />
            </div>
          </div>

          {pacientesFiltrados.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-500">
              No hay pacientes para mostrar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-3 text-left">
                <thead>
                  <tr className="text-sm text-slate-500">
                    <th className="px-4">Paciente</th>
                    <th className="px-4">Identificador</th>
                    <th className="px-4">Contacto</th>
                    <th className="px-4">Estado administrativo</th>
                    <th className="px-4 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {pacientesFiltrados.map((p) => {
                    const faltantes = datosFaltantesPaciente(p);
                    const incompleto = faltantes.length > 0;
                    const consentimientosPendientes =
                      resumenConsentimientos[p.id]?.pendientes || 0;

                    return (
                    <tr key={p.id} className={`rounded-xl ${incompleto || consentimientosPendientes ? "bg-amber-50/70" : "bg-slate-50"}`}>
                      <td className="rounded-l-xl px-4 py-4">
                        <p className="font-black text-slate-800">
                          {p.nombres} {p.apellidos}{p.registro_provisional && <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">Provisional · datos pendientes</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.genero || "Sin género registrado"}
                        </p>
                        {incompleto && (
                          <p className="mt-1 text-xs font-bold text-amber-700">
                            Faltan: {faltantes.join(", ")}
                          </p>
                        )}
                        {consentimientosPendientes > 0 && (
                          <p className="mt-1 text-xs font-bold text-amber-700">
                            {consentimientosPendientes} consentimiento(s) pendiente(s)
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {p.identificador || <span className="font-bold text-amber-700">Sin identificador</span>}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        <p>{p.email || <span className="font-bold text-amber-700">Sin correo</span>}</p>
                        <p>{p.telefono || <span className="font-bold text-amber-700">Sin teléfono</span>}</p>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${
                          incompleto || consentimientosPendientes
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {incompleto
                            ? "Datos pendientes"
                            : consentimientosPendientes
                              ? "Consentimientos pendientes"
                              : "Activo"}
                        </span>
                      </td>

                      <td className="rounded-r-xl px-4 py-4 align-middle">
                        <div className="grid min-w-[300px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                        <button type="button" onClick={() => abrirEdicion(p)} className={`rounded-xl border px-3 py-2 text-sm font-black hover:bg-cyan-50 ${
                          incompleto
                            ? "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-50"
                            : "border-cyan-200 bg-white text-cyan-700"
                        }`}>
                          {incompleto ? "Completar datos" : "Ver / editar datos"}
                        </button>
                        <button
                          onClick={() => abrirFicha(p)}
                          className="rounded-xl bg-[#18AFC1] px-4 py-2 text-sm font-black text-white"
                        >
                          Ver ficha clínica
                        </button>
                        <button type="button" onClick={() => verConsentimientos(p)} className={`col-span-2 justify-self-end rounded-xl border px-3 py-2 text-sm font-black ${
                          consentimientosPendientes
                            ? "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-50"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}>
                          {consentimientosPendientes ? "Revisar consentimientos" : "Ver consentimientos"}
                        </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {pacienteEditando && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black text-slate-900">Datos del paciente</h2><p className="text-sm text-slate-500">Revisa o actualiza los datos. Si el registro es provisional, puedes completarlos por etapas.</p></div><button type="button" onClick={() => setPacienteEditando(null)} className="rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-600">Cerrar</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><input value={datosEdicion.nombres || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, nombres: e.target.value }))} placeholder="Nombres *" className="rounded-xl border px-4 py-3" /><input value={datosEdicion.apellidos || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, apellidos: e.target.value }))} placeholder="Apellidos" className="rounded-xl border px-4 py-3" /><DocumentoCampos datos={datosEdicion} onChange={setDatosEdicion} /><input value={datosEdicion.identificador || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, identificador: e.target.value }))} onBlur={() => setDatosEdicion((prev) => ({ ...prev, identificador: normalizarIdentificadorVisible(prev.identificador, prev.tipo_identificador, prev.pais_emisor_identificador) }))} placeholder="Número de documento" className="rounded-xl border px-4 py-3" /><input type="email" value={datosEdicion.email || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, email: e.target.value }))} placeholder="Correo electrónico" className="rounded-xl border px-4 py-3" /><input value={datosEdicion.telefono || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, telefono: e.target.value }))} placeholder="Teléfono" className="rounded-xl border px-4 py-3" /><input type="date" value={datosEdicion.fecha_nacimiento || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, fecha_nacimiento: e.target.value }))} aria-label="Fecha de nacimiento" className="rounded-xl border px-4 py-3" /><select value={datosEdicion.genero || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, genero: e.target.value }))} aria-label="Género" className="rounded-xl border px-4 py-3"><option value="">Género</option><option value="femenino">Femenino</option><option value="masculino">Masculino</option><option value="otro">Otro</option><option value="prefiere_no_decir">Prefiere no decir</option></select><input value={datosEdicion.contacto_urgencia || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, contacto_urgencia: e.target.value }))} placeholder="Contacto de urgencia" className="rounded-xl border px-4 py-3" /><input value={datosEdicion.telefono_emergencia || ""} onChange={(e) => setDatosEdicion((prev) => ({ ...prev, telefono_emergencia: e.target.value }))} placeholder="Teléfono de emergencia" className="rounded-xl border px-4 py-3" /></div>{mensajeEdicion && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{mensajeEdicion}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setPacienteEditando(null)} className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">Cancelar</button><button type="button" onClick={guardarEdicion} disabled={guardandoEdicion} className="rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white disabled:opacity-50">{guardandoEdicion ? "Guardando..." : "Guardar cambios"}</button></div></div></div>}
        {consentimientosPaciente && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-2xl font-black text-slate-900">Consentimientos</h2><p className="text-sm text-slate-500">{consentimientosPaciente.paciente.nombres} {consentimientosPaciente.paciente.apellidos}</p></div><button type="button" onClick={() => setConsentimientosPaciente(null)} className="rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-600">Cerrar</button></div><div className="mt-5 space-y-3">{consentimientosPaciente.items.length ? consentimientosPaciente.items.map((item) => { const estado = item.estado || "pendiente"; const color = estado === "aceptado" ? "border-emerald-200 bg-emerald-50" : estado === "rechazado" || estado === "revocado" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"; const badge = estado === "aceptado" ? "bg-emerald-100 text-emerald-800" : estado === "rechazado" || estado === "revocado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"; return <div key={item.codigo} className={`flex items-center justify-between rounded-2xl border p-4 ${color}`}><div><p className="font-black text-slate-800">{item.consentimiento_tipos?.titulo || item.codigo}</p><p className="text-xs text-slate-500">Última respuesta: {item.respondido_en ? new Date(item.respondido_en).toLocaleString("es-CL") : "Sin respuesta"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${badge}`}>{estado}</span></div>; }) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aún no hay consentimientos registrados.</p>}</div><button type="button" onClick={() => { solicitarConsentimientos(consentimientosPaciente.paciente); setConsentimientosPaciente(null); }} className="mt-5 w-full rounded-xl bg-cyan-600 px-4 py-3 font-black text-white">Solicitar aprobación por correo</button></div></div>}
      </div>
    </main>
  );
}
