import React, { useEffect, useRef, useState } from "react";
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


function obtenerReservaPublicaDesdeUrl() {
  if (typeof window === "undefined") {
    return { esReservaPublica: false, slugProfesional: "", profesionalId: "" };
  }

  const url = new URL(window.location.href);
  const partes = url.pathname.split("/").filter(Boolean);
  const esRutaReservar = partes[0] === "reservar";
  const viewParam = url.searchParams.get("view");
  const esQueryReservar = viewParam === "reservar";

  if (!esRutaReservar && !esQueryReservar) {
    return { esReservaPublica: false, slugProfesional: "", profesionalId: "" };
  }

  const slugProfesional =
    (esRutaReservar && partes[1] ? decodeURIComponent(partes[1]) : "") ||
    url.searchParams.get("slug") ||
    url.searchParams.get("profesional") ||
    "";

  const profesionalId =
    url.searchParams.get("profesional_id") ||
    url.searchParams.get("id_profesional") ||
    "";

  return {
    esReservaPublica: true,
    slugProfesional: slugProfesional.trim().toLowerCase(),
    profesionalId: profesionalId.trim(),
  };
}

export default function App() {
  const reservaPublica = obtenerReservaPublicaDesdeUrl();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [provider, setProvider] = useState("Google");
  const [view, setView] = useState("landing");

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [citaActiva, setCitaActiva] = useState(null);
  const [pacienteActivo, setPacienteActivo] = useState(null);
  const [citaPreSesion, setCitaPreSesion] = useState(null);

  const [agendaRefreshKey, setAgendaRefreshKey] = useState(0);

  const viewRef = useRef(view);
  const isLoggedInRef = useRef(isLoggedIn);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  async function obtenerPerfilProfesional(currentUser) {
    if (!currentUser?.id && !currentUser?.email) return null;

    let perfil = null;

    if (currentUser?.id) {
      const { data, error } = await supabase
        .from("profesional")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) {
        console.error("Error buscando profesional por id:", error);
      }

      perfil = data;
    }

    if (!perfil && currentUser?.email) {
      const { data, error } = await supabase
        .from("profesional")
        .select("*")
        .eq("email", currentUser.email)
        .maybeSingle();

      if (error) {
        console.error("Error buscando profesional por email:", error);
      }

      perfil = data;
    }

    return perfil;
  }

  function construirUsuarioOperativo(currentUser, perfil) {
    return {
      ...currentUser,

      // Este es el ID que debe usar Mentalia para consultar:
      // citas, disponibilidad, pacientes, sesiones, configuración, etc.
      id: perfil?.id || currentUser.id,

      // Este queda como referencia del usuario autenticado en Supabase Auth.
      auth_id: currentUser.id,

      email: currentUser.email,
    };
  }

  async function aplicarSesion(
    currentUser,
    selectedProvider = "Google",
    opciones = { redirigir: true }
  ) {
    if (!currentUser) return;

    const perfil = await obtenerPerfilProfesional(currentUser);
    const usuarioOperativo = construirUsuarioOperativo(currentUser, perfil);

    console.log("App - currentUser auth:", currentUser);
    console.log("App - perfil profesional:", perfil);
    console.log("App - usuario operativo:", usuarioOperativo);

    setUser(usuarioOperativo);
    setProfile(perfil);
    setProvider(selectedProvider);
    setIsLoggedIn(true);

    const debeRedirigir = opciones?.redirigir !== false;

    if (!debeRedirigir) return;

    const vistaActual = viewRef.current;

    const vistasDeEntrada = ["landing", "login"];

    if (!perfil?.nombres || !perfil?.apellidos) {
      setView("profile");
      return;
    }

    if (vistasDeEntrada.includes(vistaActual)) {
      setView("dashboard");
    }
  }

  useEffect(() => {
    async function recuperarSesionInicial() {
      // Supabase procesa automáticamente el callback PKCE y espera a que la
      // sesión quede disponible antes de resolver getSession().
      const inicializacion = await supabase.auth.initialize();
      const { data, error } = await supabase.auth.getSession();

      // OAuth puede regresar temporalmente con tokens en el fragmento/hash.
      // La sesión ya fue procesada por Supabase; se elimina de la barra de
      // direcciones para no exponer credenciales en historial, capturas o logs.
      if (typeof window !== "undefined" && /(?:^|#|&)access_token=|(?:^|#|&)refresh_token=|(?:^|#|&)provider_token=/.test(window.location.hash)) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = "";
        window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`);
      }

      if (error) {
        console.error("Error recuperando sesión:", error);
        setIsLoggedIn(false);
        setView("login");
        return;
      }

      if (inicializacion?.error) {
        console.error("Error procesando el callback de autenticación:", inicializacion.error);
      }

      const session = data?.session;

      if (!session?.user) {
        setIsLoggedIn(false);
        const hayCallbackOAuth =
          typeof window !== "undefined" &&
          Boolean(new URL(window.location.href).searchParams.get("code"));
        if (hayCallbackOAuth) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`);
        }
        setView(hayCallbackOAuth ? "login" : "landing");
        return;
      }

      await aplicarSesion(session.user, "Google", { redirigir: true });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("App - onAuthStateChange:", event);

      if (!session?.user) {
        if (event === "SIGNED_OUT") {
          setIsLoggedIn(false);
          setView("login");
          setSelectedPatient(null);
          setUser(null);
          setProfile(null);
          setCitaActiva(null);
          setPacienteActivo(null);
          setCitaPreSesion(null);
        }

        return;
      }

      // Supabase ejecuta este callback mientras mantiene su bloqueo interno de
      // autenticación. No esperamos aquí consultas adicionales (por ejemplo,
      // obtenerPerfilProfesional), porque esas consultas necesitan leer la
      // sesión y podrían quedar esperando el mismo bloqueo.
      const diferirAplicacionSesion = (redirigir) => {
        setTimeout(() => {
          aplicarSesion(session.user, "Google", { redirigir }).catch((error) => {
            console.error("Error aplicando sesión autenticada:", error);
          });
        }, 0);
      };

      if (event === "SIGNED_IN") {
        diferirAplicacionSesion(true);
        return;
      }

      if (event === "INITIAL_SESSION") {
        if (!isLoggedInRef.current) {
          diferirAplicacionSesion(true);
        }
        return;
      }

      // Para eventos como TOKEN_REFRESHED o USER_UPDATED no cambiamos la vista.
      // Solo refrescamos user/profile sin mandar al dashboard.
      diferirAplicacionSesion(false);
    });

    recuperarSesionInicial();

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

    await aplicarSesion(userData.user, selectedProvider, { redirigir: true });
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

  function volverDashboardDesdeReserva() {
    setAgendaRefreshKey((actual) => actual + 1);
    setView("dashboard");
  }


  if (reservaPublica.esReservaPublica) {
    return (
      <ReservarHoraPage
        modoPublico={true}
        slug={reservaPublica.slugProfesional}
        profesionalId={reservaPublica.profesionalId}
      />
    );
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
        user={user}
        refreshKey={agendaRefreshKey}
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
        goBack={volverDashboardDesdeReserva}
        onReservaExitosa={() => {
          setAgendaRefreshKey((actual) => actual + 1);
        }}
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
