/**
 * Una pasada por la carpeta compartida: leer lo de los otros, fusionarlo y dejar
 * el archivo propio al día. Acá van los dos pasos que tocan archivos; la fusión
 * vive en `db/repositorios/carpeta`, donde se prueba sin abrir nada. También se
 * recuerda cuál es el archivo propio, que no se puede encontrar por nombre.
 *
 * La app sincroniza sola al abrirse, al irse al fondo, al volver de él, poco
 * después de cada cambio y cada minuto mientras está abierta. Por eso una pasada
 * sin nada nuevo tiene que salir casi gratis: descifrar y fusionar cuesta del
 * orden de un segundo en el teléfono, y reescribir el archivo haría que
 * FolderSync lo subiera entero cada vez.
 */

import {
  CLAVE_ARCHIVO_PROPIO, CLAVE_CARPETA, contenidoPropio, escribirAjuste, leerAjuste, pasarPorCarpeta,
  type BaseDeDatos, type Contexto, type PasadaPorCarpeta,
} from '@iceberg/db';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAvisar } from './aviso';
import { useDatos } from './BaseDeDatos';
import { escribirEnCarpeta, leerCarpeta, nombreDelPropio, type ArchivoDeCarpeta } from './carpeta';
import { useFraseDeCifrado } from './cifrado';
import { useAjuste } from './consultas';

/** Cada cuánto se sincroniza sola mientras la app está a la vista. */
const CADA_CUANTO = 60 * 1000;

/**
 * Cuánto se espera después de un cambio antes de escribirlo: lo justo para que
 * varios seguidos, como una importación, salgan en una sola pasada.
 */
const TRAS_UN_CAMBIO = 2000;

export interface OpcionesDeCarpeta {
  /** Si no está vacía, el archivo propio sale cifrado y los ajenos se abren con ella. */
  readonly frase: string;
  /** Fusionar igual los archivos que vengan de otro hogar. */
  readonly permitirOtroHogar?: boolean;
}

/**
 * Cómo quedó todo al terminar la última pasada. Vive en memoria, así que al
 * abrir la app la primera pasada es completa.
 */
interface Ultima {
  /** Carpeta, hogar y frase: si cambia alguno, lo anterior ya no sirve. */
  readonly clave: string;
  readonly contenido: string;
  readonly ajenos: ReadonlyMap<string, string>;
}

let ultima: Ultima | null = null;

/**
 * Las pasadas van de a una. Dos a la vez, antes de que exista el archivo
 * propio, crearían dos archivos para el mismo teléfono.
 */
let enCurso: Promise<unknown> = Promise.resolve();

function enFila<T>(hacer: () => Promise<T>): Promise<T> {
  const vuelta = enCurso.then(hacer);
  enCurso = vuelta.catch(() => {});
  return vuelta;
}

interface Lectura {
  readonly propio: string | null;
  readonly ajenos: ArchivoDeCarpeta[];
  readonly clave: string;
  /** La última pasada, si fue a esta misma carpeta y el archivo propio sigue ahí. */
  readonly anterior: Ultima | null;
}

async function leer(
  db: BaseDeDatos, contexto: Contexto, carpeta: string, frase: string,
): Promise<Lectura> {
  const propio = leerAjuste(db, CLAVE_ARCHIVO_PROPIO) || null;
  const { ajenos, estaElPropio } = await leerCarpeta(carpeta, propio);
  const clave = [carpeta, contexto.householdId, frase].join('\n');
  const anterior = ultima !== null && ultima.clave === clave && estaElPropio ? ultima : null;
  return { propio, ajenos, clave, anterior };
}

async function fusionarYEscribir(
  db: BaseDeDatos,
  contexto: Contexto,
  carpeta: string,
  opciones: OpcionesDeCarpeta,
  lectura: Lectura,
  aFusionar: readonly ArchivoDeCarpeta[] = lectura.ajenos,
): Promise<PasadaPorCarpeta> {
  const { propio, ajenos, clave, anterior } = lectura;
  const pasada = pasarPorCarpeta(db, contexto, aFusionar, {
    ...opciones, contenidoAnterior: anterior?.contenido,
  });

  if (pasada.propio !== null) {
    const escrito = await escribirEnCarpeta(
      carpeta, nombreDelPropio(contexto), pasada.propio, propio,
    );
    // Puede haber cambiado: la primera vez no había ninguno, y si el archivo se
    // borró desde la nube `escribirEnCarpeta` crea otro.
    if (escrito !== propio) escribirAjuste(db, CLAVE_ARCHIVO_PROPIO, escrito);
  }

  ultima = {
    clave,
    contenido: pasada.contenido,
    ajenos: new Map(ajenos.map((archivo) => [archivo.nombre, archivo.texto])),
  };
  return pasada;
}

/** Una pasada a pedido: completa siempre, para poder contar lo que encontró. */
export function sincronizarCarpeta(
  db: BaseDeDatos,
  contexto: Contexto,
  carpeta: string,
  opciones: OpcionesDeCarpeta,
): Promise<PasadaPorCarpeta> {
  return enFila(async () => fusionarYEscribir(
    db, contexto, carpeta, opciones, await leer(db, contexto, carpeta, opciones.frase),
  ));
}

/**
 * Una pasada automática. Devuelve `null` sin fusionar ni escribir nada si los
 * archivos ajenos son los mismos que la vez anterior y acá tampoco cambió nada.
 *
 * Si solo cambió lo de acá, escribe sin volver a fusionar: lo ajeno que no
 * cambió ya entró en la pasada anterior. La excepción es Empezar de cero, que
 * borra lo ya fusionado; eso vuelve en la próxima pasada completa, al abrir la
 * app o con Sincronizar ahora.
 */
export function sincronizarSiHayAlgoNuevo(
  db: BaseDeDatos,
  contexto: Contexto,
  carpeta: string,
  opciones: OpcionesDeCarpeta,
): Promise<PasadaPorCarpeta | null> {
  return enFila(async () => {
    const lectura = await leer(db, contexto, carpeta, opciones.frase);
    const { anterior, ajenos } = lectura;
    const mismosAjenos = anterior !== null
      && anterior.ajenos.size === ajenos.length
      && ajenos.every((archivo) => anterior.ajenos.get(archivo.nombre) === archivo.texto);
    if (mismosAjenos && contenidoPropio(db, contexto) === anterior.contenido) return null;
    return fusionarYEscribir(db, contexto, carpeta, opciones, lectura, mismosAjenos ? [] : ajenos);
  });
}

/**
 * No dibuja nada: sincroniza al abrir la app, al irse al fondo, al volver de
 * él, `TRAS_UN_CAMBIO` después de cada cambio y cada `CADA_CUANTO` mientras
 * está a la vista. Los errores se callan, porque nadie pidió esta pasada; se
 * ven al tocar Sincronizar ahora en Ajustes.
 */
export function SincronizarSola(): null {
  const { db, contexto } = useDatos();
  const carpeta = useAjuste(CLAVE_CARPETA) || null;
  const { frase } = useFraseDeCifrado();
  const avisar = useAvisar();

  useEffect(() => {
    if (carpeta === null || frase === '') return undefined;

    const pasar = () => {
      sincronizarSiHayAlgoNuevo(db, contexto, carpeta, { frase })
        .then((pasada) => {
          if (pasada === null) return;
          const { nuevas, actualizadas } = pasada.total;
          if (nuevas + actualizadas > 0) avisar(`Sincronizado: ${nuevas} nuevas, ${actualizadas} actualizadas`);
        })
        .catch(() => {});
    };

    pasar();
    let reloj = setInterval(pasar, CADA_CUANTO);
    // Al irse se pasa una vez más, para que lo recién anotado salga aunque se
    // cierre la app: Android deja correr unos segundos después de salir. Con la
    // app en el fondo no corren temporizadores, así que al volver se pasa de
    // inmediato y el reloj arranca de nuevo.
    const alCambiarDeEstado = AppState.addEventListener('change', (estado) => {
      clearInterval(reloj);
      pasar();
      if (estado === 'active') reloj = setInterval(pasar, CADA_CUANTO);
    });

    // Los ajustes no viajan en el archivo, y la pasada misma escribe uno.
    let espera: ReturnType<typeof setTimeout> | undefined;
    const alCambiarLaBase = addDatabaseChangeListener(({ tableName }) => {
      if (tableName === 'ajustes') return;
      clearTimeout(espera);
      espera = setTimeout(pasar, TRAS_UN_CAMBIO);
    });

    return () => {
      clearInterval(reloj);
      clearTimeout(espera);
      alCambiarDeEstado.remove();
      alCambiarLaBase.remove();
    };
  }, [db, contexto, carpeta, frase, avisar]);

  return null;
}
