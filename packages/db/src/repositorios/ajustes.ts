/**
 * Ajustes locales del dispositivo.
 *
 * Clave-valor sin columnas de sync: es lo que **no** viaja a los otros
 * dispositivos. Aca vive la identidad de este aparato, que se crea la primera
 * vez que la app arranca y despues no cambia.
 */

import { eq } from 'drizzle-orm';
import { ajustes } from '../schema';
import type { BaseDeDatos } from '../tipos';

export const CLAVE_DISPOSITIVO = 'deviceId';
export const CLAVE_HOGAR = 'householdId';
export const CLAVE_MIEMBRO = 'memberId';
export const CLAVE_SEMILLA_CARGADA = 'semillaCargada';
/**
 * Con que cuenta abre la app.
 *
 * Vive en `ajustes` y no en la fila de la cuenta a proposito: **no se
 * sincroniza**. Cual mirar primero es preferencia de cada telefono, y no tiene
 * por que ser la misma para las dos personas que comparten un libro.
 *
 * Vacio o ausente significa "todas juntas".
 */
export const CLAVE_CUENTA_POR_DEFECTO = 'cuentaPorDefecto';

export function leerAjuste(db: BaseDeDatos, clave: string): string | null {
  const filas = db.select().from(ajustes).where(eq(ajustes.clave, clave)).limit(1).all();
  return filas[0]?.valor ?? null;
}

export function escribirAjuste(db: BaseDeDatos, clave: string, valor: string): void {
  db.insert(ajustes)
    .values({ clave, valor })
    .onConflictDoUpdate({ target: ajustes.clave, set: { valor } })
    .run();
}

/**
 * Devuelve el valor guardado, o lo crea con `generar` si es la primera vez.
 *
 * Es la operacion que importa para la identidad del dispositivo: tiene que ser
 * estable entre arranques, porque el `origin_device_id` de cada fila ya escrita
 * apunta a ella.
 */
export function leerOCrear(db: BaseDeDatos, clave: string, generar: () => string): string {
  const existente = leerAjuste(db, clave);
  if (existente !== null) return existente;
  const nuevo = generar();
  escribirAjuste(db, clave, nuevo);
  return nuevo;
}
