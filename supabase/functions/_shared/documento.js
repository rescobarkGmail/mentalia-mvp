import { normalizarRut, rutParaGuardar, rutValido } from './rut.js';

export const tiposDocumento = ['rut', 'pasaporte', 'documento_nacional', 'otro'];
export const paisesDocumento = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

export function normalizarPasaporte(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export function documentoParaGuardar(valor, tipo, pais) {
  if (tipo === 'rut' && pais === 'CL') return rutParaGuardar(valor);
  if (tipo === 'pasaporte') return normalizarPasaporte(valor);
  return String(valor ?? '').trim();
}

export function claveDocumento(paciente) {
  const { tipo_identificador: tipo, pais_emisor_identificador: pais, identificador } = paciente;
  const numero = tipo === 'rut' && pais === 'CL'
    ? normalizarRut(identificador)
    : tipo === 'pasaporte'
      ? normalizarPasaporte(identificador)
      : String(identificador ?? '').trim();
  return numero ? JSON.stringify([tipo || null, pais || null, numero]) : null;
}

export function errorDocumento(datos, permitirPendiente = true) {
  const tipo = datos.tipo_identificador || '';
  const pais = datos.pais_emisor_identificador || '';
  const numero = String(datos.identificador ?? '').trim();
  if (!tipo && !pais) return numero && !permitirPendiente ? 'Selecciona el tipo de documento y su país emisor.' : '';
  if (!tiposDocumento.includes(tipo)) return 'Selecciona un tipo de documento válido.';
  if (!paisesDocumento.includes(pais)) return 'Selecciona el país emisor del documento.';
  if (tipo === 'rut' && pais !== 'CL') return 'El país emisor del RUT debe ser Chile.';
  if (numero && tipo === 'rut' && !rutValido(numero)) return 'El RUT chileno no es válido. Revisa su dígito verificador.';
  if (numero && tipo === 'pasaporte') {
    const pasaporte = normalizarPasaporte(numero);
    if (!/^[A-Z0-9]+$/.test(pasaporte)) return 'El pasaporte debe contener solo letras y números.';
    if (pasaporte.length < 5 || pasaporte.length > 20) return 'El pasaporte debe tener entre 5 y 20 caracteres.';
  }
  return '';
}
