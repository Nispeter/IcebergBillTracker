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
 *
 * ## Respaldar y compartir no son lo mismo
 *
 * Un respaldo lleva **todo**: si perdieras el telefono querrias de vuelta
 * tambien lo que no compartes con nadie. El archivo que se le pasa a otra
 * persona, en cambio, tiene que dejar fuera las cuentas marcadas como privadas.
 * Es la misma funcion con una opcion, y el valor por omision es el seguro:
 * exportar sin decir nada exporta todo.
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { Contexto } from '../contexto';
import {
  categorias, cuentas, instancias, lotes, miembros, movimientos, reglas, reglasCategoria,
  type Categoria, type Cuenta, type Instancia, type Lote, type Miembro, type Movimiento,
  type Regla, type ReglaCategoria,
} from '../schema';
import type { BaseDeDatos } from '../tipos';
import { cuentasQueNoSincronizan } from './cuentas';
import { RepositorioError } from './movimientos';

/**
 * Version del formato del respaldo.
 *
 * Sube cuando el esquema cambia de forma que un archivo viejo ya no se pueda
 * leer tal cual. Restaurar comprueba este numero antes de tocar nada: mejor
 * negarse que dejar la base a medio escribir con filas que no calzan.
 *
 * - **1**: cuentas, movimientos, reglas, instancias, lotes.
 * - **2**: agrega `reglasCategoria`.
 * - **3**: agrega `miembros`.
 *
 * Un archivo viejo se sigue leyendo, con las tablas que no traia vacias:
 * agregar una tabla no invalida lo anterior.
 */
export const VERSION_DE_RESPALDO = 4;

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
  /** Las reglas propias de categorizacion. Vacio en respaldos de la version 1. */
  readonly reglasCategoria: readonly ReglaCategoria[];
  /** Quien escribe en el hogar. Vacio en respaldos anteriores a la version 3. */
  readonly miembros: readonly Miembro[];
  /** Las categorias propias. Vacio en respaldos anteriores a la version 4. */
  readonly categorias: readonly Categoria[];
}

export interface OpcionesDeRespaldo {
  /**
   * Deja fuera las cuentas que no sincronizan, y todo lo que cuelga de ellas.
   * Solo para el archivo que se comparte; un respaldo de verdad nunca lo usa.
   */
  readonly soloSincronizables?: boolean;
}

/**
 * Saca del respaldo todo lo que cuelga de las cuentas dadas.
 *
 * Se usa en **los dos sentidos**, y ahi esta la gracia: al exportar deja fuera
 * lo privado, y al fusionar descarta lo que llegue de una cuenta que este
 * aparato marco como privada. Sin la segunda mitad, la marca seria una promesa
 * a medias: bastaria que el otro lado siguiera teniendo la cuenta compartida de
 * antes para que sus cambios volvieran a entrar.
 *
 * Las instancias no tienen `cuentaId`: cuelgan de una regla. Se resuelven con
 * las reglas del propio respaldo mas las que el llamador conozca --al fusionar,
 * las locales--. Una instancia cuya regla no se puede ubicar **se conserva**:
 * ante la duda, no perder datos.
 */
export function sinLasCuentas(
  respaldo: Respaldo,
  fuera: ReadonlySet<string>,
  reglasConocidas: readonly Regla[] = [],
): Respaldo {
  if (fuera.size === 0) return respaldo;

  const reglasFuera = new Set(
    [...respaldo.reglas, ...reglasConocidas]
      .filter((regla) => fuera.has(regla.cuentaId))
      .map((regla) => regla.id),
  );

  return {
    ...respaldo,
    cuentas: respaldo.cuentas.filter((c) => !fuera.has(c.id)),
    movimientos: respaldo.movimientos.filter((m) => !fuera.has(m.cuentaId)),
    reglas: respaldo.reglas.filter((r) => !fuera.has(r.cuentaId)),
    lotes: respaldo.lotes.filter((l) => !fuera.has(l.cuentaId)),
    instancias: respaldo.instancias.filter((i) => !reglasFuera.has(i.reglaId)),
    // `reglasCategoria`, `miembros` y `categorias` son del hogar, no de una
    // cuenta: no dicen cuanto gastaste sino como se llama cada aparato y como
    // clasificar. Viajan siempre.
    //
    // Las categorias ademas **tienen que** viajar aunque venga solo lo
    // compartido: si no, el otro telefono recibiria movimientos de una categoria
    // que no sabe nombrar y mostraria el id pelado.
  };
}

export function exportarRespaldo(
  db: BaseDeDatos,
  contexto: Contexto,
  opciones: OpcionesDeRespaldo = {},
): Respaldo {
  const completo: Respaldo = {
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
    reglasCategoria: db.select().from(reglasCategoria)
      .where(eq(reglasCategoria.householdId, contexto.householdId)).all() as ReglaCategoria[],
    miembros: db.select().from(miembros)
      .where(eq(miembros.householdId, contexto.householdId)).all() as Miembro[],
    categorias: db.select().from(categorias)
      .where(eq(categorias.householdId, contexto.householdId)).all() as Categoria[],
  };

  return opciones.soloSincronizables
    ? sinLasCuentas(completo, cuentasQueNoSincronizan(db, contexto))
    : completo;
}

/** Cuantas filas trae un respaldo, para poder decirlo antes de restaurar. */
export function contarRespaldo(respaldo: Respaldo): number {
  return respaldo.cuentas.length + respaldo.movimientos.length
    + respaldo.reglas.length + respaldo.instancias.length + respaldo.lotes.length
    + respaldo.reglasCategoria.length + respaldo.miembros.length;
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
  // La version 1 no la traia. Se completa vacia en vez de rechazar el archivo:
  // agregar una tabla no invalida los respaldos anteriores.
  return {
    ...posible,
    reglasCategoria: Array.isArray(posible.reglasCategoria) ? posible.reglasCategoria : [],
    miembros: Array.isArray(posible.miembros) ? posible.miembros : [],
    categorias: Array.isArray(posible.categorias) ? posible.categorias : [],
  } as Respaldo;
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
    base.delete(reglasCategoria)
      .where(eq(reglasCategoria.householdId, contexto.householdId)).run();
    base.delete(miembros).where(eq(miembros.householdId, contexto.householdId)).run();
    base.delete(categorias).where(eq(categorias.householdId, contexto.householdId)).run();
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

  // Restaurar tambien mete sellos ajenos, asi que el reloj local tiene que
  // quedar por delante o la primera edicion despues de restaurar perderia
  // contra lo restaurado. Ver `Contexto.recibir`.
  for (const fila of [...respaldo.cuentas, ...respaldo.movimientos, ...respaldo.reglas,
    ...respaldo.instancias, ...respaldo.lotes, ...respaldo.reglasCategoria,
    ...respaldo.miembros, ...respaldo.categorias]) {
    contexto.recibir(fila.updatedAt);
  }

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
    if (respaldo.reglasCategoria.length > 0) {
      base.insert(reglasCategoria).values(respaldo.reglasCategoria.map(deEsteHogar)).run();
    }
    if (respaldo.miembros.length > 0) {
      base.insert(miembros).values(respaldo.miembros.map(deEsteHogar)).run();
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
