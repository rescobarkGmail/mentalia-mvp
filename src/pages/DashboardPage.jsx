import React from "react";
import {
  Brain, LogOut, Search, Bell, Home, CalendarDays, Users,
  FileText, BarChart3, Settings, Plus, ShieldCheck, Clock3,
  AlertCircle, ChevronRight, Mic
} from "lucide-react";

function SidebarButton({ icon, label, active }) {
  return (
    <button className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${
      active ? "bg-[#18AFC1] text-white" : "text-slate-500 hover:bg-cyan-50"
    }`}>
      {icon} {label}
    </button>
  );
}

function MetricCard({ icon, title, value, text }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

export default function DashboardPage({ provider, onLogout }) {
  const patients = [
    ["09:00", "María González", "Control ansiedad", "Resumen listo"],
    ["10:30", "Carlos Mendoza", "Seguimiento", "Pre-sesión"],
    ["12:00", "Ana Silva", "Primera consulta", "Pendiente"],
    ["15:30", "Roberto Díaz", "Evolución", "Informe IA"],
  ];

  return (
    <main className="min-h-screen bg-[#eef8fb] text-slate-800">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 bg-white p-5 shadow lg:block">
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
            <SidebarButton icon={<CalendarDays size={20} />} label="Agenda" />
            <SidebarButton icon={<Users size={20} />} label="Pacientes" />
            <SidebarButton icon={<FileText size={20} />} label="Informes IA" />
            <SidebarButton icon={<BarChart3 size={20} />} label="Indicadores" />
            <SidebarButton icon={<Settings size={20} />} label="Configuración" />
          </nav>

          <div className="mt-8 rounded-3xl bg-cyan-50 p-5">
            <ShieldCheck className="mb-3 text-cyan-700" />
            <p className="font-black">Modo demo seguro</p>
            <p className="mt-1 text-sm text-slate-500">
              No usar datos reales de pacientes.
            </p>
          </div>
        </aside>

        <section className="flex-1">
          <header className="flex items-center justify-between bg-white/80 px-6 py-4 shadow">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input
                className="w-full rounded-2xl border border-cyan-100 bg-slate-50 py-3 pl-12 pr-4 outline-none"
                placeholder="Buscar paciente, informe o atención..."
              />
            </div>

            <div className="ml-4 flex items-center gap-3">
              <button className="rounded-2xl bg-white p-3 shadow">
                <Bell size={20} />
              </button>
              <button onClick={onLogout} className="rounded-2xl bg-white p-3 shadow">
                <LogOut size={20} />
              </button>
            </div>
          </header>

          <div className="p-6">
            <section className="mb-6 rounded-[30px] bg-gradient-to-br from-[#18AFC1] to-[#2f80ed] p-7 text-white shadow">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white/70">
                    Dashboard clínico
                  </p>
                  <h2 className="mt-2 text-4xl font-black">Bienvenida, Ps. Camila</h2>
                  <p className="mt-2 text-white/85">
                    Login simulado con {provider}. Tienes 4 pacientes agendados y 3 informes IA pendientes.
                  </p>
                </div>
                <button className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-black text-cyan-800">
                  <Plus size={20} /> Nueva atención
                </button>
              </div>
            </section>

            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<CalendarDays />} title="Atenciones hoy" value="4" text="2 presenciales · 2 online" />
              <MetricCard icon={<FileText />} title="Borradores IA" value="3" text="pendientes de validación" />
              <MetricCard icon={<Clock3 />} title="Tiempo recuperado" value="3h 20m" text="estimado esta semana" />
              <MetricCard icon={<AlertCircle />} title="Alertas suaves" value="2" text="requieren revisión" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] bg-white p-6 shadow">
                <div className="mb-5 flex justify-between">
                  <div>
                    <h3 className="text-2xl font-black">Agenda y pacientes</h3>
                    <p className="text-sm text-slate-500">Próximas atenciones del día</p>
                  </div>
                  <button className="rounded-full border px-4 py-2 text-sm font-bold text-cyan-700">
                    Ver agenda
                  </button>
                </div>

                <div className="space-y-3">
                  {patients.map(([time, name, type, status]) => (
                    <div key={name} className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                      <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-white px-3 py-3 font-black text-cyan-700">
                          {time}
                        </div>
                        <div>
                          <p className="font-black">{name}</p>
                          <p className="text-sm text-slate-500">{type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700 sm:inline-flex">
                          {status}
                        </span>
                        <ChevronRight />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                    <Brain />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">Asistente IA</h3>
                    <p className="text-sm text-slate-500">Apoyo documental editable</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50 p-5">
                  <div className="mb-3 flex items-center gap-2 font-black text-cyan-700">
                    <Mic size={20} /> Resumen pre-sesión sugerido
                  </div>
                  <p className="text-sm leading-7 text-slate-600">
                    Paciente con seguimiento por síntomas ansiosos. En la última sesión se trabajó identificación de gatillantes, higiene del sueño y registro de pensamientos automáticos.
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button className="rounded-2xl bg-[#18AFC1] px-4 py-4 font-black text-white">
                    Iniciar atención
                  </button>
                  <button className="rounded-2xl border border-cyan-100 px-4 py-4 font-black text-cyan-800">
                    Generar informe
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}