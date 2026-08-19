/**
 * Deteccion de gasto fuera de lo normal.
 *
 * Usa **mediana y MAD**, no promedio y desviacion estandar. La razon es
 * concreta: el promedio y la desviacion los arrastra justamente el valor raro
 * que uno quiere encontrar. Un mes con un gasto de $2.000.000 sube tanto el
 * promedio y tanto la desviacion que ese mismo gasto termina pareciendo normal.
 *
 * La mediana y la MAD (desviacion absoluta mediana) no se mueven por unos pocos
 * valores extremos, asi que el raro sigue destacando.
 */

import { money, type Money } from '../money/index';
import { mediana } from './resumen';

/**
 * Constante que hace la MAD comparable con una desviacion estandar cuando los
 * datos son normales. Es 1/Φ⁻¹(3/4). Sin ella, los umbrales en "sigmas" no
 * significarian lo mismo que en el z-score de siempre.
 */
const ESCALA_MAD = 1.4826;

/** Cuantas sigmas robustas se pide para considerar algo anomalo. */
export const UMBRAL_ANOMALIA = 3;

export interface Anomalia<T> {
  readonly item: T;
  readonly valor: number;
  /** Cuantas sigmas robustas por encima (o debajo) de lo normal. */
  readonly z: number;
  readonly esAlta: boolean;
}

export interface Dispersion {
  readonly mediana: number;
  /** Desviacion absoluta mediana, ya escalada. */
  readonly mad: number;
}

export function dispersionRobusta(valores: readonly number[]): Dispersion {
  const centro = mediana(valores);
  const desviaciones = valores.map((valor) => Math.abs(valor - centro));
  return { mediana: centro, mad: mediana(desviaciones) * ESCALA_MAD };
}

/**
 * Z-score robusto de un valor.
 *
 * `null` cuando la MAD es cero, o sea cuando mas de la mitad de los datos son
 * identicos. Ahi no hay dispersion contra la cual medir y cualquier numero que
 * se devolviera —infinito, cero— seria mentira.
 */
export function zRobusto(valor: number, dispersion: Dispersion): number | null {
  if (dispersion.mad === 0) return null;
  return (valor - dispersion.mediana) / dispersion.mad;
}

/**
 * Los elementos que se salen de lo normal.
 *
 * Necesita al menos cinco datos: con menos, "lo normal" no esta definido y
 * cualquier cosa parece anomala. Devuelve lista vacia en ese caso, que es lo
 * honesto.
 */
export function detectarAnomalias<T>(
  items: readonly T[],
  valorDe: (item: T) => number,
  umbral = UMBRAL_ANOMALIA,
): Anomalia<T>[] {
  if (items.length < 5) return [];

  const valores = items.map(valorDe);
  const dispersion = dispersionRobusta(valores);

  const anomalias: Anomalia<T>[] = [];
  for (const item of items) {
    const valor = valorDe(item);
    const z = zRobusto(valor, dispersion);
    if (z === null || Math.abs(z) < umbral) continue;
    anomalias.push({ item, valor, z, esAlta: z > 0 });
  }
  return anomalias.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

/** Lo mismo pero devolviendo montos, para no tener que envolver afuera. */
export function montoDeAnomalia<T>(anomalia: Anomalia<T>): Money {
  return money(Math.round(anomalia.valor), 'CLP');
}
