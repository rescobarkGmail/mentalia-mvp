import React, { useState } from "react";
import { Brain, ArrowRight } from "lucide-react";

export default function LandingPage({ goToApp }) {
  const [email, setEmail] = useState("");

  const handleSubmit = () => {
    alert(`Gracias por registrarte: ${email}`);
    setEmail("");
  };

  return (
    <main className="min-h-screen bg-white text-slate-800">

      {/* HERO */}
      <section className="bg-gradient-to-br from-[#18AFC1] to-[#2f80ed] text-white px-6 py-20 text-center">
        <div className="flex justify-center mb-4">
          <Brain size={40} />
        </div>

        <h1 className="text-4xl md:text-5xl font-black mb-4">
          Reduce tu carga administrativa como psicólogo
        </h1>

        <p className="max-w-2xl mx-auto text-lg opacity-90 mb-6">
          Mentalia utiliza inteligencia artificial para ayudarte a documentar sesiones clínicas de forma rápida, segura y eficiente.
        </p>

        <button
          onClick={goToApp}
          className="bg-white text-cyan-700 px-6 py-3 rounded-full font-black flex items-center gap-2 mx-auto"
        >
          Ir a la aplicación <ArrowRight size={18} />
        </button>
      </section>

      {/* PROBLEMA */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-3xl font-black mb-4">
          El problema actual
        </h2>
        <p className="max-w-2xl mx-auto text-slate-600">
          Los profesionales de salud mental invierten gran parte de su tiempo en tareas administrativas, reduciendo su capacidad de atención y aumentando el desgaste profesional.
        </p>
      </section>

      {/* SOLUCIÓN */}
      <section className="bg-[#eef8fb] px-6 py-16 text-center">
        <h2 className="text-3xl font-black mb-4">
          Nuestra solución
        </h2>
        <p className="max-w-2xl mx-auto text-slate-600">
          Mentalia conecta todo tu flujo clínico en una sola plataforma: desde la agenda hasta la documentación y cierre administrativo.
        </p>
      </section>

      {/* FLUJO */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-3xl font-black mb-8">
          Cómo funciona
        </h2>

        <div className="flex flex-wrap justify-center gap-4 font-bold">
          <span>Agenda</span> →
          <span>Pre-sesión</span> →
          <span>Atención</span> →
          <span>IA</span> →
          <span>Documentación</span> →
          <span>Boleta</span>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="bg-[#eef8fb] px-6 py-16 text-center">
        <h2 className="text-3xl font-black mb-8">
          Beneficios
        </h2>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <div className="bg-white p-6 rounded-2xl shadow">
            <h3 className="font-black mb-2">Ahorra tiempo</h3>
            <p className="text-sm text-slate-600">
              Reduce significativamente el tiempo dedicado a documentación clínica.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow">
            <h3 className="font-black mb-2">Mayor productividad</h3>
            <p className="text-sm text-slate-600">
              Atiende más pacientes sin aumentar tu carga laboral.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow">
            <h3 className="font-black mb-2">Menos estrés</h3>
            <p className="text-sm text-slate-600">
              Concéntrate en lo importante: tus pacientes.
            </p>
          </div>
        </div>
      </section>

      {/* CAPTURA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl font-black mb-4">
          Únete al piloto
        </h2>

        <p className="text-slate-600 mb-6">
          Déjanos tu correo y sé de los primeros en probar Mentalia
        </p>

        <div className="flex flex-col md:flex-row gap-3 justify-center max-w-md mx-auto">
          <input
            type="email"
            placeholder="Tu correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border px-4 py-3 rounded-xl w-full"
          />

          <button
            onClick={handleSubmit}
            className="bg-[#18AFC1] text-white px-6 py-3 rounded-xl font-black"
          >
            Registrarme
          </button>
        </div>
      </section>

    </main>
  );
}