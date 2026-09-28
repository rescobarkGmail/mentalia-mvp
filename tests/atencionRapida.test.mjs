import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarRut, rutParaGuardar, rutValido, finAtencion, seSuperponen, conflictoEvento } from '../src/utils/atencionRapida.js';

test('un RUT con puntos, espacios o sin guion identifica al mismo paciente', () => {
  const variantes = ['8.000.008-1', '8000008-1', '80000081', ' 8.000.008 - 1 '];
  for (const rut of variantes) {
    assert.equal(normalizarRut(rut), '80000081');
    assert.equal(rutParaGuardar(rut), '8000008-1');
  }
});

test('K se guarda en mayúscula; datos pendientes y otros identificadores se conservan', () => {
  assert.equal(rutParaGuardar('12.345.670-k'), '12345670-K');
  assert.equal(rutParaGuardar(null), '');
  assert.equal(rutParaGuardar('   '), '');
  assert.equal(rutParaGuardar('PAS-AB123'), 'PAS-AB123');
});

test('normalizar no equivale a validar el dígito verificador', () => {
  assert.equal(rutValido('12.345.678-5'), true);
  assert.equal(rutValido('12.345.678-9'), false);
  assert.equal(rutValido(''), false);
  assert.equal(rutValido('PAS-AB123'), false);
});

test('horarios contiguos no se solapan; un intervalo contenido sí', () => {
  assert.equal(seSuperponen('16:00', '16:45', '16:45', '17:30'), false);
  assert.equal(seSuperponen('16:00', '16:45', '16:15', '16:30'), true);
  assert.equal(seSuperponen('16:00', '16:45', '15:30', '16:15'), true);
});

test('la cita conserva la duración y no cruza medianoche', () => {
  assert.equal(finAtencion('16:00', 45), '16:45');
  assert.equal(finAtencion('23:00', 45), '23:45');
  assert.equal(finAtencion('23:30', 45), null);
  assert.equal(finAtencion('23:15', 45), null);
  assert.equal(finAtencion('26:00', 45), null);
  assert.equal(finAtencion('16:00', -15), null);
});

test('eventos externos se comparan en Santiago, independiente de la zona del navegador', () => {
  const evento = { fecha_inicio: '2026-01-15T19:00:00Z', fecha_fin: '2026-01-15T20:00:00Z' };
  assert.equal(conflictoEvento('2026-01-15', '16:30', '17:15', evento), true);
  assert.equal(conflictoEvento('2026-01-15', '17:00', '17:45', evento), false);
  assert.equal(conflictoEvento('2026-01-15', '10:00', '10:45', { fecha_inicio: '2026-01-15', fecha_fin: '2026-01-16' }), true);
  assert.equal(conflictoEvento('2026-01-16', '10:00', '10:45', { fecha_inicio: '2026-01-15', fecha_fin: '2026-01-16' }), false);
});
