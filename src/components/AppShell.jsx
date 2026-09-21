import React from "react";
import { Brain, Home, CalendarDays, Users, Plus, FileText, BarChart3, Settings, ShieldCheck } from "lucide-react";

const opciones = [
  ["dashboard", Home, "Dashboard"], ["agenda", CalendarDays, "Agenda"], ["pacientes", Users, "Pacientes"], ["nueva-cita", Plus, "Nueva cita"], ["reservar", CalendarDays, "Reserva pública"], ["disponibilidad", CalendarDays, "Disponibilidad"], ["informes", FileText, "Informes IA"], ["indicadores", BarChart3, "Indicadores"], ["configuracion", Settings, "Configuración"],
];

export default function AppShell({ activeView, onNavigate, children }) {
  return <div className="min-h-screen bg-[#eef8fb]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 bg-white p-5 shadow lg:block">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#18AFC1] text-white"><Brain /></div><div><p className="text-2xl font-black text-slate-900">Mental-IA</p><p className="text-xs text-slate-500">Panel profesional</p></div></div>
      <nav className="space-y-2">{opciones.map(([view, Icon, label]) => <button key={view} type="button" onClick={() => onNavigate(view)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${activeView === view ? "bg-[#18AFC1] text-white" : "text-slate-500 hover:bg-cyan-50"}`}><Icon size={20} />{label}</button>)}</nav>
      <div className="mt-8 rounded-3xl bg-cyan-50 p-5"><ShieldCheck className="mb-3 text-cyan-700" /><p className="font-black">Modo demo seguro</p><p className="mt-1 text-sm text-slate-500">No usar datos reales de pacientes.</p></div>
    </aside>
    <div className="lg:pl-72"><div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden"><span className="font-black text-slate-900">Mental-IA</span><select value={activeView} onChange={(event) => onNavigate(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm"><option value="agenda">Agenda</option><option value="pacientes">Pacientes</option><option value="nueva-cita">Nueva cita</option><option value="disponibilidad">Disponibilidad</option><option value="configuracion">Configuración</option></select></div>{children}</div>
  </div>;
}
