import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function fechaTexto(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NuevaCitaPage({ user, goBack }) {
  const [pacientes, setPacientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);

  const [pacienteId, setPacienteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [duracion, setDuracion] = useState(60);

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);

  const [mostrarNuevoPaciente, setMostrarNuevoPaciente] = useState(false);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoApellido, setNuevoApellido] = useState("");
  const [nuevoIdentificador, setNuevoIdentificador] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");

  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState("");
  const [telefonoWhatsapp, setTelefonoWhatsapp] = useState("");


  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    generarHorariosDisponibles();
  }, [fecha, duracion, disponibilidad, citas]);

  async function cargarDatos() {
    const { data: pacientesData, error: pacientesError } = await supabase
      .from("pacientes")
      .select("*")
      .order("nombres", { ascending: true });

    if (pacientesError) {
      alert(pacientesError.message);
      return;
    }

    const { data: citasData, error: citasError } = await supabase
      .from("citas")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (citasError) {
      alert(citasError.message);
      return;
    }

    const { data: disponibilidadData, error: disponibilidadError } =
      await supabase
        .from("disponibilidad_profesional")
        .select("*")
        .eq("activo", true);

    if (disponibilidadError) {
      alert(disponibilidadError.message);
      return;
    }

    setPacientes(pacientesData || []);
    setCitas(citasData || []);
    setDisponibilidad(disponibilidadData || []);
  }

  function calcularHoraFin(hora, minutos) {
    const [h, m] = hora.split(":").map(Number);

    const date = new Date();
    date.setHours(h, m + Number(minutos), 0, 0);

    return date.toTimeString().slice(0, 5);
  }

  function generarSlots(horaInicioBloque, horaFinBloque, duracionMinutos) {
    const slots = [];

    const [hi, mi] = horaInicioBloque.split(":").map(Number);
    const [hf, mf] = horaFinBloque.split(":").map(Number);

    let actual = new Date();
    actual.setHours(hi, mi, 0, 0);

    const fin = new Date();
    fin.setHours(hf, mf, 0, 0);

    while (actual < fin) {
      const hora = actual.toTimeString().slice(0, 5);
      const horaFinSlot = calcularHoraFin(hora, duracionMinutos);

      if (horaFinSlot <= horaFinBloque.slice(0, 5)) {
        slots.push(hora);
      }

      actual = new Date(
        actual.getTime() + Number(duracionMinutos) * 60000
      );
    }

    return slots;
  }

  function esFechaHoraPasada(fechaSeleccionada, horaSeleccionada) {
    const ahora = new Date();
    const fechaHora = new Date(`${fechaSeleccionada}T${horaSeleccionada}:00`);

    return fechaHora < ahora;
  }

  function existeCitaEnHorario(fechaSeleccionada, horaSeleccionada) {
    return citas.some(
      (cita) =>
        cita.fecha?.slice(0, 10) === fechaSeleccionada &&
        cita.hora_inicio?.slice(0, 5) === horaSeleccionada &&
        cita.estado !== "cancelada"
    );
  }

  function horarioExisteEnDisponibilidad(fechaSeleccionada, horaSeleccionada) {
    const fechaObj = new Date(`${fechaSeleccionada}T00:00:00`);
    const diaJS = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();

    const horaFinNueva = calcularHoraFin(horaSeleccionada, duracion);

    return disponibilidad.some((item) => {
      const inicio = item.hora_inicio?.slice(0, 5);
      const fin = item.hora_fin?.slice(0, 5);

      const fechaInicio = item.fecha_inicio?.slice(0, 10);
      const fechaFin = item.fecha_fin?.slice(0, 10);

      return (
        item.dia_semana === diaJS &&
        fechaSeleccionada >= fechaInicio &&
        fechaSeleccionada <= fechaFin &&
        horaSeleccionada >= inicio &&
        horaFinNueva <= fin
      );
    });
  }

  function generarHorariosDisponibles() {
    if (!fecha || !duracion) {
      setHorariosDisponibles([]);
      setHoraInicio("");
      return;
    }

    const fechaObj = new Date(`${fecha}T00:00:00`);
    const diaJS = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();

    const horarios = [];

    disponibilidad.forEach((item) => {
      const inicio = item.hora_inicio?.slice(0, 5);
      const fin = item.hora_fin?.slice(0, 5);

      const fechaInicio = item.fecha_inicio?.slice(0, 10);
      const fechaFin = item.fecha_fin?.slice(0, 10);

      const aplica =
        item.dia_semana === diaJS &&
        fecha >= fechaInicio &&
        fecha <= fechaFin;

      if (!aplica) return;

      generarSlots(inicio, fin, Number(duracion)).forEach((hora) => {
        const ocupado = existeCitaEnHorario(fecha, hora);
        const pasado = esFechaHoraPasada(fecha, hora);

        if (!ocupado && !pasado) {
          horarios.push(hora);
        }
      });
    });

    const unicosOrdenados = [...new Set(horarios)].sort();

    setHorariosDisponibles(unicosOrdenados);

    if (!unicosOrdenados.includes(horaInicio)) {
      setHoraInicio("");
    }
  }

  async function guardarCita() {
    if (!pacienteId || !fecha || !horaInicio || !duracion) {
      alert("Selecciona paciente, fecha, horario y duración.");
      return;
    }

    if (esFechaHoraPasada(fecha, horaInicio)) {
      alert("No puedes crear una cita en una fecha u hora pasada.");
      return;
    }

    if (!horarioExisteEnDisponibilidad(fecha, horaInicio)) {
      alert(
        "El horario seleccionado no está dentro de la disponibilidad configurada."
      );
      return;
    }

    if (existeCitaEnHorario(fecha, horaInicio)) {
      alert("Ese horario ya está reservado. Selecciona otro horario.");
      return;
    }

    const horaFin = calcularHoraFin(horaInicio, duracion);

    const { error } = await supabase.from("citas").insert([
      {
        profesional_id: user.id,
        paciente_id: pacienteId,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        estado: "reservada",
        origen: "Mentalia",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    const pacienteSeleccionado = pacientes.find(
        (p) => p.id === pacienteId
      );
      
      const mensaje = `Hola ${
        pacienteSeleccionado?.nombres || ""
      }, tu hora ha sido reservada para el día ${fecha} a las ${horaInicio} hrs. 
      Atte. Mentalia.`;
      
      setMensajeWhatsapp(encodeURIComponent(mensaje));
      
      setTelefonoWhatsapp(
        (pacienteSeleccionado?.telefono || "")
          .replace(/\s/g, "")
          .replace(/\+/g, "")
      );
      
      setMostrarConfirmacion(true);

  }

  async function crearPacienteRapido() {
    if (!nuevoNombre || !nuevoApellido || !nuevoIdentificador) {
      alert("Nombre, apellido e identificador son obligatorios.");
      return;
    }

    const { data, error } = await supabase
      .from("pacientes")
      .insert([
        {
          profesional_id: user.id,
          nombres: nuevoNombre,
          apellidos: nuevoApellido,
          identificador: nuevoIdentificador,
          email: nuevoEmail || null,
          telefono: nuevoTelefono || null,
          activo: true,
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setPacientes((prev) =>
      [...prev, data].sort((a, b) =>
        a.nombres.localeCompare(b.nombres)
      )
    );

    setPacienteId(data.id);

    setNuevoNombre("");
    setNuevoApellido("");
    setNuevoIdentificador("");
    setNuevoEmail("");
    setNuevoTelefono("");

    setMostrarNuevoPaciente(false);
  }

  return (
    <>
      <main className="min-h-screen bg-[#eef8fb] p-6">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={goBack}
            className="mb-4 font-bold text-cyan-700"
          >
            ← Volver
          </button>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h1 className="mb-2 text-2xl font-black">
              Nueva cita
            </h1>

            <p className="mb-6 text-sm text-slate-500">
              Selecciona una fecha y Mentalia mostrará solo los
              horarios realmente disponibles.
            </p>

            <div className="space-y-4">

              <select
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">
                  Seleccionar paciente
                </option>

                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombres} {p.apellidos}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setMostrarNuevoPaciente(true)}
                className="rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
              >
                + Crear nuevo paciente
              </button>

              <input
                type="date"
                value={fecha}
                min={fechaTexto(new Date())}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />

              <select
                value={duracion}
                onChange={(e) =>
                  setDuracion(Number(e.target.value))
                }
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">60 minutos</option>
                <option value="90">90 minutos</option>
              </select>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Horarios disponibles
                </label>

                {!fecha ? (
                  <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                    Primero selecciona una fecha.
                  </p>
                ) : horariosDisponibles.length === 0 ? (
                  <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                    No hay horarios disponibles para esta fecha.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {horariosDisponibles.map((hora) => (
                      <button
                        key={hora}
                        type="button"
                        onClick={() => setHoraInicio(hora)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                          horaInicio === hora
                            ? "border-cyan-700 bg-cyan-700 text-white"
                            : "border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"
                        }`}
                      >
                        {hora}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {horaInicio && (
                <div className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-800">
                  Horario seleccionado:{" "}
                  <span className="font-black">
                    {horaInicio} -{" "}
                    {calcularHoraFin(horaInicio, duracion)}
                  </span>
                </div>
              )}

              <button
                onClick={guardarCita}
                className="w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white"
              >
                Guardar cita
              </button>
            </div>
          </div>
        </div>
      </main>

      {mostrarNuevoPaciente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">

            <h2 className="text-2xl font-black text-slate-800">
              Nuevo paciente
            </h2>

            <div className="mt-5 space-y-4">

              <input
                type="text"
                placeholder="Nombres *"
                value={nuevoNombre}
                onChange={(e) =>
                  setNuevoNombre(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3"
              />

              <input
                type="text"
                placeholder="Apellidos *"
                value={nuevoApellido}
                onChange={(e) =>
                  setNuevoApellido(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3"
              />

              <input
                type="text"
                placeholder="RUT / Identificador *"
                value={nuevoIdentificador}
                onChange={(e) =>
                  setNuevoIdentificador(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3"
              />

              <input
                type="email"
                placeholder="Email"
                value={nuevoEmail}
                onChange={(e) =>
                  setNuevoEmail(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3"
              />

              <input
                type="text"
                placeholder="Teléfono"
                value={nuevoTelefono}
                onChange={(e) =>
                  setNuevoTelefono(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3"
              />

            </div>

            <div className="mt-6 flex gap-3">

              <button
                onClick={() =>
                  setMostrarNuevoPaciente(false)
                }
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold"
              >
                Cancelar
              </button>

              <button
                onClick={crearPacienteRapido}
                className="flex-1 rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white"
              >
                Guardar paciente
              </button>

            </div>

          </div>
        </div>
      )}
 
 {mostrarConfirmacion && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">

      <div className="text-center">

        <div className="text-5xl">
          ✅
        </div>

        <h2 className="mt-3 text-2xl font-black text-slate-800">
          Cita agendada correctamente
        </h2>

        <p className="mt-3 text-sm text-slate-500">
          ¿Deseas enviar confirmación por WhatsApp al paciente?
        </p>

      </div>

      <div className="mt-6 space-y-3">

        <a
          href={`https://wa.me/${telefonoWhatsapp}?text=${mensajeWhatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-green-600 px-4 py-4 text-center font-black text-white hover:bg-green-700"
        >
          Enviar WhatsApp
        </a>

        <button
          onClick={() => {
            setMostrarConfirmacion(false);
            goBack();
          }}
          className="w-full rounded-xl border border-slate-300 px-4 py-4 font-bold"
        >
          Cerrar
        </button>

      </div>

    </div>

  </div>
)}
    </>
  );
}