import { describe, expect, it } from 'vitest';
import {
  clipPolygonAtY, donutArcPath, polygonArea, sectoresDeTorta, toPathData, waterlineForShare,
  type Point,
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

describe('donutArcPath', () => {
  /** Extrae el flag de "arco grande" del primer arco del path. */
  const arcoGrande = (d: string) => Number(/A [\d.]+ [\d.]+ 0 (\d) 1/.exec(d)?.[1]);

  it('un cuarto de vuelta arranca arriba y termina a la derecha', () => {
    const d = donutArcPath(50, 50, 20, 40, 0, 90);
    expect(d.startsWith('M 50.00 10.00')).toBe(true);
    expect(d).toContain('A 40.00 40.00 0 0 1 90.00 50.00');
  });

  it('el flag de arco grande se prende recien pasados los 180 grados', () => {
    // Sin esto, un sector de 200 grados se dibuja por el lado corto y la torta
    // queda al reves.
    expect(arcoGrande(donutArcPath(50, 50, 20, 40, 0, 179))).toBe(0);
    expect(arcoGrande(donutArcPath(50, 50, 20, 40, 0, 181))).toBe(1);
  });

  it('el borde interior se recorre en sentido contrario', () => {
    // Si los dos arcos fueran en el mismo sentido, el sector se cerraria sobre
    // si mismo en vez de dejar el hueco de la dona.
    const d = donutArcPath(50, 50, 20, 40, 0, 90);
    expect(d).toContain('A 20.00 20.00 0 0 0');
  });

  it('una vuelta completa se parte en dos arcos', () => {
    // Con un solo arco de 360 el inicio y el fin coinciden y no se dibuja nada.
    const d = donutArcPath(50, 50, 20, 40, 0, 360);
    expect((d.match(/M /g) ?? []).length).toBe(2);
  });

  it('un sector vacio no dibuja nada', () => {
    expect(donutArcPath(50, 50, 20, 40, 90, 90)).toBe('');
    expect(donutArcPath(50, 50, 20, 40, 90, 30)).toBe('');
  });
});

describe('sectoresDeTorta', () => {
  it('reparte los 360 grados', () => {
    const sectores = sectoresDeTorta([50, 50]);
    expect(sectores[0]).toEqual({ desde: 0, hasta: 180 });
    expect(sectores[1]!.hasta).toBeCloseTo(360, 6);
  });

  it('los sectores van pegados, sin huecos', () => {
    const sectores = sectoresDeTorta([30, 20, 40, 10]);
    for (let i = 1; i < sectores.length; i++) {
      expect(sectores[i]!.desde).toBeCloseTo(sectores[i - 1]!.hasta, 6);
    }
  });

  it('una porcion diminuta igual se ve', () => {
    // Con doce categorias, varias quedarian en cero grados y desaparecerian.
    const sectores = sectoresDeTorta([10_000, 1], 2);
    expect(sectores[1]!.hasta - sectores[1]!.desde).toBeCloseTo(2, 6);
  });

  it('el minimo se descuenta de las grandes: el total sigue siendo 360', () => {
    const sectores = sectoresDeTorta([10_000, 1, 1, 1], 2);
    expect(sectores[sectores.length - 1]!.hasta).toBeCloseTo(360, 6);
  });

  it('sin valores no revienta', () => {
    expect(sectoresDeTorta([])).toEqual([]);
    expect(sectoresDeTorta([0, 0])).toEqual([{ desde: 0, hasta: 0 }, { desde: 0, hasta: 0 }]);
  });

  it('ignora valores negativos en vez de invertir el sector', () => {
    const sectores = sectoresDeTorta([100, -50]);
    expect(sectores[1]!.hasta - sectores[1]!.desde).toBe(0);
  });
});
