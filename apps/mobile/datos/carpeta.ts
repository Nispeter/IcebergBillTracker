/**
 * La carpeta compartida: el transporte de la sincronizacion.
 *
 * La idea entera es que **la app no habla con ninguna nube**. El usuario elige
 * una carpeta con el selector del sistema --una de Drive, de Dropbox, de
 * OneDrive o del propio telefono-- y ahi adentro cada aparato escribe un archivo
 * con su nombre. La nube sincroniza esos archivos como sincroniza cualquier otro
 * archivo del usuario, y la app se limita a leer los que no son suyos.
 *
 * Lo que se gana: sin servidor, sin cuenta dentro de la app, sin OAuth y sin
 * claves de API. Y funciona igual con cualquier nube, porque el permiso es sobre
 * una carpeta y no sobre un proveedor.
 *
 * Lo que se pierde: **nadie avisa cuando el otro escribio**. Hay que ir a mirar,
 * asi que esto se pone al dia cuando alguien sincroniza, no en tiempo real.
 *
 * ## Un archivo por aparato
 *
 * Nadie escribe el archivo de otro. Asi no hay dos escritores sobre el mismo
 * archivo y el conflicto a nivel de nube desaparece: lo peor que puede pasar es
 * leer una version vieja del archivo ajeno, y la fusion es idempotente, asi que
 * la proxima pasada lo arregla sola.
 *
 * ## Dos plataformas
 *
 * En Android es SAF --el selector de carpetas del sistema--, que entrega permiso
 * permanente sobre la carpeta elegida. En web es la File System Access API, que
 * hace lo mismo con otro nombre; su permiso se guarda en IndexedDB y el
 * navegador lo revalida con un gesto del usuario, que es justamente el boton de
 * sincronizar.
 *
 * SAF vive en `expo-file-system/legacy`: la API nueva todavia no lo expone. Es
 * la unica parte del paquete con fecha de vencimiento y esta aislada aca a
 * proposito, para que el dia que se mueva haya que tocar un solo archivo.
 */

import { nombreDelArchivo, type ArchivoDeCarpeta, type Contexto } from '@iceberg/db';
import { StorageAccessFramework as SAF } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/** El archivo de este aparato. Sin extension: SAF la agrega segun el tipo. */
export const nombreDelPropio = nombreDelArchivo;
export type { ArchivoDeCarpeta, Contexto };

/** Si esta plataforma sabe abrir una carpeta. */
export const HAY_CARPETA = Platform.OS === 'android'
  || (Platform.OS === 'web' && typeof window !== 'undefined' && 'showDirectoryPicker' in window);

/** Centinela para web: el permiso real es el manejador guardado en IndexedDB. */
const EN_EL_NAVEGADOR = 'web';

/**
 * La carpeta ya no esta: se revoco el permiso, se borro, o se cambio de nube.
 *
 * Es un error aparte porque la salida es distinta a la de cualquier otro fallo:
 * no hay nada que reintentar, hay que volver a elegir la carpeta.
 */
export class CarpetaPerdidaError extends Error {
  override name = 'CarpetaPerdidaError';

  constructor() {
    super('Ya no se puede entrar a esa carpeta. Vuelve a elegirla.');
  }
}

// ─────────────────────────────── web ───────────────────────────────

interface Escritura { write(dato: string): Promise<void>; close(): Promise<void> }

interface ManejadorDeArchivo {
  createWritable(): Promise<Escritura>;
  getFile(): Promise<{ text(): Promise<string> }>;
}

interface ManejadorDeCarpeta {
  readonly name: string;
  keys(): AsyncIterableIterator<string>;
  getFileHandle(nombre: string, opciones?: { create?: boolean }): Promise<ManejadorDeArchivo>;
  /** Opcionales: no todos los manejadores los traen. Ver `carpetaWeb`. */
  queryPermission?(opciones: { mode: 'readwrite' }): Promise<string>;
  requestPermission?(opciones: { mode: 'readwrite' }): Promise<string>;
}

const BASE = 'iceberg-carpeta';
const ALMACEN = 'manejadores';

/**
 * IndexedDB y no `localStorage`: un manejador de carpeta es un objeto vivo del
 * navegador, no texto, y solo IndexedDB sabe guardarlo.
 */
function conLaBase<T>(hacer: (almacen: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const abrir = indexedDB.open(BASE, 1);
    abrir.onupgradeneeded = () => abrir.result.createObjectStore(ALMACEN);
    abrir.onerror = () => rechazar(abrir.error);
    abrir.onsuccess = () => {
      const tx = abrir.result.transaction(ALMACEN, 'readwrite');
      const pedido = hacer(tx.objectStore(ALMACEN));
      pedido.onsuccess = () => resolver(pedido.result as T);
      pedido.onerror = () => rechazar(pedido.error);
      tx.oncomplete = () => abrir.result.close();
    };
  });
}

/**
 * El manejador guardado, ya con permiso confirmado.
 *
 * `null` si el usuario revoco el permiso o borro los datos del sitio; quien
 * llame lo trata como "hay que volver a elegir la carpeta".
 */
async function carpetaWeb(): Promise<ManejadorDeCarpeta | null> {
  const manejador = await conLaBase<ManejadorDeCarpeta | undefined>(
    (almacen) => almacen.get('carpeta'),
  );
  if (manejador === undefined) return null;
  // Si el manejador no sabe de permisos es porque no los necesita: son parte de
  // la API del selector, no de todo manejador de carpeta.
  if (manejador.queryPermission === undefined) return manejador;
  if (await manejador.queryPermission({ mode: 'readwrite' }) === 'granted') return manejador;
  // Vuelve a pedirlo: el navegador solo lo concede dentro de un gesto del
  // usuario, y todas las llamadas a esto cuelgan de un boton.
  if (manejador.requestPermission === undefined) return null;
  if (await manejador.requestPermission({ mode: 'readwrite' }) === 'granted') return manejador;
  return null;
}

// ───────────────────────────── Android ─────────────────────────────

/**
 * El nombre de archivo dentro de una URI `content://`.
 *
 * SAF no entrega nombres sino URIs con el identificador del documento adentro,
 * escapado. El nombre es lo que va despues de la ultima barra una vez
 * desescapado.
 */
function nombreEnUri(uri: string): string {
  try {
    const entero = decodeURIComponent(uri);
    return entero.slice(entero.lastIndexOf('/') + 1);
  } catch {
    return uri;
  }
}

// ────────────────────────────── comun ──────────────────────────────

/**
 * Abre el selector de carpetas del sistema.
 *
 * Devuelve lo que hay que guardar para volver a entrar, o `null` si el usuario
 * cancela, que no es un error.
 */
export async function elegirCarpeta(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const elegir = (window as unknown as {
      showDirectoryPicker(o: { mode: 'readwrite' }): Promise<ManejadorDeCarpeta>;
    }).showDirectoryPicker;
    try {
      const manejador = await elegir({ mode: 'readwrite' });
      await conLaBase((almacen) => almacen.put(manejador, 'carpeta'));
      return EN_EL_NAVEGADOR;
    } catch {
      // Cancelar tira `AbortError`, y cancelar no es un error.
      return null;
    }
  }

  const permiso = await SAF.requestDirectoryPermissionsAsync();
  return permiso.granted ? permiso.directoryUri : null;
}

/** Un nombre corto de la carpeta, para mostrarlo. */
export function nombreDeCarpeta(carpeta: string): string {
  if (carpeta === EN_EL_NAVEGADOR) return 'la carpeta elegida';
  // La URI termina en algo como `primary%3ADocuments%2FIceberg`; lo legible es
  // lo que sigue a los dos puntos.
  const cola = nombreEnUri(carpeta);
  const dosPuntos = cola.lastIndexOf(':');
  return dosPuntos === -1 ? cola : cola.slice(dosPuntos + 1);
}

/**
 * Escribe el archivo de este aparato, reemplazando el anterior.
 *
 * `base` va **sin extension**: SAF la agrega segun el tipo. El archivo se busca
 * antes de crearlo porque `createFileAsync` no reemplaza, sino que inventa un
 * nombre nuevo si ya hay uno igual, y a la vuelta habria dos.
 */
export async function escribirEnCarpeta(
  carpeta: string, base: string, texto: string,
): Promise<void> {
  if (carpeta === EN_EL_NAVEGADOR) {
    const manejador = await carpetaWeb();
    if (manejador === null) throw new CarpetaPerdidaError();
    const archivo = await manejador.getFileHandle(base + '.json', { create: true });
    const escritura = await archivo.createWritable();
    await escritura.write(texto);
    await escritura.close();
    return;
  }

  let existentes: string[];
  try {
    existentes = await SAF.readDirectoryAsync(carpeta);
  } catch {
    throw new CarpetaPerdidaError();
  }
  const mio = existentes.find((uri) => nombreEnUri(uri).startsWith(base));
  const uri = mio ?? await SAF.createFileAsync(carpeta, base, 'application/json');
  await SAF.writeAsStringAsync(uri, texto);
}

/**
 * Lee los archivos de los otros aparatos.
 *
 * Se salta el propio --ya esta en la base-- y cualquier cosa que no termine en
 * `.json`, porque la carpeta es del usuario y adentro puede tener lo que quiera.
 */
export async function leerCarpeta(
  carpeta: string, propio: string,
): Promise<ArchivoDeCarpeta[]> {
  const archivos: ArchivoDeCarpeta[] = [];

  if (carpeta === EN_EL_NAVEGADOR) {
    const manejador = await carpetaWeb();
    if (manejador === null) throw new CarpetaPerdidaError();
    for await (const nombre of manejador.keys()) {
      if (!nombre.endsWith('.json') || nombre.startsWith(propio)) continue;
      const archivo = await manejador.getFileHandle(nombre);
      archivos.push({ nombre, texto: await (await archivo.getFile()).text() });
    }
    return archivos;
  }

  let uris: string[];
  try {
    uris = await SAF.readDirectoryAsync(carpeta);
  } catch {
    throw new CarpetaPerdidaError();
  }
  for (const uri of uris) {
    const nombre = nombreEnUri(uri);
    if (!nombre.endsWith('.json') || nombre.startsWith(propio)) continue;
    archivos.push({ nombre, texto: await SAF.readAsStringAsync(uri) });
  }
  return archivos;
}
