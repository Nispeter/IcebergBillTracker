import { describe, expect, it } from 'vitest';
import { dateRange, monthRange, requirePlainDate } from '../dates/index';
import type { MovimientoAnalizable } from './movimiento';
import {
  diaDeMayorGasto, gastoPorDiaDeSemana, rachaMasLargaSinGasto, saldoAcumulado, seriePorDia,
} from './series';
import { money } from '../money/index';

const d = requirePlainDate;
const gasto = (fecha: string, monto: number): MovimientoAnalizable =>
  ({ tipo: 'gasto', montoMinor: monto, ocurridoEn: d(fecha) });
const ingreso = (fecha: string, monto: number): MovimientoAnalizable =>
  ({ tipo: 'ingreso', montoMinor: monto, ocurridoEn: d(fecha) });

const AGOSTO = monthRange(2026, 8);

describe('seriePorDia', () => {
  it('devuelve un dia por cada dia del rango, sin huecos', () => {
    // Sin esto el calendario dejaria celdas vacias y una linea uniria dos
    // puntos lejanos mintiendo sobre lo del medio.
    const serie = seriePorDia([gasto('2026-08-05', 1_000)], AGOSTO);
    expect(serie).toHaveLength(31);
    expect(serie[0]?.fecha).toBe('2026-08-01');
    expect(serie[30]?.fecha).toBe('2026-08-31');
  });

  it('suma varios movimientos del mismo dia', () => {
    const serie = seriePorDia(
      [gasto('2026-08-05', 1_000), gasto('2026-08-05', 2_500)],
      AGOSTO,
    );
    expect(serie[4]?.gasto.amountMinor).toBe(3_500);
    expect(serie[4]?.cantidad).toBe(2);
  });

  it('separa gasto de ingreso', () => {
    const serie = seriePorDia([gasto('2026-08-05', 1_000), ingreso('2026-08-05', 9_000)], AGOSTO);
    expect(serie[4]?.gasto.amountMinor).toBe(1_000);
    expect(serie[4]?.ingreso.amountMinor).toBe(9_000);
  });

  it('los dias sin movimiento quedan en cero, no ausentes', () => {
    const serie = seriePorDia([gasto('2026-08-05', 1_000)], AGOSTO);
    expect(serie[0]?.gasto.amountMinor).toBe(0);
    expect(serie[0]?.cantidad).toBe(0);
  });

  it('descarta lo de fuera del rango', () => {
    const serie = seriePorDia([gasto('2026-07-31', 999), gasto('2026-09-01', 999)], AGOSTO);
    expect(serie.reduce((s, x) => s + x.gasto.amountMinor, 0)).toBe(0);
  });

  it('las transferencias no entran en ninguno de los dos', () => {
    const serie = seriePorDia(
      [{ tipo: 'transferencia', montoMinor: 50_000, ocurridoEn: d('2026-08-05') }],
      AGOSTO,
    );
    expect(serie[4]?.gasto.amountMinor).toBe(0);
    expect(serie[4]?.ingreso.amountMinor).toBe(0);
    expect(serie[4]?.cantidad).toBe(0);
  });

  it('la suma de la serie es el gasto del rango', () => {
    const movimientos = [gasto('2026-08-01', 100), gasto('2026-08-15', 200), gasto('2026-08-31', 300)];
    expect(seriePorDia(movimientos, AGOSTO).reduce((s, x) => s + x.gasto.amountMinor, 0)).toBe(600);
  });
});

describe('diaDeMayorGasto', () => {
  it('encuentra el dia mas caro', () => {
    const serie = seriePorDia(
      [gasto('2026-08-03', 10_000), gasto('2026-08-17', 90_000), gasto('2026-08-25', 5_000)],
      AGOSTO,
    );
    expect(diaDeMayorGasto(serie)?.fecha).toBe('2026-08-17');
  });

  it('sin gasto devuelve null, no el primer dia en cero', () => {
    expect(diaDeMayorGasto(seriePorDia([], AGOSTO))).toBeNull();
  });
});

describe('gastoPorDiaDeSemana', () => {
  it('devuelve los siete dias aunque alguno no tenga gasto', () => {
    const filas = gastoPorDiaDeSemana(seriePorDia([gasto('2026-08-03', 1_000)], AGOSTO));
    expect(filas.map((f) => f.dia)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('agrupa por dia de la semana', () => {
    // 2026-08-03 y 2026-08-10 son lunes.
    const serie = seriePorDia([gasto('2026-08-03', 1_000), gasto('2026-08-10', 3_000)], AGOSTO);
    const lunes = gastoPorDiaDeSemana(serie).find((f) => f.dia === 1)!;
    expect(lunes.total.amountMinor).toBe(4_000);
  });

  it('el promedio corrige que un mes tenga mas lunes que martes', () => {
    // Agosto 2026 tiene cinco lunes y cuatro martes. Comparar totales crudos le
    // daria ventaja al lunes por existir una vez mas.
    const filas = gastoPorDiaDeSemana(seriePorDia([], AGOSTO));
    const lunes = filas.find((f) => f.dia === 1)!;
    const martes = filas.find((f) => f.dia === 2)!;
    expect(lunes.cantidad).toBe(5);
    expect(martes.cantidad).toBe(4);
  });

  it('el promedio divide por las veces que ocurrio el dia', () => {
    const serie = seriePorDia([gasto('2026-08-03', 5_000)], AGOSTO);
    const lunes = gastoPorDiaDeSemana(serie).find((f) => f.dia === 1)!;
    expect(lunes.total.amountMinor).toBe(5_000);
    expect(lunes.promedio.amountMinor).toBe(1_000);
  });
});

describe('rachaMasLargaSinGasto', () => {
  it('cuenta los dias seguidos sin gastar', () => {
    const serie = seriePorDia(
      [gasto('2026-08-01', 100), gasto('2026-08-10', 100)],
      dateRange(d('2026-08-01'), d('2026-08-10')),
    );
    // Del 2 al 9 son ocho dias sin gasto.
    expect(rachaMasLargaSinGasto(serie)).toBe(8);
  });

  it('gastando todos los dias la racha es cero', () => {
    const serie = seriePorDia(
      [gasto('2026-08-01', 100), gasto('2026-08-02', 100), gasto('2026-08-03', 100)],
      dateRange(d('2026-08-01'), d('2026-08-03')),
    );
    expect(rachaMasLargaSinGasto(serie)).toBe(0);
  });

  it('sin ningun gasto la racha es todo el rango', () => {
    expect(rachaMasLargaSinGasto(seriePorDia([], AGOSTO))).toBe(31);
  });
});

describe('saldoAcumulado', () => {
  const partida = money(100_000, 'CLP');

  it('cada punto es el saldo al cerrar el dia', () => {
    const serie = seriePorDia(
      [gasto('2026-08-01', 30_000), gasto('2026-08-03', 20_000)],
      dateRange(d('2026-08-01'), d('2026-08-03'), 'days'),
    );
    expect(saldoAcumulado(serie, partida).map((x) => x.saldo.amountMinor))
      .toEqual([70_000, 70_000, 50_000]);
  });

  it('el ingreso levanta la linea el dia que entra, no repartido en el mes', () => {
    const serie = seriePorDia(
      [gasto('2026-08-01', 30_000), ingreso('2026-08-03', 500_000)],
      dateRange(d('2026-08-01'), d('2026-08-03'), 'days'),
    );
    expect(saldoAcumulado(serie, partida).map((x) => x.saldo.amountMinor))
      .toEqual([70_000, 70_000, 570_000]);
  });

  it('un dia sin movimiento repite el saldo del dia anterior', () => {
    const serie = seriePorDia([], dateRange(d('2026-08-01'), d('2026-08-04'), 'days'));
    expect(saldoAcumulado(serie, partida).map((x) => x.saldo.amountMinor))
      .toEqual([100_000, 100_000, 100_000, 100_000]);
  });

  it('el saldo puede quedar negativo: gastar mas de lo que hay es un hecho', () => {
    const serie = seriePorDia(
      [gasto('2026-08-01', 250_000)],
      dateRange(d('2026-08-01'), d('2026-08-01'), 'days'),
    );
    expect(saldoAcumulado(serie, partida)[0]!.saldo.amountMinor).toBe(-150_000);
  });

  it('devuelve un punto por dia del rango, tambien sin datos', () => {
    const serie = seriePorDia([], AGOSTO);
    expect(saldoAcumulado(serie, partida)).toHaveLength(31);
  });

  it('las transferencias no mueven el saldo', () => {
    const transferencia: MovimientoAnalizable =
      { tipo: 'transferencia', montoMinor: 80_000, ocurridoEn: d('2026-08-02') };
    const serie = seriePorDia(
      [transferencia],
      dateRange(d('2026-08-01'), d('2026-08-02'), 'days'),
    );
    expect(saldoAcumulado(serie, partida).map((x) => x.saldo.amountMinor))
      .toEqual([100_000, 100_000]);
  });
});
