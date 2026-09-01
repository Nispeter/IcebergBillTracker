import { describe, expect, it } from 'vitest';
import { dateRange, monthRange, requirePlainDate } from '../dates/index';
import type { MovimientoAnalizable } from './movimiento';
import {
  concentracion, diaDeMayorGasto, diasSinGastar, finDeSemanaContraSemana, gastoDiarioTipico,
  gastoPorDiaDeSemana, rachaMasLargaSinGasto, saldoAcumulado, seriePorDia,
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

  it('los dias anteriores a la ventana no son racha, son falta de datos', () => {
    // Se empezo a anotar el 22: del 1 al 21 no hubo ahorro, hubo silencio.
    const serie = seriePorDia([gasto('2026-08-22', 1_000)], AGOSTO);
    expect(rachaMasLargaSinGasto(serie)).toBe(21);
    expect(rachaMasLargaSinGasto(serie, { desde: d('2026-08-22') })).toBe(9);
  });

  it('los dias que todavia no pasaron tampoco cuentan', () => {
    const serie = seriePorDia([gasto('2026-08-22', 1_000)], AGOSTO);
    expect(rachaMasLargaSinGasto(serie, {
      desde: d('2026-08-22'),
      hasta: d('2026-08-25'),
    })).toBe(3);
  });

  it('una ventana que abarca todo el rango no cambia nada', () => {
    const serie = seriePorDia([gasto('2026-08-22', 1_000)], AGOSTO);
    expect(rachaMasLargaSinGasto(serie, {
      desde: d('2026-07-01'),
      hasta: d('2026-09-30'),
    })).toBe(21);
  });

  it('con la ventana entera fuera del rango no hay racha', () => {
    const serie = seriePorDia([gasto('2026-08-22', 1_000)], AGOSTO);
    expect(rachaMasLargaSinGasto(serie, { desde: d('2026-09-01') })).toBe(0);
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

describe('finDeSemanaContraSemana', () => {
  it('parte la serie en sabado-domingo y el resto', () => {
    // Lunes a domingo: 1000 cada dia entre semana, 5000 el sabado y el domingo.
    const serie = [
      { fecha: requirePlainDate('2026-08-31'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-01'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-02'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-03'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-04'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-05'), gasto: money(5000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-06'), gasto: money(5000, 'CLP'), ingreso: money(0, 'CLP') },
    ];
    const r = finDeSemanaContraSemana(serie);
    expect(r.entreSemana.dias).toBe(5);
    expect(r.finDeSemana.dias).toBe(2);
    expect(r.entreSemana.promedio.amountMinor).toBe(1000);
    expect(r.finDeSemana.promedio.amountMinor).toBe(5000);
  });

  it('con una serie vacia no divide por cero', () => {
    const r = finDeSemanaContraSemana([]);
    expect(r.finDeSemana.promedio.amountMinor).toBe(0);
    expect(r.entreSemana.dias).toBe(0);
  });

  it('el promedio es lo comparable: el total le daria ventaja a la semana', () => {
    // Cinco dias de 1000 entre semana suman mas que dos de 2000, y aun asi el
    // fin de semana es el caro por dia.
    const serie = [
      { fecha: requirePlainDate('2026-08-31'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-01'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-02'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-03'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-04'), gasto: money(1000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-05'), gasto: money(2000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-09-06'), gasto: money(2000, 'CLP'), ingreso: money(0, 'CLP') },
    ];
    const r = finDeSemanaContraSemana(serie);
    expect(r.entreSemana.total.amountMinor).toBeGreaterThan(r.finDeSemana.total.amountMinor);
    expect(r.finDeSemana.promedio.amountMinor).toBeGreaterThan(r.entreSemana.promedio.amountMinor);
  });
});

describe('concentracion', () => {
  const serie = [
    { fecha: requirePlainDate('2026-08-01'), gasto: money(70_000, 'CLP'), ingreso: money(0, 'CLP') },
    { fecha: requirePlainDate('2026-08-02'), gasto: money(0, 'CLP'), ingreso: money(0, 'CLP') },
    { fecha: requirePlainDate('2026-08-03'), gasto: money(20_000, 'CLP'), ingreso: money(0, 'CLP') },
    { fecha: requirePlainDate('2026-08-04'), gasto: money(5_000, 'CLP'), ingreso: money(0, 'CLP') },
    { fecha: requirePlainDate('2026-08-05'), gasto: money(5_000, 'CLP'), ingreso: money(0, 'CLP') },
  ];

  it('devuelve los mas caros y que parte del total son', () => {
    const r = concentracion(serie, 3);
    expect(r.dias.map((d) => d.gasto.amountMinor)).toEqual([70_000, 20_000, 5_000]);
    expect(r.parte).toBeCloseTo(95_000 / 100_000);
  });

  it('los dias sin gasto no cuentan como dias caros', () => {
    const r = concentracion(serie, 5);
    expect(r.dias).toHaveLength(4);
    expect(r.parte).toBe(1);
  });

  it('sin gasto no inventa una fraccion', () => {
    const vacia = [
      { fecha: requirePlainDate('2026-08-01'), gasto: money(0, 'CLP'), ingreso: money(0, 'CLP') },
    ];
    expect(concentracion(vacia).parte).toBe(0);
    expect(concentracion(vacia).dias).toHaveLength(0);
  });
});

describe('gastoDiarioTipico', () => {
  it('es la mediana de los dias con gasto, no el promedio de todos', () => {
    const serie = [
      { fecha: requirePlainDate('2026-08-01'), gasto: money(490_000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-08-02'), gasto: money(0, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-08-03'), gasto: money(10_000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-08-04'), gasto: money(12_000, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-08-05'), gasto: money(14_000, 'CLP'), ingreso: money(0, 'CLP') },
    ];
    // El promedio de los cinco dias seria 105.200, tironeado por el arriendo.
    // La mediana de los cuatro con gasto --10, 12, 14 y 490 mil-- son 13.000.
    expect(gastoDiarioTipico(serie).amountMinor).toBe(13_000);
  });

  it('sin dias con gasto no hay dia normal que describir', () => {
    expect(gastoDiarioTipico([]).amountMinor).toBe(0);
  });
});

describe('diasSinGastar', () => {
  it('cuenta los dias en cero', () => {
    const serie = [
      { fecha: requirePlainDate('2026-08-01'), gasto: money(1, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-08-02'), gasto: money(0, 'CLP'), ingreso: money(0, 'CLP') },
      { fecha: requirePlainDate('2026-08-03'), gasto: money(0, 'CLP'), ingreso: money(0, 'CLP') },
    ];
    expect(diasSinGastar(serie)).toBe(2);
  });
});
