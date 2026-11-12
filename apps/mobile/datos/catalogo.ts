/**
 * El catálogo de categorías que ve la app: las doce de `core` más las propias
 * de la tabla `categorias`. Es el único lugar donde se juntan.
 *
 * Es un hook porque los nombres cambian con la pantalla abierta (se crea una en
 * Ajustes y el formulario ya abierto tiene que ofrecerla).
 *
 * `todas` deja fuera las borradas, pero `nombre()` las resuelve igual: los
 * movimientos viejos siguen llevando esa categoría. Una fila con el id de una
 * de la app es un override de su nombre, así que el orden es `viva → core →
 * borrada → id`: la viva primero o el override no se vería; solo la viva, o
 * restaurar (que deja lápida sobre el override) no haría nada.
 */

import { categories } from '@iceberg/core';
import { consultaDeCategorias, type Categoria } from '@iceberg/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { useDatos } from './BaseDeDatos';

/** Una categoría lista para mostrar, venga de donde venga. */
export interface CategoriaVisible {
  readonly id: string;
  readonly nombre: string;
  /** Una palabra, para listas densas. En las propias es el nombre entero. */
  readonly nombreCorto: string;
  /** Si la agregó el usuario. Solo esas se pueden borrar. */
  readonly propia: boolean;
}

export interface Catalogo {
  /** Las que se pueden elegir hoy: las de la app primero, las propias después. */
  readonly todas: readonly CategoriaVisible[];
  /** Solo las propias que siguen vivas, para la lista de Ajustes. */
  readonly propias: readonly CategoriaVisible[];
  /** El nombre para mostrar. Resuelve también las borradas. */
  readonly nombre: (id: string | null | undefined) => string;
  /** La versión de una palabra, para chips y leyendas. */
  readonly nombreCorto: (id: string | null | undefined) => string;
}

export function useCategorias(): Catalogo {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeCategorias(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta);

  return useMemo(() => {
    const filas = (data ?? []) as Categoria[];
    const vivas = new Map(filas.filter((c) => c.deletedAt === null).map((c) => [c.id, c.nombre]));
    // Incluye las borradas: es lo que le da nombre a los movimientos viejos.
    const porId = new Map(filas.map((c) => [c.id, c.nombre]));

    // Sin los overrides de las de la app: "Comida" renombrada saldría dos veces,
    // y la segunda con basurero.
    const propias = filas
      .filter((c) => c.deletedAt === null && categories.categoryById(c.id) === null)
      .map((c): CategoriaVisible => ({
        id: c.id, nombre: c.nombre, nombreCorto: c.nombre, propia: true,
      }));

    // Renombrada, el nombre corto es el que se escribió: quien puso "SII" no
    // quiere seguir leyendo "Impuestos" en la torta.
    const deLaApp = categories.CATEGORIES.map((c): CategoriaVisible => {
      const propio = vivas.get(c.id);
      return {
        id: c.id,
        nombre: propio ?? c.nombre,
        nombreCorto: propio ?? c.nombreCorto,
        propia: false,
      };
    });

    return {
      todas: [...deLaApp, ...propias],
      propias,
      nombre: (id) => {
        if (id === null || id === undefined) return 'Sin categoría';
        return vivas.get(id) ?? categories.categoryById(id)?.nombre ?? porId.get(id) ?? id;
      },
      nombreCorto: (id) => {
        if (id === null || id === undefined) return 'Sin categoría';
        return vivas.get(id) ?? categories.categoryById(id)?.nombreCorto ?? porId.get(id) ?? id;
      },
    };
  }, [data]);
}
