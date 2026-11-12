/**
 * Elegir una cartola y convertirla en una matriz de celdas: la única pieza del
 * importador que toca la plataforma. `core/csv` recibe la matriz, así que
 * parsear, deduplicar y categorizar se prueba en Node sin abrir nada.
 *
 * Los bytes se leen distinto en cada lado: en web el selector da un `blob:`
 * que se busca con `fetch`; en Android, una ruta `content://` que solo
 * `expo-file-system` sabe leer. El camino de web se probó con las siete
 * cartolas reales; el de Android, no.
 */

import type { csv } from '@iceberg/core';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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

/** Abre el selector y devuelve la primera hoja como matriz, o `null` si se cancela. */
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
