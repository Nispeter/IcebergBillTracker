import { describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { RECURRENTES } from './catalog';
import { generateSeed, totalOf } from './generate';

const FIN = dates.requirePlainDate('2026-08-18');
const dataset = generateSeed({ endDate: FIN });

describe('determinismo', () => {
  it('la misma semilla produce exactamente el mismo dataset', () => {
    const a = generateSeed({ endDate: FIN, seed: 42 });
    const b = generateSeed({ endDate: FIN, seed: 42 });
    expect(a).toEqual(b);
  });

  it('semillas distintas producen datasets distintos', () => {
    const a = generateSeed({ endDate: FIN, seed: 1 });
    const b = generateSeed({ endDate: FIN, seed: 2 });
    expect(a.transactions).not.toEqual(b.transactions);
  });
});

describe('forma del dataset', () => {
  it('cubre 18 meses completos por defecto', () => {
    expect(dataset.range.start).toBe('2025-03-01');
    expect(dataset.range.end).toBe('2026-08-31');
  });

  it('respeta la cantidad de meses pedida', () => {
    const corto = generateSeed({ endDate: FIN, months: 3 });
    expect(corto.range.start).toBe('2026-06-01');
    expect(corto.range.end).toBe('2026-08-31');
  });

  it('rechaza una cantidad de meses invalida', () => {
    expect(() => generateSeed({ endDate: FIN, months: 0 })).toThrow();
    expect(() => generateSeed({ endDate: FIN, months: 1.5 })).toThrow();
  });

  it('toda transaccion cae dentro del rango declarado', () => {
    for (const tx of dataset.transactions) {
      expect(dates.containsDate(dataset.range, tx.occurredAt)).toBe(true);
    }
  });

  it('viene ordenado por fecha', () => {
    const fechas = dataset.transactions.map((tx) => tx.occurredAt);
    expect([...fechas].sort(dates.compareDates)).toEqual(fechas);
  });

  it('los ids son unicos', () => {
    const ids = dataset.transactions.map((tx) => tx.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('las categorias declaradas son las que realmente aparecen', () => {
    const usadas = [...new Set(dataset.transactions.map((tx) => tx.category))].sort();
    expect(dataset.categories).toEqual(usadas);
  });
});

describe('montos', () => {
  it('todos son enteros positivos: nunca un float representa dinero', () => {
    for (const tx of dataset.transactions) {
      expect(Number.isInteger(tx.amountMinor), `${tx.id} ${tx.amountMinor}`).toBe(true);
      expect(tx.amountMinor).toBeGreaterThan(0);
    }
  });

  it('todos son CLP', () => {
    for (const tx of dataset.transactions) expect(tx.currency).toBe('CLP');
  });

  it('el ingreso supera al gasto, con una tasa de ahorro creible', () => {
    const ingreso = totalOf(dataset, 'ingreso');
    const gasto = totalOf(dataset, 'gasto');
    expect(ingreso.amountMinor).toBeGreaterThan(gasto.amountMinor);
    const tasa = (ingreso.amountMinor - gasto.amountMinor) / ingreso.amountMinor;
    expect(tasa).toBeGreaterThan(0.02);
    expect(tasa).toBeLessThan(0.35);
  });

  it('el sueldo mensual esta en el orden de magnitud de un sueldo chileno', () => {
    const sueldos = dataset.transactions.filter((tx) => tx.name === 'Sueldo');
    for (const sueldo of sueldos) {
      expect(sueldo.amountMinor).toBeGreaterThan(1_100_000);
      expect(sueldo.amountMinor).toBeLessThan(1_300_000);
    }
  });
});

describe('recurrentes', () => {
  it('cada regla genera exactamente una ocurrencia por mes', () => {
    for (const spec of RECURRENTES) {
      const ocurrencias = dataset.transactions.filter((tx) => tx.name === spec.name);
      expect(ocurrencias, spec.name).toHaveLength(18);
      expect(ocurrencias.every((tx) => tx.recurring), spec.name).toBe(true);
    }
  });

  it('caen en el dia de la regla, recortado si el mes es mas corto', () => {
    const sueldos = dataset.transactions.filter((tx) => tx.name === 'Sueldo');
    for (const sueldo of sueldos) {
      const esperado = Math.min(30, dates.daysInMonth(dates.year(sueldo.occurredAt), dates.month(sueldo.occurredAt)));
      expect(dates.day(sueldo.occurredAt), sueldo.occurredAt).toBe(esperado);
    }
    // Febrero solo tiene 28 dias: el sueldo del 30 se corre al 28.
    const febrero = sueldos.find((tx) => dates.month(tx.occurredAt) === 2);
    expect(dates.day(febrero!.occurredAt)).toBe(28);
  });

  it('el arriendo es fijo todos los meses', () => {
    const montos = new Set(
      dataset.transactions.filter((tx) => tx.name === 'Arriendo').map((tx) => tx.amountMinor),
    );
    expect(montos).toEqual(new Set([450_000]));
  });

  it('el gasto variable no queda marcado como recurrente', () => {
    const variables = dataset.transactions.filter((tx) => tx.category === 'Supermercado');
    expect(variables.length).toBeGreaterThan(0);
    expect(variables.every((tx) => !tx.recurring)).toBe(true);
    expect(variables.every((tx) => tx.merchant !== undefined)).toBe(true);
  });
});

describe('estacionalidad', () => {
  const promedioMensual = (categoria: string, mes: number) => {
    const meses = new Set<string>();
    let total = 0;
    for (const tx of dataset.transactions) {
      if (tx.category !== categoria || dates.month(tx.occurredAt) !== mes) continue;
      total += tx.amountMinor;
      meses.add(tx.occurredAt.slice(0, 7));
    }
    return meses.size === 0 ? 0 : total / meses.size;
  };

  it('las cuentas de invierno superan claramente a las de verano', () => {
    // Invierno austral: julio. Verano: enero.
    expect(promedioMensual('Cuentas', 7)).toBeGreaterThan(promedioMensual('Cuentas', 1) * 1.3);
  });

  it('diciembre gasta mas en compras que un mes cualquiera', () => {
    expect(promedioMensual('Compras', 12)).toBeGreaterThan(promedioMensual('Compras', 5));
  });
});

describe('sesgo de fin de semana', () => {
  it('el delivery cae mas en fin de semana que en dia de semana', () => {
    const delivery = dataset.transactions.filter((tx) => tx.category === 'Delivery');
    const finDeSemana = delivery.filter((tx) => dates.weekday(tx.occurredAt) >= 5).length;
    // Viernes a domingo son 3 de 7 dias: sin sesgo daria ~43%.
    expect(finDeSemana / delivery.length).toBeGreaterThan(0.55);
  });
});
