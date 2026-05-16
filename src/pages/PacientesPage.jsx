import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function PacientesPage({ user, goBack }) {
  const [pacientes, setPacientes] = useState([]);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [genero, setGenero] = useState("");
  const [contactoUrgencia, setContactoUrgencia] = useState("");
  const [telefonoEmergencia, setTelefonoEmergencia] = useState("");

  async function cargarPacientes() {
    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .order("fecha_crea", { ascending: false });

    if (!error) setPacientes(data || []);
  }

  async function crearPaciente() {
    if (!nombres || !apellidos || !identificador) {
      alert("Nombres, apellidos y RUT son obligatorios.");
      return;
    }

    const { error } = await supabase.from("pacientes").insert([
      {
        profesional_id: user.id,
        nombres,
        apellidos,
        identificador,
        email: email || null,
        telefono: telefono || null,
        fecha_nacimiento: fechaNacimiento || null,
        genero: genero || null,
        contacto_urgencia: contactoUrgencia || null,
        telefono_emergencia: telefonoEmergencia || null,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setNombres("");
    setApellidos("");
    setIdentificador("");
    setEmail("");
    setTelefono("");
    setFechaNacimiento("");
    setGenero("");
    setContactoUrgencia("");
    setTelefonoEmergencia("");

    cargarPacientes();
  }

  useEffect(() => {
    cargarPacientes();
  }, []);

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-4xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <h1 className="mb-6 text-2xl font-black">Pacientes</h1>

        <div className="mb-6 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 font-black">Nuevo paciente</h2>

          <div className="grid gap-3 md:grid-cols-2">
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
              placeholder="Identificador / RUT / DNI *"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
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
              placeholder="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              type="date"
              placeholder="Fecha nacimiento"
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
              placeholder="Teléfono emergencia"
              value={telefonoEmergencia}
              onChange={(e) => setTelefonoEmergencia(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 md:col-span-2"
            />
          </div>

          <button
            onClick={crearPaciente}
            className="mt-4 w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white"
          >
            Guardar paciente
          </button>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 font-black">Listado</h2>

          {pacientes.length === 0 ? (
            <p className="text-gray-500">No hay pacientes aún</p>
          ) : (
            <ul className="space-y-3">
              {pacientes.map((p) => (
                <li key={p.id} className="rounded-xl border p-4">
                  <p className="font-bold">
                    {p.nombres} {p.apellidos}
                  </p>
                  <p className="text-sm text-gray-500">
                    ID: {p.identificador}
                  </p>
                  <p className="text-sm text-gray-500">
                    {p.email || "Sin email"} · {p.telefono || "Sin teléfono"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}