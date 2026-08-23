/**
 * Categorias propias.
 *
 * Lo que estas pruebas cuidan, ademas de crear y borrar, son las dos decisiones
 * que no se ven: que el id salga del nombre --y por eso dos aparatos que crean
 * la misma categoria terminen con una sola-- y que borrar no le quite el nombre
 * a los movimientos viejos que la usaban.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import {
  borrarCategoria, consultaDeCategorias, crearCategoria, idDeCategoria, listarCategorias,
} from './categorias';
import { crearReglaDeCategoria } from './reglasDeCategoria';
import { exportarRespaldo } from './respaldo';
import { fusionarRespaldo } from './sincronizacion';
import type { Categoria } from '../schema';

let base: BaseDePrueba;

beforeEach(() => { base = crearBaseDePrueba(); });
afterEach(() => base.cerrar());

const crear = (nombre: string) => crearCategoria(base.db, base.contexto, nombre);

describe('el id sale del nombre', () => {
  it('sin tildes, en minusculas y con guiones', () => {
    expect(idDeCategoria('Mascotas')).toBe('mascotas');
    expect(idDeCategoria('El Gimnasio')).toBe('el-gimnasio');
    expect(idDeCategoria('Café')).toBe('cafe');
  });

  it('la categoria nace con ese id', () => {
    expect(crear('Mascotas').id).toBe('mascotas');
  });

  it('guarda el nombre tal como se escribio', () => {
    // El id es para la maquina; el nombre es lo que el usuario ve.
    expect(crear('El Gimnasio').nombre).toBe('El Gimnasio');
  });
});

describe('crear', () => {
  it('un nombre vacio se rechaza', () => {
    expect(() => crear('   ')).toThrow();
  });

  it('un nombre sin letras ni numeros se rechaza', () => {
    // Dejaria un id vacio, y un id vacio no es una categoria.
    expect(() => crear('!!!')).toThrow();
  });

  it('un nombre larguisimo se rechaza', () => {
    expect(() => crear('a'.repeat(80))).toThrow();
  });

  it('no se puede pisar una de la app', () => {
    expect(() => crear('Comida')).toThrow(/ya viene con la app/);
  });

  it('no se puede repetir una propia', () => {
    crear('Mascotas');
    expect(() => crear('mascotas')).toThrow(/ya existe/);
  });
});

describe('borrar', () => {
  it('deja de estar disponible para elegir', () => {
    crear('Mascotas');
    borrarCategoria(base.db, base.contexto, 'mascotas');

    expect(listarCategorias(base.db, base.contexto)).toHaveLength(0);
  });

  it('pero la fila sigue ahi, con su nombre', () => {
    // Es lo que hace que un movimiento viejo siga diciendo "Mascotas" en vez de
    // mostrar el id pelado.
    crear('Mascotas');
    borrarCategoria(base.db, base.contexto, 'mascotas');

    const todas = consultaDeCategorias(base.db, base.contexto).all() as Categoria[];
    expect(todas).toHaveLength(1);
    expect(todas[0]!.nombre).toBe('Mascotas');
    expect(todas[0]!.deletedAt).not.toBeNull();
  });

  it('borrar una que no existe falla', () => {
    expect(() => borrarCategoria(base.db, base.contexto, 'mascotas')).toThrow();
  });

  it('volver a crearla la revive', () => {
    crear('Mascotas');
    borrarCategoria(base.db, base.contexto, 'mascotas');

    const revivida = crear('Mascotas');

    expect(revivida.deletedAt).toBeNull();
    expect(listarCategorias(base.db, base.contexto).map((c) => c.id)).toEqual(['mascotas']);
  });
});

describe('viajan al otro telefono', () => {
  it('van en el respaldo', () => {
    crear('Mascotas');
    expect(exportarRespaldo(base.db, base.contexto).categorias).toHaveLength(1);
  });

  it('van aunque sea el archivo para compartir', () => {
    // Si no viajaran, el otro recibiria movimientos de una categoria que no sabe
    // nombrar. No dicen cuanto gastaste: dicen como se llama lo que gastaste.
    crear('Mascotas');
    const paraCompartir = exportarRespaldo(base.db, base.contexto, { soloSincronizables: true });
    expect(paraCompartir.categorias.map((c) => c.nombre)).toEqual(['Mascotas']);
  });

  it('dos aparatos que crean la misma quedan con una sola', () => {
    // La razon de que el id salga del nombre. Con ids aleatorios quedarian dos
    // categorias iguales y ninguna forma de juntarlas.
    const otro = crearBaseDePrueba({
      householdId: base.contexto.householdId, deviceId: 'otroAparato',
    });
    crear('Mascotas');
    crearCategoria(otro.db, otro.contexto, 'Mascotas');

    const suyo = JSON.parse(JSON.stringify(exportarRespaldo(otro.db, otro.contexto)));
    fusionarRespaldo(base.db, base.contexto, suyo);

    expect(listarCategorias(base.db, base.contexto).map((c) => c.id)).toEqual(['mascotas']);
    otro.cerrar();
  });
});

describe('una regla de categoria puede apuntar a una propia', () => {
  it('acepta la categoria recien creada', () => {
    crear('Mascotas');
    const regla = crearReglaDeCategoria(base.db, base.contexto, {
      patron: 'veterinaria', categoriaId: 'mascotas' as never,
    });
    expect(regla.categoriaId).toBe('mascotas');
  });

  it('sigue rechazando una que no existe en ninguna parte', () => {
    expect(() => crearReglaDeCategoria(base.db, base.contexto, {
      patron: 'veterinaria', categoriaId: 'inventada' as never,
    })).toThrow(/no existe la categoría/);
  });
});
