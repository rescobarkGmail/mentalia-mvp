import React, { useState } from "react";
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


export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [provider, setProvider] = useState("Google");
  const [view, setView] = useState("landing");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  async function handleLogin(selectedProvider) {
    setProvider(selectedProvider);

    const { data: userData, error } = await supabase.auth.getUser();

    if (error || !userData?.user) {
      alert("No se pudo obtener el usuario autenticado.");
      return;
    }

    const currentUser = userData.user;
    setUser(currentUser);
    setIsLoggedIn(true);

    const { data: perfil, error: perfilError } = await supabase
      .from("profesional")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (perfilError) {
      alert("No se pudo leer el perfil profesional.");
      return;
    }

    setProfile(perfil);

    if (!perfil?.nombres || !perfil?.apellidos) {
      setView("profile");
    } else {
      setView("dashboard");
    }
    
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setView("login");
    setSelectedPatient(null);
    setUser(null);
    supabase.auth.signOut();
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
        iniciarFlujo={(paciente) => {
          setSelectedPatient(paciente);
          setView("presesion");
        }}
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

  return (
  
    <DashboardPage
    provider={provider}
    onLogout={handleLogout}
    goAgenda={() => setView("agenda")}
    goPacientes={() => setView("pacientes")}
    goDisponibilidad={() => setView("disponibilidad")}
    profile={profile}
    goNuevaCita={() => setView("nueva-cita")}
  />

  
  );
}