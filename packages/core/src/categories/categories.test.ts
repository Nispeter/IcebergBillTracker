import { describe, expect, it } from 'vitest';
import {
  CATEGORIES, CATEGORY_IDS, categoryById, categoryName, isCategoryId,
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

  it('cada categoria trae nombre y descripcion no vacios', () => {
    for (const categoria of CATEGORIES) {
      expect(categoria.nombre.length, categoria.id).toBeGreaterThan(0);
      expect(categoria.descripcion.length, categoria.id).toBeGreaterThan(0);
    }
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

  it('categoryName resuelve, y tiene respaldo para lo desconocido', () => {
    expect(categoryName('regalos')).toBe('Regalos y donaciones');
    expect(categoryName(undefined)).toBe('Sin categoria');
    expect(categoryName('criptomonedas')).toBe('criptomonedas');
  });
});
