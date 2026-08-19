/**
 * Repositorio de cuentas.
 *
 * Misma regla que en movimientos: nada que se lea incluye lapidas.
 */

import { money } from '@iceberg/core';
import { and, asc, eq, isNull, type SQL } from 'drizzle-orm';
import { columnasEditadas, columnasNuevas, type Contexto } from '../contexto';
import { cuentas, type Cuenta, type TipoDeCuenta } from '../schema';
import type { BaseDeDatos } from '../tipos';
import { RepositorioError } from './movimientos';

export interface DatosDeCuenta {
  readonly nombre: string;
  readonly tipo: TipoDeCuenta;
  /** Entero en la unidad menor. Puede ser negativo: una tarjeta parte en deuda. */
  readonly saldoInicialMinor?: number;
}

export interface CambiosDeCuenta {
  readonly nombre?: string;
  readonly tipo?: TipoDeCuenta;
  readonly saldoInicialMinor?: number;
}

function validarNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length === 0) throw new RepositorioError('el nombre de la cuenta no puede estar vacio');
  return limpio;
}

export function crearCuenta(db: BaseDeDatos, contexto: Contexto, datos: DatosDeCuenta): Cuenta {
  const fila = {
    ...columnasNuevas(contexto),
    nombre: validarNombre(datos.nombre),
    tipo: datos.tipo,
    moneda: 'CLP',
    // Pasa por `money` para que un decimal reviente aca y no en la base.
    saldoInicialMinor: money.money(datos.saldoInicialMinor ?? 0, 'CLP').amountMinor,
  };
  db.insert(cuentas).values(fila).run();
  return fila as Cuenta;
}

function vivas(contexto: Contexto, extra: SQL[] = []): SQL {
  return and(eq(cuentas.householdId, contexto.householdId), isNull(cuentas.deletedAt), ...extra)!;
}

export function obtenerCuenta(db: BaseDeDatos, contexto: Contexto, id: string): Cuenta | null {
  const filas = db.select().from(cuentas).where(vivas(contexto, [eq(cuentas.id, id)])).limit(1).all();
  return filas[0] ?? null;
}

export function listarCuentas(db: BaseDeDatos, contexto: Contexto): Cuenta[] {
  return db.select().from(cuentas).where(vivas(contexto)).orderBy(asc(cuentas.nombre)).all();
}

export function editarCuenta(
  db: BaseDeDatos,
  contexto: Contexto,
  id: string,
  cambios: CambiosDeCuenta,
): Cuenta | null {
  if (obtenerCuenta(db, contexto, id) === null) return null;

  const parche: Record<string, unknown> = { ...columnasEditadas(contexto) };
  if (cambios.nombre !== undefined) parche.nombre = validarNombre(cambios.nombre);
  if (cambios.tipo !== undefined) parche.tipo = cambios.tipo;
  if (cambios.saldoInicialMinor !== undefined) {
    parche.saldoInicialMinor = money.money(cambios.saldoInicialMinor, 'CLP').amountMinor;
  }

  db.update(cuentas).set(parche).where(eq(cuentas.id, id)).run();
  return obtenerCuenta(db, contexto, id);
}

/** Borrado logico: pone la lapida, no elimina la fila. */
export function borrarCuenta(db: BaseDeDatos, contexto: Contexto, id: string): boolean {
  if (obtenerCuenta(db, contexto, id) === null) return false;
  const ahora = contexto.ahora();
  db.update(cuentas)
    .set({ deletedAt: ahora, updatedAt: ahora, originDeviceId: contexto.deviceId })
    .where(eq(cuentas.id, id))
    .run();
  return true;
}
