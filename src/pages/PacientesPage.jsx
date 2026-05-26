import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function PacientesPage({ user, goBack, verFichaClinica }) {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");

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
      .eq("activo", true)
      .order("fecha_crea", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPacientes(data || []);
  }

  async function crearPaciente() {
    if (!nombres || !apellidos || !identificador) {
      alert("Nombres, apellidos e identificador son obligatorios.");
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
        activo: true,
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

    await cargarPacientes();
    alert("Paciente guardado correctamente.");
  }

  function abrirFicha(paciente) {
    if (verFichaClinica) {
      verFichaClinica(paciente);
      return;
    }

    alert("Próximo paso: conectar FichaClinicaPage.jsx en App.jsx");
  }

  useEffect(() => {
    cargarPacientes();
  }, []);

  const pacientesFiltrados = pacientes.filter((p) => {
    const texto = `${p.nombres || ""} ${p.apellidos || ""} ${
      p.identificador || ""
    } ${p.email || ""}`.toLowerCase();

    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-7xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500">
            Registro de pacientes y acceso directo a su ficha clínica.
          </p>
        </div>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
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
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">Listado de pacientes</h2>
              <p className="text-sm text-slate-500">
                {pacientes.length} pacientes registrados
              </p>
            </div>

            <input
              placeholder="Buscar por nombre, RUT o email"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 md:w-80"
            />
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
                    <th className="px-4">Estado</th>
                    <th className="px-4 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {pacientesFiltrados.map((p) => (
                    <tr key={p.id} className="rounded-xl bg-slate-50">
                      <td className="rounded-l-xl px-4 py-4">
                        <p className="font-black text-slate-800">
                          {p.nombres} {p.apellidos}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.genero || "Sin género registrado"}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {p.identificador}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        <p>{p.email || "Sin email"}</p>
                        <p>{p.telefono || "Sin teléfono"}</p>
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                          Activo
                        </span>
                      </td>

                      <td className="rounded-r-xl px-4 py-4 text-right">
                        <button
                          onClick={() => abrirFicha(p)}
                          className="rounded-xl bg-[#18AFC1] px-4 py-2 text-sm font-black text-white"
                        >
                          Ver ficha clínica
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}