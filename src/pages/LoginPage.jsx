import React, { useState } from "react";
import { motion } from "framer-motion";
import BrainLogo from "../components/BrainLogo";
import LoginButton from "../components/LoginButton";
import { supabase } from "../lib/supabaseClient";

/*
  Fase 1:
  Solo acceso con Gmail.

  Fase 2:
  Cambiar estas constantes a true cuando queramos habilitar:
  - autenticación propia Mental-IA
  - Microsoft
*/
const SHOW_EMAIL_LOGIN = false;
const SHOW_MICROSOFT_LOGIN = false;

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

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [modalMessage, setModalMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailAuth() {
    if (!email || !password) {
      setModalMessage("Ingresa correo y contraseña.");
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setModalMessage(error.message);
          return;
        }

        if (data?.user) {
          const { error: insertError } = await supabase
            .from("profesional")
            .insert([
              {
                id: data.user.id,
                email: data.user.email,
                vigente: true,
              },
            ]);

          if (insertError) {
            setModalMessage(
              `Usuario creado, pero no se pudo crear el perfil profesional: ${insertError.message}`
            );
            return;
          }
        }

        setModalMessage("Usuario registrado. Ahora puedes iniciar sesión.");
        setIsRegister(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setModalMessage(error.message);
        return;
      }

      if (!data?.session?.user) {
        setModalMessage(
          "El usuario fue autenticado, pero no se pudo recuperar la sesión."
        );
        return;
      }

      window.location.replace(window.location.origin);
    } catch (error) {
      console.error("Error inesperado en login email:", error);
      setModalMessage("Ocurrió un error inesperado al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setModalMessage(error.message);
        setLoading(false);
        return;
      }

      const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
      const verifierKey = `sb-${projectRef}-auth-token-code-verifier`;
      const verifierGuardado = Boolean(window.localStorage.getItem(verifierKey) || window.sessionStorage.getItem(verifierKey));
      console.info("Mentalia OAuth PKCE: verificador guardado", verifierGuardado);

      if (!data?.url || !verifierGuardado) {
        setModalMessage("No se pudo preparar de forma segura el inicio de sesión. Vuelve a intentarlo.");
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error("Error inesperado en login Google:", error);
      setModalMessage("Ocurrió un error inesperado al iniciar sesión con Google.");
      setLoading(false);
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

          {SHOW_EMAIL_LOGIN && (
            <div className="mt-6 space-y-3">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Correo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-cyan-100 px-4 py-3 outline-none focus:ring-4 focus:ring-cyan-100 disabled:bg-slate-100"
              />

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-cyan-100 px-4 py-3 outline-none focus:ring-4 focus:ring-cyan-100 disabled:bg-slate-100"
              />

              <button
                type="button"
                onClick={handleEmailAuth}
                disabled={loading}
                className="w-full rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Procesando..."
                  : isRegister
                  ? "Registrarse"
                  : "Ingresar"}
              </button>

              <button
                type="button"
                onClick={() => setIsRegister((actual) => !actual)}
                disabled={loading}
                className="w-full text-sm font-bold text-cyan-700 disabled:opacity-60"
              >
                {isRegister ? "Ya tengo cuenta" : "Crear cuenta"}
              </button>
            </div>
          )}

          <div className="mt-8 space-y-3">
            <LoginButton
              provider={loading ? "Conectando con Google..." : "Ingresar con Gmail"}
              icon={<GoogleLogo />}
              onClick={handleGoogleLogin}
            />

            {SHOW_MICROSOFT_LOGIN && (
              <LoginButton
                provider="Ingresar con Microsoft"
                icon={<MicrosoftLogo />}
                onClick={() =>
                  setModalMessage("El acceso con Microsoft estará disponible en una segunda fase.")
                }
              />
            )}

            <p className="text-center text-xs leading-5 text-slate-500">
              Acceso seguro mediante cuenta Google. Mental-IA no administra tu
              contraseña en esta fase del MVP.
            </p>
          </div>
        </div>
      </motion.section>

      {modalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-xl font-black text-slate-900">
              Mental-IA
            </h2>

            <p className="mb-6 leading-6 text-slate-600">{modalMessage}</p>

            <div className="flex justify-end">
              <button
                type="button"
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
