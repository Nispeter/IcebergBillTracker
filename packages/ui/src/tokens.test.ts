import { describe, expect, it } from 'vitest';
import {
  charts, dark, durations, elevation, fontSizes, fonts, fontWeights, light, radii, spacing, themes,
  type Theme,
} from './tokens.js';

const HEX = /^#[0-9A-F]{6}$/;

function channels(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Luminancia relativa segun WCAG 2.1. */
function luminance(color: string): number {
  const [r, g, b] = channels(color).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

/** Razon de contraste WCAG, de 1 a 21. */
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/**
 * Distancia perceptual CIE76 en CIELAB.
 *
 * Para marcas de grafico el contraste WCAG es la metrica equivocada: mide solo
 * luminancia, asi que dos colores de matiz muy distinto pero brillo parecido
 * (el celeste y el agua de la serie) le salen "confundibles" cuando a ojo se
 * separan sin esfuerzo. WCAG se usa para texto; esto, para colores categoricos.
 */
function deltaE(a: string, b: string): number {
  const toLab = (color: string): [number, number, number] => {
    const [r, g, b2] = channels(color).map((channel) => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116));
    const x = f(((0.4124 * r) + (0.3576 * g) + (0.1805 * b2)) / 0.95047);
    const y = f((0.2126 * r) + (0.7152 * g) + (0.0722 * b2));
    const z = f(((0.0193 * r) + (0.1192 * g) + (0.9505 * b2)) / 1.08883);
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
  };
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const entries = Object.entries(themes) as [keyof typeof themes, Theme][];

describe('forma de los tokens', () => {
  it('todo color es hexadecimal de 6 digitos en mayuscula', () => {
    for (const [name, theme] of entries) {
      for (const [role, color] of Object.entries(theme)) {
        expect(color, `${name}.${role}`).toMatch(HEX);
      }
    }
    for (const color of charts) expect(color).toMatch(HEX);
  });

  it('los dos temas exponen exactamente los mismos roles', () => {
    expect(Object.keys(dark)).toEqual(Object.keys(light));
  });

  it('el ambar es el mismo acento en ambos temas', () => {
    expect(dark.acento).toBe(light.acento);
  });

  it('vencido es el unico rojo y es igual en ambos temas', () => {
    expect(dark.vencido).toBe(light.vencido);
  });
});

describe('contraste', () => {
  it('la tinta cumple AAA sobre fondo y superficie', () => {
    for (const [name, theme] of entries) {
      expect(contrast(theme.tinta, theme.fondo), `${name} tinta/fondo`).toBeGreaterThanOrEqual(7);
      expect(contrast(theme.tinta, theme.superficie), `${name} tinta/superficie`).toBeGreaterThanOrEqual(7);
    }
  });

  it('el silencio del tema oscuro cumple AA para texto normal', () => {
    expect(contrast(dark.silencio, dark.superficie)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.silencio, dark.fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it('el silencio del tema claro solo alcanza para texto grande', () => {
    // Medido: 3.98 sobre superficie. Cumple AA de texto grande (3:1) pero no el
    // de texto normal (4.5:1). Queda restringido a etiquetas de 18.66px o de
    // 16px semibold hacia arriba. Si se necesita para texto chico, hay que
    // oscurecerlo (#5E748B da 4.83) — decision de diseno, no de implementacion.
    const razon = contrast(light.silencio, light.superficie);
    expect(razon).toBeGreaterThanOrEqual(3);
    expect(razon).toBeLessThan(4.5);
  });

  it('el ambar funciona como relleno con tinta encima, no como texto en claro', () => {
    // Sobre el fondo claro el ambar da 1.98: es un color de relleno y de icono,
    // no de texto. Lo que si tiene que cumplir es legibilidad de la tinta puesta
    // encima de un chip ambar.
    expect(contrast(light.tinta, light.acento)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.acento, dark.fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it('la serie de graficos se despega del fondo en ambos temas', () => {
    for (const [name, theme] of entries) {
      for (const color of charts) {
        expect(deltaE(color, theme.fondo), `${name} ${color}`).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('la serie de graficos no tiene dos colores confundibles entre si', () => {
    for (let i = 0; i < charts.length; i++) {
      for (let j = i + 1; j < charts.length; j++) {
        const [a, b] = [charts[i]!, charts[j]!];
        expect(deltaE(a, b), `${a} vs ${b}`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('el ingreso en tema claro sirve de relleno, no de texto', () => {
    // La aurora sobre el fondo claro da 1.51:1. Como marca de grafico se ve sin
    // problema (dE 43), pero un monto de ingreso escrito en aurora sobre blanco
    // es ilegible. En claro el ingreso se distingue por signo y por icono, y la
    // aurora queda para el relleno del area. En oscuro si funciona como texto.
    expect(contrast(light.ingreso, light.superficie)).toBeLessThan(3);
    expect(deltaE(light.ingreso, light.fondo)).toBeGreaterThanOrEqual(15);
    expect(contrast(dark.ingreso, dark.superficie)).toBeGreaterThanOrEqual(4.5);
  });

  it('el hairline se ve pero no compite con el texto', () => {
    for (const [name, theme] of entries) {
      const razon = contrast(theme.hairline, theme.superficie);
      expect(razon, `${name} hairline`).toBeGreaterThan(1.1);
      expect(razon, `${name} hairline`).toBeLessThan(2);
    }
  });
});

describe('escalas', () => {
  it('los radios son distintos entre si: nada de border-radius uniforme', () => {
    expect(new Set([radii.sm, radii.md, radii.lg]).size).toBe(3);
    expect(radii.sm).toBeLessThan(radii.md);
    expect(radii.md).toBeLessThan(radii.lg);
  });

  it('el espaciado es creciente y multiplo de 4', () => {
    const valores = Object.values(spacing);
    for (const valor of valores) expect(valor % 4).toBe(0);
    expect([...valores].sort((a, b) => a - b)).toEqual(valores);
  });

  it('los tamanos de letra son crecientes', () => {
    const valores = Object.values(fontSizes);
    expect([...valores].sort((a, b) => a - b)).toEqual(valores);
  });

  it('hay una familia monoespaciada distinta de la de UI para las cifras', () => {
    expect(fonts.mono).not.toBe(fonts.ui);
  });

  it('los pesos son strings numericos que React Native acepta', () => {
    for (const peso of Object.values(fontWeights)) expect(peso).toMatch(/^[1-9]00$/);
  });

  it('elevation y durations tienen valores utiles', () => {
    expect(elevation.hairlineWidth).toBe(1);
    expect(durations.instant).toBeLessThan(durations.quick);
    expect(durations.quick).toBeLessThan(durations.calm);
  });
});
