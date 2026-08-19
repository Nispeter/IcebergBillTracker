/**
 * Que tan bien encuentra las cuentas periodicas sobre los 18 meses de la semilla.
 *
 * Los tests unitarios prueban el algoritmo con series armadas a mano. Este
 * prueba lo otro: que sobre datos con ruido —compras sueltas, montos que varian,
 * meses salteados— proponga lo que de verdad es una cuenta y no proponga lo que
 * no lo es. La semilla marca cada movimiento con `recurring`, asi que hay contra
 * que contrastar.
 */

import { recurrence } from '@iceberg/core';
import { describe, expect, it } from 'vitest';
import { generateSeed } from './generate';

const dataset = generateSeed();
const HOY = dataset.range.end;

const observados = dataset.transactions
  .filter((t) => t.type === 'gasto')
  .map((t) => ({
    nombre: t.name,
    montoMinor: t.amountMinor,
    ocurridoEn: t.occurredAt,
    categoriaId: t.category ?? null,
  }));

const candidatas = recurrence.detectarRecurrentes(observados, HOY);

/** Los nombres que la semilla genero desde una regla. */
const nombresRecurrentes = new Set(
  dataset.transactions.filter((t) => t.type === 'gasto' && t.recurring).map((t) => t.name),
);

describe('deteccion sobre la semilla', () => {
  it('la semilla trae cuentas periodicas que encontrar', () => {
    expect(nombresRecurrentes.size).toBeGreaterThan(3);
  });

  it('encuentra la mayoria de las cuentas periodicas de verdad', () => {
    const encontradas = [...nombresRecurrentes].filter(
      (nombre) => candidatas.some((c) => c.nombre === nombre),
    );
    expect(encontradas.length / nombresRecurrentes.size).toBeGreaterThanOrEqual(0.8);
  });

  it('casi nada de lo que propone es un gasto suelto', () => {
    // Un falso positivo cuesta caro: propone crear una cuenta que no existe, y
    // desde ahi la app proyecta plata que nadie debe.
    const falsos = candidatas.filter((c) => !nombresRecurrentes.has(c.nombre));
    expect(falsos.length / Math.max(candidatas.length, 1)).toBeLessThanOrEqual(0.2);
  });

  it('el monto propuesto se parece a lo que se paga de verdad', () => {
    for (const candidata of candidatas) {
      const pagados = dataset.transactions
        .filter((t) => t.name === candidata.nombre && t.type === 'gasto')
        .map((t) => t.amountMinor);
      const menor = Math.min(...pagados);
      const mayor = Math.max(...pagados);
      expect(candidata.montoMinor).toBeGreaterThanOrEqual(menor);
      expect(candidata.montoMinor).toBeLessThanOrEqual(mayor);
    }
  });

  it('todas las propuestas apuntan hacia adelante', () => {
    for (const candidata of candidatas) {
      expect(candidata.desde >= HOY).toBe(true);
    }
  });

  it('cada propuesta es una regla que el motor sabe calcular', () => {
    for (const candidata of candidatas) {
      expect(recurrence.validarRegla({
        frecuencia: candidata.frecuencia,
        cada: candidata.cada,
        desde: candidata.desde,
        hasta: null,
      })).toBeNull();
    }
  });
});
