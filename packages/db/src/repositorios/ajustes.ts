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

/**
 * Que categorias cuentan como compromiso fijo, en JSON.
 *
 * Era una lista fija en el codigo --vivienda, servicios, deudas, ahorros,
 * impuestos-- y es una suposicion que no le calza a todo el mundo: hay quien
 * paga el arriendo con tarjeta y lo lleva en deudas, y quien ahorra cuando
 * sobra en vez de todos los meses.
 *
 * Ausente significa "usa la lista de siempre", asi que nadie tiene que
 * configurar nada para que la app siga funcionando igual.
 */
export const CLAVE_CATEGORIAS_COMPROMETIDAS = 'categoriasComprometidas';

/**
 * La carpeta compartida donde viven los archivos de sincronizacion.
 *
 * En Android es la URI `content://` que devolvio el selector del sistema, con
 * permiso permanente; en web es un centinela y el permiso real vive en
 * IndexedDB. Ver `apps/mobile/datos/carpeta.ts`.
 *
 * Se guarda aca y no en el respaldo por la misma razon que el resto de la tabla
 * de ajustes: **nunca se exporta**. Cada aparato elige su propia carpeta, y una
 * URI de otro telefono no significaria nada en este.
 */
export const CLAVE_CARPETA = 'carpetaCompartida';

/**
 * La URI del archivo que escribe este aparato dentro de la carpeta.
 *
 * Se guarda porque **no hay forma de encontrarlo por nombre**: el listado de
 * SAF devuelve URIs, y en Drive la URI es un identificador opaco que no
 * contiene el nombre del archivo. Ver `apps/mobile/datos/carpeta.ts`.
 *
 * Va en `ajustes`, que nunca se exporta, por lo mismo que la carpeta: es una
 * direccion de este telefono y en otro no significaria nada.
 */
export const CLAVE_ARCHIVO_PROPIO = 'archivoPropio';

export function leerAjuste(db: BaseDeDatos, clave: string): string | null {
  const filas = db.select().from(ajustes).where(eq(ajustes.clave, clave)).limit(1).all();
  return filas[0]?.valor ?? null;
}

/**
 * La consulta sin ejecutar de un ajuste, para poder observarla.
 *
 * `leerAjuste` sirve para leer una vez; esta es para que una pantalla se entere
 * cuando el valor cambia, que es lo que hace falta cuando se edita en Ajustes y
 * el Resumen tiene que recalcular.
 */
export function consultaDeAjuste(db: BaseDeDatos, clave: string) {
  return db.select().from(ajustes).where(eq(ajustes.clave, clave)).limit(1);
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
