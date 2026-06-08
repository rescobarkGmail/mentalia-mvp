import React, { useEffect, useMemo, useState } from "react";
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

export default function ReservarHoraPage({
  profesionalId: profesionalIdProp,
  slug: slugProp,
  goBack,
  onContinuar,
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

  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [error, setError] = useState("");
  const [reservando, setReservando] = useState(false);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [primeraAtencion, setPrimeraAtencion] = useState("");
  const [canalContacto, setCanalContacto] = useState("WhatsApp");
  const [aceptaCondiciones, setAceptaCondiciones] = useState(false);

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

  async function cargarPerfilPublico({ slugFinal, idFinal }) {
    setCargandoPerfil(true);
    setError("");

    try {
      if (!slugFinal && !idFinal) {
        setError("No se indicó el enlace público del profesional.");
        setCargandoPerfil(false);
        return;
      }

      let query = supabase
        .from("v_profesionales_reserva_publica")
        .select("*")
        .eq("reserva_publica_activa", true);

      if (slugFinal) {
        query = query.eq("slug_publico", slugFinal);
      } else {
        query = query.eq("id", idFinal);
      }

      const { data, error: errorPerfil } = await query.maybeSingle();

      if (errorPerfil) throw errorPerfil;

      if (!data) {
        setError(
          "No encontramos una agenda pública activa para este profesional."
        );
        setProfesional(null);
        setProfesionalId("");
        return;
      }

      setProfesional(data);
      setProfesionalId(data.id);
    } catch (err) {
      console.error("Error cargando profesional público:", err);
      setError(
        err?.message ||
          "No fue posible cargar la página de reserva del profesional."
      );
    } finally {
      setCargandoPerfil(false);
    }
  }

  async function cargarDisponibilidadPublica(idProfesional) {
    if (!idProfesional) return;

    setCargandoDisponibilidad(true);
    setError("");

    const desde = semana[0]?.fecha;
    const hasta = semana[6]?.fecha;

    try {
      const { data: disponibilidadData, error: disponibilidadError } =
        await supabase
          .from("v_disponibilidad_reserva_publica")
          .select("*")
          .eq("profesional_id", idProfesional)
          .order("dia_semana", { ascending: true })
          .order("hora_inicio", { ascending: true });

      if (disponibilidadError) throw disponibilidadError;

      const { data: ocupacionesData, error: ocupacionesError } = await supabase
        .from("v_reservas_ocupadas_publicas")
        .select("*")
        .eq("profesional_id", idProfesional)
        .gte("fecha", desde)
        .lte("fecha", hasta);

      if (ocupacionesError) throw ocupacionesError;

      setDisponibilidad(disponibilidadData || []);
      setReservasOcupadas(ocupacionesData || []);
      setSlotSeleccionado(null);

    } catch (err) {
      console.error("Error cargando disponibilidad pública:", err);
      setError(
        err?.message || "No fue posible cargar la disponibilidad del profesional."
      );
    } finally {
      setCargandoDisponibilidad(false);
    }
  }

  function estaOcupado(fecha, hora, duracion) {
    const horaFinSlot = calcularHoraFin(hora, duracion);

    return reservasOcupadas.some((reserva) => {
      if (reserva.fecha !== fecha) return false;
      if (["cancelada", "cancelada_paciente", "cancelada_profesional"].includes(reserva.estado)) {
        return false;
      }

      const inicio = normalizarHora(reserva.hora_inicio);
      const fin = normalizarHora(reserva.hora_fin);

      if (!inicio || !fin) return false;

      return horariosSeCruzan(hora, horaFinSlot, inicio, fin);
    });
  }

  function obtenerSlotsDelDia(dia) {
    const reglasDia = disponibilidad.filter((regla) => {
      return (
        Number(regla.dia_semana) === Number(dia.dia_semana) &&
        fechaDentroDeRegla(dia.fecha, regla)
      );
    });

    const slotsPorClave = new Map();

    reglasDia.forEach((regla) => {
      const duracion = Number(
        regla.duracion_minutos || profesional?.duracion_sesion_minutos || 50
      );

      const horas = generarSlots(regla.hora_inicio, regla.hora_fin, duracion);

      horas.forEach((hora) => {
        const horaFin = calcularHoraFin(hora, duracion);
        const pasado = fechaHoraEsPasada(dia.fecha, hora);
        const ocupado = estaOcupado(dia.fecha, hora, duracion);

        if (!pasado && !ocupado) {
          const clave = `${dia.fecha}-${hora}-${horaFin}`;

          if (!slotsPorClave.has(clave)) {
            slotsPorClave.set(clave, {
              bloque_id: regla.id,
              fecha: dia.fecha,
              hora,
              hora_fin: horaFin,
              duracion,
              dia: dia.dia,
            });
          }
        }
      });
    });

    return Array.from(slotsPorClave.values()).sort((a, b) =>
      a.hora.localeCompare(b.hora)
    );
  }

  const totalSlotsSemana = semana.reduce(
    (total, dia) => total + obtenerSlotsDelDia(dia).length,
    0
  );

  function validarDatosAdministrativos() {
    if (!slotSeleccionado) {
      alert("Selecciona un horario disponible.");
      return false;
    }

    if (!normalizarTexto(nombres)) {
      alert("Ingresa tu nombre.");
      return false;
    }

    if (!normalizarTexto(apellidos)) {
      alert("Ingresa tu apellido.");
      return false;
    }

    if (!normalizarTexto(email)) {
      alert("Ingresa tu correo electrónico.");
      return false;
    }

    if (!normalizarTexto(telefono)) {
      alert("Ingresa tu teléfono.");
      return false;
    }

    if (!aceptaCondiciones) {
      alert("Debes aceptar las condiciones generales de reserva.");
      return false;
    }

    return true;
  }

  async function confirmarReservaPublica() {
    if (!validarDatosAdministrativos()) return;
    if (reservando) return;

    setReservando(true);
    setError("");

    try {
      const payload = {
        p_slug_publico: profesional?.slug_publico || slugPublico,
        p_fecha: slotSeleccionado.fecha,
        p_hora_inicio: slotSeleccionado.hora,
        p_hora_fin: slotSeleccionado.hora_fin,
        p_nombres: normalizarTexto(nombres),
        p_apellidos: normalizarTexto(apellidos),
        p_email: normalizarTexto(email).toLowerCase(),
        p_telefono: normalizarTexto(telefono),
        p_identificador: normalizarTexto(identificador) || null,
        p_primera_atencion: primeraAtencion || null,
        p_canal_contacto: canalContacto || null,
      };

      const { data, error: reservaError } = await supabase.rpc(
        "reservar_hora_publica",
        payload
      );

      if (reservaError) throw reservaError;

      const resultado = Array.isArray(data) ? data[0] : data;

      if (typeof onContinuar === "function") {
        onContinuar({ resultado, payload });
      }

      if (typeof onReservaExitosa === "function") {
        onReservaExitosa({ resultado, payload });
      }

      alert(
        resultado?.mensaje ||
          "Hora reservada correctamente. La reserva quedó sujeta a confirmación operativa del profesional."
      );

      setSlotSeleccionado(null);
      setNombres("");
      setApellidos("");
      setIdentificador("");
      setEmail("");
      setTelefono("");
      setPrimeraAtencion("");
      setCanalContacto("WhatsApp");
      setAceptaCondiciones(false);

      await cargarDisponibilidadPublica(profesionalId);
    } catch (err) {
      console.error("Error confirmando reserva pública:", err);
      setError(err?.message || "No fue posible guardar la reserva.");
      alert("No fue posible guardar la reserva: " + (err?.message || "Error desconocido"));
    } finally {
      setReservando(false);
    }
  }

  function irSemanaAnterior() {
    setFechaInicioSemana((actual) => sumarDias(actual, -7));
  }

  function irSemanaSiguiente() {
    setFechaInicioSemana((actual) => sumarDias(actual, 7));
  }

  function irSemanaActual() {
    setFechaInicioSemana(obtenerInicioSemana());
  }

  const nombreProfesional = formatearNombreProfesional(profesional);
  const cargando = cargandoPerfil || cargandoDisponibilidad;

  return (
    <main className="min-h-screen bg-[#eef8fb] px-4 py-6 text-slate-800 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        {goBack && (
          <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
            ← Volver
          </button>
        )}

        <section className="mb-6 overflow-hidden rounded-[32px] bg-white shadow">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-7 lg:p-9">
              <p className="text-sm font-black uppercase tracking-widest text-cyan-600">
                Reserva pública FluyePro
              </p>

              <h1 className="mt-3 text-3xl font-black text-slate-900 lg:text-4xl">
                Reserva tu hora
              </h1>

              {profesional ? (
                <div className="mt-5 space-y-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
                      Profesional
                    </p>
                    <p className="text-2xl font-black text-slate-900">
                      {nombreProfesional || "Profesional"}
                    </p>
                  </div>

                  <p className="max-w-3xl text-slate-600">
                    {profesional.descripcion_publica ||
                      "Selecciona un horario disponible y completa tus datos administrativos mínimos para continuar con la reserva."}
                  </p>
                </div>
              ) : (
                <p className="mt-4 max-w-3xl text-slate-600">
                  {cargandoPerfil
                    ? "Estamos cargando la información pública del profesional."
                    : "No fue posible cargar el perfil público del profesional."}
                </p>
              )}
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 p-7 lg:p-9">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-slate-400">
                    Profesión / especialidad
                  </p>
                  <p className="mt-1 font-black text-slate-800">
                    {profesional?.especialidad_publica ||
                      profesional?.profesion ||
                      "Profesional de salud mental"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-slate-400">
                    Modalidad
                  </p>
                  <p className="mt-1 font-black capitalize text-slate-800">
                    {profesional?.modalidad_atencion || "Online"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-slate-400">
                    Duración estimada
                  </p>
                  <p className="mt-1 font-black text-slate-800">
                    {profesional?.duracion_sesion_minutos || 50} minutos
                  </p>
                </div>

                <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-slate-400">
                    Enlace
                  </p>
                  <p className="mt-1 break-all text-sm font-black text-slate-800">
                    /reservar/{slugPublico || "profesional"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800">
            <p className="font-black">No fue posible cargar la reserva</p>
            <p className="mt-1 text-sm">{error}</p>
          </section>
        )}

        <section className="rounded-[32px] bg-white p-5 shadow lg:p-7">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Horarios disponibles
              </h2>
              <p className="text-sm text-slate-500">
                Semana {formatearRangoSemana(semana)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={irSemanaAnterior}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Semana anterior
              </button>
              <button
                type="button"
                onClick={irSemanaActual}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Semana actual
              </button>
              <button
                type="button"
                onClick={irSemanaSiguiente}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-black text-white hover:bg-cyan-700"
              >
                Semana siguiente
              </button>
            </div>
          </div>

          {cargando ? (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center font-bold text-slate-500">
              Cargando disponibilidad...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
              {semana.map((dia) => {
                const slots = obtenerSlotsDelDia(dia);

                return (
                  <div
                    key={dia.fecha}
                    className="min-h-[260px] rounded-2xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="mb-3">
                      <p className="text-sm font-black text-slate-900">
                        {dia.dia}
                      </p>
                      <p className="text-xs font-bold text-slate-400">
                        {dia.etiqueta}
                      </p>
                    </div>

                    {slots.length === 0 ? (
                      <p className="rounded-xl bg-white p-3 text-center text-xs font-bold text-slate-400">
                        Sin horarios disponibles
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {slots.map((slot) => {
                          const seleccionado =
                            slotSeleccionado?.fecha === slot.fecha &&
                            slotSeleccionado?.hora === slot.hora;

                          return (
                            <button
                              key={`${slot.fecha}-${slot.hora}`}
                              type="button"
                              onClick={() => setSlotSeleccionado(slot)}
                              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black transition ${
                                seleccionado
                                  ? "bg-cyan-600 text-white shadow"
                                  : "bg-white text-cyan-700 hover:bg-cyan-50"
                              }`}
                            >
                              {slot.hora} - {slot.hora_fin}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {slotSeleccionado && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[32px] bg-white p-6 shadow">
              <p className="text-sm font-black uppercase tracking-wide text-cyan-600">
                Horario seleccionado
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">
                {formatearFechaLarga(slotSeleccionado.fecha)}
              </h3>
              <p className="mt-2 text-xl font-black text-cyan-700">
                {slotSeleccionado.hora} - {slotSeleccionado.hora_fin}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Duración estimada: {slotSeleccionado.duracion} minutos
              </p>
            </div>

            <div className="rounded-[32px] bg-white p-6 shadow">
              <h3 className="text-xl font-black text-slate-900">
                Datos administrativos mínimos
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                No solicitamos contenido clínico sensible en esta etapa.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-600">Nombre</span>
                  <input
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500"
                    placeholder="Nombre"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-600">Apellido</span>
                  <input
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500"
                    placeholder="Apellido"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-600">Correo electrónico</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500"
                    placeholder="correo@ejemplo.com"
                    type="email"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-600">Teléfono</span>
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500"
                    placeholder="+56 9 ..."
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-600">RUT o identificador</span>
                  <input
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500"
                    placeholder="Opcional"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-600">Canal preferido</span>
                  <select
                    value={canalContacto}
                    onChange={(e) => setCanalContacto(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500"
                  >
                    {CANALES_CONTACTO.map((canal) => (
                      <option key={canal} value={canal}>
                        {canal}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold text-slate-600">¿Es primera atención?</span>
                  <select
                    value={primeraAtencion}
                    onChange={(e) => setPrimeraAtencion(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500"
                  >
                    <option value="">Seleccionar</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>

              <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={aceptaCondiciones}
                  onChange={(e) => setAceptaCondiciones(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Acepto las condiciones generales de reserva. {" "}
                  {profesional?.condiciones_reserva ||
                    "La reserva está sujeta a confirmación operativa del profesional."}
                </span>
              </label>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={confirmarReservaPublica}
                  disabled={reservando}
                  className="rounded-2xl bg-slate-900 px-6 py-3 font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reservando ? "Guardando reserva..." : "Confirmar reserva"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
