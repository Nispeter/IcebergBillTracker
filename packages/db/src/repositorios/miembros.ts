/**
 * Quien escribe en este hogar, con nombre.
 *
 * Cada fila guarda en `createdBy` el id del miembro que la escribio, pero un
 * ULID no le dice nada a nadie. Sin esta tabla, un conflicto de sincronizacion
 * informa que una version gano y no **quien** la escribio, que es justo lo que
 * hace falta para decidir si estuvo bien.
 *
 * El id del miembro **no se genera aca**: es el que ya vive en los ajustes de
 * este dispositivo desde el primer arranque, y las filas escritas antes de que
 * existiera esta tabla ya apuntan a el. Generar uno nuevo dejaria toda esa
 * historia sin dueno.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { columnasEditadas, columnasNuevas, type Contexto } from '../contexto';
import { miembros, type Miembro } from '../schema';
import type { BaseDeDatos } from '../tipos';
import { RepositorioError } from './movimientos';

/** Nombre con el que se registra un dispositivo si nadie le pone otro. */
export const NOMBRE_POR_DEFECTO = 'Este dispositivo';

function vivos(contexto: Contexto) {
  return and(
    eq(miembros.householdId, contexto.householdId),
    isNull(miembros.deletedAt),
  )!;
}

/** La consulta sin ejecutar, para `useLiveQuery`. */
export function consultaDeMiembros(db: BaseDeDatos, contexto: Contexto) {
  return db.select().from(miembros).where(vivos(contexto)).orderBy(miembros.createdAt);
}

export function listarMiembros(db: BaseDeDatos, contexto: Contexto): Miembro[] {
  return consultaDeMiembros(db, contexto).all() as Miembro[];
}

export function obtenerMiembro(
  db: BaseDeDatos,
  contexto: Contexto,
  id: string,
): Miembro | null {
  return listarMiembros(db, contexto).find((miembro) => miembro.id === id) ?? null;
}

/**
 * Se asegura de que este dispositivo tenga su fila de miembro.
 *
 * Se llama en cada arranque. Es idempotente: si ya existe, no toca nada —ni
 * siquiera el `updatedAt`, o cada apertura de la app generaria una escritura que
 * ganaria conflictos contra el otro telefono sin que nadie hubiera editado nada.
 */
export function asegurarMiembro(db: BaseDeDatos, contexto: Contexto): Miembro {
  const existente = obtenerMiembro(db, contexto, contexto.memberId);
  if (existente !== null) return existente;

  const fila: Miembro = {
    ...columnasNuevas(contexto),
    // El id es el del ajuste, no uno nuevo: las filas ya escritas apuntan ahi.
    id: contexto.memberId,
    nombre: NOMBRE_POR_DEFECTO,
    dispositivoId: contexto.deviceId,
  };
  db.insert(miembros).values(fila).run();
  return fila;
}

export function renombrarMiembro(
  db: BaseDeDatos,
  contexto: Contexto,
  id: string,
  nombre: string,
): Miembro | null {
  const limpio = nombre.trim();
  if (limpio.length === 0) throw new RepositorioError('el nombre no puede estar vacío');
  if (obtenerMiembro(db, contexto, id) === null) return null;

  db.update(miembros)
    .set({ ...columnasEditadas(contexto), nombre: limpio, dispositivoId: contexto.deviceId })
    .where(eq(miembros.id, id))
    .run();
  return obtenerMiembro(db, contexto, id);
}

/**
 * Como se llama quien escribio una fila.
 *
 * Devuelve el id crudo si no hay nombre: puede pasar con filas que llegaron por
 * sincronizacion de un aparato cuya fila de miembro todavia no viajo. Mostrar el
 * id es feo pero honesto; inventar un nombre seria peor.
 */
export function nombreDeMiembro(
  miembrosConocidos: readonly Miembro[],
  id: string | null,
): string {
  if (id === null) return '—';
  return miembrosConocidos.find((miembro) => miembro.id === id)?.nombre ?? id;
}
