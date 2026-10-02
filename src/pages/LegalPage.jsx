import React from "react";

const fechaActualizacion = "2 de octubre de 2026";

function Section({ title, children }) {
  return (
    <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}

function Layout({ title, subtitle, children }) {
  return (
    <main className="min-h-screen bg-[#eef8fb] px-5 py-8 text-slate-800">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-sm font-black text-cyan-700 hover:text-cyan-900">
          ← Volver a FluyePro
        </a>
        <header className="mt-6 rounded-[32px] bg-gradient-to-br from-[#18AFC1] to-[#2f80ed] p-8 text-white shadow">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-white/70">
            FluyePro
          </p>
          <h1 className="mt-3 text-4xl font-black">{title}</h1>
          <p className="mt-3 max-w-2xl text-white/85">{subtitle}</p>
          <p className="mt-5 text-sm font-bold text-white/75">
            Última actualización: {fechaActualizacion}
          </p>
        </header>
        <div className="mt-6 space-y-5">{children}</div>
        <footer className="mt-8 rounded-3xl bg-white p-5 text-sm text-slate-500 shadow-sm">
          Para consultas sobre estas condiciones o el tratamiento de datos, escríbenos a{" "}
          <a className="font-bold text-cyan-700" href="mailto:contacto@fluyepro.cl">
            contacto@fluyepro.cl
          </a>
          .
        </footer>
      </div>
    </main>
  );
}

export function PrivacidadPage() {
  return (
    <Layout
      title="Política de Privacidad"
      subtitle="Esta política describe cómo FluyePro trata datos personales para gestionar reservas, recordatorios, consentimientos y comunicaciones administrativas."
    >
      <Section title="1. Responsable y alcance">
        <p>
          FluyePro es una plataforma de gestión para profesionales, orientada a reservas,
          recordatorios, consentimientos y coordinación de servicios. Esta versión inicial se aplica al
          uso de FluyePro en ambientes de prueba y operación temprana.
        </p>
        <p>
          Esta política no reemplaza asesoría legal especializada. Será revisada y ajustada antes de
          una operación productiva amplia.
        </p>
      </Section>

      <Section title="2. Datos que podemos tratar">
        <p>
          Podemos tratar datos administrativos como nombre, apellidos, documento de identificación,
          correo electrónico, teléfono, país emisor del documento, fecha de reserva, horario,
          modalidad, estado de la cita, preferencias de contacto y registros de consentimiento.
        </p>
        <p>
          La reserva pública no debe usarse para ingresar diagnósticos, síntomas, antecedentes
          clínicos u otra información sensible que no sea necesaria para coordinar la atención.
        </p>
      </Section>

      <Section title="3. Finalidades">
        <p>
          Usamos los datos para crear y administrar reservas, confirmar o reagendar citas, enviar
          recordatorios por correo o WhatsApp cuando corresponda, gestionar consentimientos,
          mantener seguridad operativa y entregar herramientas administrativas al profesional.
        </p>
      </Section>

      <Section title="4. Proveedores y comunicaciones">
        <p>
          Para operar el servicio podemos usar proveedores tecnológicos como Supabase, Google,
          Meta/WhatsApp, servicios de correo transaccional y plataformas de hosting. Estos proveedores
          pueden procesar datos en infraestructura fuera de Chile, bajo sus propias medidas de
          seguridad y condiciones.
        </p>
      </Section>

      <Section title="5. Conservación y seguridad">
        <p>
          Conservamos los datos mientras sean necesarios para la gestión del servicio, cumplimiento de
          obligaciones, auditoría operativa o atención de solicitudes. Aplicamos medidas razonables de
          seguridad técnica y organizacional para proteger la información.
        </p>
      </Section>

      <Section title="6. Derechos de las personas">
        <p>
          Puedes solicitar acceso, rectificación, actualización, eliminación o revisión del uso de tus
          datos escribiendo a contacto@fluyepro.cl. También puedes solicitar información sobre
          consentimientos y comunicaciones enviadas.
        </p>
      </Section>
    </Layout>
  );
}

export function TerminosPage() {
  return (
    <Layout
      title="Términos y Condiciones"
      subtitle="Estos términos regulan el uso inicial de FluyePro como herramienta administrativa para profesionales y sus pacientes o usuarios."
    >
      <Section title="1. Naturaleza del servicio">
        <p>
          FluyePro es una herramienta tecnológica de apoyo administrativo para gestionar reservas,
          disponibilidad, recordatorios, consentimientos y comunicaciones. No reemplaza el criterio
          profesional, la relación clínica ni la atención directa entre profesional y paciente.
        </p>
      </Section>

      <Section title="2. Reserva pública">
        <p>
          Las solicitudes realizadas mediante la reserva pública quedan sujetas a confirmación
          operativa del profesional. Una solicitud puede figurar como pendiente hasta que el profesional
          la acepte, reprograme o cancele.
        </p>
        <p>
          La reserva pública debe usarse solo para datos administrativos. No debe ingresarse contenido
          clínico, diagnósticos, síntomas ni antecedentes sensibles innecesarios.
        </p>
      </Section>

      <Section title="3. Responsabilidades de uso">
        <p>
          El profesional es responsable de revisar la información registrada, mantener actualizada su
          disponibilidad, confirmar reservas y usar la plataforma conforme a la normativa aplicable y a
          sus deberes profesionales.
        </p>
        <p>
          Los usuarios deben entregar información veraz y usar el servicio de forma lícita, respetuosa
          y acorde con su finalidad.
        </p>
      </Section>

      <Section title="4. Comunicaciones">
        <p>
          FluyePro puede enviar correos electrónicos o mensajes de WhatsApp relacionados con reservas,
          cambios, recordatorios o consentimientos, siempre que la configuración y los consentimientos
          aplicables lo permitan.
        </p>
      </Section>

      <Section title="5. Disponibilidad y cambios">
        <p>
          El servicio puede experimentar interrupciones, ajustes o cambios por mantenimiento,
          proveedores externos o mejoras funcionales. FluyePro podrá modificar estas condiciones y
          publicará la fecha de última actualización.
        </p>
      </Section>

      <Section title="6. Limitación de responsabilidad">
        <p>
          FluyePro no garantiza que el servicio esté libre de errores o interrupciones. En la medida
          permitida por la ley, la responsabilidad se limita al funcionamiento tecnológico de la
          plataforma y no a decisiones clínicas, profesionales o administrativas tomadas por terceros.
        </p>
      </Section>
    </Layout>
  );
}
