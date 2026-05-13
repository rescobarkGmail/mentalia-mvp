import React, { useState } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AgendaPage from "./pages/AgendaPage";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [provider, setProvider] = useState("Google");
  const [view, setView] = useState("dashboard");

  function handleLogin(selectedProvider) {
    setProvider(selectedProvider);
    setIsLoggedIn(true);
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (view === "agenda") {
    return (
      <AgendaPage
        goBack={() => setView("dashboard")}
        iniciarFlujo={(paciente) => {
          console.log("Iniciando flujo:", paciente);
        }}
      />
    );
  }

  return (
    <DashboardPage
      provider={provider}
      onLogout={() => setIsLoggedIn(false)}
      goAgenda={() => setView("agenda")}
    />
  );
}