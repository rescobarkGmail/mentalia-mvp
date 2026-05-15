import React, { useState } from "react";
import { motion } from "framer-motion";
import BrainLogo from "../components/BrainLogo";
import LoginButton from "../components/LoginButton";
import { supabase } from "../lib/supabaseClient";

function MicrosoftLogo() {
  return (
    <div className="grid h-4 w-4 grid-cols-2 grid-rows-2 gap-[1px]">
      <span className="bg-[#F25022]" />
      <span className="bg-[#7FBA00]" />
      <span className="bg-[#00A4EF]" />
      <span className="bg-[#FFB900]" />
    </div>
  );
}

function GoogleLogo() {
  return <span className="text-xl font-black text-[#4285F4]">G</span>;
}

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  async function handleAuth() {
    if (!email || !password) {
      alert("Ingresa correo y contraseña.");
      return;
    }

    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
    
      if (error) {
        setModalMessage(error.message);
      } else {
        // 🔥 AQUÍ INSERTAS EN TU TABLA profesional
        if (data.user) {
          await supabase.from("profesional").insert([
            {
              id: data.user.id,
              email: data.user.email
            },
          ]);
        }
    
        setModalMessage("Usuario registrado. Bienvenido a Mental-IA.");
        setIsRegister(false);
      }
    }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9f8fb] px-4">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="rounded-xl bg-white p-8 shadow-lg">
          <BrainLogo />

          <p className="mt-10 text-center text-sm text-gray-500">
            DEMO - Prototipo de Sistema de Apoyo Documental
          </p>

          <div className="mt-6 space-y-3">
            <input
              type="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-cyan-100 px-4 py-3 outline-none focus:ring-4 focus:ring-cyan-100"
            />

            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-cyan-100 px-4 py-3 outline-none focus:ring-4 focus:ring-cyan-100"
            />

            <button
              onClick={handleAuth}
              className="w-full rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white hover:bg-cyan-700"
            >
              {isRegister ? "Registrarse" : "Ingresar"}
            </button>

            <button
              onClick={() => setIsRegister(!isRegister)}
              className="w-full text-sm font-bold text-cyan-700"
            >
              {isRegister ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
          </div>

          <div className="mt-6 space-y-3 border-t pt-6">
            <LoginButton
              provider="Ingresar con Microsoft"
              icon={<MicrosoftLogo />}
              onClick={() => onLogin("Microsoft")}
            />

            <LoginButton
              provider="Ingresar con Google"
              icon={<GoogleLogo />}
              onClick={() => onLogin("Google")}
            />
          </div>
        </div>
      </motion.section>

      {modalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-xl font-black text-slate-900">
              Mentalia
            </h2>

            <p className="mb-6 leading-6 text-slate-600">
              {modalMessage}
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setModalMessage("")}
                className="rounded-xl bg-[#18AFC1] px-6 py-3 font-black text-white hover:bg-cyan-700"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}