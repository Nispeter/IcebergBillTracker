import { describe, expect, it } from 'vitest';
import { fontSizes } from './tokens';
import { ESCALAS_DE_LETRA, escalaValida, letraConEscala } from './letra';

describe('escalaValida', () => {
  it('acepta los pasos de la tabla', () => {
    for (const paso of ESCALAS_DE_LETRA) {
      expect(escalaValida(paso.valor)).toBe(paso.valor);
    }
  });

  it('cae en normal con cualquier cosa que no sea un paso', () => {
    expect(escalaValida(undefined)).toBe(1);
    expect(escalaValida('grande')).toBe(1);
    expect(escalaValida(7)).toBe(1);
    // El caso real: un ajuste guardado por una version con otra tabla.
    expect(escalaValida('1.75')).toBe(1);
  });

  it('lee el numero aunque venga como texto, que es como sale de ajustes', () => {
    expect(escalaValida('1.15')).toBe(1.15);
  });
});

describe('letraConEscala', () => {
  it('en normal devuelve la escala de diseno intacta', () => {
    const letra = letraConEscala(1);
    expect(letra.md).toBe(fontSizes.md);
    expect(letra.display).toBe(fontSizes.display);
  });

  it('multiplica y redondea a entero', () => {
    const letra = letraConEscala(1.15);
    expect(letra.md).toBe(Math.round(fontSizes.md * 1.15));
    expect(Number.isInteger(letra.xs)).toBe(true);
  });

  it('conserva el orden de la escala al agrandar', () => {
    const letra = letraConEscala(1.3);
    expect(letra.xs).toBeLessThan(letra.sm);
    expect(letra.sm).toBeLessThan(letra.md);
    expect(letra.md).toBeLessThan(letra.lg);
    expect(letra.lg).toBeLessThan(letra.xl);
    expect(letra.xl).toBeLessThan(letra.display);
  });

  it('px escala los tamanos sueltos, que son mas chicos que xs', () => {
    expect(letraConEscala(1).px(10)).toBe(10);
    expect(letraConEscala(1.3).px(10)).toBe(13);
  });
});
