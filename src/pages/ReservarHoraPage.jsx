import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const CANALES_CONTACTO = ["WhatsApp", "Correo electrónico", "Teléfono"];

function obtenerInicioSemana(fechaBase = new Date()) {
  const fecha = new Date(fechaBase);
  fecha.setHours(0, 0, 0, 0);

  const dia = fecha.getDay();
  const diferencia = dia === 0 ? -6 : 1 - dia;
  fecha.setDate(fecha.getDate() + diferencia);

  return fecha;
}

function sumarDias(fecha, dias) {
  const nueva = new Date(fecha);
  nueva.setDate(nueva.getDate() + dias);
  return nueva;
}

function formatearFechaISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function normalizarHora(hora) {
  return (hora || "").slice(0, 5);
}

function normalizarTexto(texto) {
  return (texto || "").trim();
}

function obtenerSlugDesdeUrl() {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  const slugQuery =
    url.searchParams.get("slug") ||
    url.searchParams.get("profesional") ||
    url.searchParams.get("profesional_slug");

  if (slugQuery) return decodeURIComponent(slugQuery).trim().toLowerCase();

  const partes = url.pathname.split("/").filter(Boolean);
  const indiceReservar = partes.findIndex((parte) => parte === "reservar");

  if (indiceReservar >= 0 && partes[indiceReservar + 1]) {
    return decodeURIComponent(partes[indiceReservar + 1]).trim().toLowerCase();
  }

  return "";
}

function obtenerProfesionalIdDesdeUrl() {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);

  return (
    url.searchParams.get("profesional_id") ||
    url.searchParams.get("id_profesional") ||
    ""
  ).trim();
}

function formatearNombreProfesional(profesional) {
  return `${profesional?.nombres || ""} ${profesional?.apellidos || ""}`.trim();
}

function formatearRangoSemana(diasSemana) {
  const primero = diasSemana?.[0]?.fecha;
  const ultimo = diasSemana?.[6]?.fecha;

  if (!primero || !ultimo) return "";

  const inicio = new Date(`${primero}T00:00:00`);
  const fin = new Date(`${ultimo}T00:00:00`);

  return `${inicio.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  })} - ${fin.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

function formatearFechaLarga(fechaISO) {
  const fecha = new Date(`${fechaISO}T00:00:00`);

  return fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function calcularHoraFin(hora, minutos) {
  const [h, m] = normalizarHora(hora).split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) return "";

  const date = new Date();
  date.setHours(h, m + Number(minutos), 0, 0);

  return date.toTimeString().slice(0, 5);
}

function generarSlots(horaInicio, horaFin, duracion) {
  const slots = [];

  const [hi, mi] = normalizarHora(horaInicio).split(":").map(Number);
  const [hf, mf] = normalizarHora(horaFin).split(":").map(Number);

  if (
    Number.isNaN(hi) ||
    Number.isNaN(mi) ||
    Number.isNaN(hf) ||
    Number.isNaN(mf) ||
    !duracion ||
    Number(duracion) <= 0
  ) {
    return slots;
  }

  const inicio = new Date();
  inicio.setHours(hi, mi, 0, 0);

  const fin = new Date();
  fin.setHours(hf, mf, 0, 0);

  let actual = new Date(inicio);

  while (actual < fin) {
    const siguiente = new Date(actual.getTime() + Number(duracion) * 60000);

    if (siguiente <= fin) {
      slots.push(actual.toTimeString().slice(0, 5));
    }

    actual = siguiente;
  }

  return slots;
}

function horariosSeCruzan(inicioA, finA, inicioB, finB) {
  return inicioA < finB && finA > inicioB;
}

function fechaHoraEsPasada(fecha, hora) {
  const ahora = new Date();
  const fechaHora = new Date(`${fecha}T${hora}:00`);
  return fechaHora <= ahora;
}

function fechaDentroDeRegla(fechaISO, regla) {
  if (regla.fecha_inicio && fechaISO < regla.fecha_inicio) return false;
  if (regla.fecha_fin && fechaISO > regla.fecha_fin) return false;
  return true;
}

function limpiarRut(rut) {
  return String(rut || "")
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
}

function formatearRutChileno(valor) {
  const limpio = limpiarRut(valor);
  if (!limpio) return "";

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  if (!cuerpo) return dv;

  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoConPuntos}-${dv}`;
}

function validarRutChileno(rut) {
  const limpio = limpiarRut(rut);

  if (limpio.length < 2) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  if (!/^\d+$/.test(cuerpo)) return false;
  if (!/^[0-9K]$/.test(dv)) return false;

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const resultado = 11 - resto;
  const dvEsperado = resultado === 11 ? "0" : resultado === 10 ? "K" : String(resultado);

  return dv === dvEsperado;
}

function validarEmail(email) {
  const valor = normalizarTexto(email).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
}

function normalizarTelefonoChileno(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");

  if (digitos.startsWith("569") && digitos.length === 11) {
    return `+${digitos}`;
  }

  if (digitos.startsWith("9") && digitos.length === 9) {
    return `+56${digitos}`;
  }

  if (digitos.startsWith("56") && digitos.length === 11) {
    return `+${digitos}`;
  }

  return valor;
}

function validarCelularChileno(valor) {
  const normalizado = normalizarTelefonoChileno(valor);
  return /^\+569\d{8}$/.test(normalizado);
}

function obtenerMensajeErrorRut(rut) {
  if (!normalizarTexto(rut)) return "El RUT es obligatorio.";
  if (!validarRutChileno(rut)) return "Ingresa un RUT chileno válido. Ejemplo: 12.345.678-K.";
  return "";
}

export default function ReservarHoraPage({
  profesionalId: profesionalIdProp,
  slug: slugProp,
  goBack,
  onReservaExitosa,
}) {
  const [profesional, setProfesional] = useState(null);
  const [profesionalId, setProfesionalId] = useState(profesionalIdProp || "");
  const [slugPublico, setSlugPublico] = useState(slugProp || "");
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [reservasOcupadas, setReservasOcupadas] = useState([]);

  const [fechaInicioSemana, setFechaInicioSemana] = useState(() =>
    obtenerInicioSemana()
  );
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  const [paso, setPaso] = useState("horario");
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [error, setError] = useState("");
  const [reservando, setReservando] = useState(false);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [pacienteEncontrado, setPacienteEncontrado] = useState(false);
  const rutActualRef = useRef("");

  const [identificador, setIdentificador] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [primeraAtencion, setPrimeraAtencion] = useState("si");
  const [canalContacto, setCanalContacto] = useState("WhatsApp");
  const [aceptaCondiciones, setAceptaCondiciones] = useState(false);

  const [erroresFormulario, setErroresFormulario] = useState({});
  const [reservaConfirmada, setReservaConfirmada] = useState(null);

  const semana = useMemo(() => {
    return DIAS.map((dia, index) => {
      const fecha = sumarDias(fechaInicioSemana, index);

      return {
        dia,
        dia_semana: index + 1,
        fecha: formatearFechaISO(fecha),
        etiqueta: fecha.toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "short",
        }),
      };
    });
  }, [fechaInicioSemana]);

  const slotsPorFecha = useMemo(() => {
    const mapa = new Map();

    semana.forEach((dia) => {
      mapa.set(dia.fecha, obtenerSlotsDelDia(dia));
    });

    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana, disponibilidad, reservasOcupadas, profesional]);

  const diasConSlots = useMemo(() => {
    return semana.map((dia) => ({
      ...dia,
      slots: slotsPorFecha.get(dia.fecha) || [],
    }));
  }, [semana, slotsPorFecha]);

  const slotsDiaSeleccionado = fechaSeleccionada
    ? slotsPorFecha.get(fechaSeleccionada) || []
    : [];

  useEffect(() => {
    const slugUrl = obtenerSlugDesdeUrl();
    const idUrl = obtenerProfesionalIdDesdeUrl();

    const slugFinal = (slugProp || slugUrl || "").trim().toLowerCase();
    const idFinal = (profesionalIdProp || idUrl || "").trim();

    setSlugPublico(slugFinal);
    setProfesionalId(idFinal);

    cargarPerfilPublico({ slugFinal, idFinal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesionalIdProp, slugProp]);

  useEffect(() => {
    if (!profesionalId) return;
    cargarDisponibilidadPublica(profesionalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesionalId, fechaInicioSemana]);

  useEffect(() => {
    if (!fechaSeleccionada) {
      const primerDiaDisponible = diasConSlots.find((dia) => dia.slots.length > 0);
      if (primerDiaDisponible) setFechaSeleccionada(primerDiaDisponible.fecha);
    }
  }, [diasConSlots, fechaSeleccionada]);

  async function cargarPerfilPublico({ slugFinal, idFinal }) {
    setCargandoPerfil(true);
    setError("");

    try {
      let query = supabase
        .from("v_profesionales_reserva_publica")
        .select("*")
        .eq("reserva_publica_activa", true);

      if (slugFinal) {
        query = query.eq("slug_publico", slugFinal);
      } else if (idFinal) {
        query = query.eq("id", idFinal);
      } else {
        setProfesional(null);
        setError("No se encontró el identificador público del profesional.");
        return;
      }

      const { data, error: perfilError } = await query.maybeSingle();

      if (perfilError) throw perfilError;

      if (!data) {
        setProfesional(null);
        setError("El enlace de reserva no existe o no está activo.");
        return;
      }

      setProfesional(data);
      setProfesionalId(data.id);
      setSlugPublico(data.slug_publico || slugFinal);
    } catch (err) {
      console.error("Error cargando perfil público:", err);
      setError(`No fue posible cargar el perfil público: ${err.message}`);
    } finally {
      setCargandoPerfil(false);
    }
  }

  async function cargarDisponibilidadPublica(idProfesional) {
    if (!idProfesional) return;

    setCargandoDisponibilidad(true);
    setError("");

    try {
      const fechaInicio = semana?.[0]?.fecha;
      const fechaFin = semana?.[6]?.fecha;

      const { data: disp, error: dispError } = await supabase
        .from("v_disponibilidad_reserva_publica")
        .select("*")
        .eq("profesional_id", idProfesional)
        .eq("activo", true)
        .lte("fecha_inicio", fechaFin)
        .gte("fecha_fin", fechaInicio)
        .order("dia_semana", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (dispError) throw dispError;

      const { data: ocupadas, error: ocupadasError } = await supabase
        .from("v_reservas_ocupadas_publicas")
        .select("*")
        .eq("profesional_id", idProfesional)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);

      if (ocupadasError) throw ocupadasError;

      setDisponibilidad(disp || []);
      setReservasOcupadas(ocupadas || []);
    } catch (err) {
      console.error("Error cargando disponibilidad pública:", err);
      setError(`No fue posible cargar la disponibilidad pública: ${err.message}`);
      setDisponibilidad([]);
      setReservasOcupadas([]);
    } finally {
      setCargandoDisponibilidad(false);
    }
  }

  function estaOcupado(fecha, hora, duracion) {
    const horaFinSlot = calcularHoraFin(hora, duracion);

    return reservasOcupadas.some((reserva) => {
      if (reserva.fecha !== fecha) return false;

      const estado = String(reserva.estado || "").toLowerCase();
      if (estado === "cancelada" || estado === "cancelado") return false;

      const inicioReserva = normalizarHora(reserva.hora_inicio);
      const finReserva = normalizarHora(reserva.hora_fin);

      if (!inicioReserva || !finReserva) return false;

      return horariosSeCruzan(hora, horaFinSlot, inicioReserva, finReserva);
    });
  }

  function obtenerSlotsDelDia(dia) {
    const bloquesDia = disponibilidad.filter((bloque) => {
      return (
        Number(bloque.dia_semana) === Number(dia.dia_semana) &&
        fechaDentroDeRegla(dia.fecha, bloque)
      );
    });

    const slots = [];

    bloquesDia.forEach((bloque) => {
      const duracion =
        Number(bloque.duracion_minutos) ||
        Number(profesional?.duracion_sesion_minutos) ||
        50;

      const horas = generarSlots(bloque.hora_inicio, bloque.hora_fin, duracion);

      horas.forEach((hora) => {
        const pasado = fechaHoraEsPasada(dia.fecha, hora);
        const ocupado = estaOcupado(dia.fecha, hora, duracion);
        const horaFin = calcularHoraFin(hora, duracion);

        if (!pasado && !ocupado) {
          slots.push({
            bloque_id: bloque.id,
            fecha: dia.fecha,
            hora,
            hora_fin: horaFin,
            duracion,
            dia: dia.dia,
          });
        }
      });
    });

    const unicos = new Map();
    slots.forEach((slot) => {
      const clave = `${slot.fecha}-${slot.hora}-${slot.hora_fin}`;
      unicos.set(clave, slot);
    });

    return Array.from(unicos.values()).sort((a, b) => a.hora.localeCompare(b.hora));
  }

  function seleccionarSlot(slot) {
    setSlotSeleccionado(slot);
    setPaso("datos");
    setErroresFormulario({});
  }

  function semanaAnterior() {
    setSlotSeleccionado(null);
    setFechaSeleccionada(null);
    setFechaInicioSemana((prev) => sumarDias(prev, -7));
    setPaso("horario");
  }

  function semanaSiguiente() {
    setSlotSeleccionado(null);
    setFechaSeleccionada(null);
    setFechaInicioSemana((prev) => sumarDias(prev, 7));
    setPaso("horario");
  }

  function volverAHoy() {
    setSlotSeleccionado(null);
    setFechaSeleccionada(null);
    setFechaInicioSemana(obtenerInicioSemana());
    setPaso("horario");
  }

  function limpiarDatosPacientePorCambioRut() {
    setNombres("");
    setApellidos("");
    setEmail("");
    setTelefono("");
    setPacienteEncontrado(false);

    setErroresFormulario((prev) => ({
      ...prev,
      nombres: "",
      apellidos: "",
      email: "",
      telefono: "",
    }));
  }

  async function buscarPacientePorRut(rutFormateado) {
    const rutConsulta = formatearRutChileno(rutFormateado);
    const rutError = obtenerMensajeErrorRut(rutConsulta);

    if (rutError || !slugPublico) {
      console.warn("No se busca paciente por RUT:", {
        rutError,
        slugPublico,
        rutConsulta,
      });
      return;
    }

    rutActualRef.current = rutConsulta;
    setBuscandoPaciente(true);
    setPacienteEncontrado(false);

    try {
      console.log("Buscando paciente por RUT:", {
        p_slug_publico: slugPublico,
        p_rut: rutConsulta,
      });

      const { data, error: rpcError } = await supabase.rpc(
        "buscar_paciente_publico_por_rut",
        {
          p_slug_publico: slugPublico,
          p_rut: rutConsulta,
        }
      );

      console.log("Respuesta buscar_paciente_publico_por_rut:", {
        data,
        rpcError,
      });

      if (rpcError) throw rpcError;

      if (rutActualRef.current !== rutConsulta) {
        console.warn("Se descartó respuesta de RUT antiguo:", {
          rutConsulta,
          rutActual: rutActualRef.current,
        });
        return;
      }

      const paciente = Array.isArray(data) ? data[0] : null;

      if (paciente) {
        setNombres(paciente.nombres || "");
        setApellidos(paciente.apellidos || "");
        setEmail(paciente.email || "");
        setTelefono(paciente.telefono || "");
        setPacienteEncontrado(true);

        setErroresFormulario((prev) => ({
          ...prev,
          identificador: "",
          nombres: "",
          apellidos: "",
          email: "",
          telefono: "",
        }));
      } else {
        limpiarDatosPacientePorCambioRut();
        setPacienteEncontrado(false);
      }
    } catch (err) {
      console.error("Error buscando paciente por RUT:", err);

      setErroresFormulario((prev) => ({
        ...prev,
        identificador:
          "No se pudo buscar el paciente. Puedes continuar ingresando los datos manualmente.",
      }));
    } finally {
      if (rutActualRef.current === rutConsulta) {
        setBuscandoPaciente(false);
      }
    }
  }

  function manejarCambioRut(valor) {
    const formateado = formatearRutChileno(valor);

    rutActualRef.current = formateado;
    setIdentificador(formateado);
    limpiarDatosPacientePorCambioRut();

    setErroresFormulario((prev) => ({
      ...prev,
      identificador: "",
    }));
  }

  function manejarBlurRut() {
    const rutFormateado = formatearRutChileno(identificador);

    rutActualRef.current = rutFormateado;
    setIdentificador(rutFormateado);

    const rutError = obtenerMensajeErrorRut(rutFormateado);

    if (rutError) {
      limpiarDatosPacientePorCambioRut();

      setErroresFormulario((prev) => ({
        ...prev,
        identificador: rutError,
      }));
      return;
    }

    setErroresFormulario((prev) => ({
      ...prev,
      identificador: "",
    }));

    buscarPacientePorRut(rutFormateado);
  }

  function validarFormulario() {
    const errores = {};

    const rutFormateado = formatearRutChileno(identificador);
    const rutError = obtenerMensajeErrorRut(rutFormateado);
    if (rutError) errores.identificador = rutError;

    if (!normalizarTexto(nombres)) errores.nombres = "Ingresa tu nombre.";
    if (!normalizarTexto(apellidos)) errores.apellidos = "Ingresa tu apellido.";

    if (!normalizarTexto(email)) {
      errores.email = "Ingresa tu correo electrónico.";
    } else if (!validarEmail(email)) {
      errores.email = "Ingresa un correo electrónico válido.";
    }

    if (!normalizarTexto(telefono)) {
      errores.telefono = "Ingresa tu celular.";
    } else if (!validarCelularChileno(telefono)) {
      errores.telefono = "Ingresa un celular chileno válido. Ejemplo: +56912345678.";
    }

    if (!aceptaCondiciones) {
      errores.aceptaCondiciones = "Debes aceptar las condiciones generales de reserva.";
    }

    setErroresFormulario(errores);

    return Object.keys(errores).length === 0;
  }

  async function confirmarReserva() {
    if (!slotSeleccionado) {
      setPaso("horario");
      return;
    }

    if (!validarFormulario()) return;

    setReservando(true);
    setError("");

    const rutFormateado = formatearRutChileno(identificador);
    const telefonoNormalizado = normalizarTelefonoChileno(telefono);

    try {
      const { data, error: reservaError } = await supabase.rpc(
        "reservar_hora_publica",
        {
          p_slug_publico: slugPublico,
          p_fecha: slotSeleccionado.fecha,
          p_hora_inicio: slotSeleccionado.hora,
          p_hora_fin: slotSeleccionado.hora_fin,
          p_nombres: normalizarTexto(nombres),
          p_apellidos: normalizarTexto(apellidos),
          p_email: normalizarTexto(email).toLowerCase(),
          p_telefono: telefonoNormalizado,
          p_identificador: rutFormateado,
          p_primera_atencion: primeraAtencion || null,
          p_canal_contacto: canalContacto,
        }
      );

      if (reservaError) throw reservaError;

      const resultado = Array.isArray(data) ? data[0] : data;

      setReservaConfirmada({
        ...resultado,
        slot: slotSeleccionado,
        paciente: {
          nombres: normalizarTexto(nombres),
          apellidos: normalizarTexto(apellidos),
          identificador: rutFormateado,
          email: normalizarTexto(email).toLowerCase(),
          telefono: telefonoNormalizado,
        },
      });

      setPaso("confirmacion");

      if (typeof onReservaExitosa === "function") {
        onReservaExitosa(resultado);
      }

      await cargarDisponibilidadPublica(profesionalId);
    } catch (err) {
      console.error("Error confirmando reserva:", err);
      setError(err.message || "No fue posible confirmar la reserva.");
    } finally {
      setReservando(false);
    }
  }

  const nombreProfesional = formatearNombreProfesional(profesional);

  return (
    <main className="min-h-screen bg-[#eef8fb] px-4 py-5 text-slate-800 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {goBack && (
          <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
            ← Volver
          </button>
        )}

        <header className="mb-5 rounded-[28px] bg-white p-5 shadow lg:p-7">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-700">
            Reserva pública FluyePro
          </p>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 lg:text-5xl">
                Reserva tu hora
              </h1>

              {cargandoPerfil ? (
                <p className="mt-3 text-slate-600">Cargando profesional...</p>
              ) : error && !profesional ? (
                <p className="mt-3 rounded-2xl bg-red-50 p-4 font-bold text-red-700">
                  {error}
                </p>
              ) : (
                <>
                  <h2 className="mt-3 text-xl font-black text-slate-900">
                    {nombreProfesional || "Profesional"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {profesional?.especialidad_publica || profesional?.profesion || "Salud mental"}
                    {" · "}
                    {profesional?.modalidad_atencion || "Online"}
                    {" · "}
                    {profesional?.duracion_sesion_minutos || 50} min
                  </p>
                </>
              )}
            </div>

            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              Solo datos administrativos. Sin contenido clínico.
            </div>
          </div>
        </header>

        {error && profesional && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {profesional && paso !== "confirmacion" && (
          <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-cyan-100 p-1 text-sm font-black">
            <button
              type="button"
              onClick={() => setPaso("horario")}
              className={`rounded-xl py-2 ${paso === "horario" ? "bg-white text-cyan-800" : "text-slate-500"}`}
            >
              1. Horario
            </button>
            <button
              type="button"
              onClick={() => slotSeleccionado && setPaso("datos")}
              className={`rounded-xl py-2 ${paso === "datos" ? "bg-white text-cyan-800" : "text-slate-500"}`}
            >
              2. Datos
            </button>
            <button
              type="button"
              disabled
              className="rounded-xl py-2 text-slate-400"
            >
              3. Confirmar
            </button>
          </div>
        )}

        {profesional && paso === "horario" && (
          <section className="rounded-[28px] bg-white p-5 shadow lg:p-7">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">Elige un horario</h2>
                <p className="text-sm text-slate-500">
                  Semana {formatearRangoSemana(semana)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={semanaAnterior}
                  className="rounded-xl border border-cyan-100 px-3 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
                >
                  ← Semana anterior
                </button>
                <button
                  onClick={volverAHoy}
                  className="rounded-xl border border-cyan-100 px-3 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
                >
                  Hoy
                </button>
                <button
                  onClick={semanaSiguiente}
                  className="rounded-xl border border-cyan-100 px-3 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
                >
                  Semana siguiente →
                </button>
              </div>
            </div>

            {cargandoDisponibilidad ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">
                Cargando disponibilidad...
              </p>
            ) : disponibilidad.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">
                Este profesional aún no tiene disponibilidad pública configurada.
              </p>
            ) : (
              <>
                <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                  {diasConSlots.map((dia) => {
                    const activo = fechaSeleccionada === dia.fecha;
                    return (
                      <button
                        key={dia.fecha}
                        type="button"
                        onClick={() => setFechaSeleccionada(dia.fecha)}
                        className={`min-w-[92px] rounded-2xl px-3 py-3 text-center font-black ${
                          activo
                            ? "bg-[#18AFC1] text-white shadow"
                            : "border border-cyan-100 bg-white text-cyan-700"
                        }`}
                      >
                        <span className="block text-xs">{dia.dia.slice(0, 3)}</span>
                        <span className="block text-sm">{dia.etiqueta}</span>
                        <span className="mt-1 block text-[11px] opacity-80">
                          {dia.slots.length} hrs
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-400">
                    Horas disponibles
                  </h3>

                  {slotsDiaSeleccionado.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      No hay horarios disponibles para este día.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {slotsDiaSeleccionado.map((slot) => {
                        const activo =
                          slotSeleccionado?.fecha === slot.fecha &&
                          slotSeleccionado?.hora === slot.hora;

                        return (
                          <button
                            key={`${slot.fecha}-${slot.hora}-${slot.hora_fin}`}
                            type="button"
                            onClick={() => seleccionarSlot(slot)}
                            className={`rounded-2xl px-4 py-4 text-left font-black ${
                              activo
                                ? "bg-[#18AFC1] text-white shadow"
                                : "border border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                            }`}
                          >
                            <span className="block text-lg">{slot.hora}</span>
                            <span className="text-xs opacity-80">
                              hasta {slot.hora_fin}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {profesional && paso === "datos" && slotSeleccionado && (
          <section className="rounded-[28px] bg-white p-5 shadow lg:p-7">
            <div className="mb-5 rounded-2xl bg-cyan-50 p-4 text-sm">
              <p className="font-black text-cyan-700">Horario seleccionado</p>
              <p className="mt-1 capitalize text-slate-700">
                {formatearFechaLarga(slotSeleccionado.fecha)}
              </p>
              <p className="font-black text-slate-900">
                {slotSeleccionado.hora} - {slotSeleccionado.hora_fin}
              </p>
            </div>

            <h2 className="text-2xl font-black">Tus datos</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">
              Ingresa primero tu RUT. Si ya eres paciente, completaremos tus datos administrativos guardados.
            </p>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-black text-slate-700">
                  RUT chileno *
                </span>
                <input
                  placeholder="12.345.678-K"
                  value={identificador}
                  onChange={(e) => manejarCambioRut(e.target.value)}
                  onBlur={manejarBlurRut}
                  className={`w-full rounded-xl border px-4 py-3 uppercase outline-cyan-400 ${
                    erroresFormulario.identificador ? "border-red-300 bg-red-50" : ""
                  }`}
                />
                {buscandoPaciente && (
                  <p className="mt-1 text-xs font-bold text-cyan-700">
                    Buscando paciente...
                  </p>
                )}
                {pacienteEncontrado && (
                  <p className="mt-1 text-xs font-bold text-emerald-700">
                    Encontramos tus datos administrativos guardados.
                  </p>
                )}
                {erroresFormulario.identificador && (
                  <p className="mt-1 text-xs font-bold text-red-600">
                    {erroresFormulario.identificador}
                  </p>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <CampoTexto
                  label="Nombre *"
                  value={nombres}
                  onChange={setNombres}
                  error={erroresFormulario.nombres}
                />
                <CampoTexto
                  label="Apellido *"
                  value={apellidos}
                  onChange={setApellidos}
                  error={erroresFormulario.apellidos}
                />
              </div>

              <CampoTexto
                label="Correo electrónico *"
                type="email"
                value={email}
                onChange={setEmail}
                error={erroresFormulario.email}
                placeholder="nombre@correo.cl"
              />

              <CampoTexto
                label="Celular chileno *"
                value={telefono}
                onChange={(valor) => setTelefono(normalizarTelefonoChileno(valor))}
                onBlur={() => setTelefono(normalizarTelefonoChileno(telefono))}
                error={erroresFormulario.telefono}
                placeholder="+56912345678"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-black text-slate-700">
                    Canal preferido
                  </span>
                  <select
                    value={canalContacto}
                    onChange={(e) => setCanalContacto(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                  >
                    {CANALES_CONTACTO.map((canal) => (
                      <option key={canal} value={canal}>
                        {canal}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-black text-slate-700">
                    ¿Es primera atención?
                  </span>
                  <select
                    value={primeraAtencion}
                    onChange={(e) => setPrimeraAtencion(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                  >
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={aceptaCondiciones}
                  onChange={(e) => setAceptaCondiciones(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Acepto las condiciones generales de reserva. Entiendo que esta página no solicita información clínica sensible.
                </span>
              </label>
              {erroresFormulario.aceptaCondiciones && (
                <p className="text-xs font-bold text-red-600">
                  {erroresFormulario.aceptaCondiciones}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setPaso("horario")}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50"
                >
                  Cambiar horario
                </button>
                <button
                  type="button"
                  onClick={confirmarReserva}
                  disabled={reservando}
                  className="flex-1 rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reservando ? "Reservando..." : "Confirmar reserva"}
                </button>
              </div>
            </div>
          </section>
        )}

        {paso === "confirmacion" && reservaConfirmada && (
          <section className="rounded-[28px] bg-white p-6 text-center shadow lg:p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              ✓
            </div>
            <h2 className="text-3xl font-black text-slate-950">
              Reserva recibida
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Tu solicitud fue registrada correctamente. La reserva queda sujeta a confirmación operativa del profesional.
            </p>
            <div className="mx-auto mt-6 max-w-md rounded-2xl bg-cyan-50 p-4 text-sm text-left">
              <p className="font-black text-cyan-700">Horario</p>
              <p className="mt-1 capitalize text-slate-700">
                {formatearFechaLarga(reservaConfirmada.slot.fecha)}
              </p>
              <p className="font-black text-slate-900">
                {reservaConfirmada.slot.hora} - {reservaConfirmada.slot.hora_fin}
              </p>
            </div>
          </section>
        )}

        {profesional && paso !== "confirmacion" && (
          <footer className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            <p className="font-black">Condiciones generales</p>
            <p className="mt-1">
              {profesional?.condiciones_reserva ||
                "La reserva está sujeta a confirmación operativa. No se debe ingresar información clínica en esta etapa."}
            </p>
          </footer>
        )}
      </div>
    </main>
  );
}

function CampoTexto({
  label,
  value,
  onChange,
  onBlur,
  error,
  type = "text",
  placeholder = "",
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-slate-700">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full rounded-xl border px-4 py-3 outline-cyan-400 ${
          error ? "border-red-300 bg-red-50" : ""
        }`}
      />
      {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
    </label>
  );
}
