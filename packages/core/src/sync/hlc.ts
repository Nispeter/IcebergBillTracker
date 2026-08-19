/**
 * Reloj logico hibrido (HLC).
 *
 * Cada fila de la base lleva su `updated_at` como HLC, no como fecha. La razon
 * es el modo hogar: dos dispositivos editan la misma cuenta sin verse, y al
 * juntarse hay que decidir cual version gana. Con la hora del sistema eso falla
 * apenas un reloj esta corrido —cosa comun en telefonos— y la edicion mas nueva
 * pierde contra una vieja.
 *
 * El HLC toma lo mejor de los dos mundos: se apoya en la hora real, asi que los
 * valores se parecen a un timestamp y se pueden leer, pero **nunca retrocede** y
 * lleva un contador que desempata dentro del mismo milisegundo. Al recibir un
 * mensaje remoto adelanta el reloj local si hace falta, de modo que la relacion
 * causal queda registrada aunque los relojes de pared mientan.
 *
 * Se implementa **ahora**, en F1, aunque el motor de sync sea F5: si la columna
 * naciera como fecha habria que migrar todas las filas despues.
 */

export interface Hlc {
  /** Milisegundos desde epoch, nunca menor al ultimo visto. */
  readonly millis: number;
  /** Desempata dentro del mismo milisegundo. */
  readonly counter: number;
  /** Que dispositivo lo genero. Desempata cuando millis y counter coinciden. */
  readonly nodeId: string;
}

export class HlcError extends Error {
  override name = 'HlcError';
}

/**
 * Techo del contador. Pasado esto se avanza el milisegundo, porque el formato
 * de texto reserva 5 digitos y un contador mas largo dejaria de ordenar bien.
 */
const MAX_COUNTER = 99_999;

/**
 * Cuanto se acepta que el reloj de un dispositivo remoto vaya adelantado.
 *
 * Sin este tope, **un solo** dispositivo con la fecha mal puesta —el ano 2099,
 * por decir— envenena el HLC de todos los demas para siempre: al fusionar, cada
 * uno adopta ese milisegundo y ya nunca vuelve atras, asi que las ediciones de
 * los relojes correctos no pueden volver a ganar. Es un fallo permanente y
 * silencioso, y por eso se prefiere lanzar antes que absorberlo.
 */
export const MAX_DERIVA_MS = 5 * 60 * 1000;

/** 15 digitos alcanzan hasta el ano 33658; el padding es lo que hace ordenable el texto. */
const MILLIS_DIGITS = 15;
const COUNTER_DIGITS = 5;

// El nodeId no puede tener guiones —lo exige `assertNodeId`— asi que el patron
// tambien los rechaza. Si aceptara `(.+)`, un texto con guion parsearia bien y
// reventaria recien al volver a serializarlo.
const FORMATO = /^(\d{15})-(\d{5})-([^-]+)$/;

function assertNodeId(nodeId: string): void {
  if (nodeId.length === 0) throw new HlcError('nodeId vacio');
  // El guion es el separador del formato de texto: si aparece en el nodeId, el
  // parseo se rompe de una forma dificil de notar.
  if (nodeId.includes('-')) throw new HlcError(`nodeId no puede tener guiones: ${nodeId}`);
}

/**
 * El HLC de este instante, dado el ultimo conocido localmente.
 *
 * Si el reloj de pared avanzo, se usa; si no avanzo —o si retrocedio, que pasa
 * al ajustar la hora o al cambiar de zona— se conserva el milisegundo anterior y
 * se incrementa el contador. Asi el valor nunca retrocede.
 */
export function hlcNow(previo: Hlc | null, nodeId: string, wallClock: number): Hlc {
  assertNodeId(nodeId);
  if (!Number.isFinite(wallClock) || wallClock < 0) {
    throw new HlcError(`reloj invalido: ${wallClock}`);
  }
  const millis = Math.floor(wallClock);

  if (previo === null || millis > previo.millis) {
    return { millis, counter: 0, nodeId };
  }
  return avanzar(previo.millis, previo.counter, nodeId);
}

/**
 * Fusiona el reloj local con el de un mensaje que llega de otro dispositivo.
 *
 * Es la mitad que hace que el HLC registre causalidad: despues de recibir algo,
 * el reloj local queda por delante de lo recibido, asi que todo lo que se
 * escriba a continuacion se ordena **despues** de ese mensaje, aunque el reloj
 * de pared local este atrasado.
 */
export function hlcReceive(local: Hlc | null, remoto: Hlc, nodeId: string, wallClock: number): Hlc {
  assertNodeId(nodeId);

  if (remoto.millis - wallClock > MAX_DERIVA_MS) {
    throw new HlcError(
      `el reloj remoto va ${Math.round((remoto.millis - wallClock) / 1000)}s adelantado, `
      + `mas del maximo de ${MAX_DERIVA_MS / 1000}s`,
    );
  }

  const propio = hlcNow(local, nodeId, wallClock);

  if (remoto.millis > propio.millis) {
    return avanzar(remoto.millis, remoto.counter, nodeId);
  }
  if (remoto.millis === propio.millis && remoto.counter >= propio.counter) {
    return avanzar(propio.millis, remoto.counter, nodeId);
  }
  return propio;
}

function avanzar(millis: number, counter: number, nodeId: string): Hlc {
  if (counter >= MAX_COUNTER) {
    // Se acabaron los desempates de este milisegundo. Se toma prestado del
    // siguiente: el valor sigue sin retroceder, que es lo unico que importa.
    return { millis: millis + 1, counter: 0, nodeId };
  }
  return { millis, counter: counter + 1, nodeId };
}

/**
 * Texto ordenable: comparar dos HLC como strings da el mismo orden que
 * compararlos como estructuras. Eso permite que SQLite ordene por la columna
 * sin funciones propias, y que un `ORDER BY updated_at` signifique algo.
 */
export function hlcToString(hlc: Hlc): string {
  assertNodeId(hlc.nodeId);
  const millis = String(hlc.millis).padStart(MILLIS_DIGITS, '0');
  const counter = String(hlc.counter).padStart(COUNTER_DIGITS, '0');
  return `${millis}-${counter}-${hlc.nodeId}`;
}

/** Devuelve null en vez de lanzar: el texto puede venir de otro dispositivo. */
export function hlcParse(texto: string): Hlc | null {
  const match = FORMATO.exec(texto);
  if (!match) return null;
  const [, millis, counter, nodeId] = match;
  return { millis: Number(millis), counter: Number(counter), nodeId: nodeId! };
}

/** -1, 0 o 1. Sirve directo como comparador de `sort`. */
export function hlcCompare(a: Hlc, b: Hlc): number {
  if (a.millis !== b.millis) return a.millis < b.millis ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  if (a.nodeId === b.nodeId) return 0;
  return a.nodeId < b.nodeId ? -1 : 1;
}
