import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProfilePage({ user, onComplete }) {
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pais, setPais] = useState("");

  async function handleSave() {
    if (!nombres || !apellidos) {
      alert("Nombre y apellido son obligatorios");
      return;
    }

    const { error } = await supabase
      .from("profesional")
      .update({
        nombres,
        apellidos,
        telefono,
        pais,
      })
      .eq("id", user.id);

    if (error) {
      alert(error.message);
    } else {
      onComplete();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9f8fb]">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h2 className="mb-4 text-2xl font-black text-center">
          Completa tu perfil
        </h2>

        <p className="mb-6 text-sm text-gray-500 text-center">
          Necesitamos algunos datos para comenzar
        </p>

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
            placeholder="Teléfono (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-xl border px-4 py-3"
          />

          <input
            placeholder="País (opcional)"
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            className="w-full rounded-xl border px-4 py-3"
          />

          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-[#18AFC1] py-3 font-black text-white"
          >
            Guardar y continuar
          </button>
        </div>
      </div>
    </main>
  );
}