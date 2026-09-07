import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Building2, MapPin, Shuffle, Video } from "lucide-react";
import { formatearFecha } from "../utils/formato";
import {
  obtenerAccessTokenGoogleCalendar,
  obtenerEventosDeLaSemana,
  actualizarEventoGoogleCalendar,
} from "../lib/googleCalendarClient";
import {
  cancelarCita as cancelarCitaApi,
  obtenerCitas,
  obtenerDisponibilidad,
  obtenerAgendaOperativa,
  obtenerPacientes,
  reprogramarCita,
  vincularEventoPaciente,
} from "../lib/mentaliaApi";

const dias = [
  { id: 1, nombre: "Lunes" },
  { id: 2, nombre: "Martes" },
  { id: 3, nombre: "Miércoles" },
  { id: 4, nombre: "Jueves" },
  { id: 5, nombre: "Viernes" },
  { id: 6, nombre: "Sábado" },
  { id: 7, nombre: "Domingo" },
];

function fechaTexto(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inicioSemana(fechaBase) {
  const fecha = new Date(fechaBase);
  fecha.setHours(0, 0, 0, 0);

  const dia = fecha.getDay() === 0 ? 7 : fecha.getDay();
  fecha.setDate(fecha.getDate() - dia + 1);

  return fecha;
}

function sumarDias(fecha, cantidadDias) {
  const nueva = new Date(fecha);
  nueva.setDate(nueva.getDate() + cantidadDias);
  return nueva;
}

function generarSlots(horaInicio, horaFin, duracion, descanso = 0) {
  const [hi, mi] = String(horaInicio).slice(0, 5).split(":").map(Number);
  const [hf, mf] = String(horaFin).slice(0, 5).split(":").map(Number);
  let actual = hi * 60 + mi;
  const fin = hf * 60 + mf;
  const slots = [];
  while (actual + Number(duracion) <= fin) {
    const siguiente = actual + Number(duracion);
    const formato = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
    slots.push({ hora_inicio: formato(actual), hora_fin: formato(siguiente) });
    actual = siguiente + Number(descanso || 0);
  }
  return slots;
}

function ModalidadAgenda({ modalidad = "presencial" }) {
  const config = { presencial: ["Presencial", Building2], online: ["Online", Video], hibrida: ["Híbrida", Shuffle], domicilio: ["A domicilio", MapPin] }[modalidad] || ["Presencial", Building2];
  const [label, Icon] = config;
  return <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-1.5 py-0.5 text-[9px] font-black text-cyan-700"><Icon size={11} aria-hidden="true" />{label}</span>;
}

function extraerFechaDesdeISO(fechaISO) {
  if (!fechaISO) return null;
  return fechaISO.slice(0, 10);
}

function StatusBadge({ status }) {
  const styles = {
    reservada: "bg-slate-700 text-white",
    confirmada: "bg-slate-700 text-white",
    pendiente: "bg-yellow-100 text-yellow-700",
    cancelada: "bg-red-100 text-red-700",
    reprogramada: "bg-blue-100 text-blue-700",
    pendiente_vinculacion: "bg-amber-100 text-amber-700",
    no_presentada: "bg-orange-100 text-orange-700",
    realizada: "bg-emerald-100 text-emerald-700",
  };

  function slotsMentaliaDelDia(fechaObj) {
    const fecha = fechaTexto(fechaObj);
    const dia = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
    const reglas = disponibilidad.filter((regla) =>
      (regla.activo === undefined || regla.activo === true) &&
      Number(regla.dia_semana) === dia &&
      String(regla.fecha_inicio || "") <= fecha && String(regla.fecha_fin || "") >= fecha
    );
    return reglas.flatMap((regla) => generarSlots(regla.hora_inicio, regla.hora_fin, regla.duracion_minutos, regla.descanso_minutos).map((slot) => ({ ...slot, fecha })));
  }

  function eventoGoogleEnHora(fecha, hora) {
    return eventosGoogleCalendar.filter((evento) => {
      const inicio = evento.fecha_inicio ? new Date(evento.fecha_inicio) : null;
      return inicio && !Number.isNaN(inicio.getTime()) && fechaTexto(inicio) === fecha && inicio.getHours() === hora;
    });
  }

  function renderHorarioCronologicoAgenda() {
    const horas = Array.from({ length: 24 }, (_, index) => index);
    const slotsPorDia = diasSemana.map(slotsMentaliaDelDia);
    return (
      <div ref={timelineRef} className="max-h-[680px] overflow-auto rounded-xl">
        <div className="min-w-[1050px]">
          <div className="sticky top-0 z-10 grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] gap-px bg-slate-200 p-px">
            <div className="bg-white p-2" />
            {diasSemana.map((fechaObj) => <div key={fechaTexto(fechaObj)} className="bg-white p-2 text-center"><p className="font-black text-cyan-700">{dias.find((d) => d.id === (fechaObj.getDay() || 7))?.nombre}</p><p className="text-xs text-slate-500">{formatearFecha(fechaTexto(fechaObj))}</p></div>)}
          </div>
          {horas.map((hora) => {
            const haySlots = slotsPorDia.some((slots) => slots.some((slot) => Number(slot.hora_inicio.slice(0, 2)) === hora));
            return <div key={hora} data-hour={hora} className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] gap-px bg-slate-200 p-px">
              <div className={`${haySlots ? "min-h-0" : "min-h-[28px]"} bg-slate-50 p-1 text-center text-sm font-black text-slate-500`}>{String(hora).padStart(2, "0")}:00</div>
              {diasSemana.map((fechaObj, index) => {
                const fecha = fechaTexto(fechaObj);
                const slots = slotsPorDia[index].filter((slot) => Number(slot.hora_inicio.slice(0, 2)) === hora);
                const eventos = googleCalendarActivo ? eventoGoogleEnHora(fecha, hora) : [];
                const citaParaSlot = (slot) => citas.find((cita) => cita.fecha?.slice(0, 10) === fecha && cita.hora_inicio?.slice(0, 5) === slot.hora_inicio && cita.estado !== "cancelada");
                return <div key={`${fecha}-${hora}`} className={`${haySlots ? "min-h-0" : "min-h-[28px]"} bg-white p-1`}>
                  <div className="space-y-1">
                    {eventos.map((evento) => <div key={evento.google_calendar_event_id || evento.id} className="rounded-lg border border-blue-300 bg-blue-100 px-2 py-1.5 text-xs font-bold leading-tight text-blue-800" title={evento.titulo}><span>{evento.hora_inicio || `${String(hora).padStart(2, "0")}:00`}{evento.hora_fin ? ` - ${evento.hora_fin}` : ""}</span><p className="line-clamp-1 text-[10px]">{evento.titulo || "Evento Google"}</p></div>)}
                    {slots.map((slot) => { const cita = citaParaSlot(slot); return cita ? <div key={`${fecha}-${slot.hora_inicio}`} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-bold text-red-700"><span>{slot.hora_inicio} - {slot.hora_fin}</span><p className="line-clamp-1 text-[10px]">{`${cita.pacientes?.nombres || ""} ${cita.pacientes?.apellidos || ""}`.trim() || "Reservado"}</p></div> : <div key={`${fecha}-${slot.hora_inicio}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-700">{slot.hora_inicio} - {slot.hora_fin}</div>; })}
                  </div>
                </div>;
              })}
            </div>;
          })}
        </div>
      </div>
    );
  }

  function cambiarSemanaAgenda(cantidadDias) {
    if (timelineRef.current) scrollPreservadoRef.current = timelineRef.current.scrollTop;
    setSemanaBase((prev) => inicioSemana(sumarDias(prev, cantidadDias)));
  }

  return (
    <span
      className={`inline-flex max-w-full rounded-full px-2 py-1 text-[10px] font-bold uppercase leading-none ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status || "sin estado"}
    </span>
  );
}

export default function AgendaPage({
  user,
  refreshKey = 0,
  goBack,
  iniciarFlujo,
}) {
  const [view, setView] = useState("week");
  const [citas, setCitas] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [semanaBase, setSemanaBase] = useState(inicioSemana(new Date()));
  const [citaEditando, setCitaEditando] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [cargando, setCargando] = useState(false);

  const [eventosGoogleCalendar, setEventosGoogleCalendar] = useState([]);
  const [cargandoGoogleCalendar, setCargandoGoogleCalendar] = useState(false);
  const [errorGoogleCalendar, setErrorGoogleCalendar] = useState("");
  const [googleCalendarActivo, setGoogleCalendarActivo] = useState(false);
  const timelineRef = useRef(null);
  const scrollPreservadoRef = useRef(null);
  const [eventoGoogleSeleccionado, setEventoGoogleSeleccionado] =
    useState(null);

  const [pacientes, setPacientes] = useState([]);
  const [cargandoPacientes, setCargandoPacientes] = useState(false);
  const [pacienteSeleccionadoId, setPacienteSeleccionadoId] = useState("");
  const [busquedaPaciente, setBusquedaPaciente] = useState("");

  const [atencionGoogleVinculada, setAtencionGoogleVinculada] =
    useState(null);
  const [atencionesGoogleVinculadas, setAtencionesGoogleVinculadas] =
    useState([]);
  const [guardandoVinculacion, setGuardandoVinculacion] = useState(false);

  async function cargarCitas() {
    if (!user?.id) {
      console.warn("AgendaPage: user.id aún no disponible.", user);
      setCargando(false);
      return;
    }

    setCargando(true);

    try {
      const [citasData, disponibilidadData] = await Promise.all([
        obtenerCitas(),
        obtenerDisponibilidad(),
      ]);
      setCitas(citasData || []);
      setDisponibilidad(disponibilidadData || []);
    } catch (error) {
      console.error("AgendaPage - error inesperado:", error);
      alert("Error inesperado cargando agenda: " + error.message);
    } finally {
      setCargando(false);
    }
  }

  async function cargarPacientes() {
    if (!user?.id) {
      console.warn("No se puede cargar pacientes: user.id no disponible.");
      setPacientes([]);
      setCargandoPacientes(false);
      return;
    }

    setCargandoPacientes(true);

    try {
      const data = await obtenerPacientes();

      const pacientesOrdenados = (data || []).sort((a, b) => {
        const nombreA = `${a.apellidos || ""} ${a.nombres || ""}`
          .trim()
          .toLowerCase();

        const nombreB = `${b.apellidos || ""} ${b.nombres || ""}`
          .trim()
          .toLowerCase();

        return nombreA.localeCompare(nombreB, "es");
      });

      setPacientes(pacientesOrdenados);
    } catch (error) {
      console.error("Error inesperado cargando pacientes:", error);
      alert("Error inesperado cargando pacientes: " + error.message);
      setPacientes([]);
    } finally {
      setCargandoPacientes(false);
    }
  }

  function normalizarAtencionOperativa(row) {
    const paciente = row.pacientes || row.paciente || null;

    return {
      id: row.id,
      agenda_operativa_id: row.id,
      google_calendar_event_id: row.google_calendar_event_id,
      origen: row.origen || "google_calendar",

      titulo: row.google_calendar_summary || "Atención Google Calendar",
      google_calendar_summary: row.google_calendar_summary,
      fecha_inicio: row.google_calendar_inicio,
      fecha_fin: row.google_calendar_fin,
      hora_inicio: row.google_calendar_inicio
        ? new Date(row.google_calendar_inicio).toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
      hora_fin: row.google_calendar_fin
        ? new Date(row.google_calendar_fin).toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",

      profesional_id: row.profesional_id,
      paciente_id: row.paciente_id,
      paciente,
      pacientes: paciente,
      patient: paciente
        ? `${paciente.nombres || ""} ${paciente.apellidos || ""}`.trim()
        : "Paciente vinculado",

      estado_operativo: row.estado_operativo,
      estado: row.estado_operativo,
      consentimiento_ia: row.consentimiento_ia,

      puede_iniciar_flujo_clinico: row.estado_operativo === "confirmada",
      requiere_vincular_paciente: false,

      fecha: row.google_calendar_inicio
        ? extraerFechaDesdeISO(row.google_calendar_inicio)
        : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async function cargarAtencionesOperativas() {
    if (!user?.id) return;

    try {
      const data = await obtenerAgendaOperativa();

      setAtencionesGoogleVinculadas(
        (data || []).map((row) => normalizarAtencionOperativa(row))
      );
    } catch (error) {
      console.error("Error inesperado cargando agenda operativa:", error);
    }
  }

  useEffect(() => {
    if (user?.id) {
      cargarCitas();
      cargarPacientes();
      cargarAtencionesOperativas();
    }
  }, [user?.id, refreshKey]);

  useEffect(() => {
    if (user?.id && googleCalendarActivo) {
      cargarAgendaDesdeGoogleCalendar(semanaBase);
    }
  }, [user?.id, semanaBase, googleCalendarActivo]);

  function cambiarEstadoGoogleCalendar(activo) {
    setGoogleCalendarActivo(activo);

    if (!activo) {
      setEventosGoogleCalendar([]);
      setErrorGoogleCalendar("");
      setCargandoGoogleCalendar(false);
    }
  }

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (scrollPreservadoRef.current !== null) {
      timeline.scrollTop = scrollPreservadoRef.current;
      scrollPreservadoRef.current = null;
      return;
    }
    const row = timeline.querySelector('[data-hour="8"]');
    if (row) {
      const encabezado = timeline.querySelector(".sticky");
      const alturaEncabezado = encabezado?.getBoundingClientRect().height || 0;
      const diferencia = row.getBoundingClientRect().top - timeline.getBoundingClientRect().top;
      timeline.scrollTop = Math.max(0, timeline.scrollTop + diferencia - alturaEncabezado);
    }
  }, [semanaBase, citas.length, disponibilidad.length]);

  const hoy = fechaTexto(new Date());

  const citasHoy = citas.filter(
    (c) => c.fecha?.slice(0, 10) === hoy && c.estado !== "cancelada"
  );

  const diasSemana = Array.from({ length: 7 }, (_, i) =>
    sumarDias(semanaBase, i)
  );

  const finSemana = sumarDias(semanaBase, 6);

  function citasDelDia(fechaObj) {
    const fecha = fechaTexto(fechaObj);

    return citas.filter(
      (cita) =>
        cita.fecha?.slice(0, 10) === fecha && cita.estado !== "cancelada"
    );
  }

  function eventosGoogleDelDia(fechaObj) {
    const fecha = fechaTexto(fechaObj);

    return eventosGoogleCalendar.filter(
      (evento) => extraerFechaDesdeISO(evento.fecha_inicio) === fecha
    );
  }

  const eventosGoogleHoy = eventosGoogleDelDia(new Date());

  const pacientesFiltrados = pacientes.filter((paciente) => {
    const textoBusqueda = busquedaPaciente.trim().toLowerCase();

    if (!textoBusqueda) return true;

    const textoPaciente = [
      paciente.nombres,
      paciente.apellidos,
      paciente.identificador,
      paciente.email,
      paciente.telefono,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return textoPaciente.includes(textoBusqueda);
  });

  const pacienteSeleccionado = pacientes.find(
    (item) => String(item.id) === String(pacienteSeleccionadoId)
  );

  function obtenerAtencionVinculadaPorEvento(eventoId) {
    return atencionesGoogleVinculadas.find(
      (item) => String(item.google_calendar_event_id) === String(eventoId)
    );
  }

  function abrirFlujo(cita) {
    iniciarFlujo({
      ...cita,

      patient: `${cita.pacientes?.nombres || ""} ${
        cita.pacientes?.apellidos || ""
      }`.trim(),

      paciente_id: cita.paciente_id,

      paciente: {
        id: cita.pacientes?.id,
        nombres: cita.pacientes?.nombres,
        apellidos: cita.pacientes?.apellidos,
        identificador: cita.pacientes?.identificador,
        email: cita.pacientes?.email,
        telefono: cita.pacientes?.telefono,
      },
    });
  }

  async function cargarAgendaDesdeGoogleCalendar(fechaReferencia = semanaBase) {
    setCargandoGoogleCalendar(true);
    setErrorGoogleCalendar("");

    try {
      const accessToken = await obtenerAccessTokenGoogleCalendar({ loginHint: user?.email });

      const eventos = await obtenerEventosDeLaSemana({
        accessToken,
        fechaReferencia,
      });

      setEventosGoogleCalendar(eventos);
      // Las vinculaciones operativas son una capa secundaria y no deben bloquear
      // la visualización de los eventos que ya llegaron desde Google Calendar.
      void cargarAtencionesOperativas();

      console.log("Eventos Google Calendar semana:", eventos);
    } catch (error) {
      console.error("Error al cargar Google Calendar:", error);

      setErrorGoogleCalendar(
        `No se pudo cargar la agenda desde Google Calendar. Detalle: ${
          error.message || "Error desconocido"
        }`
      );
    } finally {
      setCargandoGoogleCalendar(false);
    }
  }

  function seleccionarEventoGoogleCalendar(evento) {
    const atencionExistente = obtenerAtencionVinculadaPorEvento(
      evento.google_calendar_event_id
    );

    const atencionOperativa = {
      id: evento.id,
      google_calendar_event_id: evento.google_calendar_event_id,
      agenda_operativa_id: atencionExistente?.agenda_operativa_id || null,

      origen: "google_calendar",

      titulo: evento.titulo,
      fecha_inicio: evento.fecha_inicio,
      fecha_fin: evento.fecha_fin,
      hora_inicio: evento.hora_inicio,
      hora_fin: evento.hora_fin,

      estado_operativo: atencionExistente?.estado_operativo || "pendiente_vinculacion",
      consentimiento_ia: atencionExistente?.consentimiento_ia || "no_registrado",

      paciente_id: atencionExistente?.paciente_id || null,
      paciente: atencionExistente?.paciente || null,

      puede_iniciar_flujo_clinico: false,
      requiere_vincular_paciente: true,

      mensaje:
        "Este evento proviene de Google Calendar. Para continuar, debe vincularse a un paciente en Mentalia.",
    };

    setEventoGoogleSeleccionado(atencionOperativa);
    setPacienteSeleccionadoId(atencionExistente?.paciente_id || "");
    setBusquedaPaciente("");
    cargarPacientes();
  }

  async function vincularPacienteAEventoGoogle() {
    if (!eventoGoogleSeleccionado || guardandoVinculacion) return;

    if (!pacienteSeleccionadoId) {
      alert("Selecciona un paciente para vincular la atención.");
      return;
    }

    if (!user?.id) {
      alert("No se pudo identificar al profesional autenticado.");
      return;
    }

    const paciente = pacienteSeleccionado;

    if (!paciente) {
      alert("No se encontró el paciente seleccionado.");
      return;
    }

    setGuardandoVinculacion(true);

    const nuevoTituloGoogle = `Atención Mentalia - ${paciente.nombres || ""} ${
      paciente.apellidos || ""
    }`.trim();

    const registroAgendaOperativa = {
      profesional_id: user.id,
      paciente_id: paciente.id,
      google_calendar_event_id:
        eventoGoogleSeleccionado.google_calendar_event_id,
      google_calendar_summary: nuevoTituloGoogle,
      google_calendar_inicio: eventoGoogleSeleccionado.fecha_inicio,
      google_calendar_fin: eventoGoogleSeleccionado.fecha_fin,
      estado_operativo: "confirmada",
      consentimiento_ia: "no_registrado",
      origen: "google_calendar",
    };

    console.log("Intentando guardar agenda_operativa:", registroAgendaOperativa);

    try {
      const data = await vincularEventoPaciente({
        paciente_id: paciente.id,
        google_calendar_event_id: registroAgendaOperativa.google_calendar_event_id,
        google_calendar_summary: registroAgendaOperativa.google_calendar_summary,
        google_calendar_inicio: registroAgendaOperativa.google_calendar_inicio,
        google_calendar_fin: registroAgendaOperativa.google_calendar_fin,
      });

      let eventoGoogleActualizado = true;

      try {
        const accessToken = await obtenerAccessTokenGoogleCalendar({ loginHint: user?.email });

        await actualizarEventoGoogleCalendar({
          accessToken,
          eventId: eventoGoogleSeleccionado.google_calendar_event_id,
          summary: nuevoTituloGoogle,
          description:
            "Evento asociado operativamente desde Mentalia. No contiene información clínica.",
        });

        console.log("Evento actualizado en Google Calendar:", nuevoTituloGoogle);

        setEventosGoogleCalendar((prev) =>
          prev.map((evento) =>
            String(evento.google_calendar_event_id) ===
            String(eventoGoogleSeleccionado.google_calendar_event_id)
              ? { ...evento, titulo: nuevoTituloGoogle }
              : evento
          )
        );
      } catch (errorGoogle) {
        eventoGoogleActualizado = false;
        console.error("No se pudo actualizar Google Calendar:", errorGoogle);
      }

      const atencionOperativa = {
        id: data.id,
        agenda_operativa_id: data.id,
        google_calendar_event_id: data.google_calendar_event_id,
        origen: data.origen || "google_calendar",

        titulo: data.google_calendar_summary || nuevoTituloGoogle,
        google_calendar_summary: data.google_calendar_summary,

        fecha_inicio: data.google_calendar_inicio,
        fecha_fin: data.google_calendar_fin,
        hora_inicio: eventoGoogleSeleccionado.hora_inicio,
        hora_fin: eventoGoogleSeleccionado.hora_fin,

        profesional_id: data.profesional_id,
        paciente_id: paciente.id,

        paciente: {
          id: paciente.id,
          nombres: paciente.nombres,
          apellidos: paciente.apellidos,
          identificador: paciente.identificador,
          email: paciente.email,
          telefono: paciente.telefono,
        },
        pacientes: {
          id: paciente.id,
          nombres: paciente.nombres,
          apellidos: paciente.apellidos,
          identificador: paciente.identificador,
          email: paciente.email,
          telefono: paciente.telefono,
        },

        patient: `${paciente.nombres || ""} ${
          paciente.apellidos || ""
        }`.trim(),

        estado_operativo: data.estado_operativo,
        estado: data.estado_operativo,
        consentimiento_ia: data.consentimiento_ia,

        puede_iniciar_flujo_clinico: data.estado_operativo === "confirmada",
        requiere_vincular_paciente: false,

        fecha: data.google_calendar_inicio
          ? data.google_calendar_inicio.slice(0, 10)
          : null,

        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setAtencionesGoogleVinculadas((prev) => {
        const existe = prev.some(
          (item) =>
            String(item.google_calendar_event_id) ===
            String(atencionOperativa.google_calendar_event_id)
        );

        if (existe) {
          return prev.map((item) =>
            String(item.google_calendar_event_id) ===
            String(atencionOperativa.google_calendar_event_id)
              ? atencionOperativa
              : item
          );
        }

        return [...prev, atencionOperativa];
      });

      setAtencionGoogleVinculada({
        ...atencionOperativa,
        eventoGoogleActualizado,
      });

      setEventoGoogleSeleccionado(null);
      setPacienteSeleccionadoId("");
      setBusquedaPaciente("");

      alert("Paciente vinculado correctamente en Mentalia.");
    } catch (error) {
      console.error("Error inesperado vinculando paciente:", error);
      alert("Error inesperado vinculando paciente: " + error.message);
    } finally {
      setGuardandoVinculacion(false);
    }
  }

  async function cancelarCita(cita) {
    const confirma = window.confirm("¿Estás seguro de cancelar esta cita?");
    if (!confirma) return;

    try {
      const actualizada = await cancelarCitaApi(cita.id);
      setCitas((prev) =>
        prev.map((item) => item.id === cita.id ? { ...item, ...actualizada } : item)
      );
    } catch (error) {
      if (error.code === "AUTH_REQUIRED" || error.status === 401) alert("Tu sesión expiró. Inicia sesión nuevamente.");
      else alert(error.message || "No fue posible cancelar la cita.");
      return;
    }
  }

  async function guardarReagenda() {
    if (!citaEditando || !nuevaFecha || !nuevaHora) {
      alert("Selecciona fecha y hora.");
      return;
    }

    try {
      const actualizada = await reprogramarCita({
        citaId: citaEditando.id,
        fecha: nuevaFecha,
        horaInicio: nuevaHora,
      });

      setCitas((prev) =>
        prev.map((item) => item.id === citaEditando.id ? { ...item, ...actualizada } : item)
      );
    } catch (error) {
      if (error.code === "SLOT_ALREADY_BOOKED") alert("Ese horario ya está reservado. Selecciona otro horario.");
      else if (error.code === "OUTSIDE_AVAILABILITY") alert("El horario seleccionado no está dentro de la disponibilidad configurada.");
      else if (error.code === "PAST_APPOINTMENT") alert("No puedes reagendar una cita a una fecha u hora pasada.");
      else if (error.code === "AUTH_REQUIRED" || error.status === 401) alert("Tu sesión expiró. Inicia sesión nuevamente.");
      else alert(error.message || "No fue posible reprogramar la cita.");
      return;
    }

    setCitaEditando(null);
    setNuevaFecha("");
    setNuevaHora("");
  }

  function renderEventoGoogleCalendar(evento) {
    const atencionVinculada = obtenerAtencionVinculadaPorEvento(
      evento.google_calendar_event_id
    );

    return (
      <div
        key={evento.id}
        className={`rounded-2xl border bg-white p-4 shadow-sm ${
          atencionVinculada ? "border-emerald-200" : "border-blue-100"
        }`}
      >
        <div className="mb-2 flex flex-col items-start gap-2">
          <span className="text-sm font-black text-blue-700">
            {evento.hora_inicio || "Todo el día"}
            {evento.hora_fin ? ` - ${evento.hora_fin}` : ""}
          </span>


          <span
            className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
              atencionVinculada
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {atencionVinculada ? "Paciente vinculado" : "Google Calendar"}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-800">
          {evento.titulo || "Evento sin título"}
        </p>

        {evento.ubicacion && (
          <p className="mt-1 text-xs text-slate-500">{evento.ubicacion}</p>
        )}

        {atencionVinculada && (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
              Asignado a
            </p>
            <p className="mt-1 font-black text-slate-900">
              {atencionVinculada.paciente?.nombres} {" "}
              {atencionVinculada.paciente?.apellidos}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Estado: {atencionVinculada.estado_operativo} · IA: {" "}
              {atencionVinculada.consentimiento_ia}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {evento.link_google_calendar && (
            <a
              href={evento.link_google_calendar}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-blue-600 hover:underline"
            >
              Ver en Google Calendar
            </a>
          )}

          <button
            type="button"
            onClick={() => seleccionarEventoGoogleCalendar(evento)}
            className={`w-full rounded-xl px-3 py-2 text-sm font-black text-white ${
              atencionVinculada
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-[#18AFC1] hover:bg-cyan-700"
            }`}
          >
            {atencionVinculada
              ? "Cambiar paciente asignado"
              : "Seleccionar atención"}
          </button>

          {atencionVinculada && (
            <button
              type="button"
              onClick={() => iniciarFlujo(atencionVinculada)}
              className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-black text-cyan-700 hover:bg-cyan-50"
            >
              Continuar a Pre-sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderCita(cita) {
    return (
      <div
        key={cita.id}
        className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm"
      >
        <div className="mb-2 flex flex-col items-start gap-2">
          <span className="text-lg font-black text-cyan-700">
            {cita.hora_inicio?.slice(0, 5)}
          </span>

          <StatusBadge status={cita.estado} />
        </div>

        <p className="font-black text-slate-800">
          {cita.pacientes?.nombres || "Paciente"} {" "}
          {cita.pacientes?.apellidos || ""}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {cita.origen || "Mentalia"}
        </p>

        <button
          onClick={() => abrirFlujo(cita)}
          className="mt-3 w-full rounded-xl bg-[#18AFC1] px-3 py-2 text-sm font-black text-white hover:bg-cyan-700"
        >
          Atender paciente
        </button>

        <button
          onClick={() => {
            setCitaEditando(cita);
            setNuevaFecha(cita.fecha?.slice(0, 10));
            setNuevaHora(cita.hora_inicio?.slice(0, 5));
          }}
          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-black text-blue-600 hover:bg-blue-50"
        >
          Reagendar
        </button>

        <button
          onClick={() => cancelarCita(cita)}
          className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-600 hover:bg-red-50"
        >
          Cancelar cita
        </button>
      </div>
    );
  }

  function slotsMentaliaDelDiaAgenda(fechaObj) {
    const fecha = fechaTexto(fechaObj);
    const dia = fechaObj.getDay() || 7;
    return disponibilidad.filter((regla) => (regla.activo === undefined || regla.activo === true) && Number(regla.dia_semana) === dia && String(regla.fecha_inicio || "") <= fecha && String(regla.fecha_fin || "") >= fecha).flatMap((regla) => generarSlots(regla.hora_inicio, regla.hora_fin, regla.duracion_minutos, regla.descanso_minutos).map((slot) => ({ ...slot, fecha, modalidad: regla.modalidad || "presencial", duracion_minutos: regla.duracion_minutos })));
  }

  function eventoGoogleEnHoraAgenda(fecha, hora) {
    return eventosGoogleCalendar.filter((evento) => { const inicio = evento.fecha_inicio ? new Date(evento.fecha_inicio) : null; return inicio && !Number.isNaN(inicio.getTime()) && fechaTexto(inicio) === fecha && inicio.getHours() === hora; });
  }

  function renderHorarioAgenda() {
    const horas = Array.from({ length: 24 }, (_, i) => i);
    const slotsPorDia = diasSemana.map(slotsMentaliaDelDiaAgenda);
    return <div ref={timelineRef} className="max-h-[680px] overflow-auto rounded-xl"><div className="min-w-[1050px]"><div className="sticky top-0 z-10 grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] gap-px bg-slate-200 p-px"><div className="bg-white p-2" />{diasSemana.map((f) => <div key={fechaTexto(f)} className="bg-white p-2 text-center"><p className="font-black text-cyan-700">{dias.find((d) => d.id === (f.getDay() || 7))?.nombre}</p><p className="text-xs text-slate-500">{formatearFecha(fechaTexto(f))}</p></div>)}</div>{horas.map((hora) => <div key={hora} data-hour={hora} className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] gap-px bg-slate-200 p-px"><div className="min-h-[28px] bg-slate-50 p-1 text-center text-sm font-black text-slate-500">{String(hora).padStart(2, "0")}:00</div>{diasSemana.map((f, i) => { const fecha = fechaTexto(f); const eventos = googleCalendarActivo ? eventoGoogleEnHoraAgenda(fecha, hora) : []; const slots = slotsPorDia[i].filter((s) => Number(s.hora_inicio.slice(0, 2)) === hora); return <div key={`${fecha}-${hora}`} className="bg-white p-1"><div className="space-y-1">{eventos.map((e) => <div key={e.google_calendar_event_id || e.id} className="rounded-lg border border-blue-300 bg-blue-100 px-2 py-1.5 text-xs font-bold text-blue-800"><span>{e.hora_inicio || `${String(hora).padStart(2, "0")}:00`}{e.hora_fin ? ` - ${e.hora_fin}` : ""}</span><p className="line-clamp-1 text-[10px]">{e.titulo || "Evento Google"}</p></div>)}{slots.map((s) => { const cita = citas.find((c) => c.fecha?.slice(0, 10) === fecha && c.hora_inicio?.slice(0, 5) === s.hora_inicio && c.estado !== "cancelada"); return cita ? <div key={s.hora_inicio} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-bold text-red-700">{s.hora_inicio} - {s.hora_fin}<p className="line-clamp-1 text-[10px]">{`${cita.pacientes?.nombres || ""} ${cita.pacientes?.apellidos || ""}`.trim() || "Reservado"}</p></div> : <div key={s.hora_inicio} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-700">{s.hora_inicio} - {s.hora_fin}</div>;})}</div></div>;})}</div>)}</div></div>;
  }

  function cambiarSemanaAgenda(cantidad) { if (timelineRef.current) scrollPreservadoRef.current = timelineRef.current.scrollTop; setSemanaBase((prev) => inicioSemana(sumarDias(prev, cantidad))); }

  function renderHorarioAgendaConModalidad() {
    const horas = Array.from({ length: 24 }, (_, i) => i);
    const slotsPorDia = diasSemana.map(slotsMentaliaDelDiaAgenda);
    return <div ref={timelineRef} className="max-h-[680px] overflow-auto rounded-xl"><div className="min-w-[1050px]"><div className="sticky top-0 z-10 grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] gap-px bg-slate-200 p-px"><div className="bg-white p-2" />{diasSemana.map((f) => <div key={fechaTexto(f)} className="bg-white p-2 text-center"><p className="font-black text-cyan-700">{dias.find((d) => d.id === (f.getDay() || 7))?.nombre}</p><p className="text-xs text-slate-500">{formatearFecha(fechaTexto(f))}</p></div>)}</div>{horas.map((hora) => <div key={hora} data-hour={hora} className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] gap-px bg-slate-200 p-px"><div className="min-h-[28px] bg-slate-50 p-1 text-center text-sm font-black text-slate-500">{String(hora).padStart(2, "0")}:00</div>{diasSemana.map((f, i) => { const fecha = fechaTexto(f); const slots = slotsPorDia[i].filter((s) => Number(s.hora_inicio.slice(0, 2)) === hora); const continuaciones = slotsPorDia[i].filter((s) => Number(s.hora_inicio.slice(0, 2)) < hora && (Number(s.hora_fin.slice(0, 2)) + (s.hora_fin.slice(3, 5) !== "00" ? 1 : 0)) > hora); const eventos = googleCalendarActivo ? eventoGoogleEnHoraAgenda(fecha, hora) : []; return <div key={`${fecha}-${hora}`} className="bg-white p-1"><div className="space-y-1">{eventos.map((e) => <div key={e.google_calendar_event_id || e.id} className="rounded-lg border border-blue-300 bg-blue-100 px-2 py-1.5 text-xs font-bold text-blue-800">{e.hora_inicio} - {e.hora_fin}<p className="text-[10px]">{e.titulo}</p></div>)}{continuaciones.map((s) => <div key={`cont-${fecha}-${s.hora_inicio}-${hora}`} className="min-h-[28px] rounded-lg border border-emerald-200 bg-emerald-50" />)}{slots.map((s) => { const cita = citas.find((c) => c.fecha?.slice(0, 10) === fecha && c.hora_inicio?.slice(0, 5) === s.hora_inicio && c.estado !== "cancelada"); return <div key={s.hora_inicio} className={cita ? "rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-bold text-red-700" : "rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-700"}><div className="flex items-center justify-between gap-1"><span>{s.hora_inicio} - {s.hora_fin}</span><ModalidadAgenda modalidad={s.modalidad} /></div>{cita && <p className="line-clamp-1 text-[10px]">{`${cita.pacientes?.nombres || ""} ${cita.pacientes?.apellidos || ""}`.trim() || "Reservado"}</p>}</div>;})}</div></div>;})}</div>)}</div></div>;
  }

  return (
    <main className="min-h-screen bg-[#eef8fb] px-4 py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] px-2">
        <button onClick={goBack} className="mb-4 font-bold text-cyan-700">
          ← Volver
        </button>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Agenda</h1>

            <p className="text-sm text-slate-500">{cargando ? "Cargando agenda..." : "Agenda de citas y disponibilidad"}</p>
          </div>
          <button type="button" role="switch" aria-checked={googleCalendarActivo} aria-label="Activar o desactivar Google Calendar" onClick={() => cambiarEstadoGoogleCalendar(!googleCalendarActivo)} className="inline-flex items-center gap-3 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm md:self-auto">
            <span>Google Calendar</span>
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${googleCalendarActivo ? "bg-blue-600" : "bg-slate-300"}`}><span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${googleCalendarActivo ? "translate-x-5" : "translate-x-0.5"}`} /></span>
            <span className={googleCalendarActivo ? "text-blue-700" : "text-slate-500"}>{googleCalendarActivo ? "ON" : "OFF"}</span>
          </button>
        </div>

        {errorGoogleCalendar && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorGoogleCalendar}
          </div>
        )}

        {/* La integración se controla desde el switch compacto del encabezado. */}
        {/* <section className="mb-6 rounded-[24px] border border-blue-100 bg-blue-50 p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-blue-900">
                Integración con Google Calendar
              </h2>

              <p className="text-sm text-blue-700">
                Las citas de Mentalia siempre están disponibles. Google Calendar es opcional.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-blue-700">
                {googleCalendarActivo
                  ? cargandoGoogleCalendar
                    ? "Sincronizando..."
                    : `${eventosGoogleCalendar.length} evento(s) en la semana`
                  : "Desactivado"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={googleCalendarActivo}
                onClick={() => cambiarEstadoGoogleCalendar(!googleCalendarActivo)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                  googleCalendarActivo ? "bg-blue-600" : "bg-slate-300"
                }`}
                title={googleCalendarActivo ? "Desactivar Google Calendar" : "Activar Google Calendar"}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    googleCalendarActivo ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </section> */}

        <div className="mb-6 flex rounded-full bg-cyan-100 p-1">
          <button
            onClick={() => setView("day")}
            className={`flex-1 rounded-full py-2 font-bold ${
              view === "day" ? "bg-white text-cyan-800" : "text-slate-500"
            }`}
          >
            Día
          </button>

          <button
            onClick={() => setView("week")}
            className={`flex-1 rounded-full py-2 font-bold ${
              view === "week" ? "bg-white text-cyan-800" : "text-slate-500"
            }`}
          >
            Semana
          </button>
        </div>

        {view === "day" && (
          <section className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow">
            <h2 className="mb-5 text-center text-xl font-black">
              Hoy - {formatearFecha(hoy)}
            </h2>

            {(googleCalendarActivo && cargandoGoogleCalendar) || cargando ? (
              <p className="text-center text-slate-500">Cargando agenda...</p>
            ) : eventosGoogleHoy.length === 0 && citasHoy.length === 0 ? (
              <p className="text-center text-slate-500">
                No hay citas internas en Mentalia{googleCalendarActivo ? " ni eventos de Google Calendar" : ""}.
              </p>
            ) : (
              <div className="space-y-6">
                {eventosGoogleHoy.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-blue-700">
                      Google Calendar
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {eventosGoogleHoy.map((evento) =>
                        renderEventoGoogleCalendar(evento)
                      )}
                    </div>
                  </div>
                )}

                {citasHoy.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-cyan-700">
                      Citas internas Mentalia
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {citasHoy.map((cita) => renderCita(cita))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {view === "week" && (
          <section className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                onClick={() => cambiarSemanaAgenda(-7)}
                className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
              >
                ← Semana anterior
              </button>

              <div className="text-center">
                <h2 className="font-black">
                  Semana {formatearFecha(fechaTexto(semanaBase))} al {" "}
                  {formatearFecha(fechaTexto(finSemana))}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Fuente primaria: Mentalia. Google Calendar es una integración opcional para consultar eventos externos.
                </p>
              </div>

              <button
                onClick={() => cambiarSemanaAgenda(7)}
                className="rounded-xl border px-4 py-2 font-bold text-cyan-700"
              >
                Semana siguiente →
              </button>
            </div>

            {(googleCalendarActivo && cargandoGoogleCalendar) || cargando ? (
              <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                Cargando agenda semanal desde Mentalia{googleCalendarActivo ? " y Google Calendar" : ""}...
              </p>
            ) : (
              <>
                {renderHorarioAgendaConModalidad()}
              <div className="hidden grid gap-4 md:grid-cols-7">
                {diasSemana.map((fechaObj) => {
                  const fecha = fechaTexto(fechaObj);
                  const dia = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
                  const citasDia = citasDelDia(fechaObj);
                  const eventosGoogleDia = eventosGoogleDelDia(fechaObj);

                  return (
                    <div
                      key={fecha}
                      className="min-h-[320px] rounded-2xl border bg-slate-50 p-3"
                    >
                      <h3 className="text-center text-lg font-black text-cyan-700">
                        {dias.find((d) => d.id === dia)?.nombre}
                      </h3>

                      <p className="mb-3 text-center text-xs text-slate-500">
                        {formatearFecha(fecha)}
                      </p>

                      {eventosGoogleDia.length === 0 && citasDia.length === 0 ? (
                        <p className="text-center text-xs text-slate-400">
                          Sin eventos
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {eventosGoogleDia.map((evento) =>
                            renderEventoGoogleCalendar(evento)
                          )}

                          {citasDia.length > 0 && (
                            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-2">
                              <p className="mb-2 text-[10px] font-black uppercase text-cyan-700">
                                Citas internas Mentalia
                              </p>

                              <div className="space-y-2">
                                {citasDia.map((cita) => renderCita(cita))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </section>
        )}
      </div>

      {citaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-800">
              Reagendar cita
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {citaEditando.pacientes?.nombres} {" "}
              {citaEditando.pacientes?.apellidos}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-600">
                  Nueva fecha
                </label>

                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-600">
                  Nueva hora
                </label>

                <input
                  type="time"
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setCitaEditando(null)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold"
              >
                Cancelar
              </button>

              <button
                onClick={guardarReagenda}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-black text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {eventoGoogleSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-600">
                  Google Calendar
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Vincular atención a paciente
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEventoGoogleSeleccionado(null);
                  setPacienteSeleccionadoId("");
                  setBusquedaPaciente("");
                }}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-base font-black text-slate-900">
                  {eventoGoogleSeleccionado.titulo}
                </p>

                <p className="mt-1 text-sm font-bold text-blue-700">
                  {eventoGoogleSeleccionado.hora_inicio || "Todo el día"}
                  {eventoGoogleSeleccionado.hora_fin
                    ? ` - ${eventoGoogleSeleccionado.hora_fin}`
                    : ""}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <label className="text-sm font-bold text-cyan-900">
                  Buscar paciente
                </label>

                <input
                  type="text"
                  value={busquedaPaciente}
                  onChange={(e) => {
                    setBusquedaPaciente(e.target.value);
                    setPacienteSeleccionadoId("");
                  }}
                  placeholder="Nombre, apellido, RUT, email o teléfono"
                  className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-cyan-100"
                />

                <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-cyan-100 bg-white">
                  {cargandoPacientes ? (
                    <p className="p-4 text-sm text-slate-500">
                      Cargando pacientes...
                    </p>
                  ) : pacientesFiltrados.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      No se encontraron pacientes.
                    </p>
                  ) : (
                    pacientesFiltrados.map((paciente) => {
                      const seleccionado =
                        String(paciente.id) === String(pacienteSeleccionadoId);

                      return (
                        <button
                          key={paciente.id}
                          type="button"
                          onClick={() =>
                            setPacienteSeleccionadoId(String(paciente.id))
                          }
                          className={`w-full border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-cyan-50 ${
                            seleccionado ? "bg-cyan-100" : "bg-white"
                          }`}
                        >
                          <p className="font-black text-slate-800">
                            {paciente.apellidos || ""} {paciente.nombres || ""}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {paciente.identificador || "Sin identificador"}
                            {paciente.email ? ` · ${paciente.email}` : ""}
                            {paciente.telefono ? ` · ${paciente.telefono}` : ""}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {pacienteSeleccionado && (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Paciente seleccionado
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-900">
                    {pacienteSeleccionado.nombres || ""} {" "}
                    {pacienteSeleccionado.apellidos || ""}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {pacienteSeleccionado.identificador || "Sin identificador"}
                    {pacienteSeleccionado.email
                      ? ` · ${pacienteSeleccionado.email}`
                      : ""}
                    {pacienteSeleccionado.telefono
                      ? ` · ${pacienteSeleccionado.telefono}`
                      : ""}
                  </p>
                </div>
              )}

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Esta acción vincula el evento de Google Calendar con un paciente
                existente en Mentalia. No habilita IA automáticamente.
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-5 md:flex-row">
              <button
                type="button"
                onClick={() => {
                  setEventoGoogleSeleccionado(null);
                  setPacienteSeleccionadoId("");
                  setBusquedaPaciente("");
                }}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={vincularPacienteAEventoGoogle}
                disabled={!pacienteSeleccionadoId || guardandoVinculacion}
                className="flex-1 rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {guardandoVinculacion
                  ? "Guardando..."
                  : pacienteSeleccionado
                  ? `Asignar a ${pacienteSeleccionado.nombres || "paciente"}`
                  : "Asignar paciente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {atencionGoogleVinculada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
                Atención operativa creada
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Paciente vinculado correctamente
              </h2>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-800">
                Evento Google Calendar
              </p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {atencionGoogleVinculada.titulo}
              </p>

              <p className="mt-2 text-sm font-bold text-emerald-700">
                {atencionGoogleVinculada.hora_inicio || "Todo el día"}
                {atencionGoogleVinculada.hora_fin
                  ? ` - ${atencionGoogleVinculada.hora_fin}`
                  : ""}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-700">Paciente</p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {atencionGoogleVinculada.paciente?.nombres} {" "}
                {atencionGoogleVinculada.paciente?.apellidos}
              </p>

              {atencionGoogleVinculada.paciente?.identificador && (
                <p className="mt-1 text-xs text-slate-500">
                  Identificador: {" "}
                  {atencionGoogleVinculada.paciente.identificador}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                Estado del flujo
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-700">
                La atención quedó guardada en la agenda operativa de Mentalia.
                {atencionGoogleVinculada.eventoGoogleActualizado
                  ? " El evento también fue actualizado en Google Calendar."
                  : " No se pudo actualizar el evento en Google Calendar, pero la vinculación quedó guardada en Mentalia."}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={() => setAtencionGoogleVinculada(null)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => {
                  setAtencionGoogleVinculada(null);
                  iniciarFlujo(atencionGoogleVinculada);
                }}
                className="flex-1 rounded-xl bg-[#18AFC1] px-4 py-3 font-black text-white hover:bg-cyan-700"
              >
                Continuar a Pre-sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
