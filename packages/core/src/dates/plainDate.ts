/**
 * Fecha civil sin hora ni zona horaria, como texto `YYYY-MM-DD`.
 *
 * Un movimiento ocurre "el 13 de abril", no "el 13 de abril a las 00:00 UTC".
 * Modelarlo con `Date` obliga a arrastrar zona horaria y horario de verano en
 * cada comparacion, y en Chile eso significa dos dias al ano en que un mes
 * empieza o termina corrido.
 *
 * El formato `YYYY-MM-DD` tiene ademas la propiedad de que su orden
 * lexicografico coincide con el cronologico, asi que ordenar y comparar es
 * comparar strings.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

declare const plainDateBrand: unique symbol;

export type PlainDate = string & { readonly [plainDateBrand]: true };

export class DateError extends Error {
  override name = 'DateError';
}

/** Zona horaria del proyecto. Toda fecha "de hoy" se resuelve en Chile continental. */
export const TIME_ZONE = 'America/Santiago';

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** Dias del mes, con anos bisiestos. `month` va de 1 a 12. */
export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new DateError(`mes fuera de rango: ${month}`);
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Construye una fecha validando que exista en el calendario. */
export function plainDate(year: number, month: number, day: number): PlainDate {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new DateError(`ano fuera de rango: ${year}`);
  }
  const last = daysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > last) {
    throw new DateError(`dia fuera de rango para ${year}-${pad(month, 2)}: ${day}`);
  }
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as PlainDate;
}

/** Parsea `YYYY-MM-DD`. Devuelve null si no existe (por ejemplo 2026-02-30). */
export function parsePlainDate(input: string): PlainDate | null {
  const match = ISO_DATE.exec(input.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  try {
    return plainDate(Number(y), Number(m), Number(d));
  } catch {
    return null;
  }
}

export function isPlainDate(input: string): input is PlainDate {
  return parsePlainDate(input) !== null;
}

/** Igual que `parsePlainDate` pero lanza. Para constantes y fixtures. */
export function requirePlainDate(input: string): PlainDate {
  const parsed = parsePlainDate(input);
  if (!parsed) throw new DateError(`fecha invalida: ${input}`);
  return parsed;
}

export function year(date: PlainDate): number {
  return Number(date.slice(0, 4));
}

export function month(date: PlainDate): number {
  return Number(date.slice(5, 7));
}

export function day(date: PlainDate): number {
  return Number(date.slice(8, 10));
}

/** La fecha de hoy en la zona indicada, no la del reloj UTC del dispositivo. */
export function today(now: Date = new Date(), timeZone: string = TIME_ZONE): PlainDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return requirePlainDate(`${get('year')}-${get('month')}-${get('day')}`);
}

/**
 * Se usa UTC como aritmetica interna porque no tiene horario de verano: un dia
 * siempre dura 24 horas y sumar dias nunca se corre.
 */
function toUtc(date: PlainDate): Date {
  return new Date(Date.UTC(year(date), month(date) - 1, day(date)));
}

function fromUtc(value: Date): PlainDate {
  return plainDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

export function addDays(date: PlainDate, amount: number): PlainDate {
  if (!Number.isInteger(amount)) throw new DateError(`dias debe ser entero: ${amount}`);
  const shifted = toUtc(date);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return fromUtc(shifted);
}

/**
 * Suma meses recortando al ultimo dia si el mes destino es mas corto:
 * 31 de enero + 1 mes = 28 de febrero.
 */
export function addMonths(date: PlainDate, amount: number): PlainDate {
  if (!Number.isInteger(amount)) throw new DateError(`meses debe ser entero: ${amount}`);
  const total = (year(date) * 12) + (month(date) - 1) + amount;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return plainDate(targetYear, targetMonth, Math.min(day(date), daysInMonth(targetYear, targetMonth)));
}

export function addYears(date: PlainDate, amount: number): PlainDate {
  return addMonths(date, amount * 12);
}

export function startOfMonth(date: PlainDate): PlainDate {
  return plainDate(year(date), month(date), 1);
}

export function endOfMonth(date: PlainDate): PlainDate {
  const y = year(date);
  const m = month(date);
  return plainDate(y, m, daysInMonth(y, m));
}

/** -1, 0 o 1. Sirve directo como comparador de `sort`. */
export function compareDates(a: PlainDate, b: PlainDate): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isBefore(a: PlainDate, b: PlainDate): boolean {
  return a < b;
}

export function isAfter(a: PlainDate, b: PlainDate): boolean {
  return a > b;
}

export function minDate(a: PlainDate, b: PlainDate): PlainDate {
  return a <= b ? a : b;
}

export function maxDate(a: PlainDate, b: PlainDate): PlainDate {
  return a >= b ? a : b;
}

/** Dias completos de `from` a `to`. Negativo si `to` es anterior. */
export function daysBetween(from: PlainDate, to: PlainDate): number {
  const millis = toUtc(to).getTime() - toUtc(from).getTime();
  return Math.round(millis / 86_400_000);
}

/** Dia de la semana ISO: 1 lunes … 7 domingo. */
export function weekday(date: PlainDate): number {
  return toUtc(date).getUTCDay() || 7;
}

/** `18-08-2026`, el formato corto que se usa en Chile. */
export function formatDate(date: PlainDate): string {
  return `${pad(day(date), 2)}-${pad(month(date), 2)}-${pad(year(date), 4)}`;
}

/** `18 de agosto de 2026`. */
export function formatDateLong(date: PlainDate): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(toUtc(date));
}
