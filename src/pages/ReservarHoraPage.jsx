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
export default function ReservarHoraPage({  profesionalId,  goBack,  onReservaExitosa,}) {
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [citas, setCitas] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [reservando, setReservando] = useState(false);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  function obtenerInicioSemana(fechaBase = new Date()) {
    const fecha = new Date(fechaBase);
    fecha.setHours(0, 0, 0, 0);

    const dia = fecha.getDay();
    const diferencia = dia === 0 ? -6 : 1 - dia;

    fecha.setDate(fecha.getDate() + diferencia);
    return fecha;
  }

  const semana = useMemo(() => {
    const inicio = obtenerInicioSemana();

    return DIAS.map((dia, index) => {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + index);

      return {
        dia,
        dia_semana: index + 1,
        fecha: fecha.toISOString().slice(0, 10),
        etiqueta: fecha.toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "short",
        }),
      };
    });
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [profesionalId]);

  async function cargarDatos() {
    if (!profesionalId) {
      setCargando(false);
      console.warn("ReservarHoraPage: profesionalId aún no disponible.");
      return;
    }

    setCargando(true);

    const { data: disp, error: dispError } = await supabase
      .from("disponibilidad_profesional")
      .select("*")
      .eq("profesional_id", profesionalId)
      .eq("activo", true)
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (dispError) {
      console.error("Error cargando disponibilidad:", dispError);
      alert(dispError.message);
      setCargando(false);
      return;
    }

    const hoy = new Date();
    const hasta = new Date();
    hasta.setDate(hoy.getDate() + 30);

    const { data: citasData, error: citasError } = await supabase
      .from("citas")
      .select("*")
      .eq("profesional_id", profesionalId)
      .gte("fecha", hoy.toISOString().slice(0, 10))
      .lte("fecha", hasta.toISOString().slice(0, 10));

    if (citasError) {
      console.error("Error cargando citas:", citasError);
      alert(citasError.message);
      setCargando(false);
      return;
    }

    setDisponibilidad(disp || []);
    setCitas(citasData || []);
    setCargando(false);
  }

  function normalizarTexto(texto) {
    return (texto || "").trim();
  }

  function generarSlots(horaInicio, horaFin, duracion) {
    const slots = [];

    const [hi, mi] = horaInicio.slice(0, 5).split(":").map(Number);
    const [hf, mf] = horaFin.slice(0, 5).split(":").map(Number);

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

  function calcularHoraFin(hora, minutos) {
    const [h, m] = hora.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m + Number(minutos), 0, 0);
    return date.toTimeString().slice(0, 5);
  }

  function horariosSeCruzan(inicioA, finA, inicioB, finB) {
    return inicioA < finB && finA > inicioB;
  }

  function fechaHoraEsPasada(fecha, hora) {
    const ahora = new Date();
    const fechaHora = new Date(`${fecha}T${hora}:00`);
    return fechaHora <= ahora;
  }

  function estaOcupado(fecha, hora, duracion) {
    const horaFinSlot = calcularHoraFin(hora, duracion);

    return citas.some((c) => {
      if (c.fecha !== fecha) return false;
      if (c.estado === "cancelada") return false;

      const inicioCita = c.hora_inicio?.slice(0, 5);
      const finCita = c.hora_fin?.slice(0, 5);

      if (!inicioCita || !finCita) return false;

      return horariosSeCruzan(hora, horaFinSlot, inicioCita, finCita);
    });
  }

  function obtenerSlotsDelDia(dia) {
    const bloquesDia = disponibilidad.filter(
      (bloque) => Number(bloque.dia_semana) === Number(dia.dia_semana)
    );

    const slots = [];

    bloquesDia.forEach((bloque) => {
      const horas = generarSlots(
        bloque.hora_inicio,
        bloque.hora_fin,
        bloque.duracion_minutos
      );

      horas.forEach((hora) => {
        const pasado = fechaHoraEsPasada(dia.fecha, hora);
        const ocupado = estaOcupado(dia.fecha, hora, bloque.duracion_minutos);

        if (!pasado && !ocupado) {
          slots.push({
            bloque_id: bloque.id,
            fecha: dia.fecha,
            hora,
            duracion: bloque.duracion_minutos,
            dia: dia.dia,
          });
        }
      });
    });

    return slots.sort((a, b) => a.hora.localeCompare(b.hora));
  }

  function formatearFecha(fechaISO) {
    const fecha = new Date(`${fechaISO}T00:00:00`);

    return fecha.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function construirWhatsapp(paciente, slot) {
    const nombreCompleto = `${paciente.nombres} ${paciente.apellidos}`.trim();

    const texto = `Hola, reservé una hora en Mentalia.

Paciente: ${nombreCompleto}
Fecha: ${slot.fecha}
Hora: ${slot.hora}

Quedo atento/a a la confirmación.`;

    return `https://wa.me/?text=${encodeURIComponent(texto)}`;
  }

  async function buscarOCrearPaciente() {
    const rut = normalizarTexto(identificador);
    const correo = normalizarTexto(email).toLowerCase();

    let query = supabase
      .from("pacientes")
      .select("*")
      .eq("profesional_id", profesionalId);

    if (rut) {
      query = query.eq("identificador", rut);
    } else {
      query = query.eq("email", correo);
    }

    const { data: existentes, error: buscarError } = await query.limit(1);

    if (buscarError) throw buscarError;

    const existente = existentes?.[0] || null;

    if (existente) {
      const { data: actualizado, error: updateError } = await supabase
        .from("pacientes")
        .update({
          nombres: normalizarTexto(nombres),
          apellidos: normalizarTexto(apellidos),
          email: correo,
          telefono: normalizarTexto(telefono) || null,
          identificador: rut,
        })
        .eq("id", existente.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return actualizado;
    }

    const { data: nuevo, error: insertError } = await supabase
      .from("pacientes")
      .insert([
        {
          profesional_id: profesionalId,
          nombres: normalizarTexto(nombres),
          apellidos: normalizarTexto(apellidos),
          email: correo,
          telefono: normalizarTexto(telefono) || null,
          identificador: rut,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return nuevo;
  }

  async function reservar() {
    if (!slotSeleccionado) {
      alert("Selecciona un horario disponible.");
      return;
    }

    if (
      !normalizarTexto(nombres) ||
      !normalizarTexto(apellidos) ||
      !normalizarTexto(identificador) ||
      !normalizarTexto(email)
    ) {
      alert("Ingresa nombres, apellidos, RUT/identificador y correo.");
      return;
    }

    if (
      estaOcupado(
        slotSeleccionado.fecha,
        slotSeleccionado.hora,
        slotSeleccionado.duracion
      )
    ) {
      alert("Ese horario acaba de ser reservado. Selecciona otro.");
      await cargarDatos();
      return;
    }

    setReservando(true);

    try {
      const paciente = await buscarOCrearPaciente();

      const { error: citaError } = await supabase.from("citas").insert([
        {
          profesional_id: profesionalId,
          paciente_id: paciente.id,
          fecha: slotSeleccionado.fecha,
          hora_inicio: slotSeleccionado.hora,
          hora_fin: calcularHoraFin(
            slotSeleccionado.hora,
            slotSeleccionado.duracion
          ),
          estado: "reservada",
          origen: "reserva_publica",
        },
      ]);

      if (citaError) throw citaError;

      const whatsappUrl = construirWhatsapp(paciente, slotSeleccionado);

      setSlotSeleccionado(null);
      setNombres("");
      setApellidos("");
      setIdentificador("");
      setEmail("");
      setTelefono("");

      setReservando(false);

      await cargarDatos();

      if (typeof onReservaExitosa === "function") {
        onReservaExitosa();
      }

      alert("Hora reservada correctamente.");
      window.open(whatsappUrl, "_blank");

    } catch (error) {
      console.error("Error reservando hora:", error);
      alert("No fue posible reservar la hora: " + error.message);
      setReservando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6 text-slate-800">
      <div className="mx-auto max-w-7xl">
        {goBack && (
          <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
            ← Volver
          </button>
        )}

        <section className="mb-6 rounded-[28px] bg-white p-7 shadow">
          <p className="text-sm font-black uppercase tracking-widest text-cyan-600">
            Agenda pública
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Reserva tu hora
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Selecciona un día y horario disponible. La reserva se agregará
            automáticamente a la agenda del profesional.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[28px] bg-white p-6 shadow">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">Semana actual</h2>
                <p className="text-sm text-slate-500">
                  Vista por columnas · solo horarios libres
                </p>
              </div>

              <button
                onClick={cargarDatos}
                className="w-fit rounded-xl border border-cyan-200 px-4 py-2 text-sm font-bold text-cyan-700"
              >
                Actualizar
              </button>
            </div>

            {cargando ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">
                Cargando disponibilidad...
              </p>
            ) : disponibilidad.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">
                Este profesional aún no tiene disponibilidad configurada.
              </p>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[980px] grid-cols-7 gap-3">
                  {semana.map((dia) => {
                    const slots = obtenerSlotsDelDia(dia);

                    return (
                      <div
                        key={dia.fecha}
                        className="min-h-[380px] rounded-3xl border border-slate-100 bg-slate-50 p-3"
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
                                  onClick={() => setSlotSeleccionado(slot)}
                                  className={`w-full rounded-2xl px-3 py-3 text-left font-black transition ${
                                    activo
                                      ? "bg-[#18AFC1] text-white shadow"
                                      : "border border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                                  }`}
                                >
                                  <span className="block text-lg">
                                    {slot.hora}
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

          <div className="rounded-[28px] bg-white p-6 shadow">
            <h2 className="mb-5 text-xl font-black">Tus datos</h2>

            {slotSeleccionado ? (
              <div className="mb-5 rounded-2xl bg-cyan-50 p-4 text-sm">
                <p className="font-black text-cyan-700">
                  Horario seleccionado
                </p>
                <p className="mt-1 text-slate-700">
                  {formatearFecha(slotSeleccionado.fecha)}
                </p>
                <p className="font-black text-slate-900">
                  {slotSeleccionado.hora} · {slotSeleccionado.duracion} min
                </p>
              </div>
            ) : (
              <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Selecciona un horario disponible para continuar.
              </div>
            )}

            <div className="space-y-3">
              <input
                placeholder="Nombres *"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
              />

              <input
                placeholder="Apellidos *"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
              />

              <input
                placeholder="RUT / DNI / Identificador *"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
              />

              <input
                type="email"
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
              />

              <input
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-cyan-400"
              />

              <button
                onClick={reservar}
                disabled={reservando || !slotSeleccionado}
                className="w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reservando ? "Reservando..." : "Confirmar reserva"}
              </button>

              <p className="text-xs leading-5 text-slate-500">
                Al confirmar, la cita quedará registrada en la agenda del
                profesional y se abrirá un mensaje de WhatsApp prellenado.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}