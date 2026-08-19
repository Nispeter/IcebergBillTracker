/**
 * Comparar un rango contra otro.
 *
 * Un numero solo no dice nada: $1.400.000 de gasto puede ser un mes tranquilo o
 * una catastrofe. Lo que informa es contra que se compara, y por eso el rango
 * guarda de que tipo es (ver `dates/range`): el anterior de marzo es febrero, no
 * "los 31 dias previos".
 */

import { previousPeriod, sameRangeLastYear, type DateRange } from '../dates/index';
import { isZero, ratio, subtract, type Money } from '../money/index';
import type { MovimientoAnalizable } from './movimiento';
import { resumirRango, type Resumen } from './resumen';

export interface Variacion {
  readonly actual: Money;
  readonly anterior: Money;
  /** Actual menos anterior. Positivo = subio. */
  readonly delta: Money;
  /**
   * Delta sobre el anterior, de -1 a lo que sea. `null` cuando el anterior es
   * cero: no existe el "porcentaje de cambio" respecto de nada, y mostrar
   * "+∞%" o "+100%" seria inventar.
   */
  readonly variacion: number | null;
}

export interface Comparacion {
  readonly actual: Resumen;
  readonly referencia: Resumen;
  readonly gasto: Variacion;
  readonly ingreso: Variacion;
  readonly neto: Variacion;
}

export function compararMontos(actual: Money, anterior: Money): Variacion {
  return {
    actual,
    anterior,
    delta: subtract(actual, anterior),
    variacion: isZero(anterior) ? null : ratio(subtract(actual, anterior), anterior),
  };
}

/** Compara dos rangos cualesquiera. */
export function compararRangos(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
  referencia: DateRange,
): Comparacion {
  const a = resumirRango(movimientos, rango);
  const b = resumirRango(movimientos, referencia);
  return {
    actual: a,
    referencia: b,
    gasto: compararMontos(a.gasto, b.gasto),
    ingreso: compararMontos(a.ingreso, b.ingreso),
    neto: compararMontos(a.neto, b.neto),
  };
}

/** Contra el periodo inmediatamente anterior del mismo tipo. */
export function compararConAnterior(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
): Comparacion {
  return compararRangos(movimientos, rango, previousPeriod(rango));
}

/**
 * Contra el mismo rango del ano pasado.
 *
 * Es la comparacion que saca del medio la estacionalidad: marzo siempre trae
 * gastos de colegio y julio siempre trae calefaccion, asi que compararlos con el
 * mes anterior exagera un cambio que en realidad se repite todos los anos.
 */
export function compararConAnoPasado(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
): Comparacion {
  return compararRangos(movimientos, rango, sameRangeLastYear(rango));
}
