import { describe, expect, it } from 'vitest';
import { monthRange, requirePlainDate } from '../dates/index';
import type { MovimientoAnalizable } from './movimiento';
import { enRango, mediana, resumirRango } from './resumen';

const d = requirePlainDate;

const gasto = (fecha: string, monto: number, categoriaId?: string): MovimientoAnalizable =>
  ({ tipo: 'gasto', montoMinor: monto, ocurridoEn: d(fecha), categoriaId: categoriaId ?? null });
const ingreso = (fecha: string, monto: number): MovimientoAnalizable =>
  ({ tipo: 'ingreso', montoMinor: monto, ocurridoEn: d(fecha) });

const AGOSTO = monthRange(2026, 8);

describe('mediana', () => {
  it('con cantidad impar toma el del medio', () => {
    expect(mediana([5, 1, 3])).toBe(3);
  });

  it('con cantidad par promedia los dos del centro y redondea', () => {
    expect(mediana([1, 2, 3, 4])).toBe(3);
    expect(mediana([10, 20])).toBe(15);
  });

  it('lista vacia da cero', () => {
    expect(mediana([])).toBe(0);
  });

  it('no la mueve un valor extremo', () => {
    // Es la razon de usarla: el promedio de esto es 200.008.
    expect(mediana([10, 20, 30, 40, 1_000_000])).toBe(30);
  });
});

describe('enRango', () => {
  it('incluye los bordes y descarta lo de afuera', () => {
    const movimientos = [
      gasto('2026-07-31', 100),
      gasto('2026-08-01', 200),
      gasto('2026-08-31', 300),
      gasto('2026-09-01', 400),
    ];
    expect(enRango(movimientos, AGOSTO).map((m) => m.montoMinor)).toEqual([200, 300]);
  });
});

describe('resumirRango', () => {
  const movimientos = [
    ingreso('2026-08-30', 1_500_000),
    gasto('2026-08-05', 450_000, 'vivienda'),
    gasto('2026-08-10', 30_000, 'comida'),
    gasto('2026-08-15', 20_000, 'comida'),
    gasto('2026-08-20', 10_000, 'transporte'),
    // Fuera del rango: no debe contarse.
    gasto('2026-07-31', 999_999, 'comida'),
  ];

  it('suma gasto e ingreso solo del rango', () => {
    const r = resumirRango(movimientos, AGOSTO);
    expect(r.gasto.amountMinor).toBe(510_000);
    expect(r.ingreso.amountMinor).toBe(1_500_000);
    expect(r.neto.amountMinor).toBe(990_000);
  });

  it('cuenta los movimientos por tipo', () => {
    const r = resumirRango(movimientos, AGOSTO);
    expect(r.cantidadDeGastos).toBe(4);
    expect(r.cantidadDeIngresos).toBe(1);
  });

  it('la tasa de ahorro es neto sobre ingreso', () => {
    expect(resumirRango(movimientos, AGOSTO).tasaDeAhorro).toBeCloseTo(0.66, 4);
  });

  it('sin ingreso la tasa de ahorro es null, no cero', () => {
    // Cero significaria "no ahorro nada"; null significa "no aplica".
    const soloGastos = [gasto('2026-08-10', 30_000)];
    expect(resumirRango(soloGastos, AGOSTO).tasaDeAhorro).toBeNull();
  });

  it('el ticket promedio y el mediano se separan cuando hay un gasto grande', () => {
    // Es justo para lo que existen los dos: el arriendo arrastra el promedio a
    // $127.500 cuando el gasto tipico del mes son $25.000.
    const r = resumirRango(movimientos, AGOSTO);
    expect(r.ticketPromedio.amountMinor).toBe(127_500);
    expect(r.ticketMediano.amountMinor).toBe(25_000);
  });

  it('sin gastos los tickets son cero y no revientan', () => {
    const r = resumirRango([ingreso('2026-08-30', 100)], AGOSTO);
    expect(r.ticketPromedio.amountMinor).toBe(0);
    expect(r.ticketMediano.amountMinor).toBe(0);
    expect(r.gastoDiarioPromedio.amountMinor).toBe(0);
  });

  it('el gasto diario promedio usa los dias del rango, no los dias con gasto', () => {
    // Agosto tiene 31 dias: 510.000 / 31 = 16.452 (redondeado).
    const r = resumirRango(movimientos, AGOSTO);
    expect(r.diasDelRango).toBe(31);
    expect(r.gastoDiarioPromedio.amountMinor).toBe(16_452);
  });

  it('las transferencias no cuentan como gasto ni como ingreso', () => {
    const conTransferencia: MovimientoAnalizable[] = [
      ...movimientos,
      { tipo: 'transferencia', montoMinor: 700_000, ocurridoEn: d('2026-08-12') },
    ];
    const r = resumirRango(conTransferencia, AGOSTO);
    expect(r.gasto.amountMinor).toBe(510_000);
    expect(r.ingreso.amountMinor).toBe(1_500_000);
  });

  it('todo monto sale entero', () => {
    const r = resumirRango(movimientos, AGOSTO);
    for (const monto of [r.gasto, r.ingreso, r.neto, r.ticketPromedio, r.ticketMediano, r.gastoDiarioPromedio]) {
      expect(Number.isInteger(monto.amountMinor)).toBe(true);
    }
  });
});
