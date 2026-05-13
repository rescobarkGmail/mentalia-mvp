import React from "react";
import { motion } from "framer-motion";
import BrainLogo from "../components/BrainLogo";
import LoginButton from "../components/LoginButton";

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
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9f8fb]">
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
    </main>
  );
}