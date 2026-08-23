import { describe, expect, it } from 'vitest';
import { CATEGORIES, type CategoryId } from '../categories/index';
import {
  REGLAS_CHILE, categorizar, cuantasReconoce, normalizar,
} from './categorizar';

describe('normalizar', () => {
  it('saca el prefijo que pone el banco', () => {
    expect(normalizar('PAGO:SUPERMERCADO LIDER')).toBe('supermercado lider');
    expect(normalizar('COMPRA JUMBO')).toBe('jumbo');
  });

  it('saca varios prefijos encadenados', () => {
    expect(normalizar('PAGO: COMPRA LIDER')).toBe('lider');
  });

  it('saca las tildes: el banco escribe con y sin ellas', () => {
    expect(normalizar('FARMACIA ÁHUMADA')).toBe('farmacia ahumada');
  });

  it('junta los espacios repetidos', () => {
    expect(normalizar('  JUMBO   MAIPU  ')).toBe('jumbo maipu');
  });
});

describe('categorizar', () => {
  it('reconoce comercios chilenos comunes', () => {
    expect(categorizar('PAGO:SUPERMERCADO LIDER')).toBe('comida');
    expect(categorizar('PAGO CUENTA ENEL')).toBe('servicios');
    expect(categorizar('COPEC ESTACION 45')).toBe('transporte');
    expect(categorizar('FARMACIA CRUZ VERDE')).toBe('salud');
    expect(categorizar('ARRIENDO DEPTO')).toBe('vivienda');
  });

  it('gana el patron mas largo, no el que se declaro primero', () => {
    // Depender del orden del arreglo seria una trampa para la proxima regla que
    // alguien agregue.
    expect(categorizar('PAGO:UBER EATS')).toBe('comida');
    expect(categorizar('PAGO:UBER TRIP')).toBe('transporte');
  });

  it('devuelve null cuando no reconoce, en vez de inventar', () => {
    // Una categoria inventada ensucia la torta, la deriva y el comprometido sin
    // que nadie sospeche. Sin categoria, la fila se ve rara y se arregla.
    expect(categorizar('TRANSFERENCIA A JUAN')).toBeNull();
    expect(categorizar('XYZ123')).toBeNull();
  });

  it('una descripcion vacia no reconoce nada', () => {
    expect(categorizar('')).toBeNull();
    expect(categorizar('   ')).toBeNull();
  });

  it('no se confunde con la descripcion truncada del banco', () => {
    // La cartola corta a 34 caracteres.
    expect(categorizar('PAGO:MERCADOPAGO*CONCE')).toBe('personales');
    expect(categorizar('PAGO CUENTA MOVISTAR SERVICIO')).toBe('servicios');
  });

  it('acepta un catalogo propio', () => {
    const propias = [{ patron: 'panaderia', categoriaId: 'comida' as CategoryId }];
    expect(categorizar('PANADERIA DON PEDRO', propias)).toBe('comida');
    expect(categorizar('PAGO:LIDER', propias)).toBeNull();
  });
});

describe('el catalogo', () => {
  it('todas las categorias que nombra existen', () => {
    const validas = new Set(CATEGORIES.map((c) => c.id));
    for (const regla of REGLAS_CHILE) {
      expect(validas.has(regla.categoriaId as CategoryId), regla.patron).toBe(true);
    }
  });

  it('los patrones estan normalizados: si no, no calzarian nunca', () => {
    for (const regla of REGLAS_CHILE) {
      expect(regla.patron, regla.patron).toBe(regla.patron.toLowerCase());
      expect(regla.patron.normalize('NFD')).toBe(regla.patron);
    }
  });

  it('no hay dos reglas con el mismo patron y distinta categoria', () => {
    const porPatron = new Map<string, string>();
    for (const regla of REGLAS_CHILE) {
      const previa = porPatron.get(regla.patron);
      expect(previa === undefined || previa === regla.categoriaId, regla.patron).toBe(true);
      porPatron.set(regla.patron, regla.categoriaId);
    }
  });
});

describe('cuantasReconoce', () => {
  it('cuenta las que quedarian categorizadas', () => {
    expect(cuantasReconoce(['PAGO:LIDER', 'PAGO CUENTA ENEL', 'TRANSFERENCIA A JUAN'])).toBe(2);
  });

  it('sobre una lista vacia da cero', () => {
    expect(cuantasReconoce([])).toBe(0);
  });
});
