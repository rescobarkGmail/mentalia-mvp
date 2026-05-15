import React, { useState } from "react";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AgendaPage from "./pages/AgendaPage";
import PreSesionPage from "./pages/PreSesionPage";
import AtencionPage from "./pages/AtencionPage";
import DocumentacionPage from "./pages/DocumentacionPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [provider, setProvider] = useState("Google");
  const [view, setView] = useState("landing");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("landing");

async function handleLogin() {
  const { data: userData } = await supabase.auth.getUser();

  const currentUser = userData.user;
  setUser(currentUser);

  const { data } = await supabase
    .from("profesional")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (!data.nombres || !data.apellidos) {
    setView("profile");
  } else {
    setView("dashboard");
  }
}

  function handleLogout() {
    setIsLoggedIn(false);
    setView("landing");
    setSelectedPatient(null);
  }

  if (view === "landing") {
    return <LandingPage goToApp={() => setView("login")} />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
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
          alert("Documento validado y guardado en carpeta del paciente (simulado).");
          setView("agenda");
        }}
        goDashboard={() => setView("dashboard")}
        onLogout={handleLogout}
      />
    );
  }


  if (view === "profile") {
    return (
      <ProfilePage
        user={user}
        onComplete={() => setView("dashboard")}
      />
    );
  }
  
  return (
    <DashboardPage
      provider={provider}
      onLogout={handleLogout}
      goAgenda={() => setView("agenda")}
    />
  );
}