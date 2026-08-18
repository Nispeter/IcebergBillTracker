/**
 * Dinero como entero en la unidad menor de la moneda + codigo ISO 4217.
 *
 * Regla dura del proyecto: **jamas un float representa dinero**. Los flotantes
 * solo aparecen como factores de entrada (una tasa, un divisor) y el resultado
 * vuelve a entero en el mismo paso, con redondeo explicito.
 *
 * CLP tiene exponente 0, asi que `amountMinor` son pesos enteros. El codigo de
 * moneda se guarda igual para que agregar UF/USD mas adelante no obligue a
 * migrar datos.
 */

export type CurrencyCode = 'CLP';

/** Decimales de cada moneda segun ISO 4217. CLP no tiene. */
const EXPONENT: Record<CurrencyCode, number> = { CLP: 0 };

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  override name = 'MoneyError';
}

/** Decimales de la moneda. */
export function exponentOf(currency: CurrencyCode): number {
  return EXPONENT[currency];
}

/**
 * Construye un Money validando que el monto sea un entero seguro.
 *
 * Rechazar aca es lo que impide que un float se filtre a la base de datos:
 * cualquier calculo que produzca decimales tiene que redondear antes.
 */
export function money(amountMinor: number, currency: CurrencyCode = 'CLP'): Money {
  if (!Number.isFinite(amountMinor)) {
    throw new MoneyError(`monto no finito: ${amountMinor}`);
  }
  if (!Number.isInteger(amountMinor)) {
    throw new MoneyError(`el monto debe ser entero en la unidad menor, se recibio ${amountMinor}`);
  }
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(`monto fuera del rango entero seguro: ${amountMinor}`);
  }
  return { amountMinor, currency };
}

/** Cero en la moneda dada. */
export function zero(currency: CurrencyCode = 'CLP'): Money {
  return { amountMinor: 0, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`no se pueden operar monedas distintas: ${a.currency} y ${b.currency}`);
  }
}

/**
 * Redondeo mitad hacia afuera del cero: 2.5 -> 3, -2.5 -> -3.
 *
 * Es el que la gente espera al ver un promedio o una proyeccion, y es simetrico
 * para positivos y negativos, cosa que `Math.round` no cumple (`Math.round(-2.5)`
 * da -2).
 */
function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.amountMinor, a.currency);
}

export function abs(a: Money): Money {
  return money(Math.abs(a.amountMinor), a.currency);
}

/** Multiplica por un factor (una tasa, un numero de cuotas) y redondea a entero. */
export function multiply(a: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`factor no finito: ${factor}`);
  }
  return money(roundHalfAwayFromZero(a.amountMinor * factor), a.currency);
}

/** Divide por un escalar y redondea a entero. Usado para promedios y prorrateos. */
export function divide(a: Money, divisor: number): Money {
  if (!Number.isFinite(divisor)) {
    throw new MoneyError(`divisor no finito: ${divisor}`);
  }
  if (divisor === 0) {
    throw new MoneyError('division por cero');
  }
  return money(roundHalfAwayFromZero(a.amountMinor / divisor), a.currency);
}

/** Suma una lista. Con lista vacia devuelve cero en la moneda indicada. */
export function sum(values: readonly Money[], currency: CurrencyCode = 'CLP'): Money {
  let total = 0;
  for (const value of values) {
    if (value.currency !== currency) {
      throw new MoneyError(`no se pueden sumar monedas distintas: ${currency} y ${value.currency}`);
    }
    total += value.amountMinor;
  }
  return money(total, currency);
}

/**
 * Proporcion entre dos montos como numero simple (0.25 = 25%).
 *
 * Devuelve un float a proposito: una proporcion **no es dinero**. Sirve para
 * mostrar porcentajes y participaciones, nunca para volver a un monto sin pasar
 * por `multiply`. Con divisor cero devuelve null en vez de Infinity, porque el
 * caso real ("gastaste 0 el mes pasado") aparece y hay que mostrarlo distinto.
 */
export function ratio(a: Money, b: Money): number | null {
  assertSameCurrency(a, b);
  if (b.amountMinor === 0) return null;
  return a.amountMinor / b.amountMinor;
}

/** -1, 0 o 1. Sirve directo como comparador de `Array.prototype.sort`. */
export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

export function isZero(a: Money): boolean {
  return a.amountMinor === 0;
}

export function isPositive(a: Money): boolean {
  return a.amountMinor > 0;
}

export function isNegative(a: Money): boolean {
  return a.amountMinor < 0;
}

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}
