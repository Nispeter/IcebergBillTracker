/**
 * Series por dia: lo que alimenta al calendario y a los graficos de linea.
 *
 * Devuelve **todos** los dias del rango, incluidos los que no tuvieron
 * movimiento. Saltarse los dias vacios haria que un calendario dejara huecos y
 * que una linea uniera dos puntos lejanos con una recta que miente sobre lo que
 * paso en el medio.
 */

import { eachDate, weekday, type DateRange, type PlainDate } from '../dates/index';
import { money, type Money } from '../money/index';
import { esGasto, esIngreso, type MovimientoAnalizable } from './movimiento';
import { enRango } from './resumen';

export interface DiaDeLaSerie {
  readonly fecha: PlainDate;
  readonly gasto: Money;
  readonly ingreso: Money;
  readonly cantidad: number;
}

/** Un dia por cada dia del rango, en orden, sin huecos. */
export function seriePorDia(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
): DiaDeLaSerie[] {
  const gastos = new Map<string, number>();
  const ingresos = new Map<string, number>();
  const cuenta = new Map<string, number>();

  for (const movimiento of enRango(movimientos, rango)) {
    const clave = movimiento.ocurridoEn;
    if (esGasto(movimiento)) {
      gastos.set(clave, (gastos.get(clave) ?? 0) + movimiento.montoMinor);
    } else if (esIngreso(movimiento)) {
      ingresos.set(clave, (ingresos.get(clave) ?? 0) + movimiento.montoMinor);
    } else {
      continue; // Las transferencias no son flujo real.
    }
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }

  return eachDate(rango).map((fecha) => ({
    fecha,
    gasto: money(gastos.get(fecha) ?? 0, 'CLP'),
    ingreso: money(ingresos.get(fecha) ?? 0, 'CLP'),
    cantidad: cuenta.get(fecha) ?? 0,
  }));
}

export interface DiaConSaldo {
  readonly fecha: PlainDate;
  /** Saldo al **cerrar** ese dia, ya aplicados sus movimientos. */
  readonly saldo: Money;
}

/**
 * El saldo dia a dia, partiendo de lo que habia al empezar el rango.
 *
 * Cada punto es el saldo al **cerrar** el dia, que es como lo muestra un banco.
 * Asi la linea baja durante el mes y pega el salto el dia que entra el sueldo,
 * que es la forma real de un mes y no un promedio suavizado.
 *
 * El saldo de partida se lo tiene que dar quien llama: `analytics` solo ve los
 * movimientos que le pasan, y el saldo verdadero incluye todo lo anterior al
 * rango mas el saldo inicial de las cuentas.
 */
export function saldoAcumulado(
  serie: readonly DiaDeLaSerie[],
  saldoAlEmpezar: Money,
): DiaConSaldo[] {
  let corriente = saldoAlEmpezar.amountMinor;
  return serie.map((dia) => {
    corriente += dia.ingreso.amountMinor - dia.gasto.amountMinor;
    return { fecha: dia.fecha, saldo: money(corriente, saldoAlEmpezar.currency) };
  });
}

/** El dia que mas se gasto. `null` si no hubo gasto en todo el rango. */
export function diaDeMayorGasto(serie: readonly DiaDeLaSerie[]): DiaDeLaSerie | null {
  let mayor: DiaDeLaSerie | null = null;
  for (const dia of serie) {
    if (dia.gasto.amountMinor === 0) continue;
    if (mayor === null || dia.gasto.amountMinor > mayor.gasto.amountMinor) mayor = dia;
  }
  return mayor;
}

export interface GastoPorDiaDeSemana {
  /** 1 lunes … 7 domingo. */
  readonly dia: number;
  readonly total: Money;
  readonly cantidad: number;
  /** Promedio por vez que ocurrio ese dia de la semana en el rango. */
  readonly promedio: Money;
}

/**
 * Gasto agrupado por dia de la semana.
 *
 * Responde "¿que dia se me va la plata?". El promedio va aparte del total
 * porque un rango puede tener cinco lunes y cuatro martes, y comparar totales
 * crudos le daria ventaja al lunes por existir una vez mas.
 */
export function gastoPorDiaDeSemana(serie: readonly DiaDeLaSerie[]): GastoPorDiaDeSemana[] {
  const totales = new Map<number, number>();
  const ocurrencias = new Map<number, number>();

  for (const dia of serie) {
    const cual = weekday(dia.fecha);
    totales.set(cual, (totales.get(cual) ?? 0) + dia.gasto.amountMinor);
    ocurrencias.set(cual, (ocurrencias.get(cual) ?? 0) + 1);
  }

  return [1, 2, 3, 4, 5, 6, 7].map((dia) => {
    const total = totales.get(dia) ?? 0;
    const veces = ocurrencias.get(dia) ?? 0;
    return {
      dia,
      total: money(total, 'CLP'),
      cantidad: veces,
      promedio: money(veces === 0 ? 0 : Math.round(total / veces), 'CLP'),
    };
  });
}

/**
 * Rachas de dias seguidos sin gastar nada.
 *
 * La mas larga es el dato interesante: dice cuanto se aguanta sin gastar, que
 * es distinto de gastar poco.
 */
export function rachaMasLargaSinGasto(serie: readonly DiaDeLaSerie[]): number {
  let mejor = 0;
  let actual = 0;
  for (const dia of serie) {
    if (dia.gasto.amountMinor === 0) {
      actual += 1;
      if (actual > mejor) mejor = actual;
    } else {
      actual = 0;
    }
  }
  return mejor;
}
