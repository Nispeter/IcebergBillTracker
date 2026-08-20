/**
 * Respaldo: sacar todo a un JSON y volver a meterlo.
 *
 * Es lo que hace que se le pueda confiar plata real a la app. Sin esto, la base
 * vive en el almacenamiento de una sola aplicacion en un solo telefono, y
 * cualquier accidente —desinstalar, cambiar de aparato, un bug— se lleva anos de
 * historial sin vuelta.
 *
 * **Se exportan tambien las lapidas.** Una fila borrada no es basura: es la
 * unica forma de que ese borrado viaje a los otros dispositivos cuando exista el
 * sync. Un respaldo que las filtrara resucitaria todo lo borrado al restaurar.
 *
 * **No se exportan los ajustes.** Ahi vive la identidad del aparato —su
 * `deviceId`— y copiarla a otro telefono no es una feature, es un error: dos
 * dispositivos con el mismo id no pueden fusionar sus cambios.
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { Contexto } from '../contexto';
import {
  cuentas, instancias, lotes, movimientos, reglas,
  type Cuenta, type Instancia, type Lote, type Movimiento, type Regla,
} from '../schema';
import type { BaseDeDatos } from '../tipos';
import { RepositorioError } from './movimientos';

/**
 * Version del formato del respaldo.
 *
 * Sube cuando el esquema cambia de forma que un archivo viejo ya no se pueda
 * leer tal cual. Restaurar comprueba este numero antes de tocar nada: mejor
 * negarse que dejar la base a medio escribir con filas que no calzan.
 */
export const VERSION_DE_RESPALDO = 1;

export interface Respaldo {
  readonly version: number;
  /** Marca de tiempo real, solo informativa: no participa de ninguna decision. */
  readonly exportadoEn: string;
  readonly householdId: string;
  readonly cuentas: readonly Cuenta[];
  readonly movimientos: readonly Movimiento[];
  readonly reglas: readonly Regla[];
  readonly instancias: readonly Instancia[];
  readonly lotes: readonly Lote[];
}

export function exportarRespaldo(db: BaseDeDatos, contexto: Contexto): Respaldo {
  return {
    version: VERSION_DE_RESPALDO,
    exportadoEn: new Date().toISOString(),
    householdId: contexto.householdId,
    cuentas: db.select().from(cuentas)
      .where(eq(cuentas.householdId, contexto.householdId)).all() as Cuenta[],
    movimientos: db.select().from(movimientos)
      .where(eq(movimientos.householdId, contexto.householdId)).all() as Movimiento[],
    reglas: db.select().from(reglas)
      .where(eq(reglas.householdId, contexto.householdId)).all() as Regla[],
    instancias: db.select().from(instancias)
      .where(eq(instancias.householdId, contexto.householdId)).all() as Instancia[],
    lotes: db.select().from(lotes)
      .where(eq(lotes.householdId, contexto.householdId)).all() as Lote[],
  };
}

/** Cuantas filas trae un respaldo, para poder decirlo antes de restaurar. */
export function contarRespaldo(respaldo: Respaldo): number {
  return respaldo.cuentas.length + respaldo.movimientos.length
    + respaldo.reglas.length + respaldo.instancias.length + respaldo.lotes.length;
}

/**
 * Comprueba que un objeto cualquiera tenga forma de respaldo.
 *
 * Restaurar borra todo lo que hay antes de escribir, asi que un archivo
 * equivocado no puede llegar a la parte destructiva. Se valida entero primero.
 */
export function leerRespaldo(crudo: unknown): Respaldo {
  if (typeof crudo !== 'object' || crudo === null) {
    throw new RepositorioError('El archivo no es un respaldo.');
  }
  const posible = crudo as Partial<Respaldo>;

  if (typeof posible.version !== 'number') {
    throw new RepositorioError('El archivo no es un respaldo de Iceberg.');
  }
  if (posible.version > VERSION_DE_RESPALDO) {
    throw new RepositorioError(
      `El respaldo es de una versión más nueva de la app (${posible.version}). Actualiza antes de restaurar.`,
    );
  }
  for (const tabla of ['cuentas', 'movimientos', 'reglas', 'instancias', 'lotes'] as const) {
    if (!Array.isArray(posible[tabla])) {
      throw new RepositorioError(`Al respaldo le falta "${tabla}".`);
    }
  }
  return posible as Respaldo;
}

/**
 * Borra **todos** los datos del hogar. No deja lapidas: elimina las filas.
 *
 * Es distinto de borrar un movimiento. Ahi la lapida existe para que el borrado
 * viaje; aca se esta vaciando la base entera a proposito, y dejar seiscientas
 * lapidas solo serviria para que la proxima sincronizacion las propagara.
 *
 * No toca `ajustes`: la identidad del aparato sobrevive, que es lo que uno
 * quiere al empezar de cero sin dejar de ser el mismo dispositivo.
 */
export function borrarTodo(db: BaseDeDatos, contexto: Contexto): void {
  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;
    base.delete(movimientos).where(eq(movimientos.householdId, contexto.householdId)).run();
    base.delete(instancias).where(eq(instancias.householdId, contexto.householdId)).run();
    base.delete(reglas).where(eq(reglas.householdId, contexto.householdId)).run();
    base.delete(lotes).where(eq(lotes.householdId, contexto.householdId)).run();
    base.delete(cuentas).where(eq(cuentas.householdId, contexto.householdId)).run();
  });
}

/**
 * Restaura un respaldo, **reemplazando** todo lo que hay.
 *
 * Reemplazar y no fusionar: fusionar dos historiales sin el motor de sync —que
 * es F5— produciria duplicados silenciosos, que es la peor forma de perder
 * datos porque no se nota.
 *
 * **Las filas adoptan el hogar de este aparato.** El primer intento conservaba
 * el `householdId` del respaldo, con el argumento de que asi seguia siendo el
 * mismo hogar. Eso rompe el caso principal: una instalacion nueva genera un
 * hogar nuevo al arrancar, asi que restaurar el propio respaldo metia 700 filas
 * que **ninguna consulta encontraba**, porque todas filtran por hogar. Los datos
 * estaban y la app se veia vacia, que es la peor forma de fallar.
 *
 * Cuando exista el sync, unirse a un hogar sera un paso explicito de
 * emparejamiento, no un efecto lateral de abrir un archivo.
 */
export function restaurarRespaldo(
  db: BaseDeDatos,
  contexto: Contexto,
  crudo: unknown,
): number {
  const respaldo = leerRespaldo(crudo);

  const deEsteHogar = <T extends { householdId: string }>(fila: T): T =>
    ({ ...fila, householdId: contexto.householdId });

  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;
    borrarTodo(base, contexto);

    if (respaldo.cuentas.length > 0) {
      base.insert(cuentas).values(respaldo.cuentas.map(deEsteHogar)).run();
    }
    if (respaldo.reglas.length > 0) {
      base.insert(reglas).values(respaldo.reglas.map(deEsteHogar)).run();
    }
    if (respaldo.lotes.length > 0) {
      base.insert(lotes).values(respaldo.lotes.map(deEsteHogar)).run();
    }
    if (respaldo.instancias.length > 0) {
      base.insert(instancias).values(respaldo.instancias.map(deEsteHogar)).run();
    }
    // Los movimientos se insertan por tandas: SQLite tiene un tope de variables
    // por sentencia y un historial de anos lo pasa sin esfuerzo.
    const TANDA = 200;
    for (let i = 0; i < respaldo.movimientos.length; i += TANDA) {
      base.insert(movimientos).values(respaldo.movimientos.slice(i, i + TANDA).map(deEsteHogar)).run();
    }
  });

  return contarRespaldo(respaldo);
}

/** Si la base esta vacia de datos del usuario. Decide si ofrecer la semilla. */
export function estaVacia(db: BaseDeDatos, contexto: Contexto): boolean {
  const fila = db.select({ id: movimientos.id }).from(movimientos)
    .where(and(
      eq(movimientos.householdId, contexto.householdId),
      isNull(movimientos.deletedAt),
    )!)
    .limit(1)
    .all();
  return fila.length === 0;
}
