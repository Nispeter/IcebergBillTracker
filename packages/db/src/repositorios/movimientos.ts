/**
 * Repositorio de movimientos.
 *
 * Las consultas viven aca y no en las pantallas, para que se puedan probar en
 * Node en milisegundos —sin emulador ni navegador— y para que ninguna pantalla
 * arme SQL a mano y se olvide de descartar las lapidas.
 *
 * **Regla que sostiene todo el modulo**: nada que se lea puede incluir filas con
 * `deleted_at`. Un solo `select` sin ese filtro y un movimiento borrado
 * reaparece en el listado.
 */

import { dates, money } from '@iceberg/core';
import { and, asc, desc, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { columnasEditadas, columnasNuevas, type Contexto } from '../contexto';
import { movimientos, type Movimiento, type TipoDeMovimiento } from '../schema';
import type { BaseDeDatos } from '../tipos';

export interface DatosDeMovimiento {
  readonly cuentaId: string;
  readonly tipo: TipoDeMovimiento;
  /** Entero positivo en la unidad menor. El signo lo da `tipo`. */
  readonly montoMinor: number;
  readonly ocurridoEn: dates.PlainDate;
  readonly nombre: string;
  readonly categoriaId?: string | null;
  readonly notas?: string | null;
}

export interface CambiosDeMovimiento {
  readonly cuentaId?: string;
  readonly tipo?: TipoDeMovimiento;
  readonly montoMinor?: number;
  readonly ocurridoEn?: dates.PlainDate;
  readonly nombre?: string;
  readonly categoriaId?: string | null;
  readonly notas?: string | null;
}

export interface FiltroDeMovimientos {
  readonly cuentaId?: string;
  readonly tipo?: TipoDeMovimiento;
  readonly categoriaId?: string;
  readonly desde?: dates.PlainDate;
  readonly hasta?: dates.PlainDate;
  readonly limite?: number;
}

export class RepositorioError extends Error {
  override name = 'RepositorioError';
}

/**
 * El monto pasa por `money` para que un decimal reviente aca y no termine
 * silenciosamente en la base. Ademas se exige positivo: el signo es del tipo.
 */
function validarMonto(montoMinor: number): number {
  const validado = money.money(montoMinor, 'CLP').amountMinor;
  if (validado <= 0) {
    throw new RepositorioError(`el monto debe ser positivo, el signo lo da el tipo: ${montoMinor}`);
  }
  return validado;
}

function validarNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length === 0) throw new RepositorioError('el nombre no puede estar vacio');
  return limpio;
}

export function crearMovimiento(
  db: BaseDeDatos,
  contexto: Contexto,
  datos: DatosDeMovimiento,
): Movimiento {
  const fila = {
    ...columnasNuevas(contexto),
    cuentaId: datos.cuentaId,
    tipo: datos.tipo,
    montoMinor: validarMonto(datos.montoMinor),
    moneda: 'CLP',
    ocurridoEn: datos.ocurridoEn,
    nombre: validarNombre(datos.nombre),
    categoriaId: datos.categoriaId ?? null,
    notas: datos.notas ?? null,
  };
  db.insert(movimientos).values(fila).run();
  return fila as Movimiento;
}

/** Las lapidas quedan fuera: para el resto de la app, la fila ya no existe. */
function vivos(contexto: Contexto, extra: SQL[] = []): SQL {
  return and(
    eq(movimientos.householdId, contexto.householdId),
    isNull(movimientos.deletedAt),
    ...extra,
  )!;
}

export function obtenerMovimiento(
  db: BaseDeDatos,
  contexto: Contexto,
  id: string,
): Movimiento | null {
  const filas = db.select().from(movimientos)
    .where(vivos(contexto, [eq(movimientos.id, id)]))
    .limit(1)
    .all();
  return filas[0] ?? null;
}

/**
 * La consulta **sin ejecutar**.
 *
 * Se expone aparte porque `useLiveQuery` de Drizzle necesita el constructor de
 * consulta, no el resultado: se queda escuchando los cambios de la base y la
 * vuelve a correr sola. Las pantallas usan esta; los tests usan
 * `listarMovimientos`, que la ejecuta de una.
 */
/** Traduce el filtro a condiciones SQL. Compartido por la lista y el resumen. */
function condicionesDe(filtro: FiltroDeMovimientos): SQL[] {
  const condiciones: SQL[] = [];
  if (filtro.cuentaId) condiciones.push(eq(movimientos.cuentaId, filtro.cuentaId));
  if (filtro.tipo) condiciones.push(eq(movimientos.tipo, filtro.tipo));
  if (filtro.categoriaId) condiciones.push(eq(movimientos.categoriaId, filtro.categoriaId));
  if (filtro.desde) condiciones.push(gte(movimientos.ocurridoEn, filtro.desde));
  if (filtro.hasta) condiciones.push(lte(movimientos.ocurridoEn, filtro.hasta));
  return condiciones;
}

export function consultaDeMovimientos(
  db: BaseDeDatos,
  contexto: Contexto,
  filtro: FiltroDeMovimientos = {},
) {
  const base = db.select().from(movimientos)
    .where(vivos(contexto, condicionesDe(filtro)))
    // Mas nuevo primero. El id desempata dentro del mismo dia, y como es ULID
    // eso equivale a orden de creacion.
    .orderBy(desc(movimientos.ocurridoEn), desc(movimientos.id));

  return filtro.limite === undefined ? base : base.limit(filtro.limite);
}

export function listarMovimientos(
  db: BaseDeDatos,
  contexto: Contexto,
  filtro: FiltroDeMovimientos = {},
): Movimiento[] {
  return consultaDeMovimientos(db, contexto, filtro).all() as Movimiento[];
}

/** Igual que `listarMovimientos` pero del mas viejo al mas nuevo. */
export function listarCronologico(
  db: BaseDeDatos,
  contexto: Contexto,
  filtro: FiltroDeMovimientos = {},
): Movimiento[] {
  return listarMovimientos(db, contexto, filtro)
    .sort((a, b) => dates.compareDates(a.ocurridoEn as dates.PlainDate, b.ocurridoEn as dates.PlainDate)
      || a.id.localeCompare(b.id));
}

export function editarMovimiento(
  db: BaseDeDatos,
  contexto: Contexto,
  id: string,
  cambios: CambiosDeMovimiento,
): Movimiento | null {
  if (obtenerMovimiento(db, contexto, id) === null) return null;

  const parche: Record<string, unknown> = { ...columnasEditadas(contexto) };
  if (cambios.cuentaId !== undefined) parche.cuentaId = cambios.cuentaId;
  if (cambios.tipo !== undefined) parche.tipo = cambios.tipo;
  if (cambios.montoMinor !== undefined) parche.montoMinor = validarMonto(cambios.montoMinor);
  if (cambios.ocurridoEn !== undefined) parche.ocurridoEn = cambios.ocurridoEn;
  if (cambios.nombre !== undefined) parche.nombre = validarNombre(cambios.nombre);
  if (cambios.categoriaId !== undefined) parche.categoriaId = cambios.categoriaId;
  if (cambios.notas !== undefined) parche.notas = cambios.notas;

  db.update(movimientos).set(parche).where(eq(movimientos.id, id)).run();
  return obtenerMovimiento(db, contexto, id);
}

/**
 * Borrado logico: pone la lapida, **no elimina la fila**.
 *
 * Es lo que permite que el borrado viaje al resto de los dispositivos. Si la
 * fila desapareciera, el que borro no tendria como contarlo y la proxima fusion
 * la resucitaria.
 */
export function borrarMovimiento(db: BaseDeDatos, contexto: Contexto, id: string): boolean {
  if (obtenerMovimiento(db, contexto, id) === null) return false;
  const ahora = contexto.ahora();
  db.update(movimientos)
    .set({ deletedAt: ahora, updatedAt: ahora, originDeviceId: contexto.deviceId })
    .where(eq(movimientos.id, id))
    .run();
  return true;
}

/** Suma de un tipo de movimiento, en la unidad menor. Descarta lapidas. */
export function totalPorTipo(
  db: BaseDeDatos,
  contexto: Contexto,
  tipo: TipoDeMovimiento,
  filtro: FiltroDeMovimientos = {},
): money.Money {
  const total = listarMovimientos(db, contexto, { ...filtro, tipo })
    .reduce((suma, fila) => suma + fila.montoMinor, 0);
  return money.money(total, 'CLP');
}

export interface ResumenDeFiltro {
  readonly cantidad: number;
  readonly ingreso: money.Money;
  readonly gasto: money.Money;
  /** Ingreso menos gasto. Las transferencias no entran en ninguno. */
  readonly neto: money.Money;
}

/**
 * Totales de lo que cumple el filtro, **sin traer las filas**.
 *
 * Existe por el paginado: el encabezado tiene que decir cuantos movimientos hay
 * en total y cuanto suman, no cuantos se alcanzaron a cargar. Sumar en memoria
 * obligaria a traer las 679 filas justamente para no mostrarlas.
 *
 * El signo lo pone el `case`, porque los montos se guardan sin signo.
 */
export function resumenDeMovimientos(
  db: BaseDeDatos,
  contexto: Contexto,
  filtro: FiltroDeMovimientos = {},
): ResumenDeFiltro {
  const filas = db.select({
    cantidad: sql<number>`count(*)`,
    ingreso: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'ingreso' then ${movimientos.montoMinor} else 0 end), 0)`,
    gasto: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'gasto' then ${movimientos.montoMinor} else 0 end), 0)`,
  })
    .from(movimientos)
    .where(vivos(contexto, condicionesDe(filtro)))
    .all();

  const fila = filas[0] ?? { cantidad: 0, ingreso: 0, gasto: 0 };
  const ingreso = money.money(fila.ingreso, 'CLP');
  const gasto = money.money(fila.gasto, 'CLP');
  return { cantidad: fila.cantidad, ingreso, gasto, neto: money.subtract(ingreso, gasto) };
}

/** Cuenta filas vivas, sin traerlas. Para paginado y para los tests. */
export function contarMovimientos(db: BaseDeDatos, contexto: Contexto): number {
  const filas = db.select({ n: sql<number>`count(*)` }).from(movimientos)
    .where(vivos(contexto))
    .all();
  return filas[0]?.n ?? 0;
}

/** Solo para el motor de sync y para los tests: incluye las lapidas. */
export function listarConLapidas(db: BaseDeDatos, contexto: Contexto): Movimiento[] {
  return db.select().from(movimientos)
    .where(eq(movimientos.householdId, contexto.householdId))
    .orderBy(asc(movimientos.id))
    .all();
}
