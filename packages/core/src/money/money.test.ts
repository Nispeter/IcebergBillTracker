import { describe, expect, it } from 'vitest';
import {
  abs, add, compare, divide, equals, exponentOf, isNegative, isPositive, isZero,
  max, min, money, MoneyError, multiply, negate, ratio, subtract, sum, zero,
} from './money';

const clp = (n: number) => money(n, 'CLP');

describe('money', () => {
  it('construye con enteros y moneda por defecto CLP', () => {
    expect(money(45000)).toEqual({ amountMinor: 45000, currency: 'CLP' });
  });

  it('acepta cero y negativos', () => {
    expect(money(0).amountMinor).toBe(0);
    expect(money(-45000).amountMinor).toBe(-45000);
  });

  it('rechaza decimales: un float nunca puede representar dinero', () => {
    expect(() => money(1234.5)).toThrow(MoneyError);
    expect(() => money(0.1 + 0.2)).toThrow(MoneyError);
  });

  it('rechaza no finitos y enteros fuera del rango seguro', () => {
    expect(() => money(Number.NaN)).toThrow(MoneyError);
    expect(() => money(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });

  it('CLP tiene exponente 0', () => {
    expect(exponentOf('CLP')).toBe(0);
  });

  it('zero devuelve el cero de la moneda', () => {
    expect(zero('CLP')).toEqual({ amountMinor: 0, currency: 'CLP' });
  });
});

describe('aritmetica', () => {
  it('suma y resta sin error de punto flotante', () => {
    expect(add(clp(19778), clp(7500)).amountMinor).toBe(27278);
    expect(subtract(clp(34099), clp(14266)).amountMinor).toBe(19833);
  });

  it('niega e invierte el signo, y abs lo quita', () => {
    expect(negate(clp(45000)).amountMinor).toBe(-45000);
    expect(negate(clp(-45000)).amountMinor).toBe(45000);
    expect(abs(clp(-45000)).amountMinor).toBe(45000);
    expect(abs(clp(45000)).amountMinor).toBe(45000);
  });

  it('multiplica y redondea mitad hacia afuera del cero', () => {
    expect(multiply(clp(1000), 0.19).amountMinor).toBe(190);
    expect(multiply(clp(5), 0.5).amountMinor).toBe(3);
    expect(multiply(clp(-5), 0.5).amountMinor).toBe(-3);
  });

  it('divide y redondea igual, simetrico en negativos', () => {
    expect(divide(clp(100000), 3).amountMinor).toBe(33333);
    expect(divide(clp(5), 2).amountMinor).toBe(3);
    expect(divide(clp(-5), 2).amountMinor).toBe(-3);
  });

  it('rechaza division por cero y factores no finitos', () => {
    expect(() => divide(clp(1000), 0)).toThrow(MoneyError);
    expect(() => divide(clp(1000), Number.NaN)).toThrow(MoneyError);
    expect(() => multiply(clp(1000), Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });

  it('suma una lista y devuelve cero con lista vacia', () => {
    expect(sum([clp(34), clp(14266), clp(21)]).amountMinor).toBe(14321);
    expect(sum([]).amountMinor).toBe(0);
  });

  it('rechaza operar monedas distintas', () => {
    const usd = { amountMinor: 100, currency: 'USD' } as unknown as ReturnType<typeof clp>;
    expect(() => add(clp(1000), usd)).toThrow(MoneyError);
    expect(() => sum([clp(1000), usd])).toThrow(MoneyError);
  });
});

describe('ratio', () => {
  it('devuelve la proporcion como numero simple', () => {
    expect(ratio(clp(25000), clp(100000))).toBe(0.25);
  });

  it('devuelve null cuando el divisor es cero, en vez de Infinity', () => {
    expect(ratio(clp(25000), clp(0))).toBeNull();
  });
});

describe('comparacion', () => {
  it('compare sirve como comparador de sort', () => {
    const ordenado = [clp(45000), clp(-100), clp(0)].sort(compare);
    expect(ordenado.map((m) => m.amountMinor)).toEqual([-100, 0, 45000]);
  });

  it('equals exige mismo monto y misma moneda', () => {
    expect(equals(clp(1000), clp(1000))).toBe(true);
    expect(equals(clp(1000), clp(1001))).toBe(false);
  });

  it('predicados de signo', () => {
    expect(isZero(clp(0))).toBe(true);
    expect(isPositive(clp(1))).toBe(true);
    expect(isNegative(clp(-1))).toBe(true);
    expect(isPositive(clp(0))).toBe(false);
    expect(isNegative(clp(0))).toBe(false);
  });

  it('min y max', () => {
    expect(min(clp(10), clp(20)).amountMinor).toBe(10);
    expect(max(clp(10), clp(20)).amountMinor).toBe(20);
  });
});
