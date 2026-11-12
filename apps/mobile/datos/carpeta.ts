/**
 * La carpeta compartida, el transporte de la sincronización: la app no habla
 * con ninguna nube. Se elige una carpeta con el selector del sistema y cada
 * teléfono escribe ahí su propio archivo; la nube los mueve como a cualquier
 * otro, y nadie escribe el archivo de otro, así que no hay conflictos de nube.
 *
 * - Nada se busca por nombre: en Drive la URI es un identificador opaco. Se
 *   guarda la URI del archivo propio, y lo ajeno es todo lo demás.
 * - Al elegir se crea la subcarpeta `Iceberg` y se guarda esa, para no leer
 *   todo lo que el usuario tenga en la suya.
 * - Android usa SAF (en `expo-file-system/legacy`, aislado acá para tocar un
 *   solo archivo el día que se mueva); web, la File System Access API, con el
 *   permiso guardado en IndexedDB y revalidado al tocar Sincronizar.
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

/** La subcarpeta que la app crea adentro de la que eligio el usuario. */
const SUBCARPETA = 'Iceberg';

/**
 * Ya no se puede entrar a la carpeta, con certeza: en web, el manejador no está
 * o el navegador niega el permiso. Quien la recibe suelta la carpeta guardada,
 * así que en Android no se usa: ahí los errores de SAF suben tal como vienen, y
 * un fallo de red no obliga a volver a elegirla.
 */
export class CarpetaPerdidaError extends Error {
  override name = 'CarpetaPerdidaError';

  constructor() {
    super('Ya no se puede entrar a esa carpeta. Vuelve a elegirla.');
  }
}

/**
 * El proveedor de la carpeta no deja escribir: algunas nubes exponen sus
 * carpetas solo para leer y el selector las ofrece igual. Se descubre al
 * elegirla, cuando todavía se puede elegir otra, y no días después.
 */
export class CarpetaDeSoloLecturaError extends Error {
  override name = 'CarpetaDeSoloLecturaError';

  constructor(causa: string) {
    super(
      'Esa carpeta no deja crear archivos, así que la app no puede sincronizar ahí. '
      + 'Le pasa a Google Drive: comparte sus carpetas solo para leer.\n\n'
      + 'Prueba con una carpeta del teléfono, o con otra nube cuyo proveedor sí deje '
      + `escribir.\n\nAndroid dijo: ${causa}`,
    );
  }
}

/** Corre una operación de SAF diciendo cuál era si falla: listar, crear y escribir fallan distinto. */
async function alIntentar<T>(que: string, hacer: () => Promise<T>): Promise<T> {
  try {
    return await hacer();
  } catch (e) {
    throw new Error(`No se pudo ${que}: ${(e as Error).message}`);
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
  getDirectoryHandle(nombre: string, opciones?: { create?: boolean }): Promise<ManejadorDeCarpeta>;
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

// ────────────────────────────── comun ──────────────────────────────

/**
 * Abre el selector de carpetas del sistema y prepara la subcarpeta.
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
      const elegida = await elegir({ mode: 'readwrite' });
      // La misma subcarpeta que en Android, para que las dos plataformas hagan
      // lo mismo: lo que hay adentro es nuestro y no hace falta distinguirlo de
      // lo que el usuario ya tuviera en la carpeta.
      const manejador = await elegida.getDirectoryHandle(SUBCARPETA, { create: true });
      await conLaBase((almacen) => almacen.put(manejador, 'carpeta'));
      return EN_EL_NAVEGADOR;
    } catch {
      // Cancelar tira `AbortError`, y cancelar no es un error.
      return null;
    }
  }

  const permiso = await SAF.requestDirectoryPermissionsAsync();
  if (!permiso.granted) return null;

  // Crear la subcarpeta es además la prueba de que se puede escribir.
  try {
    return await SAF.makeDirectoryAsync(permiso.directoryUri, SUBCARPETA);
  } catch (e) {
    throw new CarpetaDeSoloLecturaError((e as Error).message);
  }
}

/**
 * Un nombre corto de la carpeta, para mostrarlo. Si la URI es un identificador
 * opaco (Drive), se dice de qué proveedor es, que es lo único cierto.
 */
export function nombreDeCarpeta(carpeta: string): string {
  if (carpeta === EN_EL_NAVEGADOR) return 'la carpeta elegida';

  let cola: string;
  try {
    const entero = decodeURIComponent(carpeta);
    cola = entero.slice(entero.lastIndexOf('/') + 1);
  } catch {
    cola = carpeta;
  }

  // `acc=4;doc=encoded=...`: un identificador, no un nombre.
  if (cola.includes('=')) {
    const proveedor = carpeta.match(/com\.google\.android\.apps\.docs/) ? 'Google Drive' : 'tu nube';
    return `Una carpeta de ${proveedor}`;
  }

  const dosPuntos = cola.lastIndexOf(':');
  return dosPuntos === -1 ? cola : cola.slice(dosPuntos + 1);
}

/**
 * Escribe el archivo de este teléfono y devuelve su URI, para guardarla. Con la
 * URI de la vuelta anterior se escribe derecho; sin ella, se crea.
 */
export async function escribirEnCarpeta(
  carpeta: string, base: string, texto: string, archivoConocido: string | null,
): Promise<string> {
  if (carpeta === EN_EL_NAVEGADOR) {
    const manejador = await carpetaWeb();
    if (manejador === null) throw new CarpetaPerdidaError();
    const nombre = base + '.json';
    const archivo = await manejador.getFileHandle(nombre, { create: true });
    const escritura = await archivo.createWritable();
    await escritura.write(texto);
    await escritura.close();
    return nombre;
  }

  if (archivoConocido !== null) {
    try {
      await SAF.writeAsStringAsync(archivoConocido, texto);
      return archivoConocido;
    } catch {
      // El archivo pudo borrarse desde la nube o desde otro aparato. Se cae al
      // camino de crearlo: perder el archivo no puede dejar sin sincronizar.
    }
  }

  const uri = await alIntentar(
    'crear el archivo en la carpeta',
    () => SAF.createFileAsync(carpeta, base, 'application/json'),
  );
  await alIntentar('escribir el archivo', () => SAF.writeAsStringAsync(uri, texto));
  return uri;
}

/**
 * Lee lo que dejaron los otros teléfonos: todo menos el archivo propio. Lo que
 * no sea un respaldo lo descarta `pasarPorCarpeta`, que lo cuenta como cerrado.
 */
export async function leerCarpeta(
  carpeta: string, propio: string | null,
): Promise<ArchivoDeCarpeta[]> {
  const archivos: ArchivoDeCarpeta[] = [];

  if (carpeta === EN_EL_NAVEGADOR) {
    const manejador = await carpetaWeb();
    if (manejador === null) throw new CarpetaPerdidaError();
    for await (const nombre of manejador.keys()) {
      if (!nombre.endsWith('.json') || nombre === propio) continue;
      const archivo = await manejador.getFileHandle(nombre);
      archivos.push({ nombre, texto: await (await archivo.getFile()).text() });
    }
    return archivos;
  }

  const uris = await alIntentar('abrir la carpeta', () => SAF.readDirectoryAsync(carpeta));
  for (const uri of uris) {
    if (uri === propio) continue;
    try {
      archivos.push({ nombre: uri, texto: await SAF.readAsStringAsync(uri) });
    } catch {
      // Una subcarpeta, o un archivo que el proveedor no deja leer. No es
      // asunto nuestro y no puede cortar la pasada.
    }
  }
  return archivos;
}
