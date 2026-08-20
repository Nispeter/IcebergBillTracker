/**
 * Elegir un archivo de cartola y convertirlo en una matriz de celdas.
 *
 * Es la unica pieza del importador que toca la plataforma. `core/csv` recibe la
 * matriz y no sabe de archivos, asi que todo lo que sigue —parsear, deduplicar,
 * categorizar— se prueba en Node sin abrir nada.
 *
 * Leer los bytes se hace distinto en cada lado y no hay forma de evitarlo: en
 * web el picker devuelve un `blob:` que se busca con `fetch`, y en Android una
 * ruta `content://` que solo `expo-file-system` sabe leer.
 *
 * Se usa la API **nueva** de `expo-file-system` (`File`, `Paths`). En SDK 57 la
 * vieja —`readAsStringAsync` y compania— se movio a `expo-file-system/legacy` y
 * ya no sale del import normal.
 *
 * **El camino de Android no esta probado**: la app todavia no corre en un
 * telefono. El de web si, con las siete cartolas reales.
 */

import type { csv } from '@iceberg/core';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

export interface ArchivoElegido {
  readonly nombre: string;
  readonly matriz: csv.Matriz;
}

/** Extensiones que el picker deja elegir. */
const TIPOS = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

/**
 * Abre el selector y devuelve la primera hoja como matriz.
 *
 * `null` si el usuario cancela, que no es un error.
 */
export async function elegirCartola(): Promise<ArchivoElegido | null> {
  const elegido = await DocumentPicker.getDocumentAsync({
    type: TIPOS,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (elegido.canceled) return null;

  const archivo = elegido.assets[0];
  if (archivo === undefined) return null;

  const libro = Platform.OS === 'web'
    ? XLSX.read(await (await fetch(archivo.uri)).arrayBuffer(), { type: 'array' })
    : XLSX.read(await new FileSystem.File(archivo.uri).base64(), { type: 'base64' });

  const primera = libro.SheetNames[0];
  if (primera === undefined) throw new Error('El archivo no tiene ninguna hoja.');
  const hoja = libro.Sheets[primera];
  if (hoja === undefined) throw new Error('El archivo no tiene ninguna hoja.');

  // `header: 1` devuelve filas como arreglos, y `defval: null` conserva las
  // celdas vacias en su posicion: sin eso las columnas se corren.
  const matriz = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  }) as csv.Matriz;

  return { nombre: archivo.name, matriz };
}

/**
 * Guarda un respaldo en un archivo que el usuario pueda quedarse.
 *
 * En web se arma un blob y se dispara la descarga con un `<a download>`, que es
 * lo unico que un navegador deja hacer sin permisos. En Android se escribe en el
 * directorio de la app y se abre la hoja de compartir, porque escribir directo
 * en Descargas necesita permisos que no vale la pena pedir para esto.
 */
export async function guardarRespaldo(nombre: string, contenido: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Sin esto el blob queda en memoria hasta que se cierre la pestaña, y un
    // respaldo de anos de historial no es chico.
    URL.revokeObjectURL(url);
    return;
  }

  const archivo = new FileSystem.File(FileSystem.Paths.document, nombre);
  // Se reescribe si ya existe: dos respaldos del mismo dia comparten nombre.
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(contenido);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(archivo.uri, { mimeType: 'application/json' });
  }
}

/** Abre el selector y devuelve el JSON ya parseado. `null` si se cancela. */
export async function elegirRespaldo(): Promise<{ nombre: string; datos: unknown } | null> {
  const elegido = await DocumentPicker.getDocumentAsync({
    type: ['application/json'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (elegido.canceled) return null;

  const archivo = elegido.assets[0];
  if (archivo === undefined) return null;

  const texto = Platform.OS === 'web'
    ? await (await fetch(archivo.uri)).text()
    : await new FileSystem.File(archivo.uri).text();

  return { nombre: archivo.name, datos: JSON.parse(texto) as unknown };
}
