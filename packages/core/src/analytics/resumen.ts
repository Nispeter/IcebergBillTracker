/**
 * Resumen de un rango: las cifras que encabezan cualquier pantalla de analisis.
 *
 * Todo funcion pura. Entra una lista de movimientos y un rango, sale un objeto
 * de numeros. Sin base de datos, sin fechas del sistema, sin nada que impida
 * probarlo con un fixture escrito a mano.
 */

import { containsDate, type DateRange, lengthInDays } from '../dates/index';
import { divide, money, ratio, subtract, sum, type Money } from '../money/index';
import { esGasto, esIngreso, type MovimientoAnalizable } from './movimiento';

export interface Resumen {
  readonly rango: DateRange;
  readonly gasto: Money;
  readonly ingreso: Money;
  /** Ingreso menos gasto. Negativo significa que se gasto mas de lo que entro. */
  readonly neto: Money;
  /**
   * Neto sobre ingreso, de 0 a 1. `null` si no hubo ingreso en el rango, que es
   * distinto de cero: no se puede ahorrar un porcentaje de nada.
   */
  readonly tasaDeAhorro: number | null;
  readonly cantidadDeGastos: number;
  readonly cantidadDeIngresos: number;
  /** Promedio de los gastos. Cero si no hubo ninguno. */
  readonly ticketPromedio: Money;
  /**
   * Mediana de los gastos.
   *
   * Va junto al promedio a proposito: en gasto domestico un arriendo o un
   * pago de tarjeta arrastran el promedio muy por encima de lo que la persona
   * gasta habitualmente. La mediana dice cuanto es un gasto **tipico**, y la
   * distancia entre las dos ya es informacion.
   */
  readonly ticketMediano: Money;
  readonly gastoDiarioPromedio: Money;
  readonly diasDelRango: number;
}

/** Filtra a lo que cae dentro del rango. Los bordes entran. */
export function enRango(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
): MovimientoAnalizable[] {
  return movimientos.filter((movimiento) => containsDate(rango, movimiento.ocurridoEn));
}

/** Mediana de una lista de enteros. Cero si esta vacia. */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[medio]!;
  // Par: el promedio de los dos del centro, redondeado para no soltar decimales
  // en algo que despues se trata como dinero.
  return Math.round((ordenados[medio - 1]! + ordenados[medio]!) / 2);
}

export function resumirRango(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
): Resumen {
  const delRango = enRango(movimientos, rango);
  const gastos = delRango.filter(esGasto);
  const ingresos = delRango.filter(esIngreso);

  const montos = (lista: readonly MovimientoAnalizable[]) =>
    lista.map((movimiento) => money(movimiento.montoMinor, 'CLP'));

  const gasto = sum(montos(gastos));
  const ingreso = sum(montos(ingresos));
  const neto = subtract(ingreso, gasto);
  const dias = lengthInDays(rango);

  return {
    rango,
    gasto,
    ingreso,
    neto,
    tasaDeAhorro: ratio(neto, ingreso),
    cantidadDeGastos: gastos.length,
    cantidadDeIngresos: ingresos.length,
    ticketPromedio: gastos.length === 0 ? money(0, 'CLP') : divide(gasto, gastos.length),
    ticketMediano: money(mediana(gastos.map((movimiento) => movimiento.montoMinor)), 'CLP'),
    gastoDiarioPromedio: divide(gasto, dias),
    diasDelRango: dias,
  };
}
