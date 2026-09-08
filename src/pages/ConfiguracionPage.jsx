import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Bell, Clock3, Mail, MessageCircle, Save } from "lucide-react";
import {
  guardarConfiguracionNotificaciones,
  obtenerConfiguracionNotificaciones,
} from "../lib/mentaliaApi";

const opciones = [
  {
    id: "mentalia_cloud",
    titulo: "Mentalia Cloud",
    descripcion: "Los datos clínicos se almacenan en la nube segura de Mentalia.",
  },
  {
    id: "google_drive",
    titulo: "Google Drive",
    descripcion: "Próximamente: almacenar documentos clínicos en Drive del profesional.",
  },
  {
    id: "onedrive",
    titulo: "OneDrive",
    descripcion: "Próximamente: almacenar documentos clínicos en OneDrive del profesional.",
  },
  {
    id: "local",
    titulo: "Equipo local",
    descripcion: "Próximamente: exportar y almacenar en el computador del profesional.",
  },
];

const CONFIGURACION_NOTIFICACIONES_INICIAL = {
  confirmacion_reserva_email: true,
  confirmacion_reserva_whatsapp: false,
  cambios_reserva_email: true,
  cambios_reserva_whatsapp: false,
  recordatorio_email_activo: true,
  recordatorio_whatsapp_activo: false,
  horas_antes_recordatorio_email: 27,
  minutos_antes_recordatorio_whatsapp: 60,
  zona_horaria: "America/Santiago",
};

function Interruptor({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-black transition ${
        checked ? "text-cyan-700" : "text-slate-500"
      }`}
    >
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
          checked ? "bg-cyan-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span>{checked ? "ON" : "OFF"}</span>
    </button>
  );
}

export default function ConfiguracionPage({ user, goBack }) {
  const [storageProvider, setStorageProvider] = useState("mentalia_cloud");
  const [guardando, setGuardando] = useState(false);
  const [slugPublico, setSlugPublico] = useState("");
  const [reservaPublicaActiva, setReservaPublicaActiva] = useState(false);
  const [guardandoReservaPublica, setGuardandoReservaPublica] = useState(false);
  const [mensajeReservaPublica, setMensajeReservaPublica] = useState("");
  const [configuracionNotificaciones, setConfiguracionNotificaciones] = useState(
    CONFIGURACION_NOTIFICACIONES_INICIAL,
  );
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(true);
  const [guardandoNotificaciones, setGuardandoNotificaciones] = useState(false);
  const [mensajeNotificaciones, setMensajeNotificaciones] = useState("");

  useEffect(() => {
    cargarConfiguracion();
  }, [user?.id]);

  async function cargarConfiguracion() {
    const { data, error } = await supabase
      .from("profesionales_config")
      .select("*")
      .eq("profesional_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("No fue posible cargar la configuración de almacenamiento:", error);
    }

    if (data) {
      setStorageProvider(data.storage_provider || "mentalia_cloud");
    }

    const { data: profesional, error: profesionalError } = await supabase
      .from("profesional")
      .select("slug_publico, reserva_publica_activa")
      .eq("id", user.id)
      .maybeSingle();

    if (profesionalError) {
      console.error("No fue posible cargar la reserva pública:", profesionalError);
      setCargandoNotificaciones(false);
      return;
    }

    setSlugPublico(profesional?.slug_publico || "");
    setReservaPublicaActiva(Boolean(profesional?.reserva_publica_activa));

    setCargandoNotificaciones(true);
    try {
      const notificaciones = await obtenerConfiguracionNotificaciones();
      setConfiguracionNotificaciones((actual) => ({
        ...actual,
        ...(notificaciones || {}),
      }));
      setMensajeNotificaciones("");
    } catch (notificacionesError) {
      console.error("No fue posible cargar las notificaciones:", notificacionesError);
      setMensajeNotificaciones(
        notificacionesError.code === "NOTIFICATION_SETTINGS_LOOKUP_FAILED"
          ? "Falta habilitar la configuración de notificaciones. Ejecuta el archivo notificaciones_config.sql en el proyecto y vuelve a cargar."
          : "No fue posible cargar las preferencias de notificaciones. Verifica tu sesión y la conexión con la API.",
      );
    } finally {
      setCargandoNotificaciones(false);
    }
  }

  function normalizarSlug(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  const enlaceReservaPublica =
    typeof window !== "undefined" && slugPublico
      ? `${window.location.origin}/reservar/${slugPublico}`
      : "";

  async function guardarReservaPublica() {
    const slug = normalizarSlug(slugPublico);

    if (!slug) {
      setMensajeReservaPublica("Define un identificador para crear el enlace público.");
      return;
    }

    setSlugPublico(slug);
    setGuardandoReservaPublica(true);
    setMensajeReservaPublica("");

    const { error } = await supabase
      .from("profesional")
      .update({
        slug_publico: slug,
        reserva_publica_activa: reservaPublicaActiva,
      })
      .eq("id", user.id);

    setGuardandoReservaPublica(false);

    if (error) {
      setMensajeReservaPublica(`No fue posible guardar la reserva pública: ${error.message}`);
      return;
    }

    setMensajeReservaPublica("Configuración de reserva pública guardada.");
  }

  async function copiarEnlaceReservaPublica() {
    if (!enlaceReservaPublica) return;

    try {
      await navigator.clipboard.writeText(enlaceReservaPublica);
      setMensajeReservaPublica("Enlace copiado al portapapeles.");
    } catch {
      setMensajeReservaPublica("No se pudo copiar automáticamente. Selecciona y copia el enlace.");
    }
  }

  async function guardarConfiguracion(nuevoValor) {
    setStorageProvider(nuevoValor);
    setGuardando(true);

    const { data: existente } = await supabase
      .from("profesionales_config")
      .select("id")
      .eq("profesional_id", user.id)
      .maybeSingle();

    let error;

    if (existente) {
      const response = await supabase
        .from("profesionales_config")
        .update({
          storage_provider: nuevoValor,
        })
        .eq("id", existente.id)
        .eq("profesional_id", user.id);

      error = response.error;
    } else {
      const response = await supabase
        .from("profesionales_config")
        .insert([
          {
            profesional_id: user.id,
            storage_provider: nuevoValor,
          },
        ]);

      error = response.error;
    }

    setGuardando(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Configuración guardada correctamente.");
  }

  function cambiarNotificacion(campo, valor) {
    setConfiguracionNotificaciones((actual) => ({
      ...actual,
      [campo]: valor,
    }));
    setMensajeNotificaciones("");
  }

  async function guardarNotificaciones() {
    setGuardandoNotificaciones(true);
    setMensajeNotificaciones("");

    try {
      const guardada = await guardarConfiguracionNotificaciones(configuracionNotificaciones);
      setConfiguracionNotificaciones((actual) => ({
        ...actual,
        ...(guardada || {}),
      }));
      setMensajeNotificaciones("Configuración de notificaciones guardada.");
    } catch (error) {
      console.error("No fue posible guardar las notificaciones:", error);
      setMensajeNotificaciones(error.message || "No fue posible guardar las notificaciones.");
    } finally {
      setGuardandoNotificaciones(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] p-6">
      <div className="mx-auto max-w-4xl">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <section className="rounded-3xl bg-white p-6 shadow">
          <h1 className="text-3xl font-black text-slate-900">
            Configuración
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Define dónde se almacenarán los datos clínicos del profesional.
          </p>

          <div className="mt-6 space-y-4">
            {opciones.map((opcion) => {
              const activo = storageProvider === opcion.id;

              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => guardarConfiguracion(opcion.id)}
                  disabled={guardando}
                  className={`w-full rounded-2xl border p-5 text-left transition ${
                    activo
                      ? "border-cyan-600 bg-cyan-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-slate-900">
                        {opcion.titulo}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {opcion.descripcion}
                      </p>
                    </div>

                    <div
                      className={`flex h-7 w-14 items-center rounded-full p-1 ${
                        activo ? "bg-[#18AFC1]" : "bg-slate-300"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white transition ${
                          activo ? "translate-x-7" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-5">
            <p className="font-black text-slate-800">
              Configuración actual:
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {opciones.find((o) => o.id === storageProvider)?.titulo}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow">
          <h2 className="text-2xl font-black text-slate-900">Reserva pública</h2>
          <p className="mt-2 text-sm text-slate-500">
            Comparte este enlace para que tus pacientes puedan elegir una hora según tu disponibilidad.
          </p>

          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-cyan-50 p-4">
            <div>
              <p className="font-black text-slate-800">Permitir reservas públicas</p>
              <p className="mt-1 text-xs text-slate-500">
                Si está desactivado, el enlace no mostrará tus horarios.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reservaPublicaActiva}
              aria-label="Activar o desactivar reservas públicas"
              onClick={() => setReservaPublicaActiva((activo) => !activo)}
              className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-black transition ${reservaPublicaActiva ? "text-cyan-700" : "text-slate-500"}`}
            >
              <span className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${reservaPublicaActiva ? "bg-cyan-600" : "bg-slate-300"}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${reservaPublicaActiva ? "translate-x-5" : "translate-x-0"}`} />
              </span>
              <span>{reservaPublicaActiva ? "ON" : "OFF"}</span>
            </button>
          </div>

          <label className="mt-5 block">
            <span className="mb-1 block text-sm font-black text-slate-700">Identificador del enlace</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                <span className="shrink-0">/reservar/</span>
                <input
                  value={slugPublico}
                  onChange={(e) => setSlugPublico(normalizarSlug(e.target.value))}
                  placeholder="nombre-profesional"
                  className="min-w-0 flex-1 bg-transparent px-1 text-slate-800 outline-none"
                />
              </div>
              <button type="button" onClick={guardarReservaPublica} disabled={guardandoReservaPublica} className="rounded-xl bg-[#18AFC1] px-4 py-2 font-black text-white disabled:opacity-60">
                {guardandoReservaPublica ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </label>

          {enlaceReservaPublica && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Enlace para pacientes</p>
              <p className="mt-2 break-all text-sm font-bold text-cyan-700">{enlaceReservaPublica}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={copiarEnlaceReservaPublica} className="rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-black text-cyan-700">Copiar enlace</button>
                <a href={enlaceReservaPublica} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">Abrir enlace</a>
              </div>
            </div>
          )}

          {mensajeReservaPublica && <p className={`mt-3 text-sm font-bold ${mensajeReservaPublica.startsWith("No") ? "text-red-600" : "text-emerald-700"}`}>{mensajeReservaPublica}</p>}
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                  <Bell size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Notificaciones de reservas
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Define qué avisos recibirá el paciente cuando cambie el estado de su reserva.
                  </p>
                </div>
              </div>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              Configuración inicial
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
            En este paso solo dejamos configuradas tus preferencias. Los envíos de correo y WhatsApp se habilitarán en los pasos siguientes.
            No se enviará ningún mensaje mientras no exista un proveedor conectado.
          </div>

          {cargandoNotificaciones ? (
            <p className="mt-5 text-sm font-bold text-slate-500">
              Cargando preferencias...
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <Mail className="text-cyan-700" size={20} />
                  <div>
                    <h3 className="font-black text-slate-900">Avisos por correo</h3>
                    <p className="text-xs text-slate-500">Mensajes administrativos enviados a la dirección registrada por el paciente.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <div>
                      <p className="font-bold text-slate-800">Reserva aceptada</p>
                      <p className="text-xs text-slate-500">Avisar cuando el profesional confirme la hora.</p>
                    </div>
                    <Interruptor
                      checked={configuracionNotificaciones.confirmacion_reserva_email}
                      onChange={(valor) => cambiarNotificacion("confirmacion_reserva_email", valor)}
                      label="Aviso por correo de reserva aceptada"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <div>
                      <p className="font-bold text-slate-800">Cambios de la reserva</p>
                      <p className="text-xs text-slate-500">Avisar cancelaciones y reprogramaciones.</p>
                    </div>
                    <Interruptor
                      checked={configuracionNotificaciones.cambios_reserva_email}
                      onChange={(valor) => cambiarNotificacion("cambios_reserva_email", valor)}
                      label="Avisos por correo de cambios de reserva"
                    />
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Recordatorio de cita</p>
                      <p className="text-xs text-slate-500">Enviar un correo antes de la atención.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <span>Horas antes</span>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={configuracionNotificaciones.horas_antes_recordatorio_email}
                          onChange={(e) => cambiarNotificacion("horas_antes_recordatorio_email", Number(e.target.value))}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-black text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </label>
                      <Interruptor
                        checked={configuracionNotificaciones.recordatorio_email_activo}
                        onChange={(valor) => cambiarNotificacion("recordatorio_email_activo", valor)}
                        label="Recordatorio de cita por correo"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <MessageCircle className="text-cyan-700" size={20} />
                  <div>
                    <h3 className="font-black text-slate-900">Avisos por WhatsApp</h3>
                    <p className="text-xs text-slate-500">Requiere un número válido y autorización del paciente.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <div>
                      <p className="font-bold text-slate-800">Reserva aceptada</p>
                      <p className="text-xs text-slate-500">Avisar cuando el profesional confirme la hora.</p>
                    </div>
                    <Interruptor
                      checked={configuracionNotificaciones.confirmacion_reserva_whatsapp}
                      onChange={(valor) => cambiarNotificacion("confirmacion_reserva_whatsapp", valor)}
                      label="Aviso por WhatsApp de reserva aceptada"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <div>
                      <p className="font-bold text-slate-800">Cambios de la reserva</p>
                      <p className="text-xs text-slate-500">Avisar cancelaciones y reprogramaciones.</p>
                    </div>
                    <Interruptor
                      checked={configuracionNotificaciones.cambios_reserva_whatsapp}
                      onChange={(valor) => cambiarNotificacion("cambios_reserva_whatsapp", valor)}
                      label="Avisos por WhatsApp de cambios de reserva"
                    />
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Recordatorio cercano</p>
                      <p className="text-xs text-slate-500">Enviar un WhatsApp antes de la atención.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <span>Minutos antes</span>
                        <input
                          type="number"
                          min="5"
                          max="1440"
                          value={configuracionNotificaciones.minutos_antes_recordatorio_whatsapp}
                          onChange={(e) => cambiarNotificacion("minutos_antes_recordatorio_whatsapp", Number(e.target.value))}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-black text-slate-700 outline-none focus:border-cyan-500"
                        />
                      </label>
                      <Interruptor
                        checked={configuracionNotificaciones.recordatorio_whatsapp_activo}
                        onChange={(valor) => cambiarNotificacion("recordatorio_whatsapp_activo", valor)}
                        label="Recordatorio de cita por WhatsApp"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock3 size={16} />
                  <span>Zona horaria usada para recordatorios: America/Santiago</span>
                </div>
                <button
                  type="button"
                  onClick={guardarNotificaciones}
                  disabled={guardandoNotificaciones}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18AFC1] px-5 py-3 font-black text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={18} />
                  {guardandoNotificaciones ? "Guardando..." : "Guardar notificaciones"}
                </button>
              </div>
            </div>
          )}

          {mensajeNotificaciones && (
            <p className={`mt-3 text-sm font-bold ${mensajeNotificaciones.startsWith("No") ? "text-red-600" : "text-emerald-700"}`}>
              {mensajeNotificaciones}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
