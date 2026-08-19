/**
 * Reglas de recurrencia: "el 5 de cada mes", "cada dos semanas".
 *
 * No es RRULE. RRULE tiene `BYMONTHDAY`, `BYSETPOS`, `WKST` y una docena de
 * campos mas que se combinan entre si, y la mayoria no describe ninguna cuenta
 * chilena. Aca la regla es **una fecha ancla y un paso**: el ancla ya dice el
 * dia del mes y el dia de la semana, asi que no hacen falta campos aparte que
 * puedan contradecirla. Menos estados invalidos que validar.
 *
 * | Se quiere | Regla |
 * |---|---|
 * | El 5 de cada mes | `mensual`, cada 1, ancla el 5 |
 * | Fin de mes | `mensual`, cada 1, ancla el 31 |
 * | Cada dos lunes | `semanal`, cada 2, ancla un lunes |
 * | Permiso de circulacion | `anual`, cada 1, ancla en marzo |
 * | Cada 15 dias | `diaria`, cada 15 |
 *
 * **Diferencia deliberada con RRULE**: con ancla el 31, RRULE se salta los meses
 * que no tienen 31. Aca cae al ultimo dia del mes, porque una cuenta que vence
 * "el 31" vence igual en febrero, y saltarse el mes seria decir que ese mes no
 * hay que pagarla.
 */

import {
  addDays, addMonths, addYears, compareDates, containsDate, day, daysBetween,
  isAfter, month, weekday, year, type DateRange, type PlainDate,
} from '../dates/index';

export type Frecuencia = 'diaria' | 'semanal' | 'mensual' | 'anual';

export interface ReglaDeRecurrencia {
  readonly frecuencia: Frecuencia;
  /** Cada cuantas unidades de la frecuencia. `2` con `semanal` es cada dos semanas. */
  readonly cada: number;
  /**
   * La primera ocurrencia, y el ancla de todas las demas.
   *
   * Cada ocurrencia se calcula **desde aca**, nunca desde la anterior. Encadenar
   * `addMonths` de a uno arrastra el recorte: 31 de enero da 28 de febrero, y
   * el siguiente paso daria 28 de marzo en vez de 31. Con ancla fija, marzo
   * vuelve a ser 31.
   */
  readonly desde: PlainDate;
  /** Ultimo dia en que puede ocurrir, inclusive. `null` si no termina. */
  readonly hasta: PlainDate | null;
}

export class ReglaError extends Error {
  override name = 'ReglaError';
}

/**
 * Por que una regla no sirve, o `null` si sirve.
 *
 * Devuelve el motivo en vez de un booleano porque el formulario tiene que poder
 * decir que esta mal, no solo que algo lo esta.
 */
export function validarRegla(regla: ReglaDeRecurrencia): string | null {
  if (!Number.isInteger(regla.cada) || regla.cada < 1) {
    return 'La repetición tiene que ser un número entero de al menos 1.';
  }
  if (regla.hasta !== null && isAfter(regla.desde, regla.hasta)) {
    return 'La fecha de término no puede ser anterior a la de inicio.';
  }
  return null;
}

function assertRegla(regla: ReglaDeRecurrencia): void {
  const problema = validarRegla(regla);
  if (problema !== null) throw new ReglaError(problema);
}

/**
 * La ocurrencia numero `n`, contando la del ancla como la cero.
 *
 * Siempre desde el ancla. Ver el comentario de `desde`.
 */
export function ocurrenciaEnesima(regla: ReglaDeRecurrencia, n: number): PlainDate {
  assertRegla(regla);
  if (!Number.isInteger(n) || n < 0) throw new ReglaError(`n debe ser entero y no negativo: ${n}`);

  const paso = regla.cada * n;
  switch (regla.frecuencia) {
    case 'diaria': return addDays(regla.desde, paso);
    case 'semanal': return addDays(regla.desde, paso * 7);
    case 'mensual': return addMonths(regla.desde, paso);
    case 'anual': return addYears(regla.desde, paso);
  }
}

/**
 * Cuantos pasos hay, aproximadamente, entre el ancla y una fecha.
 *
 * Es una estimacion para no arrancar a contar desde cero cuando el ancla es de
 * hace anos. Puede quedar corta o larga por uno; quien la use tiene que
 * ajustarse caminando, y por eso `ocurrencias` retrocede antes de avanzar.
 */
function pasosAproximados(regla: ReglaDeRecurrencia, hasta: PlainDate): number {
  const dias = daysBetween(regla.desde, hasta);
  switch (regla.frecuencia) {
    case 'diaria': return Math.floor(dias / regla.cada);
    case 'semanal': return Math.floor(dias / (regla.cada * 7));
    case 'mensual': {
      const meses = (year(hasta) - year(regla.desde)) * 12 + (month(hasta) - month(regla.desde));
      return Math.floor(meses / regla.cada);
    }
    case 'anual': return Math.floor((year(hasta) - year(regla.desde)) / regla.cada);
  }
}

/** Tope de seguridad: una regla diaria de un ano da 365, y nadie mira mas que eso. */
const MAX_OCURRENCIAS = 2000;

/**
 * Todas las ocurrencias que caen dentro del rango, en orden.
 *
 * Acotado por el rango, asi que una regla sin fecha de termino igual termina.
 */
export function ocurrencias(regla: ReglaDeRecurrencia, rango: DateRange): PlainDate[] {
  assertRegla(regla);

  // El ancla es la primera: nada ocurre antes.
  if (isAfter(regla.desde, rango.end)) return [];

  let n = Math.max(0, pasosAproximados(regla, rango.start));
  // La estimacion puede pasarse: se retrocede hasta quedar antes del rango o en
  // el ancla, y recien ahi se avanza. Asi no se pierde la primera ocurrencia.
  while (n > 0 && compareDates(ocurrenciaEnesima(regla, n), rango.start) >= 0) n -= 1;

  const salida: PlainDate[] = [];
  for (let i = 0; i < MAX_OCURRENCIAS; i += 1) {
    const fecha = ocurrenciaEnesima(regla, n + i);
    if (isAfter(fecha, rango.end)) break;
    if (regla.hasta !== null && isAfter(fecha, regla.hasta)) break;
    if (containsDate(rango, fecha)) salida.push(fecha);
  }
  return salida;
}

/**
 * La primera ocurrencia en o despues de `desde`. `null` si la regla ya termino.
 *
 * Es lo que necesita la vista de tempanos: "cuando vence lo proximo".
 */
export function proximaOcurrencia(
  regla: ReglaDeRecurrencia,
  desde: PlainDate,
): PlainDate | null {
  assertRegla(regla);
  if (regla.hasta !== null && isAfter(desde, regla.hasta)) return null;

  let n = Math.max(0, pasosAproximados(regla, desde));
  while (n > 0 && compareDates(ocurrenciaEnesima(regla, n), desde) >= 0) n -= 1;

  for (let i = 0; i < MAX_OCURRENCIAS; i += 1) {
    const fecha = ocurrenciaEnesima(regla, n + i);
    if (regla.hasta !== null && isAfter(fecha, regla.hasta)) return null;
    if (compareDates(fecha, desde) >= 0) return fecha;
  }
  return null;
}

/** Como se lee la regla en pantalla: "El 5 de cada mes". */
export function describirRegla(regla: ReglaDeRecurrencia): string {
  const diaAncla = day(regla.desde);
  switch (regla.frecuencia) {
    case 'diaria':
      return regla.cada === 1 ? 'Todos los días' : `Cada ${regla.cada} días`;
    case 'semanal': {
      const dia = DIAS[weekday(regla.desde) - 1];
      return regla.cada === 1 ? `Todos los ${dia}` : `Cada ${regla.cada} semanas, el ${dia}`;
    }
    case 'mensual': {
      // 29, 30 y 31 no existen todos los meses: el texto lo dice para que nadie
      // se sorprenda cuando febrero caiga el 28.
      const cola = diaAncla >= 29 ? ' (o el último si el mes es más corto)' : '';
      return regla.cada === 1
        ? `El ${diaAncla} de cada mes${cola}`
        : `El ${diaAncla} cada ${regla.cada} meses${cola}`;
    }
    case 'anual':
      return regla.cada === 1
        ? `Cada año el ${diaAncla} de ${MESES[month(regla.desde) - 1]}`
        : `Cada ${regla.cada} años el ${diaAncla} de ${MESES[month(regla.desde) - 1]}`;
  }
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
