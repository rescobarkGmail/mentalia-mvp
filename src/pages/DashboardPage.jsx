import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  FileCheck,
  FileText,
  FileWarning,
  Home,
  Inbox,
  LogOut,
  MailCheck,
  MailWarning,
  MessageCircleCheck,
  MessageCircleWarning,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
} from "lucide-react";
import {
  obtenerCitas,
  obtenerConfiguracionNotificaciones,
  obtenerConsentimientosPaciente,
  obtenerPacientes,
} from "../lib/mentaliaApi";
import AtencionRapidaPanel from "../components/AtencionRapidaPanel";
import { ahoraSantiago } from "../utils/atencionRapida";

function fechaLocalISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function horaCorta(value) {
  return String(value || "").slice(0, 5) || "--:--";
}

function nombrePaciente(cita) {
  const paciente = cita?.pacientes || cita?.paciente || {};
  const nombre = `${paciente.nombres || ""} ${paciente.apellidos || ""}`.trim();
  return nombre || cita?.paciente_nombre || "Paciente sin nombre";
}

function modalidadCita(cita) {
  return String(cita?.modalidad || cita?.tipo_atencion || "").toLowerCase();
}

function esCitaVigente(cita) {
  const estado = String(cita?.estado || "").toLowerCase();
  return !["cancelada", "anulada", "eliminada"].includes(estado);
}

function puedeAbrirAtencion(cita) {
  return ["confirmada", "reprogramada", "en_curso"].includes(
    String(cita?.estado || "").toLowerCase(),
  );
}

const DASHBOARD_CACHE_KEY = "mentalia_dashboard_cache_v1";
const DASHBOARD_REFRESH_INTERVAL_MS = 60 * 1000;

function leerCacheDashboard() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardarCacheDashboard(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify({ ...payload, guardadoEn: new Date().toISOString() }),
    );
  } catch {
    // La caché es solo una mejora visual; si falla, la app sigue funcionando.
  }
}

function SidebarButton({ icon, label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
        active
          ? "bg-[#18AFC1] text-white shadow-sm"
          : disabled
            ? "cursor-not-allowed text-slate-300"
            : "text-slate-500 hover:bg-cyan-50 hover:text-cyan-800"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {disabled ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
          pronto
        </span>
      ) : null}
    </button>
  );
}

function MetricCard({ icon, title, value, text, tone = "cyan" }) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-3xl border border-cyan-50 bg-white p-5 shadow-sm">
      <div
        className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${
          tones[tone] || tones.cyan
        }`}
      >
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function ActionMetricCard({ icon, title, value, text, tone = "cyan", actionLabel, onClick }) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border border-cyan-50 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
    >
      <div
        className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${
          tones[tone] || tones.cyan
        }`}
      >
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{text}</p>
        {actionLabel ? (
          <span className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-black text-white">
            {actionLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ModuleCard({ icon, title, text, onClick, soon }) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className={`rounded-3xl border bg-white p-5 text-left shadow-sm transition ${
        soon
          ? "cursor-not-allowed border-slate-100 opacity-70"
          : "border-cyan-100 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
          {icon}
        </div>
        <div>
          <p className="font-black text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{text}</p>
        </div>
      </div>
      {soon ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">
          Próximamente
        </p>
      ) : null}
    </button>
  );
}

function PendingRow({
  icon,
  title,
  text,
  value,
  tone = "cyan",
  actionLabel,
  onClick,
}) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-500",
  };

  const contenido = (
    <>
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
            tones[tone] || tones.cyan
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-black text-slate-900">{title}</p>
          <p className="truncate text-sm text-slate-500">{text}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actionLabel ? (
          <span className="hidden rounded-full bg-cyan-600 px-3 py-1 text-xs font-black text-white sm:inline-flex">
            {actionLabel}
          </span>
        ) : null}
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
          {value}
        </span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 rounded-3xl bg-slate-50 p-4 text-left transition hover:bg-cyan-50 hover:shadow-sm"
      >
        {contenido}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl bg-slate-50 p-4">
      {contenido}
    </div>
  );
}

export default function DashboardPage({
  provider,
  onLogout,
  goAgenda,
  goPacientes,
  goDisponibilidad,
  goConfiguracion,
  profile,
  goNuevaCita,
  goReservar,
  iniciarAtencionCita,
}) {
  const cacheInicial = useMemo(leerCacheDashboard, []);
  const [citas, setCitas] = useState(() =>
    Array.isArray(cacheInicial?.citas) ? cacheInicial.citas : [],
  );
  const [pacientes, setPacientes] = useState(() =>
    Array.isArray(cacheInicial?.pacientes) ? cacheInicial.pacientes : [],
  );
  const [consentimientosPendientes, setConsentimientosPendientes] =
    useState(
      Number.isFinite(cacheInicial?.consentimientosPendientes)
        ? cacheInicial.consentimientosPendientes
        : null,
    );
  const [notificacionesConfig, setNotificacionesConfig] = useState(
    cacheInicial?.notificacionesConfig || null,
  );
  const [cargando, setCargando] = useState(!cacheInicial);
  const [errorCarga, setErrorCarga] = useState("");
  const [inicioRapido, setInicioRapido] = useState(null);

  const nombreProfesional =
    profile?.nombres || profile?.apellidos
      ? `${profile?.nombres || ""} ${profile?.apellidos || ""}`.trim()
      : "Profesional";

  const emailProfesional = profile?.email || "Sin correo registrado";

  useEffect(() => {
    let activo = true;

    async function cargarDashboard({ silencioso = false } = {}) {
      if (!silencioso) {
        setCargando(true);
      }
      setErrorCarga("");

      try {
        const [citasData, pacientesData, configData] = await Promise.all([
          obtenerCitas(),
          obtenerPacientes(),
          obtenerConfiguracionNotificaciones().catch(() => null),
        ]);

        if (!activo) return;

        const pacientesNormalizados = Array.isArray(pacientesData)
          ? pacientesData
          : [];
        const citasNormalizadas = Array.isArray(citasData) ? citasData : [];

        setCitas(citasNormalizadas);
        setPacientes(pacientesNormalizados);
        setNotificacionesConfig(configData);

        const pacientesParaRevisar = pacientesNormalizados.slice(0, 20);
        const resultadosConsentimientos = await Promise.allSettled(
          pacientesParaRevisar.map((paciente) =>
            obtenerConsentimientosPaciente(paciente.id),
          ),
        );

        if (!activo) return;

        const pendientes = resultadosConsentimientos.reduce((total, item) => {
          if (item.status !== "fulfilled" || !Array.isArray(item.value)) {
            return total;
          }

          return (
            total +
            item.value.filter(
              (consentimiento) =>
                String(consentimiento?.estado || "").toLowerCase() ===
                "pendiente",
            ).length
          );
        }, 0);

        setConsentimientosPendientes(pendientes);
        guardarCacheDashboard({
          citas: citasNormalizadas,
          pacientes: pacientesNormalizados,
          notificacionesConfig: configData,
          consentimientosPendientes: pendientes,
        });
      } catch (error) {
        console.error("DashboardPage: error cargando datos", error);
        if (activo) {
          setErrorCarga(
            "No se pudo cargar todo el resumen operativo. Puedes seguir usando los accesos principales.",
          );
        }
      } finally {
        if (activo && !silencioso) setCargando(false);
      }
    }

    cargarDashboard();

    const intervaloId = window.setInterval(() => {
      cargarDashboard({ silencioso: true });
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    function refrescarAlVolver() {
      if (document.visibilityState === "visible") {
        cargarDashboard({ silencioso: true });
      }
    }

    document.addEventListener("visibilitychange", refrescarAlVolver);

    return () => {
      activo = false;
      window.clearInterval(intervaloId);
      document.removeEventListener("visibilitychange", refrescarAlVolver);
    };
  }, []);

  const resumen = useMemo(() => {
    const hoy = fechaLocalISO();
    const vigentes = citas.filter(esCitaVigente);
    const citasHoy = vigentes
      .filter((cita) => String(cita?.fecha || "").slice(0, 10) === hoy)
      .sort((a, b) =>
        String(a?.hora_inicio || "").localeCompare(String(b?.hora_inicio || "")),
      );

    const confirmadasHoy = citasHoy.filter((cita) =>
      ["confirmada", "reprogramada", "en_curso"].includes(
        String(cita?.estado || "").toLowerCase(),
      ),
    );

    const reservasPendientes = vigentes.filter(
      (cita) =>
        String(cita?.estado || "").toLowerCase() === "pendiente_confirmacion",
    );

    const pacientesIncompletos = pacientes.filter((paciente) => {
      const tieneTelefono = Boolean(paciente?.telefono || paciente?.celular);
      const tieneIdentificador = Boolean(
        paciente?.identificador || paciente?.rut || paciente?.documento,
      );
      const tieneEmail = Boolean(paciente?.email || paciente?.correo);
      return !tieneTelefono || !tieneIdentificador || !tieneEmail;
    });

    const onlineHoy = confirmadasHoy.filter((cita) =>
      modalidadCita(cita).includes("online"),
    ).length;
    const presencialHoy = confirmadasHoy.length - onlineHoy;

    return {
      citasHoy,
      confirmadasHoy,
      onlineHoy,
      presencialHoy,
      proximasCitas: citasHoy.slice(0, 4),
      reservasPendientes,
      pacientesIncompletos,
    };
  }, [citas, pacientes]);

  const cargandoPrimeraVez =
    cargando &&
    citas.length === 0 &&
    pacientes.length === 0 &&
    consentimientosPendientes === null;

  const proximaCita = resumen.proximasCitas[0];
  const hayRecordatoriosWhatsapp =
    notificacionesConfig?.recordatorio_whatsapp_activo === true;
  const hayConfirmacionWhatsapp =
    notificacionesConfig?.confirmacion_reserva_whatsapp === true;
  const hayConfirmacionEmail =
    notificacionesConfig?.confirmacion_reserva_email !== false;

  function abrirCita(cita) {
    if (puedeAbrirAtencion(cita) && iniciarAtencionCita) {
      iniciarAtencionCita(cita);
      return;
    }

    goAgenda?.();
  }

  function abrirAtencionRapida() {
    setInicioRapido(ahoraSantiago());
  }

  function atenderCitaCreada(cita) {
    setInicioRapido(null);

    if (iniciarAtencionCita) {
      iniciarAtencionCita(cita);
      return;
    }

    goAgenda?.();
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] text-slate-800">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 bg-white p-5 shadow-sm lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#18AFC1] text-white">
              <Brain />
            </div>

            <div>
              <h1 className="text-2xl font-black">Mental-IA</h1>
              <p className="text-xs text-slate-500">Panel profesional</p>
            </div>
          </div>

          <nav className="space-y-2">
            <SidebarButton active icon={<Home size={20} />} label="Dashboard" />
            <SidebarButton icon={<CalendarDays size={20} />} label="Agenda" onClick={goAgenda} />
            <SidebarButton icon={<Users size={20} />} label="Pacientes" onClick={goPacientes} />
            <SidebarButton icon={<Plus size={20} />} label="Atención rápida" onClick={abrirAtencionRapida} />
            <SidebarButton icon={<CalendarDays size={20} />} label="Reserva pública" onClick={goReservar} />
            <SidebarButton icon={<CalendarCheck size={20} />} label="Disponibilidad" onClick={goDisponibilidad} />
            <SidebarButton disabled icon={<FileText size={20} />} label="Informes IA" />
            <SidebarButton disabled icon={<BarChart3 size={20} />} label="Indicadores" />
            <SidebarButton icon={<Settings size={20} />} label="Configuración" onClick={goConfiguracion} />
          </nav>

          <div className="mt-8 rounded-3xl bg-cyan-50 p-5">
            <ShieldCheck className="mb-3 text-cyan-700" />
            <p className="font-black">Ambiente DEV</p>
            <p className="mt-1 text-sm text-slate-500">
              Usa este panel para probar flujos antes de producción.
            </p>
          </div>
        </aside>

        <section className="flex-1">
          <header className="flex items-center justify-between bg-white/80 px-6 py-4 shadow-sm">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input
                className="w-full rounded-2xl border border-cyan-100 bg-slate-50 py-3 pl-12 pr-4 outline-none transition focus:border-cyan-300 focus:bg-white"
                placeholder="Buscar paciente, informe o atención..."
              />
            </div>

            <div className="ml-4 flex items-center gap-3">
              <div className="hidden rounded-2xl bg-slate-50 px-4 py-2 text-right md:block">
                <p className="text-sm font-black text-slate-800">{nombreProfesional}</p>
                <p className="text-xs text-slate-500">{emailProfesional}</p>
              </div>
              <button type="button" className="rounded-2xl bg-white p-3 shadow">
                <Bell size={20} />
              </button>
              <button type="button" onClick={onLogout} className="rounded-2xl bg-white p-3 shadow" title="Cerrar sesión">
                <LogOut size={20} />
              </button>
            </div>
          </header>

          <div className="p-6">
            {errorCarga ? (
              <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {errorCarga}
              </div>
            ) : null}

            <section className="mb-6 rounded-[30px] bg-gradient-to-br from-[#18AFC1] to-[#2f80ed] p-7 text-white shadow">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white/70">
                    Centro de control diario
                  </p>
                  <h2 className="mt-2 text-4xl font-black">Hola, {nombreProfesional}</h2>
                  <p className="mt-2 max-w-3xl text-white/85">
                    {proximaCita
                      ? `Hoy: próxima atención ${horaCorta(proximaCita.hora_inicio)} · ${resumen.reservasPendientes.length} reserva(s) pendiente(s).`
                      : `Sesión iniciada con ${provider}. No hay atenciones pendientes para hoy.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={proximaCita ? () => abrirCita(proximaCita) : abrirAtencionRapida}
                  className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-black text-cyan-800"
                >
                  <Plus size={20} />
                  {proximaCita ? "Atender ahora" : "Atención rápida"}
                </button>
              </div>
            </section>

            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<CalendarDays />}
                title="Citas confirmadas hoy"
                value={cargandoPrimeraVez ? "..." : resumen.confirmadasHoy.length}
                text={`${resumen.presencialHoy} presenciales · ${resumen.onlineHoy} online`}
              />
              <ActionMetricCard
                icon={<Inbox />}
                title="Reservas por aceptar"
                value={cargandoPrimeraVez ? "..." : resumen.reservasPendientes.length}
                text={
                  resumen.reservasPendientes.length
                    ? "Click para revisar en agenda"
                    : "sin solicitudes públicas pendientes"
                }
                tone={resumen.reservasPendientes.length ? "amber" : "cyan"}
                actionLabel={resumen.reservasPendientes.length ? "Revisar" : ""}
                onClick={resumen.reservasPendientes.length ? goAgenda : undefined}
              />
              <ActionMetricCard
                icon={<FileCheck />}
                title="Consentimientos pendientes"
                value={consentimientosPendientes === null ? "..." : consentimientosPendientes}
                text={consentimientosPendientes ? "Click para revisar pacientes" : "sin pendientes detectados"}
                tone={consentimientosPendientes ? "amber" : "emerald"}
                actionLabel={consentimientosPendientes ? "Revisar" : ""}
                onClick={goPacientes}
              />
              <MetricCard
                icon={<MessageCircleWarning />}
                title="Comunicaciones fallidas"
                value="0"
                text="pendiente conectar auditoría por canal"
                tone="emerald"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black">Hoy y próximas atenciones</h3>
                    <p className="text-sm text-slate-500">Agenda operativa del día con datos reales de Mentalia.</p>
                  </div>
                  <button type="button" onClick={goAgenda} className="rounded-full border border-cyan-100 px-4 py-2 text-sm font-bold text-cyan-700">
                    Ver agenda
                  </button>
                </div>

                <div className="space-y-3">
                  {cargandoPrimeraVez ? (
                    <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">Cargando agenda del día...</div>
                  ) : resumen.proximasCitas.length ? (
                    resumen.proximasCitas.map((cita) => (
                      <button
                        type="button"
                        key={cita.id}
                        onClick={() => abrirCita(cita)}
                        className="flex w-full items-center justify-between rounded-3xl bg-slate-50 p-4 text-left transition hover:bg-cyan-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-2xl bg-white px-3 py-3 font-black text-cyan-700">
                            {horaCorta(cita.hora_inicio)}
                          </div>
                          <div>
                            <p className="font-black">{nombrePaciente(cita)}</p>
                            <p className="text-sm text-slate-500">
                              {modalidadCita(cita).includes("online") ? "Online" : "Presencial"} ·{" "}
                              {String(cita.estado || "sin estado").replaceAll("_", " ")}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700">
                          {puedeAbrirAtencion(cita) ? "Abrir atención" : "Ver agenda"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="font-black text-slate-800">No tienes citas agendadas para hoy.</p>
                      <p className="mt-1 text-sm text-slate-500">Puedes crear una nueva atención o revisar la agenda semanal.</p>
                      <button type="button" onClick={abrirAtencionRapida} className="mt-4 rounded-2xl bg-[#18AFC1] px-4 py-3 text-sm font-black text-white">
                        Crear atención rápida
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                    <AlertTriangle />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">Pendientes accionables</h3>
                    <p className="text-sm text-slate-500">Lo que conviene revisar antes de seguir atendiendo.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <PendingRow
                    icon={<UserRoundCog size={20} />}
                    title="Pacientes con datos incompletos"
                    text={
                      resumen.pacientesIncompletos.length
                        ? "Click para ir a pacientes y completar ficha"
                        : "Fichas administrativas completas"
                    }
                    value={cargandoPrimeraVez ? "..." : resumen.pacientesIncompletos.length}
                    tone={resumen.pacientesIncompletos.length ? "amber" : "cyan"}
                    actionLabel={
                      resumen.pacientesIncompletos.length
                        ? "Revisar pacientes"
                        : ""
                    }
                    onClick={
                      resumen.pacientesIncompletos.length
                        ? goPacientes
                        : undefined
                    }
                  />
                  <PendingRow icon={<FileWarning size={20} />} title="Informes IA por revisar" text="Pendiente conectar bandeja de borradores" value="—" tone="slate" />
                  <PendingRow icon={<FileText size={20} />} title="Sesiones sin cerrar" text="Pendiente conectar estado clínico" value="—" tone="slate" />
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-black">Accesos principales</h3>
                <p className="mb-5 mt-1 text-sm text-slate-500">Atajos funcionales para operar el día sin navegar de más.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <ModuleCard icon={<CalendarDays />} title="Agenda" text="Citas, horarios y atención rápida" onClick={goAgenda} />
                  <ModuleCard icon={<Users />} title="Pacientes" text="Ficha, antecedentes y documentos" onClick={goPacientes} />
                  <ModuleCard icon={<CalendarCheck />} title="Reserva pública" text="Agenda visible para pacientes" onClick={goReservar} />
                  <ModuleCard icon={<FileCheck />} title="Solicitar consentimientos" text="Revisar estado desde pacientes" onClick={goPacientes} />
                  <ModuleCard icon={<Settings />} title="Notificaciones" text="Recordatorios y mensajes automáticos" onClick={goConfiguracion} />
                  <ModuleCard soon icon={<CreditCard />} title="Pagos y boletas" text="Gestión financiera" />
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                    <MessageCircleCheck />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">Comunicaciones</h3>
                    <p className="text-sm text-slate-500">Estado operativo de avisos y confirmaciones.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <PendingRow
                    icon={hayRecordatoriosWhatsapp ? <MessageCircleCheck size={20} /> : <MessageCircleWarning size={20} />}
                    title="Recordatorios por WhatsApp"
                    text={hayRecordatoriosWhatsapp ? "Activo para citas configuradas" : "No activo o pendiente de configuración"}
                    value={hayRecordatoriosWhatsapp ? "Activo" : "Revisar"}
                    tone={hayRecordatoriosWhatsapp ? "cyan" : "amber"}
                  />
                  <PendingRow
                    icon={hayConfirmacionWhatsapp ? <MessageCircleCheck size={20} /> : <MessageCircleWarning size={20} />}
                    title="Confirmación por WhatsApp"
                    text="Mensaje al reservar o reagendar"
                    value={hayConfirmacionWhatsapp ? "Activo" : "Revisar"}
                    tone={hayConfirmacionWhatsapp ? "cyan" : "amber"}
                  />
                  <PendingRow
                    icon={hayConfirmacionEmail ? <MailCheck size={20} /> : <MailWarning size={20} />}
                    title="Confirmación por correo"
                    text="Respaldo por email para reservas"
                    value={hayConfirmacionEmail ? "Activo" : "Revisar"}
                    tone={hayConfirmacionEmail ? "cyan" : "amber"}
                  />
                </div>
              </div>
            </section>
          </div>

          {inicioRapido && (
            <AtencionRapidaPanel
              inicio={inicioRapido}
              citas={citas}
              eventos={[]}
              onClose={() => setInicioRapido(null)}
              onCreated={atenderCitaCreada}
            />
          )}
        </section>
      </div>
    </main>
  );
}
