/**
 * Gasto por categoria, y —lo que de verdad informa— **que categoria explica el
 * cambio del mes**.
 *
 * Ver que se gasto $265.890 en comida esta bien. Ver que la comida subio
 * $80.000 y que eso es el 70% de todo lo que subio el mes, es lo que hace que
 * uno cambie algo.
 */

import type { DateRange } from '../dates/index';
import { abs, compare, isZero, money, ratio, subtract, sum, type Money } from '../money/index';
import { esGasto, type MovimientoAnalizable } from './movimiento';
import { enRango } from './resumen';

/** Clave con la que se agrupan los gastos sin categoria. */
export const SIN_CATEGORIA = '__sin__';

export interface TotalDeCategoria {
  readonly categoriaId: string;
  readonly total: Money;
  /** Parte del gasto total del rango, de 0 a 1. `null` si no hubo gasto. */
  readonly participacion: number | null;
}

export interface DerivaDeCategoria extends TotalDeCategoria {
  readonly anterior: Money;
  /** Actual menos anterior. Positivo = subio. */
  readonly delta: Money;
  /**
   * Cuanto del cambio total del gasto explica esta categoria, de 0 a 1.
   *
   * Se mide sobre la suma de los **valores absolutos** de todos los deltas, no
   * sobre el cambio neto. Si comida sube $80.000 y transporte baja $78.000, el
   * neto es $2.000 y dividir por eso daria participaciones absurdas de 4.000%.
   * Con el absoluto, cada categoria queda con su peso real en el movimiento del
   * mes. `null` si no cambio nada.
   */
  readonly explicacion: number | null;
}

function agrupar(movimientos: readonly MovimientoAnalizable[]): Map<string, number> {
  const acumulado = new Map<string, number>();
  for (const movimiento of movimientos) {
    if (!esGasto(movimiento)) continue;
    const clave = movimiento.categoriaId ?? SIN_CATEGORIA;
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + movimiento.montoMinor);
  }
  return acumulado;
}

/** Gasto por categoria en el rango, de mayor a menor. */
export function gastoPorCategoria(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
): TotalDeCategoria[] {
  const acumulado = agrupar(enRango(movimientos, rango));
  const total = sum([...acumulado.values()].map((valor) => money(valor, 'CLP')));

  return [...acumulado.entries()]
    .map(([categoriaId, valor]) => {
      const monto = money(valor, 'CLP');
      return { categoriaId, total: monto, participacion: ratio(monto, total) };
    })
    .sort((a, b) => compare(b.total, a.total));
}

/**
 * Que categoria explica el cambio entre dos rangos.
 *
 * Devuelve **todas** las categorias que aparecen en cualquiera de los dos
 * rangos, ordenadas por cuanto movieron la aguja —en valor absoluto— asi que la
 * primera es la que mas explica el cambio, haya subido o bajado.
 */
export function derivaPorCategoria(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
  referencia: DateRange,
): DerivaDeCategoria[] {
  const ahora = agrupar(enRango(movimientos, rango));
  const antes = agrupar(enRango(movimientos, referencia));
  const total = sum([...ahora.values()].map((valor) => money(valor, 'CLP')));

  const claves = new Set([...ahora.keys(), ...antes.keys()]);
  const filas = [...claves].map((categoriaId) => {
    const actual = money(ahora.get(categoriaId) ?? 0, 'CLP');
    const anterior = money(antes.get(categoriaId) ?? 0, 'CLP');
    return {
      categoriaId,
      total: actual,
      participacion: ratio(actual, total),
      anterior,
      delta: subtract(actual, anterior),
    };
  });

  const movimientoTotal = sum(filas.map((fila) => abs(fila.delta)));

  return filas
    .map((fila) => ({
      ...fila,
      explicacion: isZero(movimientoTotal) ? null : ratio(abs(fila.delta), movimientoTotal),
    }))
    .sort((a, b) => compare(abs(b.delta), abs(a.delta)));
}
