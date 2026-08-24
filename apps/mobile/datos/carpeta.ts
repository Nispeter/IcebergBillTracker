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
 * ## Nada se busca por nombre
 *
 * La primera version listaba la carpeta y buscaba su archivo por el nombre que
 * venia en la URI. **En Drive eso no existe.** Una URI de almacenamiento local
 * termina en `primary:Documents/Iceberg/iceberg-01ABC.json` y el nombre esta a
 * la vista; una de Drive termina en `acc=4;doc=encoded=6jU41736SetDJn6Zm...`,
 * que es un identificador opaco. `readDirectoryAsync` devuelve URIs y nada mas:
 * no hay forma de pedir el nombre para mostrar.
 *
 * Por eso ahora **se guarda la URI del archivo propio** y se escribe derecho
 * sobre ella. Y al leer, lo ajeno es "todo lo que hay menos esa URI": tampoco
 * hace falta el nombre.
 *
 * ## Una subcarpeta propia
 *
 * Al elegir se crea `Iceberg` adentro y se guarda **esa**. Sin eso, "todo lo que
 * hay menos lo mio" seria la carpeta entera del usuario --planillas, PDF, lo que
 * tenga-- y habria que abrir cada archivo para descubrir que no era nuestro.
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

/** La subcarpeta que la app crea adentro de la que eligio el usuario. */
const SUBCARPETA = 'Iceberg';

/**
 * Ya no se puede entrar a la carpeta.
 *
 * **Solo se usa cuando es seguro**, y en la practica eso es un caso: en web, que
 * el manejador guardado en IndexedDB no este o que el navegador niegue el
 * permiso. Ahi no hay nada que reintentar.
 *
 * En Android **no se usa**, y es a proposito. Antes cualquier error de SAF se
 * convertia en este, y quien llamaba borraba la carpeta guardada: un fallo
 * cualquiera --uno de red de Drive, por ejemplo-- dejaba al usuario teniendo que
 * volver a elegir la carpeta y sin saber que habia pasado, porque el mensaje
 * verdadero se perdia en el camino. Ahora los errores de SAF suben tal como
 * vienen.
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

  // La subcarpeta acota lo que hay que leer a lo que escribimos nosotros. Si el
  // proveedor no deja crearla se sigue con la carpeta elegida: peor que tenerla
  // es no poder sincronizar.
  try {
    return await SAF.makeDirectoryAsync(permiso.directoryUri, SUBCARPETA);
  } catch {
    return permiso.directoryUri;
  }
}

/**
 * Un nombre corto de la carpeta, para mostrarlo.
 *
 * En almacenamiento local la URI termina en algo legible; en Drive termina en un
 * identificador opaco y no hay de donde sacar el nombre. Ahi se dice de que
 * proveedor es, que es lo unico cierto que se puede decir.
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

  // `acc=4;doc=encoded=...` y compañia: un identificador, no un nombre.
  if (cola.includes('=')) {
    const proveedor = carpeta.match(/com\.google\.android\.apps\.docs/) ? 'Google Drive' : 'tu nube';
    return `Carpeta ${SUBCARPETA} en ${proveedor}`;
  }

  const dosPuntos = cola.lastIndexOf(':');
  return dosPuntos === -1 ? cola : cola.slice(dosPuntos + 1);
}

/**
 * Escribe el archivo de este aparato y devuelve su URI, para guardarla.
 *
 * `archivoConocido` es la URI de la vuelta anterior. Con ella se escribe derecho
 * y no hace falta listar nada; sin ella se crea el archivo. **Buscarlo por
 * nombre no es una opcion**: ver el encabezado de este archivo.
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

  const uri = await SAF.createFileAsync(carpeta, base, 'application/json');
  await SAF.writeAsStringAsync(uri, texto);
  return uri;
}

/**
 * Lee lo que dejaron los otros aparatos.
 *
 * Ajeno es **todo lo que hay menos el archivo propio**, identificado por su URI
 * y no por su nombre. Lo que no se pueda leer o no sea JSON se descarta mas
 * arriba, en `pasarPorCarpeta`, que lo cuenta como cerrado.
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

  for (const uri of await SAF.readDirectoryAsync(carpeta)) {
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
