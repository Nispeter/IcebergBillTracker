/**
 * El catálogo de categorías que ve la app: las doce de siempre más las propias.
 *
 * Las doce viven en `core/categories` y no dependen de la base; las propias
 * salen de la tabla `categorias` y pueden cambiar en cualquier momento. Este
 * módulo es el único lugar donde se juntan, para que ninguna pantalla tenga que
 * acordarse de que existen las dos clases.
 *
 * ## Por qué un hook y no una función suelta
 *
 * Porque el nombre de una categoría **puede cambiar mientras la pantalla está
 * abierta**: se crea una en Ajustes y el selector de un formulario ya abierto
 * tiene que ofrecerla. `categories.categoryName` sigue existiendo para lo que no
 * es interfaz --el importador, el generador de datos--, donde las propias no
 * participan.
 *
 * ## Las borradas siguen teniendo nombre
 *
 * `todas` deja fuera las borradas: no hay por qué ofrecer algo que el usuario
 * quitó. Pero `nombre()` las mira igual, porque un movimiento de hace tres meses
 * quedó con esa categoría y mostrarle el id pelado sería castigarlo por haber
 * ordenado su lista.
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

const DE_LA_APP: readonly CategoriaVisible[] = categories.CATEGORIES.map((c) => ({
  id: c.id,
  nombre: c.nombre,
  nombreCorto: c.nombreCorto,
  propia: false,
}));

export function useCategorias(): Catalogo {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeCategorias(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta);

  return useMemo(() => {
    const filas = (data ?? []) as Categoria[];
    const propias = filas
      .filter((c) => c.deletedAt === null)
      .map((c): CategoriaVisible => ({
        id: c.id, nombre: c.nombre, nombreCorto: c.nombre, propia: true,
      }));

    // Incluye las borradas: es lo que le da nombre a los movimientos viejos.
    const porId = new Map(filas.map((c) => [c.id, c.nombre]));

    const nombre = (id: string | null | undefined): string => {
      if (id === null || id === undefined) return 'Sin categoría';
      return categories.categoryById(id)?.nombre ?? porId.get(id) ?? id;
    };

    return {
      todas: [...DE_LA_APP, ...propias],
      propias,
      nombre,
      nombreCorto: (id) => {
        if (id === null || id === undefined) return 'Sin categoría';
        return categories.categoryById(id)?.nombreCorto ?? porId.get(id) ?? id;
      },
    };
  }, [data]);
}
