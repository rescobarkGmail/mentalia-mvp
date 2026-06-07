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

function obtenerInicioSemana(fechaBase = new Date()) {
  const fecha = new Date(fechaBase);
  fecha.setHours(0, 0, 0, 0);

  const dia = fecha.getDay();
  const diferencia = dia === 0 ? -6 : 1 - dia;

  fecha.setDate(fecha.getDate() + diferencia);
  return fecha;
}

function obtenerSlugDesdeUrl() {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  const slugQuery = url.searchParams.get("slug") || url.searchParams.get("profesional");
  if (slugQuery) return slugQuery.trim().toLowerCase();

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

function formatearFechaISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha, dias) {
  const nueva = new Date(fecha);
  nueva.setDate(nueva.getDate() + dias);
  return nueva;
}

function normalizarHora(hora) {
  return (hora || "").slice(0, 5);
}

function normalizarTexto(texto) {
  return (texto || "").trim();
}

function formatearNombreProfesional(profesional) {
  return `${profesional?.nombres || ""} ${profesional?.apellidos || ""}`.trim();
}

function calcularHoraFin(hora, minutos) {
  const [h, m] = hora.split(":").map(Number);
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

function formatearFechaLarga(fechaISO) {
  const fecha = new Date(`${fechaISO}T00:00:00`);

  return fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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

export default function ReservarHoraPage({
  profesionalId,
  slugProfesional,
  goBack,
  onReservaExitosa,
  modoPublico = true,
}) {
  const [profesional, setProfesional] = useState(null);
  const [profesionalResueltoId, setProfesionalResueltoId] = useState("");
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [ocupaciones, setOcupaciones] = useState([]);
  const [inicioSemana, setInicioSemana] = useState(() => obtenerInicioSemana());
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [pasoFormulario, setPasoFormulario] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [primeraAtencion, setPrimeraAtencion] = useState("si");
  const [canalContacto, setCanalContacto] = useState("whatsapp");
  const [aceptaCondiciones, setAceptaCondiciones] = useState(false);

  const slugDesdeUrl = useMemo(() => obtenerSlugDesdeUrl(), []);
  const idDesdeUrl = useMemo(() => obtenerProfesionalIdDesdeUrl(), []);

  const identificadorPublico =
    slugProfesional || slugDesdeUrl || profesionalId || idDesdeUrl || "";

  const semana = useMemo(() => {
    return DIAS.map((dia, index) => {
      const fecha = sumarDias(inicioSemana, index);

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
  }, [inicioSemana]);

  useEffect(() => {
    cargarModuloReserva();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identificadorPublico]);

  useEffect(() => {
    if (profesionalResueltoId) {
      cargarDatosAgenda(profesionalResueltoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesionalResueltoId, inicioSemana]);

  async function cargarModuloReserva() {
    const slugFinal = slugProfesional || slugDesdeUrl;
    const idFinal = profesionalId || idDesdeUrl;

    if (!slugFinal && !idFinal) {
      setCargando(false);
      setErrorCarga("No se encontró un enlace válido de reserva.");
      return;
    }

    setCargando(true);
    setErrorCarga("");

    try {
      let query = supabase
        .from("v_profesionales_reserva_publica")
        .select("*")
        .limit(1);

      if (slugFinal) {
        query = query.eq("slug_publico", slugFinal.trim().toLowerCase());
      } else {
        query = query.eq("id", idFinal);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (!data) {
        setProfesional(null);
        setProfesionalResueltoId("");
        setErrorCarga(
          "No encontramos una página de reserva activa para este profesional."
        );
        setCargando(false);
        return;
      }

      setProfesional(data);
      setProfesionalResueltoId(data.id);
    } catch (error) {
      console.error("Error cargando profesional público:", error);
      setErrorCarga(
        "No fue posible cargar la página de reserva. Revisa la configuración pública del profesional."
      );
      setCargando(false);
    }
  }

  async function cargarDatosAgenda(idProfesional) {
    if (!idProfesional) return;

    setCargando(true);
    setErrorCarga("");

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
      setOcupaciones(ocupacionesData || []);
      setSlotSeleccionado(null);
      setPasoFormulario(false);
    } catch (error) {
      console.error("Error cargando disponibilidad pública:", error);
      setErrorCarga("No fue posible cargar la disponibilidad del profesional.");
    } finally {
      setCargando(false);
    }
  }

  function estaOcupado(fecha, hora, duracion) {
    const horaFinSlot = calcularHoraFin(hora, duracion);

    return ocupaciones.some((ocupacion) => {
      if (ocupacion.fecha !== fecha) return false;
      if (ocupacion.estado === "cancelada") return false;

      const inicio = normalizarHora(ocupacion.hora_inicio);
      const fin = normalizarHora(ocupacion.hora_fin);

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

    const slots = [];

    reglasDia.forEach((regla) => {
      const duracion = Number(
        regla.duracion_minutos || profesional?.duracion_sesion_minutos || 50
      );

      const horas = generarSlots(regla.hora_inicio, regla.hora_fin, duracion);

      horas.forEach((hora) => {
        const pasado = fechaHoraEsPasada(dia.fecha, hora);
        const ocupado = estaOcupado(dia.fecha, hora, duracion);

        if (!pasado && !ocupado) {
          slots.push({
            bloque_id: regla.id,
            fecha: dia.fecha,
            hora,
            hora_fin: calcularHoraFin(hora, duracion),
            duracion,
            dia: dia.dia,
          });
        }
      });
    });

    return slots.sort((a, b) => a.hora.localeCompare(b.hora));
  }

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

  function continuarEtapaSiguiente() {
    if (!validarDatosAdministrativos()) return;

    const datosReserva = {
      profesional_id: profesionalResueltoId,
      profesional_slug: profesional?.slug_publico,
      profesional_nombre: formatearNombreProfesional(profesional),
      slot: slotSeleccionado,
      paciente: {
        nombres: normalizarTexto(nombres),
        apellidos: normalizarTexto(apellidos),
        identificador: normalizarTexto(identificador) || null,
        email: normalizarTexto(email).toLowerCase(),
        telefono: normalizarTexto(telefono),
        primera_atencion: primeraAtencion,
        canal_contacto: canalContacto,
      },
    };

    console.log("Datos administrativos de reserva listos:", datosReserva);

    if (typeof onReservaExitosa === "function") {
      onReservaExitosa(datosReserva);
    }

    alert(
      "Datos de reserva preparados correctamente. En la siguiente etapa guardaremos la reserva y enviaremos confirmación."
    );
  }

  function irSemanaAnterior() {
    setInicioSemana((actual) => sumarDias(actual, -7));
  }

  function irSemanaSiguiente() {
    setInicioSemana((actual) => sumarDias(actual, 7));
  }

  function irSemanaActual() {
    setInicioSemana(obtenerInicioSemana());
  }

  const nombreProfesional = formatearNombreProfesional(profesional);

  return (
    <main className="min-h-screen bg-[#eef8fb] px-4 py-6 text-slate-800 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        {goBack && !modoPublico && (
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
                  Estamos cargando la información pública del profesional.
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
                    Contenido clínico
                  </p>
                  <p className="mt-1 font-black text-emerald-700">
                    No solicitado
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {errorCarga && (
          <section className="rounded-[28px] border border-rose-100 bg-white p-6 shadow">
            <h2 className="text-xl font-black text-rose-700">
              No fue posible abrir la reserva
            </h2>
            <p className="mt-2 text-slate-600">{errorCarga}</p>
          </section>
        )}

        {!errorCarga && (
          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-[28px] bg-white p-6 shadow">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black">Horarios disponibles</h2>
                  <p className="text-sm text-slate-500">
                    Semana {formatearRangoSemana(semana)} · elige un horario para continuar
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={irSemanaAnterior}
                    className="rounded-xl border border-cyan-100 px-3 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
                  >
                    ← Semana anterior
                  </button>
                  <button
                    onClick={irSemanaActual}
                    className="rounded-xl border border-cyan-100 px-3 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={irSemanaSiguiente}
                    className="rounded-xl border border-cyan-100 px-3 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
                  >
                    Semana siguiente →
                  </button>
                </div>
              </div>

              {cargando ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">
                  Cargando disponibilidad...
                </p>
              ) : disponibilidad.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">
                  Este profesional aún no tiene disponibilidad pública configurada.
                </p>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div className="grid min-w-[980px] grid-cols-7 gap-3">
                    {semana.map((dia) => {
                      const slots = obtenerSlotsDelDia(dia);

                      return (
                        <div
                          key={dia.fecha}
                          className="min-h-[390px] rounded-3xl border border-slate-100 bg-slate-50 p-3"
                        >
                          <div className="sticky top-0 z-10 mb-3 rounded-2xl bg-white p-3 shadow-sm">
                            <p className="text-sm font-black text-cyan-700">
                              {dia.dia}
                            </p>
                            <p className="text-xs font-bold text-slate-500">
                              {dia.etiqueta}
                            </p>
                          </div>

                          {slots.length === 0 ? (
                            <p className="rounded-2xl bg-white p-3 text-center text-xs text-slate-400">
                              Sin horas
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {slots.map((slot) => {
                                const activo =
                                  slotSeleccionado?.fecha === slot.fecha &&
                                  slotSeleccionado?.hora === slot.hora;

                                return (
                                  <button
                                    key={`${slot.fecha}-${slot.hora}-${slot.bloque_id}`}
                                    onClick={() => {
                                      setSlotSeleccionado(slot);
                                      setPasoFormulario(true);
                                    }}
                                    className={`w-full rounded-2xl px-3 py-3 text-left font-black transition ${
                                      activo
                                        ? "bg-[#18AFC1] text-white shadow"
                                        : "border border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                                    }`}
                                  >
                                    <span className="block text-base">
                                      {slot.hora} - {slot.hora_fin}
                                    </span>
                                    <span className="text-xs opacity-80">
                                      {slot.duracion} min
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-[28px] bg-white p-6 shadow">
              <h2 className="mb-2 text-xl font-black">Datos administrativos</h2>
              <p className="mb-5 text-sm text-slate-500">
                No ingreses diagnósticos, antecedentes clínicos ni documentos médicos.
              </p>

              {slotSeleccionado ? (
                <div className="mb-5 rounded-2xl bg-cyan-50 p-4 text-sm">
                  <p className="font-black text-cyan-700">Horario seleccionado</p>
                  <p className="mt-1 capitalize text-slate-700">
                    {formatearFechaLarga(slotSeleccionado.fecha)}
                  </p>
                  <p className="font-black text-slate-900">
                    {slotSeleccionado.hora} - {slotSeleccionado.hora_fin}
                  </p>
                </div>
              ) : (
                <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Selecciona un horario disponible para continuar.
                </div>
              )}

              {pasoFormulario && (
                <div className="space-y-3">
                  <input
                    placeholder="Nombre *"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                  />

                  <input
                    placeholder="Apellido *"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                  />

                  <input
                    placeholder="RUT / DNI / Identificador"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                  />

                  <input
                    type="email"
                    placeholder="Correo electrónico *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                  />

                  <input
                    placeholder="Teléfono *"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase text-slate-400">
                        Primera atención
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

                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase text-slate-400">
                        Canal contacto
                      </span>
                      <select
                        value={canalContacto}
                        onChange={(e) => setCanalContacto(e.target.value)}
                        className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                        <option value="telefono">Teléfono</option>
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
                      Acepto las condiciones generales de reserva. Entiendo que
                      esta página no solicita información clínica sensible.
                    </span>
                  </label>

                  <button
                    onClick={continuarEtapaSiguiente}
                    disabled={!slotSeleccionado}
                    className="w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continuar
                  </button>
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                <p className="font-black">Condiciones generales</p>
                <p className="mt-1">
                  {profesional?.condiciones_reserva ||
                    "La reserva está sujeta a confirmación operativa. No se debe ingresar información clínica en esta etapa."}
                </p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
