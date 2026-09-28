import test from 'node:test';
import assert from 'node:assert/strict';
import { documentoParaGuardar, claveDocumento, errorDocumento } from '../supabase/functions/_shared/documento.js';

test('un pasaporte numérico no se transforma en RUT', () => {
  assert.equal(documentoParaGuardar('80000081', 'pasaporte', 'AR'), '80000081');
  assert.equal(documentoParaGuardar('00.123-AB', 'pasaporte', 'PE'), '00.123-AB');
  assert.equal(documentoParaGuardar('8.000.008-1', null, null), '8.000.008-1');
  assert.equal(documentoParaGuardar('8.000.008-1', 'rut', 'CL'), '8000008-1');
});

test('un número compartido por dos países o tipos no representa el mismo documento', () => {
  const base = { identificador: '12345678', tipo_identificador: 'pasaporte', pais_emisor_identificador: 'AR' };
  assert.notEqual(claveDocumento(base), claveDocumento({ ...base, pais_emisor_identificador: 'PE' }));
  assert.notEqual(claveDocumento(base), claveDocumento({ ...base, tipo_identificador: 'documento_nacional' }));
  assert.equal(claveDocumento(base), claveDocumento({ ...base, identificador: ' 12345678 ' }));
});

test('RUT con puntos y sin puntos tiene la misma clave solo cuando está clasificado', () => {
  const base = { identificador: '8.000.008-1', tipo_identificador: 'rut', pais_emisor_identificador: 'CL' };
  assert.equal(claveDocumento(base), claveDocumento({ ...base, identificador: '80000081' }));
  assert.notEqual(claveDocumento(base), claveDocumento({ ...base, tipo_identificador: 'pasaporte' }));
});

test('el documento puede quedar pendiente en una atención rápida', () => {
  assert.equal(errorDocumento({}), '');
  assert.equal(claveDocumento({}), null);
  assert.equal(errorDocumento({ identificador: '12345678' }), '');
  assert.notEqual(errorDocumento({ identificador: '12345678' }, false), '');
});

test('solo el RUT chileno usa el dígito verificador; el país no implica nacionalidad', () => {
  assert.equal(errorDocumento({ identificador: 'ABC-0123', tipo_identificador: 'pasaporte', pais_emisor_identificador: 'CL' }), '');
  assert.equal(errorDocumento({ identificador: '12345678-9', tipo_identificador: 'pasaporte', pais_emisor_identificador: 'AR' }), '');
  assert.notEqual(errorDocumento({ identificador: '12345678-9', tipo_identificador: 'rut', pais_emisor_identificador: 'CL' }), '');
  assert.notEqual(errorDocumento({ identificador: '12345678-5', tipo_identificador: 'rut', pais_emisor_identificador: 'AR' }), '');
  assert.equal(errorDocumento({ identificador: '12.345.678-5', tipo_identificador: 'rut', pais_emisor_identificador: 'CL' }), '');
});

test('tipo y país deben completarse juntos', () => {
  assert.notEqual(errorDocumento({ tipo_identificador: 'pasaporte' }), '');
  assert.notEqual(errorDocumento({ pais_emisor_identificador: 'AR' }), '');
  assert.notEqual(errorDocumento({ tipo_identificador: 'pasaporte', pais_emisor_identificador: 'ZZ' }), '');
});
