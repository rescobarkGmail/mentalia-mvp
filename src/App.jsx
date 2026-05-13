import React, { useState } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [provider, setProvider] = useState("Google");

  function handleLogin(selectedProvider) {
    setProvider(selectedProvider);
    setIsLoggedIn(true);
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <DashboardPage
      provider={provider}
      onLogout={() => setIsLoggedIn(false)}
    />
  );
}