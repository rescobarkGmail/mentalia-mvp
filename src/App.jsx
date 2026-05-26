import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AgendaPage from "./pages/AgendaPage";
import PreSesionPage from "./pages/PreSesionPage";
import AtencionPage from "./pages/AtencionPage";
import DocumentacionPage from "./pages/DocumentacionPage";
import ProfilePage from "./pages/ProfilePage";
import PacientesPage from "./pages/PacientesPage";
import DisponibilidadPage from "./pages/DisponibilidadPage";
import NuevaCitaPage from "./pages/NuevaCitaPage";
import ReservarHoraPage from "./pages/ReservarHoraPage";
import SesionClinicaPage from "./pages/SesionClinicaPage";
import FichaClinicaPage from "./pages/FichaClinicaPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [provider, setProvider] = useState("Google");
  const [view, setView] = useState("landing");

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [citaActiva, setCitaActiva] = useState(null);
  const [pacienteActivo, setPacienteActivo] = useState(null);
  const [citaPreSesion, setCitaPreSesion] = useState(null);

  async function obtenerPerfilProfesional(currentUser) {
    let { data: perfil } = await supabase
      .from("profesional")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!perfil && currentUser.email) {
      const { data: perfilPorEmail } = await supabase
        .from("profesional")
        .select("*")
        .eq("email", currentUser.email)
        .maybeSingle();

      perfil = perfilPorEmail;
    }

    return perfil;
  }

  function construirUsuarioOperativo(currentUser, perfil) {
    return {
      ...currentUser,
      id: perfil?.id || currentUser.id,
      auth_id: currentUser.id,
      email: currentUser.email,
    };
  }

  async function aplicarSesion(currentUser, selectedProvider = "Google") {
    const perfil = await obtenerPerfilProfesional(currentUser);
    const usuarioOperativo = construirUsuarioOperativo(currentUser, perfil);

    setUser(usuarioOperativo);
    setProfile(perfil);
    setProvider(selectedProvider);
    setIsLoggedIn(true);

    if (!perfil?.nombres || !perfil?.apellidos) {
      setView("profile");
    } else {
      setView("dashboard");
    }
  }

  useEffect(() => {
    async function recuperarSesion() {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session?.user) return;

      await aplicarSesion(session.user, "Google");
    }

    recuperarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;

      await aplicarSesion(session.user, "Google");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(selectedProvider) {
    setProvider(selectedProvider);

    const { data: userData, error } = await supabase.auth.getUser();

    if (error || !userData?.user) {
      alert("No se pudo obtener el usuario autenticado.");
      return;
    }

    await aplicarSesion(userData.user, selectedProvider);
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setIsLoggedIn(false);
    setView("login");
    setSelectedPatient(null);
    setUser(null);
    setProfile(null);
    setCitaActiva(null);
    setPacienteActivo(null);
    setCitaPreSesion(null);
  }

  function verFichaClinica(paciente) {
    setPacienteActivo(paciente);
    setView("ficha-clinica");
  }

  function iniciarFlujo(cita) {
    setCitaPreSesion(cita);
    setView("pre-sesion");
  }

  function iniciarSesionClinica(cita) {
    setCitaActiva(cita);
    setView("sesion-clinica");
  }

  if (view === "landing") {
    return <LandingPage goToApp={() => setView("login")} />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (view === "profile") {
    return (
      <ProfilePage
        user={user}
        onComplete={() => setView("dashboard")}
      />
    );
  }

  if (view === "agenda") {
    return (
      <AgendaPage
        goBack={() => setView("dashboard")}
        iniciarFlujo={iniciarFlujo}
      />
    );
  }

  if (view === "configuracion") {
    return (
      <ConfiguracionPage
        user={user}
        goBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "pre-sesion") {
    return (
      <PreSesionPage
        user={user}
        cita={citaPreSesion}
        iniciarSesionClinica={iniciarSesionClinica}
        goBack={() => setView("agenda")}
      />
    );
  }

  if (view === "sesion-clinica") {
    return (
      <SesionClinicaPage
        user={user}
        cita={citaActiva}
        goBack={() => setView("agenda")}
      />
    );
  }

  if (view === "presesion") {
    return (
      <PreSesionPage
        paciente={selectedPatient}
        goBack={() => setView("agenda")}
        iniciarSesion={() => setView("atencion")}
      />
    );
  }

  if (view === "atencion") {
    return (
      <AtencionPage
        goBack={() => setView("presesion")}
        finalizarSesion={() => setView("documentacion")}
      />
    );
  }

  if (view === "documentacion") {
    return (
      <DocumentacionPage
        goBack={() => setView("atencion")}
        validarGuardar={() => {
          alert("Documento validado y guardado en carpeta del paciente.");
          setView("agenda");
        }}
        goDashboard={() => setView("dashboard")}
        onLogout={handleLogout}
      />
    );
  }

  if (view === "pacientes") {
    return (
      <PacientesPage
        user={user}
        goBack={() => setView("dashboard")}
        verFichaClinica={verFichaClinica}
      />
    );
  }

  if (view === "disponibilidad") {
    return (
      <DisponibilidadPage
        user={user}
        goBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "nueva-cita") {
    return (
      <NuevaCitaPage
        user={user}
        goBack={() => setView("agenda")}
      />
    );
  }

  if (view === "ficha-clinica") {
    return (
      <FichaClinicaPage
        user={user}
        paciente={pacienteActivo}
        goBack={() => setView("pacientes")}
      />
    );
  }

  if (view === "reservar") {
    return (
      <ReservarHoraPage
        profesionalId={user?.id}
        goBack={() => setView("dashboard")}
      />
    );
  }

  return (
    <DashboardPage
      provider={provider}
      onLogout={handleLogout}
      goAgenda={() => setView("agenda")}
      goPacientes={() => setView("pacientes")}
      goDisponibilidad={() => setView("disponibilidad")}
      goConfiguracion={() => setView("configuracion")}
      profile={profile}
      goNuevaCita={() => setView("nueva-cita")}
      goReservar={() => setView("reservar")}
    />
  );
}