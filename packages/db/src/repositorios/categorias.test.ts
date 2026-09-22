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
  obtenerCategoria, renombrarCategoria, restaurarCategoria,
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

describe('renombrar una propia', () => {
  it('le cambia el nombre y le deja el id', () => {
    crear('Mascotas');
    const renombrada = renombrarCategoria(base.db, base.contexto, 'mascotas', 'Perros');

    // El id no se recalcula a partir del nombre nuevo: es lo que llevan escrito
    // los movimientos, y cambiarlo los dejaria huerfanos.
    expect(renombrada.id).toBe('mascotas');
    expect(renombrada.nombre).toBe('Perros');
  });

  it('valida el nombre igual que al crear', () => {
    crear('Mascotas');
    expect(() => renombrarCategoria(base.db, base.contexto, 'mascotas', '   ')).toThrow(/necesita un nombre/);
    expect(() => renombrarCategoria(base.db, base.contexto, 'mascotas', 'x'.repeat(25)))
      .toThrow(/no puede pasar de/);
  });

  it('una borrada se renombra pero NO revive', () => {
    // Al reparto del gasto siguen llegando las categorias borradas mientras
    // queden movimientos viejos con su id. Renombrar una de esas no puede
    // devolverla a todos los selectores sin que nada lo anuncie.
    crear('Mascotas');
    borrarCategoria(base.db, base.contexto, 'mascotas');

    renombrarCategoria(base.db, base.contexto, 'mascotas', 'Perros');

    expect(obtenerCategoria(base.db, base.contexto, 'mascotas')!.nombre).toBe('Perros');
    expect(listarCategorias(base.db, base.contexto)).toHaveLength(0);
  });

  it('renombrar una que no existe en ninguna parte falla', () => {
    expect(() => renombrarCategoria(base.db, base.contexto, 'inventada', 'Lo que sea'))
      .toThrow(/no existe la categoría/);
  });
});

describe('renombrar una de las que trae la app', () => {
  it('escribe una fila con el id de la built-in', () => {
    const override = renombrarCategoria(base.db, base.contexto, 'comida', 'Supermercado');

    expect(override.id).toBe('comida');
    expect(override.nombre).toBe('Supermercado');
    expect(obtenerCategoria(base.db, base.contexto, 'comida')!.nombre).toBe('Supermercado');
  });

  it('crear esa misma categoria sigue estando prohibido', () => {
    // Renombrar y crear terminan en la misma tabla pero son otra intencion:
    // crear una que ya viene con la app es un error del usuario.
    expect(() => crear('Comida')).toThrow(/ya viene con la app/);
  });

  it('renombrar dos veces no duplica la fila', () => {
    renombrarCategoria(base.db, base.contexto, 'comida', 'Supermercado');
    renombrarCategoria(base.db, base.contexto, 'comida', 'Feria');

    const todas = consultaDeCategorias(base.db, base.contexto).all() as Categoria[];
    expect(todas).toHaveLength(1);
    expect(todas[0]!.nombre).toBe('Feria');
  });

  it('el override viaja al otro telefono', () => {
    renombrarCategoria(base.db, base.contexto, 'comida', 'Supermercado');
    expect(exportarRespaldo(base.db, base.contexto).categorias.map((c) => c.nombre))
      .toEqual(['Supermercado']);
  });
});

describe('restaurar el nombre original', () => {
  it('le pone lapida al override', () => {
    renombrarCategoria(base.db, base.contexto, 'comida', 'Supermercado');
    restaurarCategoria(base.db, base.contexto, 'comida');

    expect(obtenerCategoria(base.db, base.contexto, 'comida')!.deletedAt).not.toBeNull();
  });

  it('lapida y no borrado fisico, para que la restauracion viaje', () => {
    // Una fila que desaparece vuelve en la siguiente fusion, porque el otro
    // aparato todavia la tiene y nadie le conto que se fue.
    renombrarCategoria(base.db, base.contexto, 'comida', 'Supermercado');
    restaurarCategoria(base.db, base.contexto, 'comida');

    expect(exportarRespaldo(base.db, base.contexto).categorias).toHaveLength(1);
  });

  it('no falla si nunca se habia renombrado', () => {
    // No tener override ya es estar en el nombre original.
    expect(() => restaurarCategoria(base.db, base.contexto, 'comida')).not.toThrow();
  });

  it('una propia no se puede restaurar: no tiene nombre original', () => {
    crear('Mascotas');
    expect(() => restaurarCategoria(base.db, base.contexto, 'mascotas'))
      .toThrow(/no es una categoría de la app/);
  });

  it('despues de restaurar se puede volver a renombrar, y el nombre se ve', () => {
    renombrarCategoria(base.db, base.contexto, 'comida', 'Supermercado');
    restaurarCategoria(base.db, base.contexto, 'comida');
    const otra = renombrarCategoria(base.db, base.contexto, 'comida', 'Feria');

    // La fila tiene que quedar **viva**. Si conservara la lapida, el catalogo
    // la saltaria y la app seguiria diciendo "Comida" con el override escrito.
    expect(otra.nombre).toBe('Feria');
    expect(otra.deletedAt).toBeNull();
    expect(listarCategorias(base.db, base.contexto).map((c) => c.nombre)).toEqual(['Feria']);
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
