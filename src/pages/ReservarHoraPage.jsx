import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ReservarHoraPage({ profesionalId, goBack }) {
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [citas, setCitas] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: disp } = await supabase
      .from("disponibilidad_profesional")
      .select("*")
      .eq("profesional_id", profesionalId)
      .eq("activo", true);

    const { data: citasData } = await supabase
      .from("citas")
      .select("*")
      .eq("profesional_id", profesionalId);

    setDisponibilidad(disp || []);
    setCitas(citasData || []);
  }

  function generarSlots(horaInicio, horaFin, duracion) {
    const slots = [];
    const inicio = new Date();
    const fin = new Date();

    const [hi, mi] = horaInicio.split(":").map(Number);
    const [hf, mf] = horaFin.split(":").map(Number);

    inicio.setHours(hi, mi, 0);
    fin.setHours(hf, mf, 0);

    let actual = new Date(inicio);

    while (actual < fin) {
      const hora = actual.toTimeString().slice(0, 5);
      slots.push(hora);
      actual = new Date(actual.getTime() + duracion * 60000);
    }

    return slots;
  }

  function obtenerProximasFechas(diaSemana) {
    const fechas = [];
    const hoy = new Date();

    for (let i = 0; i <= 30; i++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + i);

      const diaJS = fecha.getDay(); // domingo = 0
      const diaMentalia = diaJS === 0 ? 7 : diaJS;

      if (diaMentalia === diaSemana) {
        fechas.push(fecha.toISOString().slice(0, 10));
      }
    }

    return fechas;
  }

  function estaOcupado(fecha, hora) {
    return citas.some(
      (c) =>
        c.fecha === fecha &&
        c.hora_inicio.slice(0, 5) === hora &&
        c.estado !== "cancelada"
    );
  }

  function calcularHoraFin(hora, minutos) {
    const [h, m] = hora.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m + Number(minutos), 0);
    return date.toTimeString().slice(0, 5);
  }

  async function reservar() {
    if (!slotSeleccionado) {
      alert("Selecciona un horario.");
      return;
    }

    if (!nombres || !apellidos || !identificador || !email) {
        alert("Ingresa Nombre, Apellido, RUT y correo.");
        return;
      }

    

    const { data: paciente, error: pacienteError } = await supabase
      .from("pacientes")
      .insert([
        {
          profesional_id: profesionalId,
          nombres,
          apellidos,
          email,
          telefono: telefono || null,
          identificador: identificador,
        },
      ])
      .select()
      .single();

    if (pacienteError) {
      alert(pacienteError.message);
      return;
    }

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
        origen: "Reserva pública",
      },
    ]);

    if (citaError) {
      alert(citaError.message);
      return;
    }

    alert("Hora reservada correctamente. El profesional verá tu cita en su agenda.");

    setSlotSeleccionado(null);
    setNombres("");
    setApellidos("");
    setIdentificador("");
    setEmail("");
    setTelefono("");
    cargarDatos();
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6 text-slate-800">
      <div className="mx-auto max-w-5xl">
        {goBack && (
          <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
            ← Volver
          </button>
        )}

        <section className="mb-6 rounded-[28px] bg-white p-7 shadow">
          <h1 className="text-3xl font-black text-cyan-700">
            Reserva tu hora
          </h1>
          <p className="mt-2 text-slate-600">
            Selecciona un horario disponible y completa tus datos para confirmar
            la reserva.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-white p-6 shadow">
            <h2 className="mb-5 text-xl font-black">
              Horarios disponibles
            </h2>

            {disponibilidad.length === 0 ? (
              <p className="text-slate-500">
                Este profesional aún no tiene disponibilidad configurada.
              </p>
            ) : (
              <div className="space-y-8">
                {disponibilidad.map((bloque) =>
                  obtenerProximasFechas(bloque.dia_semana).map((fecha) => (
                    <div key={`${bloque.id}-${fecha}`}>
                      <h3 className="mb-3 font-black text-cyan-700">
                        {fecha}
                      </h3>

                      <div className="flex flex-wrap gap-3">
                        {generarSlots(
                          bloque.hora_inicio,
                          bloque.hora_fin,
                          bloque.duracion_minutos
                        ).map((hora) => {
                          const ocupado = estaOcupado(fecha, hora);
                          const activo =
                            slotSeleccionado?.fecha === fecha &&
                            slotSeleccionado?.hora === hora;

                          return (
                            <button
                              key={hora}
                              disabled={ocupado}
                              onClick={() =>
                                setSlotSeleccionado({
                                  fecha,
                                  hora,
                                  duracion: bloque.duracion_minutos,
                                })
                              }
                              className={`rounded-xl px-4 py-2 font-bold ${
                                ocupado
                                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                  : activo
                                  ? "bg-[#18AFC1] text-white"
                                  : "border border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"
                              }`}
                            >
                              {hora}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow">
            <h2 className="mb-5 text-xl font-black">
              Tus datos
            </h2>

            {slotSeleccionado && (
              <div className="mb-5 rounded-2xl bg-cyan-50 p-4 text-sm">
                <p className="font-black text-cyan-700">
                  Horario seleccionado
                </p>
                <p>
                  {slotSeleccionado.fecha} · {slotSeleccionado.hora}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <input
                placeholder="Nombres *"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />

              <input
                placeholder="Apellidos *"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />

              <input
                type="email"
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />

                <input
                placeholder="RUT / DNI / Identificador *"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                />

              <input
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />

              <button
                onClick={reservar}
                className="w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white hover:bg-cyan-700"
              >
                Confirmar reserva
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}