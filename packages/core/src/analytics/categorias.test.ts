import { describe, expect, it } from 'vitest';
import { monthRange, requirePlainDate } from '../dates/index';
import { SIN_CATEGORIA, derivaPorCategoria, gastoPorCategoria } from './categorias';
import type { MovimientoAnalizable } from './movimiento';

const d = requirePlainDate;
const gasto = (fecha: string, monto: number, categoriaId?: string | null): MovimientoAnalizable =>
  ({ tipo: 'gasto', montoMinor: monto, ocurridoEn: d(fecha), categoriaId: categoriaId ?? null });

const JULIO = monthRange(2026, 7);
const AGOSTO = monthRange(2026, 8);

describe('gastoPorCategoria', () => {
  const movimientos = [
    gasto('2026-08-05', 450_000, 'vivienda'),
    gasto('2026-08-10', 200_000, 'comida'),
    gasto('2026-08-20', 50_000, 'comida'),
    gasto('2026-08-25', 100_000, 'transporte'),
    { tipo: 'ingreso', montoMinor: 1_500_000, ocurridoEn: d('2026-08-30') } as MovimientoAnalizable,
  ];

  it('agrupa y ordena de mayor a menor', () => {
    const filas = gastoPorCategoria(movimientos, AGOSTO);
    expect(filas.map((f) => [f.categoriaId, f.total.amountMinor])).toEqual([
      ['vivienda', 450_000],
      ['comida', 250_000],
      ['transporte', 100_000],
    ]);
  });

  it('las participaciones suman uno', () => {
    const filas = gastoPorCategoria(movimientos, AGOSTO);
    const suma = filas.reduce((s, f) => s + (f.participacion ?? 0), 0);
    expect(suma).toBeCloseTo(1, 6);
  });

  it('los ingresos no entran', () => {
    const filas = gastoPorCategoria(movimientos, AGOSTO);
    expect(filas.reduce((s, f) => s + f.total.amountMinor, 0)).toBe(800_000);
  });

  it('los gastos sin categoria se agrupan aparte', () => {
    const filas = gastoPorCategoria([gasto('2026-08-01', 5_000, null)], AGOSTO);
    expect(filas[0]?.categoriaId).toBe(SIN_CATEGORIA);
  });

  it('sin gastos devuelve lista vacia', () => {
    expect(gastoPorCategoria([], AGOSTO)).toEqual([]);
  });
});

describe('derivaPorCategoria', () => {
  const movimientos = [
    // Julio
    gasto('2026-07-05', 450_000, 'vivienda'),
    gasto('2026-07-10', 100_000, 'comida'),
    gasto('2026-07-15', 80_000, 'transporte'),
    // Agosto: comida sube 80.000, transporte baja 78.000, vivienda igual
    gasto('2026-08-05', 450_000, 'vivienda'),
    gasto('2026-08-10', 180_000, 'comida'),
    gasto('2026-08-15', 2_000, 'transporte'),
  ];

  it('ordena por cuanto movio la aguja, en valor absoluto', () => {
    const filas = derivaPorCategoria(movimientos, AGOSTO, JULIO);
    expect(filas.map((f) => f.categoriaId)).toEqual(['comida', 'transporte', 'vivienda']);
  });

  it('calcula el delta con signo', () => {
    const filas = derivaPorCategoria(movimientos, AGOSTO, JULIO);
    const porId = new Map(filas.map((f) => [f.categoriaId, f.delta.amountMinor]));
    expect(porId.get('comida')).toBe(80_000);
    expect(porId.get('transporte')).toBe(-78_000);
    expect(porId.get('vivienda')).toBe(0);
  });

  it('la explicacion se mide sobre el movimiento total, no sobre el neto', () => {
    // El neto del mes es apenas +2.000. Dividir por eso daria a comida un
    // 4.000% de "explicacion", que es absurdo. Sobre la suma de los absolutos
    // (158.000) comida explica el 50,6% y transporte el 49,4%.
    const filas = derivaPorCategoria(movimientos, AGOSTO, JULIO);
    const porId = new Map(filas.map((f) => [f.categoriaId, f.explicacion]));
    expect(porId.get('comida')).toBeCloseTo(80_000 / 158_000, 6);
    expect(porId.get('transporte')).toBeCloseTo(78_000 / 158_000, 6);
    expect(porId.get('vivienda')).toBe(0);
  });

  it('las explicaciones suman uno', () => {
    const filas = derivaPorCategoria(movimientos, AGOSTO, JULIO);
    const suma = filas.reduce((s, f) => s + (f.explicacion ?? 0), 0);
    expect(suma).toBeCloseTo(1, 6);
  });

  it('incluye una categoria que existia antes y ahora no', () => {
    // Sin esto, dejar de gastar en algo no se veria en ningun lado.
    const filas = derivaPorCategoria(
      [gasto('2026-07-10', 90_000, 'ocio'), gasto('2026-08-10', 10_000, 'comida')],
      AGOSTO,
      JULIO,
    );
    const ocio = filas.find((f) => f.categoriaId === 'ocio');
    expect(ocio?.total.amountMinor).toBe(0);
    expect(ocio?.delta.amountMinor).toBe(-90_000);
  });

  it('sin ningun cambio la explicacion es null', () => {
    const iguales = [gasto('2026-07-10', 50_000, 'comida'), gasto('2026-08-10', 50_000, 'comida')];
    expect(derivaPorCategoria(iguales, AGOSTO, JULIO)[0]?.explicacion).toBeNull();
  });
});
