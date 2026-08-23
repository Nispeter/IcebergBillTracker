/**
 * Una pasada por la carpeta compartida.
 *
 * Son tres pasos --leer lo que dejaron los otros, fusionarlo, y dejar el archivo
 * propio al día-- y acá está solamente el primero y el último, que son los que
 * tocan el sistema de archivos. Lo del medio vive en `db/repositorios/carpeta`,
 * separado justamente para poder probarlo sin abrir nada.
 */

import { pasarPorCarpeta, type BaseDeDatos, type Contexto, type PasadaPorCarpeta } from '@iceberg/db';
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
  const propio = nombreDelPropio(contexto);
  const ajenos = await leerCarpeta(carpeta, propio);
  const pasada = pasarPorCarpeta(db, contexto, ajenos, opciones);
  await escribirEnCarpeta(carpeta, propio, pasada.propio);
  return pasada;
}
