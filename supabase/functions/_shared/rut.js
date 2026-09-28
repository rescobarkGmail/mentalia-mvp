// Comparación independiente de puntos, espacios, guion y mayúsculas.
export function normalizarRut(value) {
  return String(value ?? "").replace(/[.\s-]/g, "").toUpperCase();
}

// Los identificadores extranjeros conservan su formato. Los RUT se guardan
// sin puntos, con guion y dígito verificador en mayúscula.
export function rutParaGuardar(value) {
  const original = String(value ?? "").trim();
  const compacto = normalizarRut(original);
  return /^\d{1,8}[\dK]$/.test(compacto)
    ? `${compacto.slice(0, -1)}-${compacto.slice(-1)}`
    : original;
}

export function rutValido(value) {
  const rut = normalizarRut(value);
  if (!/^\d{1,8}[\dK]$/.test(rut)) return false;
  let suma = 0;
  let factor = 2;
  for (const digit of rut.slice(0, -1).split("").reverse()) {
    suma += Number(digit) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - suma % 11;
  return rut.at(-1) === (resto === 11 ? "0" : resto === 10 ? "K" : String(resto));
}
