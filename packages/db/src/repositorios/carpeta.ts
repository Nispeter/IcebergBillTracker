/**
 * Una pasada por la carpeta compartida, sin tocar ningún archivo.
 *
 * El transporte --abrir la carpeta, leer, escribir-- vive en la app, porque cada
 * plataforma lo hace distinto. Lo que vive acá es lo que pasa **entre** leer y
 * escribir: abrir cada archivo, fusionarlo, y armar el que hay que dejar.
 *
 * Está separado para poder probarlo: con dos bases y una carpeta de mentira
 * --un `Map`-- se verifica lo único que de verdad importa de F5, que es que dos
 * aparatos apuntando a la misma carpeta terminen viendo lo mismo.
 */

import { crypto } from '@iceberg/core';
import type { BaseDeDatos } from '../tipos';
import type { Contexto } from '../contexto';
import { exportarRespaldo } from './respaldo';
import { fusionarVarios, type ResultadoDeVarios } from './sincronizacion';

/** Un archivo de otro aparato, tal como salió de la carpeta. */
export interface ArchivoDeCarpeta {
  readonly nombre: string;
  readonly texto: string;
}

export interface PasadaPorCarpeta extends ResultadoDeVarios {
  /** Archivos de otros aparatos que había en la carpeta. */
  readonly encontrados: number;
  /**
   * Cuántos no se pudieron abrir: JSON roto, o cifrados con otra frase.
   *
   * Se cuentan en vez de cortar la pasada. En una carpeta compartida puede
   * quedar el archivo de alguien que usó otra frase, y eso no tiene por qué
   * dejar sin sincronizar a los demás.
   */
  readonly cerrados: number;
  /** El texto que hay que dejar en el archivo de este aparato. */
  readonly propio: string;
}

export interface OpcionesDePasada {
  /** Si no está vacía, el archivo propio sale cifrado y los ajenos se abren con ella. */
  readonly frase?: string;
  /** Fusionar igual los archivos que vengan de otro hogar. */
  readonly permitirOtroHogar?: boolean;
}

/** El nombre del archivo de un aparato, sin extensión. */
export function nombreDelArchivo(contexto: Contexto): string {
  return 'iceberg-' + contexto.deviceId;
}

/**
 * Fusiona lo que traen los archivos ajenos y devuelve el propio ya al día.
 *
 * **El propio se arma al final, después de fusionar.** Así el archivo que queda
 * en la carpeta ya incluye lo que se acaba de recibir, y dos aparatos convergen
 * en una pasada de cada uno en vez de dos.
 */
export function pasarPorCarpeta(
  db: BaseDeDatos,
  contexto: Contexto,
  ajenos: readonly ArchivoDeCarpeta[],
  opciones: OpcionesDePasada = {},
): PasadaPorCarpeta {
  const frase = (opciones.frase ?? '').trim();

  const abiertos: unknown[] = [];
  let cerrados = 0;
  for (const archivo of ajenos) {
    let datos: unknown;
    try {
      datos = JSON.parse(archivo.texto) as unknown;
    } catch {
      // Un JSON roto en la carpeta del usuario no es asunto nuestro.
      cerrados += 1;
      continue;
    }
    if (!crypto.esSobre(datos)) {
      abiertos.push(datos);
      continue;
    }
    if (frase === '') { cerrados += 1; continue; }
    try {
      abiertos.push(JSON.parse(crypto.descifrar(datos, frase)) as unknown);
    } catch {
      cerrados += 1;
    }
  }

  const resultado = fusionarVarios(db, contexto, abiertos, {
    permitirOtroHogar: opciones.permitirOtroHogar ?? false,
  });

  // **Solo lo sincronizable.** La carpeta es compartida: lo que este aparato
  // marcó como cuenta privada no puede salir de acá.
  const respaldo = exportarRespaldo(db, contexto, { soloSincronizables: true });
  const propio = frase === ''
    ? JSON.stringify(respaldo)
    : JSON.stringify(crypto.cifrar(JSON.stringify(respaldo), frase));

  return { ...resultado, encontrados: ajenos.length, cerrados, propio };
}
