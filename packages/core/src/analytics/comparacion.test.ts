import { describe, expect, it } from 'vitest';
import { monthRange, requirePlainDate } from '../dates/index';
import { money } from '../money/index';
import { compararConAnoPasado, compararConAnterior, compararMontos } from './comparacion';
import type { MovimientoAnalizable } from './movimiento';

const d = requirePlainDate;
const gasto = (fecha: string, monto: number): MovimientoAnalizable =>
  ({ tipo: 'gasto', montoMinor: monto, ocurridoEn: d(fecha) });

describe('compararMontos', () => {
  it('calcula delta y variacion', () => {
    const v = compararMontos(money(120_000), money(100_000));
    expect(v.delta.amountMinor).toBe(20_000);
    expect(v.variacion).toBeCloseTo(0.2, 6);
  });

  it('una baja da delta y variacion negativos', () => {
    const v = compararMontos(money(80_000), money(100_000));
    expect(v.delta.amountMinor).toBe(-20_000);
    expect(v.variacion).toBeCloseTo(-0.2, 6);
  });

  it('con anterior en cero la variacion es null, no infinito', () => {
    // "Subio un infinito por ciento" no es informacion; que antes no habia nada,
    // si. La UI decide como decirlo.
    const v = compararMontos(money(50_000), money(0));
    expect(v.delta.amountMinor).toBe(50_000);
    expect(v.variacion).toBeNull();
  });

  it('sin cambio la variacion es cero', () => {
    expect(compararMontos(money(100), money(100)).variacion).toBe(0);
  });
});

describe('compararConAnterior', () => {
  const movimientos = [
    gasto('2026-07-10', 100_000),
    gasto('2026-08-10', 150_000),
  ];

  it('compara agosto contra julio completo', () => {
    const c = compararConAnterior(movimientos, monthRange(2026, 8));
    expect(c.actual.gasto.amountMinor).toBe(150_000);
    expect(c.referencia.gasto.amountMinor).toBe(100_000);
    expect(c.gasto.variacion).toBeCloseTo(0.5, 6);
  });

  it('el mes anterior de marzo es febrero, con sus 28 dias', () => {
    // Es lo que justifica que el rango sepa de que tipo es: "los 31 dias
    // previos al 1 de marzo" arrancarian el 29 de enero.
    const enero = gasto('2026-01-30', 999_999);
    const febrero = gasto('2026-02-10', 50_000);
    const c = compararConAnterior([enero, febrero, gasto('2026-03-10', 60_000)], monthRange(2026, 3));
    expect(c.referencia.rango.start).toBe('2026-02-01');
    expect(c.referencia.gasto.amountMinor).toBe(50_000);
  });

  it('el anterior de enero es diciembre del ano pasado', () => {
    const c = compararConAnterior([gasto('2025-12-10', 70_000)], monthRange(2026, 1));
    expect(c.referencia.rango.start).toBe('2025-12-01');
    expect(c.referencia.gasto.amountMinor).toBe(70_000);
  });
});

describe('compararConAnoPasado', () => {
  it('compara contra el mismo mes del ano anterior', () => {
    // La comparacion que saca del medio la estacionalidad.
    const movimientos = [
      gasto('2025-07-10', 200_000),
      gasto('2026-06-10', 999_999),
      gasto('2026-07-10', 220_000),
    ];
    const c = compararConAnoPasado(movimientos, monthRange(2026, 7));
    expect(c.referencia.rango.start).toBe('2025-07-01');
    expect(c.referencia.gasto.amountMinor).toBe(200_000);
    expect(c.gasto.variacion).toBeCloseTo(0.1, 6);
  });

  it('sin datos del ano pasado la variacion es null', () => {
    const c = compararConAnoPasado([gasto('2026-07-10', 220_000)], monthRange(2026, 7));
    expect(c.referencia.gasto.amountMinor).toBe(0);
    expect(c.gasto.variacion).toBeNull();
  });
});
