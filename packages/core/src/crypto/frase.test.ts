import { describe, expect, it } from 'vitest';
import { generarFrase } from './frase';
import { cifrar, descifrar, fraseDebil } from './sobre';

/** Un azar de mentira: devuelve los bytes que se le pidan, en orden. */
const fijo = (...bytes: number[]) => () => Uint8Array.from(bytes);

describe('generarFrase', () => {
  it('arma cuatro palabras y un numero de tres cifras', () => {
    const frase = generarFrase(fijo(0, 1, 2, 3, 0, 0));
    expect(frase).toBe('agua-aire-ala-alba-100');
  });

  it('el mismo azar da la misma frase', () => {
    const azar = fijo(10, 20, 30, 40, 50, 60);
    expect(generarFrase(azar)).toBe(generarFrase(azar));
  });

  it('el numero se queda entre 100 y 999 aunque los bytes esten al tope', () => {
    const frase = generarFrase(fijo(0, 0, 0, 0, 255, 255));
    const numero = Number(frase.split('-').at(-1));
    expect(numero).toBeGreaterThanOrEqual(100);
    expect(numero).toBeLessThanOrEqual(999);
  });

  it('se escribe sin tildes ni mayusculas: la copia el otro telefono a mano', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(generarFrase()).toMatch(/^[a-z]+(-[a-z]+){3}-\d{3}$/);
    }
  });

  it('nunca sale una frase que la app misma llamaria floja', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(fraseDebil(generarFrase())).toBeNull();
    }
  });

  it('sirve para lo que se hizo: cifra y vuelve a abrir', () => {
    const frase = generarFrase();
    expect(descifrar(cifrar('{"movimientos":[]}', frase), frase)).toBe('{"movimientos":[]}');
  });

  it('dos frases seguidas no son la misma', () => {
    const cuantas = new Set(Array.from({ length: 50 }, () => generarFrase()));
    expect(cuantas.size).toBe(50);
  });
});
