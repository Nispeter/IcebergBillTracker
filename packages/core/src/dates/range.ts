/**
 * Rangos de fechas cerrados en ambos extremos.
 *
 * El rango guarda **de que tipo es** (`kind`), no solo sus extremos. Sin eso, el
 * "periodo anterior" no se puede calcular bien: el anterior de marzo es febrero,
 * que dura 28 dias, no "los 31 dias previos al 1 de marzo". Es exactamente la
 * comparacion que muestra Home, asi que el tipo tiene que sobrevivir en el dato.
 */

import {
  addDays, addMonths, addYears, compareDates, daysBetween, daysInMonth,
  DateError, endOfMonth, month, plainDate, startOfMonth, today, weekday, year,
  type PlainDate,
} from './plainDate';

export type RangeKind = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'days' | 'ytd' | 'custom';

export interface DateRange {
  readonly start: PlainDate;
  readonly end: PlainDate;
  readonly kind: RangeKind;
}

export function dateRange(start: PlainDate, end: PlainDate, kind: RangeKind = 'custom'): DateRange {
  if (compareDates(start, end) > 0) {
    throw new DateError(`el rango termina antes de empezar: ${start} a ${end}`);
  }
  return { start, end, kind };
}

/** Un solo dia. */
export function dayRange(fecha: PlainDate): DateRange {
  return dateRange(fecha, fecha, 'day');
}

/**
 * La semana que contiene la fecha, de **lunes a domingo**.
 *
 * Lunes y no domingo porque es la convencion ISO y la que se usa en Chile. La
 * diferencia importa: con semanas que arrancan el domingo, el fin de semana
 * queda partido entre dos semanas y el gasto de sabado y domingo —que suele ir
 * junto— se reparte en dos filas distintas.
 */
export function weekRange(fecha: PlainDate): DateRange {
  const lunes = addDays(fecha, -(weekday(fecha) - 1));
  return dateRange(lunes, addDays(lunes, 6), 'week');
}

/** Mes calendario completo. `month` va de 1 a 12. */
export function monthRange(y: number, m: number): DateRange {
  return dateRange(plainDate(y, m, 1), plainDate(y, m, daysInMonth(y, m)), 'month');
}

/** Trimestre calendario. `quarter` va de 1 a 4. */
export function quarterRange(y: number, quarter: number): DateRange {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new DateError(`trimestre fuera de rango: ${quarter}`);
  }
  const firstMonth = ((quarter - 1) * 3) + 1;
  const lastMonth = firstMonth + 2;
  return dateRange(
    plainDate(y, firstMonth, 1),
    plainDate(y, lastMonth, daysInMonth(y, lastMonth)),
    'quarter',
  );
}

export function yearRange(y: number): DateRange {
  return dateRange(plainDate(y, 1, 1), plainDate(y, 12, 31), 'year');
}

/** El mes calendario que contiene la fecha de referencia. */
export function currentMonth(reference: PlainDate = today()): DateRange {
  return dateRange(startOfMonth(reference), endOfMonth(reference), 'month');
}

/**
 * Los ultimos `count` dias contando la fecha de referencia como el ultimo.
 * `lastNDays(30)` cubre hoy y los 29 anteriores.
 */
export function lastNDays(count: number, reference: PlainDate = today()): DateRange {
  if (!Number.isInteger(count) || count < 1) {
    throw new DateError(`cantidad de dias invalida: ${count}`);
  }
  return dateRange(addDays(reference, -(count - 1)), reference, 'days');
}

/** Del 1 de enero a la fecha de referencia. */
export function yearToDate(reference: PlainDate = today()): DateRange {
  return dateRange(plainDate(year(reference), 1, 1), reference, 'ytd');
}

/** Dias que cubre el rango, contando ambos extremos. */
export function lengthInDays(range: DateRange): number {
  return daysBetween(range.start, range.end) + 1;
}

export function containsDate(range: DateRange, date: PlainDate): boolean {
  return compareDates(date, range.start) >= 0 && compareDates(date, range.end) <= 0;
}

export function overlaps(a: DateRange, b: DateRange): boolean {
  return compareDates(a.start, b.end) <= 0 && compareDates(b.start, a.end) <= 0;
}

/** Todas las fechas del rango, en orden. Para series diarias y calendarios. */
export function eachDate(range: DateRange): PlainDate[] {
  const dates: PlainDate[] = [];
  for (let cursor = range.start; compareDates(cursor, range.end) <= 0; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

/**
 * El periodo inmediatamente anterior, respetando el tipo de rango.
 *
 * Los rangos de calendario retroceden una unidad completa (marzo -> febrero).
 * Los demas retroceden su propio largo en dias, que es lo que hace comparables
 * "los ultimos 30 dias" con los 30 previos.
 */
export function previousPeriod(range: DateRange): DateRange {
  switch (range.kind) {
    case 'day':
      return dayRange(addDays(range.start, -1));
    case 'week':
      return weekRange(addDays(range.start, -7));
    case 'month': {
      const previous = addMonths(range.start, -1);
      return dateRange(startOfMonth(previous), endOfMonth(previous), 'month');
    }
    case 'quarter': {
      const previous = addMonths(range.start, -3);
      return quarterRange(year(previous), Math.floor((month(previous) - 1) / 3) + 1);
    }
    case 'year':
      return yearRange(year(range.start) - 1);
    case 'ytd': {
      // El mismo tramo del ano pasado, no el ano completo: comparar enero-agosto
      // contra doce meses daria siempre una caida.
      const start = plainDate(year(range.start) - 1, 1, 1);
      return dateRange(start, addYears(range.end, -1), 'ytd');
    }
    case 'days':
    case 'custom': {
      const length = lengthInDays(range);
      return dateRange(addDays(range.start, -length), addDays(range.end, -length), range.kind);
    }
  }
}

/**
 * El periodo siguiente del mismo tipo.
 *
 * Es el espejo de `previousPeriod` y existe por la navegacion: la barra de
 * periodo mueve el rango hacia atras y hacia adelante, y las dos direcciones
 * tienen que respetar el tipo. El siguiente de febrero es marzo, con sus 31
 * dias, no "28 dias despues".
 */
export function nextPeriod(range: DateRange): DateRange {
  switch (range.kind) {
    case 'day':
      return dayRange(addDays(range.end, 1));
    case 'week':
      return weekRange(addDays(range.start, 7));
    case 'month': {
      const siguiente = addMonths(startOfMonth(range.start), 1);
      return dateRange(startOfMonth(siguiente), endOfMonth(siguiente), 'month');
    }
    case 'quarter': {
      const siguiente = addMonths(range.start, 3);
      return quarterRange(year(siguiente), Math.floor((month(siguiente) - 1) / 3) + 1);
    }
    case 'year':
      return yearRange(year(range.start) + 1);
    case 'ytd': {
      const siguiente = addYears(range.start, 1);
      return dateRange(plainDate(year(siguiente), 1, 1), addYears(range.end, 1), 'ytd');
    }
    case 'days':
    case 'custom': {
      const largo = lengthInDays(range);
      return dateRange(addDays(range.start, largo), addDays(range.end, largo), range.kind);
    }
  }
}

/**
 * El mismo rango un ano antes. Para la comparacion interanual, que es la que
 * saca del medio la estacionalidad (marzo siempre trae gastos de colegio).
 *
 * Un rango de mes se mapea al mismo mes completo, no dia a dia, para que
 * febrero no quede comparado contra 28 de los 31 dias de marzo.
 */
export function sameRangeLastYear(range: DateRange): DateRange {
  switch (range.kind) {
    case 'day':
      return dayRange(addYears(range.start, -1));
    case 'week':
      // 52 semanas atras, no `addYears`. Restar un ano al lunes cae en otro dia
      // de la semana —2026-08-17 es lunes, 2025-08-17 es domingo— y devolveria
      // la semana anterior a la que uno quiere. 364 dias son exactamente 52
      // semanas, asi que siempre aterriza en lunes y la comparacion es de
      // semana completa contra semana completa, a un dia del calendario.
      return weekRange(addDays(range.start, -364));
    case 'month': {
      const previous = addYears(range.start, -1);
      return monthRange(year(previous), month(previous));
    }
    case 'quarter': {
      const previous = addYears(range.start, -1);
      return quarterRange(year(previous), Math.floor((month(previous) - 1) / 3) + 1);
    }
    case 'year':
      return yearRange(year(range.start) - 1);
    case 'ytd':
    case 'days':
    case 'custom':
      return dateRange(addYears(range.start, -1), addYears(range.end, -1), range.kind);
  }
}

/**
 * El periodo **del mismo tipo** que contiene la fecha.
 *
 * Es lo que hace falta para "llevame al periodo donde si hay datos": la app
 * conoce la fecha del ultimo movimiento anterior y necesita el mes --o la
 * semana, o el ano-- que lo envuelve, sin cambiar de tipo por el camino.
 *
 * Los rangos de calendario se calculan directo. Los que **no** tienen anclaje en
 * el calendario --un rango libre, "los ultimos 30 dias"-- no se pueden calcular:
 * su rejilla depende de donde arranco el que se esta mirando. Para esos se
 * retrocede o se avanza de periodo en periodo hasta dar con el que la contiene,
 * que es exactamente lo que haria alguien tocando la flecha.
 *
 * El tope de pasos existe para que una fecha absurda --un movimiento con ano
 * 1900 por un dedazo al importar-- no cuelgue la app. Al toparse devuelve el
 * ultimo periodo al que llego, que es lo mas cerca que pudo.
 */
export function periodContaining(range: DateRange, date: PlainDate): DateRange {
  switch (range.kind) {
    case 'day':
      return dayRange(date);
    case 'week':
      return weekRange(date);
    case 'month':
      return currentMonth(date);
    case 'quarter':
      return quarterRange(year(date), Math.floor((month(date) - 1) / 3) + 1);
    case 'year':
      return yearRange(year(date));
    case 'ytd':
    case 'days':
    case 'custom': {
      const TOPE = 4000;
      let cursor = range;
      for (let paso = 0; paso < TOPE && compareDates(date, cursor.start) < 0; paso += 1) {
        cursor = previousPeriod(cursor);
      }
      for (let paso = 0; paso < TOPE && compareDates(date, cursor.end) > 0; paso += 1) {
        cursor = nextPeriod(cursor);
      }
      return cursor;
    }
  }
}
