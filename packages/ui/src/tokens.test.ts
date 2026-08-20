import { describe, expect, it } from 'vitest';
import {
  charts, dark, durations, elevation, fontSizes, fonts, light, pesos, radii, spacing, themes,
  type Theme,
} from './tokens';

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

/** Razon de contraste WCAG, de 1 a 21. La metrica para **texto**. */
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

function toLab(color: string): [number, number, number] {
  const [r, g, b] = channels(color).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116));
  const x = f(((0.4124 * r) + (0.3576 * g) + (0.1805 * b)) / 0.95047);
  const y = f((0.2126 * r) + (0.7152 * g) + (0.0722 * b));
  const z = f(((0.0193 * r) + (0.1192 * g) + (0.9505 * b)) / 1.08883);
  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * Distancia perceptual CIE76 en CIELAB. La metrica para **rellenos**.
 *
 * Para una barra o un chip, el contraste WCAG es la metrica equivocada: mide
 * solo luminancia, asi que un naranjo saturado sobre casi-blanco le sale
 * "invisible" cuando a ojo salta de inmediato. WCAG se usa para lo que se lee;
 * esto, para lo que se ve.
 */
function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Diferencia de matiz en grados sobre el circulo LCh. */
function hueDistance(a: string, b: string): number {
  const angle = (color: string) => {
    const [, x, y] = toLab(color);
    return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
  };
  const diff = Math.abs(angle(a) - angle(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

const entries = Object.entries(themes) as [keyof typeof themes, Theme][];

/** Roles que la gente lee. Obligados a cumplir AA sobre fondo y superficie. */
const ROLES_TEXTO = ['tinta', 'gasto', 'silencio', 'acentoTexto', 'ingresoTexto', 'vencidoTexto'] as const;

/** Roles de relleno: barras, chips, puntos, areas. Se miden en perceptual. */
const ROLES_RELLENO = ['acento', 'ingreso', 'vencido'] as const;

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

  it('vencido es el unico rojo y su relleno es igual en ambos temas', () => {
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

  it('todo rol de texto cumple AA en los dos temas', () => {
    for (const [name, theme] of entries) {
      for (const rol of ROLES_TEXTO) {
        expect(contrast(theme[rol], theme.fondo), `${name}.${rol} sobre fondo`)
          .toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme[rol], theme.superficie), `${name}.${rol} sobre superficie`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('lo que se escribe sobre el ambar se lee en ambos temas', () => {
    for (const [name, theme] of entries) {
      expect(contrast(theme.sobreAcento, theme.acento), `${name}.sobreAcento sobre acento`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it('la silueta del pinguino se ve sobre los dos fondos', () => {
    // Es el unico dibujo con colores fijos: una cara no se puede invertir sin
    // dejar las pupilas claras, y ahi deja de parecer un pinguino.
    for (const [name, theme] of entries) {
      expect(deltaE(theme.pinguinoCuerpo, theme.fondo), `${name}.pinguinoCuerpo sobre fondo`)
        .toBeGreaterThanOrEqual(15);
      expect(deltaE(theme.pinguinoCuerpo, theme.superficie), `${name}.pinguinoCuerpo sobre superficie`)
        .toBeGreaterThanOrEqual(15);
    }
  });

  it('la cara se distingue del cuerpo, que es lo unico que la rodea', () => {
    // La panza **no** necesita separarse del fondo: el cuerpo la encierra por
    // completo, nunca toca el fondo de la pantalla. Exigirselo hacia imposible
    // usar el hielo, que es justo el blanco que corresponde.
    for (const [name, theme] of entries) {
      expect(deltaE(theme.pinguinoCuerpo, theme.pinguinoPanza), `${name}: cuerpo contra panza`)
        .toBeGreaterThanOrEqual(30);
    }
  });

  it('la punta del iceberg se ve sobre los dos fondos', () => {
    // El bug que motiva el test: la punta salia de `gasto`, que es un rol de
    // texto y se invierte con el tema, y en el tema claro quedaba negra.
    for (const [name, theme] of entries) {
      expect(deltaE(theme.hieloSobreAgua, theme.fondo), `${name}.hieloSobreAgua sobre fondo`)
        .toBeGreaterThanOrEqual(15);
      // La linea de agua la cruza por el medio y tiene que verse encima.
      expect(deltaE(theme.hieloSobreAgua, theme.acento), `${name}: hielo contra la linea de agua`)
        .toBeGreaterThanOrEqual(15);
    }
  });

  it('el pinguino es igual en los dos temas', () => {
    expect(dark.pinguinoCuerpo).toBe(light.pinguinoCuerpo);
    expect(dark.pinguinoPanza).toBe(light.pinguinoPanza);
  });

  it('todo rol de relleno se despega del fondo y de la superficie', () => {
    for (const [name, theme] of entries) {
      for (const rol of ROLES_RELLENO) {
        expect(deltaE(theme[rol], theme.fondo), `${name}.${rol} sobre fondo`)
          .toBeGreaterThanOrEqual(15);
        expect(deltaE(theme[rol], theme.superficie), `${name}.${rol} sobre superficie`)
          .toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('cada variante de texto conserva el matiz de su relleno', () => {
    // Si la version legible cambiara de matiz dejaria de leerse como el mismo
    // color y la paleta perderia coherencia: seria otro color, no el mismo mas
    // oscuro.
    expect(hueDistance(light.acentoTexto, light.acento), 'ambar').toBeLessThan(12);
    expect(hueDistance(light.ingresoTexto, light.ingreso), 'aurora').toBeLessThan(12);
    expect(hueDistance(light.vencidoTexto, light.vencido), 'vencido').toBeLessThan(12);
  });

  it('en el tema oscuro el relleno ya sirve de texto', () => {
    // Sobre la noche polar el ambar da 7,7:1 y la aurora 10,9:1, asi que no hace
    // falta una variante aparte.
    expect(dark.acentoTexto).toBe(dark.acento);
    expect(dark.ingresoTexto).toBe(dark.ingreso);
  });

  it('el ambar de relleno aguanta tinta encima', () => {
    // El acento como fondo de un chip, con la tinta escrita arriba.
    expect(contrast(light.tinta, light.acento)).toBeGreaterThanOrEqual(4.5);
  });

  it('la serie de graficos se despega del fondo y de la superficie', () => {
    for (const [name, theme] of entries) {
      for (const color of charts) {
        expect(deltaE(color, theme.fondo), `${name} ${color} sobre fondo`).toBeGreaterThanOrEqual(15);
        expect(deltaE(color, theme.superficie), `${name} ${color} sobre superficie`).toBeGreaterThanOrEqual(15);
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

  it('la pila de fuentes termina en una monoespaciada generica', () => {
    // Consolas es de Windows. Si no esta, lo que no puede pasar es caer a una
    // proporcional: las columnas de montos dejarian de cuadrar.
    for (const pila of [fonts.ui, fonts.mono]) {
      expect(pila).toContain('Consolas');
      expect(pila.trim().endsWith('monospace')).toBe(true);
    }
  });

  it('las cifras y la interfaz comparten familia', () => {
    // Al ser toda la app monoespaciada, no hay dos familias que coordinar.
    expect(fonts.mono).toBe(fonts.ui);
  });

  it('los pesos son valores que React Native acepta', () => {
    for (const peso of Object.values(pesos)) expect(peso).toMatch(/^[1-9]00$/);
    expect(new Set(Object.values(pesos)).size).toBe(Object.values(pesos).length);
  });

  it('elevation y durations tienen valores utiles', () => {
    expect(elevation.hairlineWidth).toBe(1);
    expect(durations.instant).toBeLessThan(durations.quick);
    expect(durations.quick).toBeLessThan(durations.calm);
  });
});
