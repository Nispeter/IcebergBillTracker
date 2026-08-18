import { describe, expect, it } from 'vitest';
import { format, formatNumber, formatSigned, parseMoney } from './format';
import { money } from './money';

const clp = (n: number) => money(n, 'CLP');

describe('format', () => {
  it('formatea en es-CL con punto de miles y sin decimales', () => {
    expect(format(clp(1234))).toBe('$1.234');
    expect(format(clp(1806324))).toBe('$1.806.324');
    expect(format(clp(0))).toBe('$0');
  });

  it('pone el menos antes del simbolo, no despues', () => {
    expect(format(clp(-45000))).toBe('-$45.000');
  });
});

describe('formatSigned', () => {
  it('marca explicitamente el signo de un delta', () => {
    expect(formatSigned(clp(45000))).toBe('+$45.000');
    expect(formatSigned(clp(-45000))).toBe('-$45.000');
  });

  it('el cero no lleva signo', () => {
    expect(formatSigned(clp(0))).toBe('$0');
  });
});

describe('formatNumber', () => {
  it('devuelve la cifra sin simbolo de moneda', () => {
    expect(formatNumber(clp(1806324))).toBe('1.806.324');
    expect(formatNumber(clp(-45000))).toBe('-45.000');
  });
});

describe('parseMoney', () => {
  it('acepta las formas que la gente escribe', () => {
    expect(parseMoney('$12.345')?.amountMinor).toBe(12345);
    expect(parseMoney('12.345')?.amountMinor).toBe(12345);
    expect(parseMoney('12345')?.amountMinor).toBe(12345);
    expect(parseMoney('  $ 1.806.324  ')?.amountMinor).toBe(1806324);
  });

  it('acepta signo explicito antes del simbolo', () => {
    expect(parseMoney('-$12.345')?.amountMinor).toBe(-12345);
    expect(parseMoney('+12345')?.amountMinor).toBe(12345);
  });

  it('devuelve null con campo vacio o basura', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('$')).toBeNull();
  });

  it('rechaza decimales en vez de redondear en silencio', () => {
    expect(parseMoney('1.234,56')).toBeNull();
    expect(parseMoney('1234,5')).toBeNull();
  });

  it('rechaza agrupacion de miles mal formada', () => {
    // `1.5` seria 15 si se borraran los puntos a ciegas; no es lo que se escribio.
    expect(parseMoney('1.5')).toBeNull();
    expect(parseMoney('1.2345')).toBeNull();
  });

  it('ida y vuelta con format', () => {
    for (const n of [0, 1, 1234, 1806324, -45000]) {
      expect(parseMoney(format(clp(n)))?.amountMinor).toBe(n);
    }
  });
});
