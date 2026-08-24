/**
 * Una pasada por la carpeta compartida.
 *
 * Son tres pasos --leer lo que dejaron los otros, fusionarlo, y dejar el archivo
 * propio al día-- y acá está solamente el primero y el último, que son los que
 * tocan el sistema de archivos. Lo del medio vive en `db/repositorios/carpeta`,
 * separado justamente para poder probarlo sin abrir nada.
 *
 * Acá también se recuerda **cuál es el archivo propio**, porque no se puede
 * encontrar por nombre: ver `carpeta.ts`.
 */

import {
  CLAVE_ARCHIVO_PROPIO, escribirAjuste, leerAjuste, pasarPorCarpeta,
  type BaseDeDatos, type Contexto, type PasadaPorCarpeta,
} from '@iceberg/db';
import { escribirEnCarpeta, leerCarpeta, nombreDelPropio } from './carpeta';

export interface OpcionesDeCarpeta {
  /** Si no está vacía, el archivo propio sale cifrado y los ajenos se abren con ella. */
  readonly frase: string;
  /** Fusionar igual los archivos que vengan de otro hogar. */
  readonly permitirOtroHogar?: boolean;
}

export async function sincronizarCarpeta(
  db: BaseDeDatos,
  contexto: Contexto,
  carpeta: string,
  opciones: OpcionesDeCarpeta,
): Promise<PasadaPorCarpeta> {
  const propio = leerAjuste(db, CLAVE_ARCHIVO_PROPIO) || null;

  const ajenos = await leerCarpeta(carpeta, propio);
  const pasada = pasarPorCarpeta(db, contexto, ajenos, opciones);

  const escrito = await escribirEnCarpeta(
    carpeta, nombreDelPropio(contexto), pasada.propio, propio,
  );
  // Puede haber cambiado: la primera vez no había ninguno, y si el archivo se
  // borró desde la nube `escribirEnCarpeta` crea otro.
  if (escrito !== propio) escribirAjuste(db, CLAVE_ARCHIVO_PROPIO, escrito);

  return pasada;
}
