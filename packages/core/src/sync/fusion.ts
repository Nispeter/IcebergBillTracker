/**
 * Fusionar dos copias de la misma base.
 *
 * Cada fila es un **registro de último escritor gana**, y quién escribió último
 * lo decide el HLC de `updatedAt`, no el reloj de pared. Es lo que hace que dos
 * teléfonos con la hora mal puesta converjan igual: el HLC ordena por causalidad,
 * y su formato de ancho fijo hace que comparar los textos baste.
 *
 * **El borrado es una escritura más.** No hay regla especial de "gana el
 * borrado": la lápida viaja en la misma fila y compite por `updatedAt` como
 * cualquier otro cambio. Si un teléfono borra a las 10:00 y el otro edita a las
 * 10:01, la edición gana y la fila vive. Al revés, queda borrada. Eso es lo que
 * permite deshacer un borrado y que el deshacer también viaje; una regla de
 * "gana el borrado" haría que un movimiento borrado por accidente en un aparato
 * no se pudiera recuperar nunca desde el otro.
 *
 * Lo que **no** hace: fusionar campo por campo. Si los dos lados cambian filas
 * distintas de la misma tabla, ambos cambios sobreviven; si cambian la misma
 * fila, sobrevive una entera. Mezclar campos de dos versiones produce filas que
 * ningún usuario escribió, y en plata eso es peor que perder una edición.
 */

/** Lo mínimo que toda fila sincronizable tiene. */
export interface FilaSincronizable {
  readonly id: string;
  /** HLC en texto. Ver `hlc.ts`: el orden lexicográfico es el orden causal. */
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** Una fila donde hubo que descartar una versión. */
export interface Conflicto<T> {
  readonly id: string;
  readonly ganadora: T;
  readonly descartada: T;
}

export interface ResultadoDeFusion<T> {
  readonly filas: T[];
  /**
   * Los casos en que dos versiones distintas compitieron y una se perdió.
   *
   * No es un error: la fusión ya resolvió. Es lo que hay que poder mostrarle al
   * usuario, porque una edición suya pudo quedar descartada sin que se entere.
   */
  readonly conflictos: Conflicto<T>[];
}

/**
 * Cuál de las dos versiones de una fila sobrevive.
 *
 * Empata por `updatedAt` —posible si dos aparatos escriben en el mismo instante
 * lógico— y desempata por `id`, que es arbitrario pero **igual en los dos
 * lados**. Sin desempate determinista, dos réplicas podrían elegir distinto y no
 * converger nunca, que es justo lo que la fusión tiene que garantizar.
 */
export function ganadora<T extends FilaSincronizable>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return a.id <= b.id ? a : b;
}

/** Si dos versiones de la misma fila son la misma escritura. */
function mismaEscritura<T extends FilaSincronizable>(a: T, b: T): boolean {
  return a.updatedAt === b.updatedAt && a.deletedAt === b.deletedAt;
}

/**
 * Fusiona dos listas de filas de la misma tabla.
 *
 * Es **conmutativa, asociativa e idempotente**: fusionar A con B da lo mismo que
 * B con A, el orden de una cadena de fusiones no importa, y fusionar algo
 * consigo mismo no lo cambia. Sin esas tres propiedades no hay convergencia, y
 * hay un test de propiedad que las comprueba con operaciones desordenadas.
 */
export function fusionarTabla<T extends FilaSincronizable>(
  locales: readonly T[],
  remotas: readonly T[],
): ResultadoDeFusion<T> {
  const porId = new Map<string, T>();
  const conflictos: Conflicto<T>[] = [];

  for (const fila of locales) porId.set(fila.id, fila);

  for (const remota of remotas) {
    const local = porId.get(remota.id);
    if (local === undefined) {
      porId.set(remota.id, remota);
      continue;
    }
    if (mismaEscritura(local, remota)) continue;

    const gana = ganadora(local, remota);
    const pierde = gana === local ? remota : local;
    porId.set(remota.id, gana);
    conflictos.push({ id: remota.id, ganadora: gana, descartada: pierde });
  }

  // Ordenado por id para que el resultado no dependa del orden de entrada: dos
  // replicas tienen que llegar al mismo arreglo, no solo al mismo conjunto.
  const filas = [...porId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { filas, conflictos };
}

/** Cuántas filas de la fusión quedaron con lápida. */
export function contarBorradas<T extends FilaSincronizable>(filas: readonly T[]): number {
  return filas.filter((fila) => fila.deletedAt !== null).length;
}

/**
 * El resumen de una fusión, para poder contarla en una frase.
 *
 * Se calcula comparando contra lo que había antes, no contando lo que llegó: lo
 * que le importa a quien mira es cuántas filas cambiaron **en su base**, y una
 * fila remota idéntica a la local no cambió nada.
 */
export interface ResumenDeFusion {
  readonly nuevas: number;
  readonly actualizadas: number;
  readonly sinCambios: number;
  readonly conflictos: number;
}

export function resumirFusion<T extends FilaSincronizable>(
  locales: readonly T[],
  resultado: ResultadoDeFusion<T>,
): ResumenDeFusion {
  const antes = new Map(locales.map((fila) => [fila.id, fila]));
  let nuevas = 0;
  let actualizadas = 0;
  let sinCambios = 0;

  for (const fila of resultado.filas) {
    const previa = antes.get(fila.id);
    if (previa === undefined) nuevas += 1;
    else if (mismaEscritura(previa, fila)) sinCambios += 1;
    else actualizadas += 1;
  }

  return { nuevas, actualizadas, sinCambios, conflictos: resultado.conflictos.length };
}
