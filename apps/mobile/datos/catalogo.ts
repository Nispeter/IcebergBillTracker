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
 *
 * ## Las de la app también se pueden renombrar
 *
 * Y eso se resuelve acá, no en `core`: una fila de esta tabla **con el id de la
 * built-in** es un override, y su nombre le gana al de `core`. Ver
 * `renombrarCategoria`.
 *
 * El orden de resolución es por eso `viva → core → borrada → id`, y cada paso
 * está donde está por una razón:
 *
 * - **Viva primero**, o el override no se vería.
 * - **Pero solo la viva.** Restaurar el nombre original deja el override con
 *   lápida, y si las borradas también pisaran a `core` restaurar no haría nada.
 * - **Las borradas al final**, que es lo que le da nombre a los movimientos
 *   viejos de una categoría propia que ya no está.
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

    /**
     * Las propias dejan fuera los overrides de las de la app.
     *
     * Si no, "Comida" renombrada aparecería **dos veces** en la lista de
     * Ajustes —una desde el catálogo de la app y otra como propia— y la segunda
     * con basurero, que borraría el override sin que nadie entienda qué pasó.
     */
    const propias = filas
      .filter((c) => c.deletedAt === null && categories.categoryById(c.id) === null)
      .map((c): CategoriaVisible => ({
        id: c.id, nombre: c.nombre, nombreCorto: c.nombre, propia: true,
      }));

    /**
     * El nombre corto de una renombrada es el nombre entero.
     *
     * Las de la app traen los dos distintos —"Impuestos y obligaciones legales"
     * y "Impuestos"—, pero quien renombra escribió **una** cosa, y seguir
     * diciendo "Impuestos" en la torta después de que puso "SII" sería ignorar
     * lo que pidió. Es el mismo trato que ya reciben las propias.
     */
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
