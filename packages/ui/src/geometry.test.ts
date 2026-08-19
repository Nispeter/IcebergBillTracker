import { describe, expect, it } from 'vitest';
import {
  clipPolygonAtY, polygonArea, toPathData, waterlineForShare, type Point,
} from './geometry';

/** Cuadrado de 10x10 con la esquina en el origen. */
const CUADRADO: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];

/** Triangulo con la punta arriba y la base abajo: angosto arriba, ancho abajo. */
const TRIANGULO: Point[] = [[5, 0], [10, 10], [0, 10]];

describe('polygonArea', () => {
  it('calcula el area de un cuadrado', () => {
    expect(polygonArea(CUADRADO)).toBe(100);
  });

  it('calcula el area de un triangulo', () => {
    expect(polygonArea(TRIANGULO)).toBe(50);
  });

  it('no depende del sentido de giro', () => {
    expect(polygonArea([...CUADRADO].reverse())).toBe(100);
  });

  it('degenerados dan cero', () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
  });
});

describe('clipPolygonAtY', () => {
  it('parte un cuadrado por la mitad', () => {
    expect(polygonArea(clipPolygonAtY(CUADRADO, 5, 'above'))).toBe(50);
    expect(polygonArea(clipPolygonAtY(CUADRADO, 5, 'below'))).toBe(50);
  });

  it('las dos mitades suman el total', () => {
    for (const y of [1, 3.7, 5, 8, 9.9]) {
      const arriba = polygonArea(clipPolygonAtY(TRIANGULO, y, 'above'));
      const abajo = polygonArea(clipPolygonAtY(TRIANGULO, y, 'below'));
      expect(arriba + abajo).toBeCloseTo(polygonArea(TRIANGULO), 6);
    }
  });

  it('cortar fuera del poligono devuelve todo o nada', () => {
    expect(polygonArea(clipPolygonAtY(CUADRADO, 20, 'above'))).toBe(100);
    expect(polygonArea(clipPolygonAtY(CUADRADO, -5, 'above'))).toBe(0);
  });

  it('en SVG la Y crece hacia abajo: "above" es la Y menor', () => {
    const arriba = clipPolygonAtY(CUADRADO, 5, 'above');
    for (const punto of arriba) expect(punto[1]).toBeLessThanOrEqual(5);
  });
});

describe('waterlineForShare', () => {
  it('en un cuadrado el reparto por area coincide con el de altura', () => {
    // Ancho constante: es el unico caso donde partir por altura no miente.
    expect(waterlineForShare(CUADRADO, 0.5)).toBeCloseTo(5, 4);
    expect(waterlineForShare(CUADRADO, 0.25)).toBeCloseTo(2.5, 4);
  });

  it('en un triangulo NO coincide, que es la razon de existir del modulo', () => {
    // La mitad del area de un triangulo de punta arriba queda en y = 10/raiz(2)
    // = 7,07, no en 5. Partir por altura mostraria 25% donde hay 50%.
    const y = waterlineForShare(TRIANGULO, 0.5);
    expect(y).toBeCloseTo(10 / Math.SQRT2, 3);
    expect(y).toBeGreaterThan(5);
  });

  it('la linea deja exactamente la proporcion pedida', () => {
    const total = polygonArea(TRIANGULO);
    for (const share of [0.1, 0.25, 0.4, 0.626, 0.8, 0.95]) {
      const y = waterlineForShare(TRIANGULO, share);
      const arriba = polygonArea(clipPolygonAtY(TRIANGULO, y, 'above'));
      expect(arriba / total, `share ${share}`).toBeCloseTo(share, 4);
    }
  });

  it('los extremos devuelven el borde del poligono', () => {
    expect(waterlineForShare(TRIANGULO, 0)).toBe(0);
    expect(waterlineForShare(TRIANGULO, 1)).toBe(10);
  });

  it('recorta valores fuera de [0, 1] en vez de devolver algo absurdo', () => {
    expect(waterlineForShare(TRIANGULO, -3)).toBe(0);
    expect(waterlineForShare(TRIANGULO, 42)).toBe(10);
  });

  it('un poligono sin area no revienta', () => {
    expect(waterlineForShare([[0, 4], [1, 4]], 0.5)).toBe(4);
  });
});

describe('toPathData', () => {
  it('arma el atributo d cerrando la figura', () => {
    expect(toPathData([[0, 0], [10, 0], [5, 8]]))
      .toBe('M 0.00 0.00 L 10.00 0.00 L 5.00 8.00 Z');
  });

  it('sin puntos devuelve vacio', () => {
    expect(toPathData([])).toBe('');
  });
});
