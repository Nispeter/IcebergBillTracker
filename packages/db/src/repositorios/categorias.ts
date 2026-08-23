/**
 * Categorías propias, además de las que trae la app.
 *
 * Las doce de `core/categories` son el piso común y existen siempre. Esto es lo
 * que alguien suma encima, porque ninguna lista fija le calza a todo el mundo:
 * quien tiene perro quiere "mascotas" y quien tiene auto quiere "auto", y meter
 * las dos en la lista base sería ruido para los demás.
 *
 * ## El id sale del nombre
 *
 * `Mascotas` → `mascotas`. No es un ULID, y son dos razones:
 *
 * 1. Cualquier pantalla que no conozca la categoría **muestra el id**, que es el
 *    respaldo que ya tenían `categoryName` y compañía. `mascotas` se lee bien;
 *    un ULID no dice nada.
 * 2. Si dos personas del mismo hogar crean "Mascotas" cada una por su lado, las
 *    dos filas nacen con el mismo id y la fusión las junta en **una**. Con ids
 *    aleatorios quedarían dos categorías iguales y ninguna forma de unirlas.
 */

import { categories } from '@iceberg/core';
import { and, eq, isNull } from 'drizzle-orm';
import { columnasEditadas, columnasNuevas, type Contexto } from '../contexto';
import { categorias, type Categoria } from '../schema';
import type { BaseDeDatos } from '../tipos';
import { RepositorioError } from './movimientos';

/** Nombres más largos que esto no caben en un chip ni en una leyenda. */
const LARGO_MAXIMO = 24;

/**
 * El id que le corresponde a un nombre.
 *
 * Sin tildes, en minúsculas y con guiones: es lo que se va a guardar en cada
 * movimiento, y tiene que sobrevivir a que alguien escriba "Café" en un teléfono
 * y "cafe" en otro.
 */
export function idDeCategoria(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Crea una categoría propia, o revive una que estaba borrada.
 *
 * Revivir en vez de fallar: si alguien borró "mascotas" y la vuelve a escribir,
 * lo que quiere es tenerla de nuevo —y de paso los movimientos viejos que la
 * usaban recuperan su nombre—.
 */
export function crearCategoria(
  db: BaseDeDatos,
  contexto: Contexto,
  nombre: string,
): Categoria {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (limpio === '') throw new RepositorioError('la categoría necesita un nombre');
  if (limpio.length > LARGO_MAXIMO) {
    throw new RepositorioError(`el nombre no puede pasar de ${LARGO_MAXIMO} caracteres`);
  }

  const id = idDeCategoria(limpio);
  if (id === '') throw new RepositorioError('ese nombre no deja ninguna letra ni número');
  if (categories.categoryById(id) !== null) {
    throw new RepositorioError(`"${categories.categoryName(id)}" ya viene con la app`);
  }

  const existente = db.select().from(categorias)
    .where(and(eq(categorias.householdId, contexto.householdId), eq(categorias.id, id))!)
    .get() as Categoria | undefined;

  if (existente !== undefined) {
    if (existente.deletedAt === null) throw new RepositorioError(`ya existe "${existente.nombre}"`);
    const revivida: Categoria = {
      ...existente, ...columnasEditadas(contexto), nombre: limpio, deletedAt: null,
    };
    db.update(categorias).set(revivida).where(eq(categorias.id, id)).run();
    return revivida;
  }

  const fila: Categoria = { ...columnasNuevas(contexto), id, nombre: limpio };
  db.insert(categorias).values(fila).run();
  return fila;
}

/**
 * La consulta sin ejecutar, **con lápidas**.
 *
 * Las borradas viajan a propósito: no salen en los selectores, pero un
 * movimiento viejo que quedó con esa categoría tiene que seguir mostrando su
 * nombre en vez del id pelado.
 */
export function consultaDeCategorias(db: BaseDeDatos, contexto: Contexto) {
  return db.select().from(categorias)
    .where(eq(categorias.householdId, contexto.householdId))
    .orderBy(categorias.nombre);
}

/** Las que se pueden elegir hoy. */
export function listarCategorias(db: BaseDeDatos, contexto: Contexto): Categoria[] {
  return db.select().from(categorias)
    .where(and(eq(categorias.householdId, contexto.householdId), isNull(categorias.deletedAt))!)
    .orderBy(categorias.nombre)
    .all() as Categoria[];
}

/**
 * Borra una categoría propia. Lápida, no borrado físico.
 *
 * **Los movimientos que la usaban no se tocan.** Reasignarlos sería decidir por
 * el usuario a qué otra categoría van, y dejarlos sin categoría le borraría una
 * clasificación que hizo a mano. Se quedan con el id, que sigue leyéndose porque
 * la fila borrada conserva el nombre.
 */
export function borrarCategoria(db: BaseDeDatos, contexto: Contexto, id: string): void {
  const afectadas = db.update(categorias)
    .set({ ...columnasEditadas(contexto), deletedAt: contexto.ahora() })
    .where(and(
      eq(categorias.householdId, contexto.householdId),
      eq(categorias.id, id),
      isNull(categorias.deletedAt),
    )!)
    .returning({ id: categorias.id })
    .all();

  if (afectadas.length === 0) throw new RepositorioError(`no existe la categoría ${id}`);
}
