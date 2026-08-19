/**
 * El motor de metricas contra el dataset de 18 meses.
 *
 * Es el criterio de verificacion de F2: cada cifra se contrasta con un calculo
 * **independiente** hecho aca, a mano sobre el dataset. Si las dos coinciden es
 * porque el motor hace lo que dice; si el motor y su test compartieran el
 * calculo, el test no probaria nada.
 */

import { describe, expect, it } from 'vitest';
import { analytics, dates, money } from '@iceberg/core';
import { generateSeed, type SeedTransaction } from './generate';

const FIN = dates.requirePlainDate('2026-08-18');
const dataset = generateSeed({ endDate: FIN });

/** El dataset traducido a lo que entiende analytics. */
const movimientos: analytics.MovimientoAnalizable[] = dataset.transactions.map((tx) => ({
  tipo: tx.type,
  montoMinor: tx.amountMinor,
  ocurridoEn: tx.occurredAt,
  categoriaId: tx.category ?? null,
  nombre: tx.name,
}));

/** Suma a mano, sin tocar el motor. */
const sumarAMano = (
  filtro: (tx: SeedTransaction) => boolean,
  desde: string,
  hasta: string,
): number => dataset.transactions
  .filter((tx) => tx.occurredAt >= desde && tx.occurredAt <= hasta && filtro(tx))
  .reduce((suma, tx) => suma + tx.amountMinor, 0);

const JULIO = dates.monthRange(2026, 7);
const AGOSTO = dates.monthRange(2026, 8);

describe('resumen contra la semilla', () => {
  it('el gasto de julio coincide con la suma a mano', () => {
    const resumen = analytics.resumirRango(movimientos, JULIO);
    const aMano = sumarAMano((tx) => tx.type === 'gasto', '2026-07-01', '2026-07-31');
    expect(resumen.gasto.amountMinor).toBe(aMano);
    expect(aMano).toBeGreaterThan(0);
  });

  it('el ingreso de julio coincide', () => {
    const resumen = analytics.resumirRango(movimientos, JULIO);
    expect(resumen.ingreso.amountMinor)
      .toBe(sumarAMano((tx) => tx.type === 'ingreso', '2026-07-01', '2026-07-31'));
  });

  it('el neto es ingreso menos gasto', () => {
    const r = analytics.resumirRango(movimientos, JULIO);
    expect(r.neto.amountMinor).toBe(r.ingreso.amountMinor - r.gasto.amountMinor);
  });

  it('la suma de los doce meses da el total del dataset', () => {
    // Si algun rango dejara filas afuera —un borde mal calculado— esto no
    // cerraria.
    let acumulado = 0;
    for (let offset = 0; offset < 18; offset++) {
      const mes = dates.addMonths(dataset.range.start, offset);
      acumulado += analytics
        .resumirRango(movimientos, dates.monthRange(dates.year(mes), dates.month(mes)))
        .gasto.amountMinor;
    }
    const total = dataset.transactions
      .filter((tx) => tx.type === 'gasto')
      .reduce((s, tx) => s + tx.amountMinor, 0);
    expect(acumulado).toBe(total);
  });

  it('el ticket mediano queda por debajo del promedio', () => {
    // El arriendo y el aporte a fondo mutuo arrastran el promedio; la mediana
    // se queda donde esta el gasto tipico.
    const r = analytics.resumirRango(movimientos, JULIO);
    expect(r.ticketMediano.amountMinor).toBeLessThan(r.ticketPromedio.amountMinor);
  });

  it('el gasto diario promedio por los dias del mes reconstruye el gasto', () => {
    const r = analytics.resumirRango(movimientos, JULIO);
    const reconstruido = r.gastoDiarioPromedio.amountMinor * r.diasDelRango;
    // Tolerancia de un dia de gasto: el promedio se redondea a peso entero.
    expect(Math.abs(reconstruido - r.gasto.amountMinor)).toBeLessThan(r.diasDelRango);
  });
});

describe('comparacion contra la semilla', () => {
  it('agosto contra julio usa los meses completos correctos', () => {
    const c = analytics.compararConAnterior(movimientos, AGOSTO);
    expect(c.referencia.rango.start).toBe('2026-07-01');
    expect(c.referencia.rango.end).toBe('2026-07-31');
    expect(c.referencia.gasto.amountMinor)
      .toBe(sumarAMano((tx) => tx.type === 'gasto', '2026-07-01', '2026-07-31'));
  });

  it('el delta es la resta de los dos meses', () => {
    const c = analytics.compararConAnterior(movimientos, AGOSTO);
    expect(c.gasto.delta.amountMinor)
      .toBe(c.actual.gasto.amountMinor - c.referencia.gasto.amountMinor);
  });

  it('julio de 2026 contra julio de 2025 muestra la estacionalidad del invierno', () => {
    // Los dos son julio, asi que la comparacion interanual no deberia estar
    // dominada por la calefaccion: ambos la tienen.
    const c = analytics.compararConAnoPasado(movimientos, JULIO);
    expect(c.referencia.rango.start).toBe('2025-07-01');
    expect(c.referencia.gasto.amountMinor).toBeGreaterThan(0);
  });
});

describe('categorias contra la semilla', () => {
  it('vivienda es la categoria mas pesada del mes', () => {
    const filas = analytics.gastoPorCategoria(movimientos, JULIO);
    expect(filas[0]?.categoriaId).toBe('vivienda');
    expect(filas[0]?.total.amountMinor).toBe(450_000);
  });

  it('las categorias suman el gasto total del mes', () => {
    const filas = analytics.gastoPorCategoria(movimientos, JULIO);
    const suma = money.sum(filas.map((f) => f.total));
    expect(suma.amountMinor).toBe(analytics.resumirRango(movimientos, JULIO).gasto.amountMinor);
  });

  it('las participaciones suman uno', () => {
    const filas = analytics.gastoPorCategoria(movimientos, JULIO);
    expect(filas.reduce((s, f) => s + (f.participacion ?? 0), 0)).toBeCloseTo(1, 6);
  });

  it('la deriva cubre todas las categorias de los dos meses', () => {
    const deriva = analytics.derivaPorCategoria(movimientos, AGOSTO, JULIO);
    const enAgosto = new Set(analytics.gastoPorCategoria(movimientos, AGOSTO).map((f) => f.categoriaId));
    const enJulio = new Set(analytics.gastoPorCategoria(movimientos, JULIO).map((f) => f.categoriaId));
    const esperadas = new Set([...enAgosto, ...enJulio]);
    expect(new Set(deriva.map((f) => f.categoriaId))).toEqual(esperadas);
  });

  it('los deltas de la deriva suman el cambio total del gasto', () => {
    const deriva = analytics.derivaPorCategoria(movimientos, AGOSTO, JULIO);
    const sumaDeltas = deriva.reduce((s, f) => s + f.delta.amountMinor, 0);
    const cambioReal = analytics.resumirRango(movimientos, AGOSTO).gasto.amountMinor
      - analytics.resumirRango(movimientos, JULIO).gasto.amountMinor;
    expect(sumaDeltas).toBe(cambioReal);
  });
});

describe('ritmo contra la semilla', () => {
  it('a fin de mes lo gastado es todo el gasto del mes', () => {
    const ritmo = analytics.calcularRitmo(movimientos, JULIO, dates.requirePlainDate('2026-07-31'));
    expect(ritmo.gastadoHastaAhora.amountMinor)
      .toBe(analytics.resumirRango(movimientos, JULIO).gasto.amountMinor);
    expect(ritmo.diasRestantes).toBe(0);
  });

  it('a mitad de mes solo cuenta hasta esa fecha', () => {
    const ritmo = analytics.calcularRitmo(movimientos, JULIO, dates.requirePlainDate('2026-07-15'));
    const aMano = sumarAMano((tx) => tx.type === 'gasto', '2026-07-01', '2026-07-15');
    expect(ritmo.gastadoHastaAhora.amountMinor).toBe(aMano);
    expect(ritmo.diasTranscurridos).toBe(15);
    expect(ritmo.diasRestantes).toBe(16);
  });

  it('con 16 meses de historia si hay proyeccion por perfil', () => {
    const ritmo = analytics.calcularRitmo(movimientos, JULIO, dates.requirePlainDate('2026-07-15'));
    expect(ritmo.proyeccionPorPerfil).not.toBeNull();
  });

  it('la proyeccion por perfil le acierta mas que la lineal', () => {
    // El gasto de la semilla se carga al principio del mes —arriendo el 5,
    // cuentas entre el 8 y el 22— asi que proyectar linealmente a mitad de mes
    // exagera. Es exactamente el caso para el que existe el perfil.
    const corte = dates.requirePlainDate('2026-07-15');
    const ritmo = analytics.calcularRitmo(movimientos, JULIO, corte);
    const real = analytics.resumirRango(movimientos, JULIO).gasto.amountMinor;

    const errorLineal = Math.abs(ritmo.proyeccionLineal.amountMinor - real);
    const errorPerfil = Math.abs(ritmo.proyeccionPorPerfil!.amountMinor - real);
    expect(errorPerfil).toBeLessThan(errorLineal);
  });

  it('el grosor del hielo es saldo sobre quema diaria', () => {
    const ritmo = analytics.calcularRitmo(movimientos, JULIO, dates.requirePlainDate('2026-07-15'));
    const saldo = money.money(500_000);
    const dias = analytics.grosorDelHielo(saldo, ritmo.promedioDiario);
    expect(dias).toBe(Math.floor(500_000 / ritmo.promedioDiario.amountMinor));
  });
});

describe('anomalias contra la semilla', () => {
  it('encuentra el gasto mas raro del dataset', () => {
    // El aporte a fondo mutuo y el arriendo son mucho mayores que el gasto
    // corriente, asi que tienen que salir marcados.
    const gastos = dataset.transactions.filter((tx) => tx.type === 'gasto');
    const anomalias = analytics.detectarAnomalias(gastos, (tx) => tx.amountMinor);
    expect(anomalias.length).toBeGreaterThan(0);
    expect(anomalias[0]!.item.amountMinor).toBeGreaterThan(400_000);
    expect(anomalias[0]?.esAlta).toBe(true);
  });

  it('el gasto corriente de comida no dispara falsos positivos', () => {
    const comida = dataset.transactions.filter((tx) => tx.category === 'comida');
    const anomalias = analytics.detectarAnomalias(comida, (tx) => tx.amountMinor);
    // Puede haber alguno, pero no la mitad de la categoria.
    expect(anomalias.length).toBeLessThan(comida.length * 0.1);
  });
});
