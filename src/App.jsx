import React, { useState } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AgendaPage from "./pages/AgendaPage";
import PreSesionPage from "./pages/PreSesionPage";
import AtencionPage from "./pages/AtencionPage";
import DocumentacionPage from "./pages/DocumentacionPage";


export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [provider, setProvider] = useState("Google");
  const [view, setView] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);

  function handleLogin(selectedProvider) {
    setProvider(selectedProvider);
    setIsLoggedIn(true);
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setView("dashboard");
    setSelectedPatient(null);
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

  return (
    <DashboardPage
      provider={provider}
      onLogout={handleLogout}
      goAgenda={() => setView("agenda")}
    />
  );
}