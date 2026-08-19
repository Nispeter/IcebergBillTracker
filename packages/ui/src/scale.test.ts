import { describe, expect, it } from 'vitest';
import { niceUnit, notchesFor } from './scale';

describe('niceUnit', () => {
  it('elige la unidad redonda del caso real del catalogo', () => {
    // Vivienda, la categoria mas pesada del mes, son $450.000.
    expect(niceUnit(450_000, 18)).toBe(25_000);
  });

  it('siempre devuelve un numero redondo, no uno cualquiera', () => {
    const redondo = (n: number) => {
      const decada = 10 ** Math.floor(Math.log10(n));
      return [1, 2, 2.5, 5, 10].some((f) => Math.abs((f * decada) - n) < 1);
    };
    for (const maximo of [8_000, 45_000, 123_456, 450_000, 999_999, 9_000_000]) {
      expect(redondo(niceUnit(maximo)), `maximo ${maximo}`).toBe(true);
    }
  });

  it('mantiene la cantidad de muescas en un rango legible en cualquier magnitud', () => {
    // Es la razon de existir de la funcion: que sirva igual para un mes de
    // $80.000 y para uno de $9.000.000.
    for (const maximo of [8_000, 45_000, 123_456, 450_000, 999_999, 9_000_000]) {
      const muescas = Math.ceil(maximo / niceUnit(maximo, 18));
      expect(muescas, `maximo ${maximo}`).toBeGreaterThanOrEqual(7);
      expect(muescas, `maximo ${maximo}`).toBeLessThanOrEqual(18);
    }
  });

  it('la unidad nunca supera el maximo', () => {
    for (const maximo of [1_000, 45_000, 450_000]) {
      expect(niceUnit(maximo)).toBeLessThanOrEqual(maximo);
    }
  });

  it('devuelve un entero: una muesca de 2.500,5 pesos no significa nada', () => {
    for (const maximo of [7, 33, 450_000, 1_234_567]) {
      expect(Number.isInteger(niceUnit(maximo)), `maximo ${maximo}`).toBe(true);
    }
  });

  it('aguanta entradas degeneradas sin devolver algo absurdo', () => {
    expect(niceUnit(0)).toBe(1);
    expect(niceUnit(-5)).toBe(1);
    expect(niceUnit(Number.NaN)).toBe(1);
    expect(niceUnit(100, 0)).toBe(100);
  });
});

describe('notchesFor', () => {
  it('cuenta las muescas redondeando', () => {
    expect(notchesFor(450_000, 25_000)).toBe(18);
    expect(notchesFor(241_900, 25_000)).toBe(10);
    expect(notchesFor(150_000, 25_000)).toBe(6);
  });

  it('un gasto que existe nunca muestra la barra vacia', () => {
    // 900 sobre 25.000 redondea a cero, pero la fila no puede leerse como
    // "no hubo gasto": el monto exacto va escrito al lado.
    expect(notchesFor(900, 25_000)).toBe(1);
    expect(notchesFor(1, 25_000)).toBe(1);
  });

  it('cero es cero', () => {
    expect(notchesFor(0, 25_000)).toBe(0);
  });

  it('unidad invalida no revienta', () => {
    expect(notchesFor(1_000, 0)).toBe(0);
    expect(notchesFor(1_000, -5)).toBe(0);
  });
});
