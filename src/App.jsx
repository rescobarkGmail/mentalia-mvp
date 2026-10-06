import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";

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
import ConsentimientoPublicoPage from "./pages/ConsentimientoPublicoPage";
import { PrivacidadPage, TerminosPage } from "./pages/LegalPage";
import AppShell from "./components/AppShell";

const APP_SESSION_CACHE_KEY = "mentalia_app_session_cache_v1";
const APP_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function sesionAppExpirada(iniciadaEn) {
  if (!iniciadaEn) {
    return false;
  }

  const timestamp = new Date(iniciadaEn).getTime();

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return Date.now() - timestamp >= APP_SESSION_MAX_AGE_MS;
}

function leerCacheSesionApp() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(APP_SESSION_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : null;

    if (cache && sesionAppExpirada(cache.iniciadaEn || cache.guardadoEn)) {
      window.localStorage.removeItem(APP_SESSION_CACHE_KEY);
      return null;
    }

    return cache;
  } catch {
    return null;
  }
}

function guardarCacheSesionApp(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      APP_SESSION_CACHE_KEY,
      JSON.stringify({
        ...payload,
        iniciadaEn: payload.iniciadaEn || new Date().toISOString(),
        guardadoEn: new Date().toISOString(),
      }),
    );
  } catch {
    // La caché solo evita parpadeos visuales; si falla, no bloquea la app.
  }
}

function limpiarCacheSesionApp() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(APP_SESSION_CACHE_KEY);
  } catch {
    // Sin acción.
  }
}

function hayCallbackOAuthActual() {
  if (typeof window === "undefined") {
    return false;
  }

  const url = new URL(window.location.href);
  return Boolean(url.searchParams.get("code"));
}

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
  const urlActual = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const partesUrl = urlActual?.pathname.split("/").filter(Boolean) || [];
  const paginaLegal = partesUrl[0] === "privacidad" || partesUrl[0] === "terminos"
    ? partesUrl[0]
    : "";
  const tokenConsentimiento = partesUrl[0] === "consentimiento" ? partesUrl[1] : urlActual?.searchParams.get("token");
  const cacheSesionInicial = leerCacheSesionApp();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(cacheSesionInicial?.user));
  const [authReady, setAuthReady] = useState(Boolean(cacheSesionInicial?.user));
  const [provider, setProvider] = useState(cacheSesionInicial?.provider || "Google");
  const [view, setView] = useState(cacheSesionInicial?.user ? "dashboard" : "login");

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [user, setUser] = useState(cacheSesionInicial?.user || null);
  const [profile, setProfile] = useState(cacheSesionInicial?.profile || null);

  const [citaActiva, setCitaActiva] = useState(null);
  const [pacienteActivo, setPacienteActivo] = useState(null);
  const [origenFichaClinica, setOrigenFichaClinica] = useState("pacientes");
  const [citaPreSesion, setCitaPreSesion] = useState(null);

  const [agendaRefreshKey, setAgendaRefreshKey] = useState(0);

  const viewRef = useRef(view);
  const isLoggedInRef = useRef(isLoggedIn);
  const sesionIniciadaEnRef = useRef(cacheSesionInicial?.iniciadaEn || cacheSesionInicial?.guardadoEn || null);

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

    if (sesionAppExpirada(sesionIniciadaEnRef.current)) {
      await handleLogout();
      return;
    }

    if (!sesionIniciadaEnRef.current) {
      sesionIniciadaEnRef.current = new Date().toISOString();
    }

    const perfil = await obtenerPerfilProfesional(currentUser);
    const usuarioOperativo = construirUsuarioOperativo(currentUser, perfil);

    console.log("App - currentUser auth:", currentUser);
    console.log("App - perfil profesional:", perfil);
    console.log("App - usuario operativo:", usuarioOperativo);

    setUser(usuarioOperativo);
    setProfile(perfil);
    setProvider(selectedProvider);
    setIsLoggedIn(true);
    guardarCacheSesionApp({
      user: usuarioOperativo,
      profile: perfil,
      provider: selectedProvider,
      iniciadaEn: sesionIniciadaEnRef.current,
    });

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
      try {
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
          limpiarCacheSesionApp();
          setView("login");
          return;
        }

        if (inicializacion?.error) {
          console.error("Error procesando el callback de autenticación:", inicializacion.error);
        }

        const session = data?.session;

        if (!session?.user) {
          setIsLoggedIn(false);
          limpiarCacheSesionApp();
          sesionIniciadaEnRef.current = null;
          const hayCallbackOAuth = hayCallbackOAuthActual();
          if (hayCallbackOAuth) {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("code");
            window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`);
          }
          setView("login");
          return;
        }

        if (!sesionIniciadaEnRef.current && !hayCallbackOAuthActual()) {
          await supabase.auth.signOut();
          setIsLoggedIn(false);
          limpiarCacheSesionApp();
          setView("login");
          return;
        }

        if (sesionAppExpirada(sesionIniciadaEnRef.current)) {
          await supabase.auth.signOut();
          setIsLoggedIn(false);
          limpiarCacheSesionApp();
          sesionIniciadaEnRef.current = null;
          setView("login");
          return;
        }

        await aplicarSesion(session.user, "Google", { redirigir: true });
      } finally {
        setAuthReady(true);
      }
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
          limpiarCacheSesionApp();
          sesionIniciadaEnRef.current = null;
          setCitaActiva(null);
          setPacienteActivo(null);
          setCitaPreSesion(null);
        }

        return;
      }

      if (!sesionIniciadaEnRef.current && event !== "SIGNED_IN" && !hayCallbackOAuthActual()) {
        supabase.auth.signOut();
        return;
      }

      if (sesionAppExpirada(sesionIniciadaEnRef.current)) {
        supabase.auth.signOut();
        return;
      }

      // Supabase ejecuta este callback mientras mantiene su bloqueo interno de
      // autenticación. No esperamos aquí consultas adicionales (por ejemplo,
      // obtenerPerfilProfesional), porque esas consultas necesitan leer la
      // sesión y podrían quedar esperando el mismo bloqueo.
      const diferirAplicacionSesion = (redirigir) => {
        setTimeout(() => {
          aplicarSesion(session.user, "Google", { redirigir })
            .catch((error) => {
              console.error("Error aplicando sesión autenticada:", error);
            })
            .finally(() => {
              setAuthReady(true);
            });
        }, 0);
      };

      if (event === "SIGNED_IN") {
        if (!isLoggedInRef.current) {
          setAuthReady(false);
        }
        diferirAplicacionSesion(true);
        return;
      }

      if (event === "INITIAL_SESSION") {
        if (!isLoggedInRef.current) {
          diferirAplicacionSesion(true);
        }
        setAuthReady(true);
        return;
      }

      // Para eventos como TOKEN_REFRESHED o USER_UPDATED no cambiamos la vista.
      // Solo refrescamos user/profile sin mandar al dashboard.
      diferirAplicacionSesion(false);
      setAuthReady(true);
    });

    recuperarSesionInicial();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !sesionIniciadaEnRef.current) {
      return undefined;
    }

    const timestampInicio = new Date(sesionIniciadaEnRef.current).getTime();

    if (!Number.isFinite(timestampInicio)) {
      handleLogout();
      return undefined;
    }

    const tiempoRestante = Math.max(timestampInicio + APP_SESSION_MAX_AGE_MS - Date.now(), 0);
    const timeoutId = window.setTimeout(() => {
      handleLogout();
    }, tiempoRestante);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoggedIn]);

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
    limpiarCacheSesionApp();
    sesionIniciadaEnRef.current = null;
    setCitaActiva(null);
    setPacienteActivo(null);
    setCitaPreSesion(null);
  }

  function verFichaClinica(paciente, origen = "pacientes") {
    setPacienteActivo(paciente);
    setOrigenFichaClinica(origen);
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


  if (paginaLegal === "privacidad") {
    return <PrivacidadPage />;
  }

  if (paginaLegal === "terminos") {
    return <TerminosPage />;
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

  if (tokenConsentimiento) {
    return <ConsentimientoPublicoPage token={tokenConsentimiento} />;
  }

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef8fb] text-slate-800">
        <div className="rounded-3xl bg-white px-8 py-6 text-center shadow">
          <p className="text-lg font-black">Cargando FluyePro...</p>
          <p className="mt-2 text-sm text-slate-500">Estamos recuperando tu sesión.</p>
        </div>
      </main>
    );
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
      <AppShell activeView="agenda" onNavigate={setView}>
        <AgendaPage user={user} refreshKey={agendaRefreshKey} goBack={() => setView("dashboard")} iniciarFlujo={iniciarFlujo} iniciarAtencionRapida={iniciarSesionClinica} verFichaClinica={(paciente) => verFichaClinica(paciente, "agenda")} />
      </AppShell>
    );
  }

  if (view === "configuracion") {
    return (
      <AppShell activeView="configuracion" onNavigate={setView}>
        <ConfiguracionPage user={user} goBack={() => setView("dashboard")} />
      </AppShell>
    );
  }

  if (view === "pre-sesion") {
    return (
      <AppShell activeView="agenda" onNavigate={setView}><PreSesionPage
        user={user}
        cita={citaPreSesion}
        iniciarSesionClinica={iniciarSesionClinica}
        goBack={() => setView("agenda")}
      /></AppShell>
    );
  }

  if (view === "sesion-clinica") {
    return (
      <AppShell activeView="agenda" onNavigate={setView}><SesionClinicaPage
        user={user}
        cita={citaActiva}
        goBack={() => setView("agenda")}
      /></AppShell>
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
      <AppShell activeView="pacientes" onNavigate={setView}><PacientesPage user={user} goBack={() => setView("dashboard")} verFichaClinica={verFichaClinica} /></AppShell>
    );
  }

  if (view === "disponibilidad") {
    return (
      <AppShell activeView="disponibilidad" onNavigate={setView}><DisponibilidadPage user={user} goBack={() => setView("dashboard")} /></AppShell>
    );
  }

  if (view === "nueva-cita") {
    return (
      <AppShell activeView="nueva-cita" onNavigate={setView}><NuevaCitaPage user={user} goBack={() => setView("agenda")} /></AppShell>
    );
  }

  if (view === "ficha-clinica") {
    return (
      <AppShell activeView="pacientes" onNavigate={setView}><FichaClinicaPage
        user={user}
        paciente={pacienteActivo}
        goBack={() => setView(origenFichaClinica)}
      /></AppShell>
    );
  }

  if (view === "reservar") {
    return (
      <ReservarHoraPage
        profesionalId={user?.id}
        slug={profile?.slug_publico || ""}
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
      iniciarAtencionCita={iniciarSesionClinica}
    />
  );
}
