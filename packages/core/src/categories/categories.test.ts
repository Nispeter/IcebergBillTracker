import { describe, expect, it } from 'vitest';
import {
  CATEGORIES, CATEGORY_IDS, categoryById, categoryName, categoryShortName, isCategoryId,
} from './categories';

describe('catalogo', () => {
  it('tiene las doce categorias acordadas', () => {
    expect(CATEGORY_IDS).toEqual([
      'vivienda', 'servicios', 'comida', 'transporte', 'salud', 'personales',
      'familia', 'regalos', 'ahorros', 'deudas', 'impuestos', 'trabajo',
    ]);
  });

  it('los ids son unicos', () => {
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORY_IDS.length);
  });

  it('los nombres son unicos', () => {
    const nombres = CATEGORIES.map((categoria) => categoria.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('cada categoria trae nombre, nombre corto y descripcion no vacios', () => {
    for (const categoria of CATEGORIES) {
      expect(categoria.nombre.length, categoria.id).toBeGreaterThan(0);
      expect(categoria.nombreCorto.length, categoria.id).toBeGreaterThan(0);
      expect(categoria.descripcion.length, categoria.id).toBeGreaterThan(0);
    }
  });

  it('el nombre corto entra en una lista densa: una palabra, hasta 12 caracteres', () => {
    // El limite sale de medir la columna real de la tabla de gasto por
    // categoria. Si un nombre corto lo pasa, se corta con elipsis y deja de
    // informar, que es justo lo que este campo vino a evitar.
    for (const categoria of CATEGORIES) {
      expect(categoria.nombreCorto.length, categoria.id).toBeLessThanOrEqual(12);
      expect(categoria.nombreCorto, categoria.id).not.toContain(' ');
    }
  });

  it('los nombres cortos siguen siendo unicos entre si', () => {
    const cortos = CATEGORIES.map((categoria) => categoria.nombreCorto);
    expect(new Set(cortos).size).toBe(cortos.length);
  });

  it('los ids son slugs en minuscula, aptos para guardar en la base', () => {
    for (const id of CATEGORY_IDS) expect(id).toMatch(/^[a-z]+$/);
  });

  it('el streaming vive en Servicios, no en una categoria propia', () => {
    const servicios = categoryById('servicios');
    expect(servicios?.descripcion).toContain('streaming');
    expect(CATEGORY_IDS).not.toContain('suscripciones');
  });

  it('no hay categoria de ingreso: el ingreso no se categoriza', () => {
    expect(CATEGORY_IDS).not.toContain('ingresos');
  });
});

describe('consultas', () => {
  it('categoryById encuentra por id', () => {
    expect(categoryById('vivienda')?.nombre).toBe('Vivienda');
  });

  it('categoryById devuelve null con un id desconocido en vez de lanzar', () => {
    // Puede llegar desde otro dispositivo con una version mas nueva de la app.
    expect(categoryById('criptomonedas')).toBeNull();
  });

  it('isCategoryId distingue', () => {
    expect(isCategoryId('comida')).toBe(true);
    expect(isCategoryId('Comida')).toBe(false);
    expect(isCategoryId('')).toBe(false);
  });

  it('categoryShortName resuelve, y tiene el mismo respaldo', () => {
    expect(categoryShortName('regalos')).toBe('Regalos');
    expect(categoryShortName('impuestos')).toBe('Impuestos');
    expect(categoryShortName(undefined)).toBe('Sin categoría');
    expect(categoryShortName('criptomonedas')).toBe('criptomonedas');
  });

  it('categoryName resuelve, y tiene respaldo para lo desconocido', () => {
    expect(categoryName('regalos')).toBe('Regalos y donaciones');
    expect(categoryName(undefined)).toBe('Sin categoría');
    expect(categoryName('criptomonedas')).toBe('criptomonedas');
  });
});
