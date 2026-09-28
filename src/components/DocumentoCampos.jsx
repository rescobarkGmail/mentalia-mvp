import { paisesDocumento } from '../../supabase/functions/_shared/documento.js';

const nombresPaises = new Intl.DisplayNames(['es'], { type: 'region' });
const paises = paisesDocumento.map((codigo) => ({ codigo, nombre: nombresPaises.of(codigo) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

export default function DocumentoCampos({ datos, onChange }) {
  const clase = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2';
  return <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
    <label className="text-sm">Tipo de documento<select value={datos.tipo_identificador || ''} className={clase} onChange={(e) => onChange({ ...datos, tipo_identificador: e.target.value, pais_emisor_identificador: e.target.value === 'rut' ? 'CL' : '' })}>
      <option value="">Pendiente de identificar</option><option value="rut">RUT chileno</option><option value="pasaporte">Pasaporte</option><option value="documento_nacional">Documento nacional de identidad</option><option value="otro">Otro documento</option>
    </select></label>
    <label className="text-sm">País emisor del documento<select value={datos.pais_emisor_identificador || ''} disabled={!datos.tipo_identificador || datos.tipo_identificador === 'rut'} className={clase} onChange={(e) => onChange({ ...datos, pais_emisor_identificador: e.target.value })}>
      <option value="">Seleccionar país</option>{paises.map((pais) => <option key={pais.codigo} value={pais.codigo}>{pais.nombre}</option>)}
    </select></label>
    <p className="text-xs text-slate-500 sm:col-span-2">El país emisor corresponde al documento, no a la nacionalidad del paciente.</p>
  </div>;
}
