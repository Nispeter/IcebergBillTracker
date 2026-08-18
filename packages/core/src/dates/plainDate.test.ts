import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, addYears, compareDates, DateError, day, daysBetween, daysInMonth,
  endOfMonth, formatDate, formatDateLong, isAfter, isBefore, isPlainDate, maxDate, minDate,
  month, parsePlainDate, plainDate, requirePlainDate, startOfMonth, today, weekday, year,
} from './plainDate.js';

const d = requirePlainDate;

describe('construccion', () => {
  it('arma la fecha con ceros a la izquierda', () => {
    expect(plainDate(2026, 4, 13)).toBe('2026-04-13');
    expect(plainDate(2026, 12, 1)).toBe('2026-12-01');
  });

  it('rechaza fechas que no existen en el calendario', () => {
    expect(() => plainDate(2026, 2, 30)).toThrow(DateError);
    expect(() => plainDate(2026, 13, 1)).toThrow(DateError);
    expect(() => plainDate(2026, 0, 1)).toThrow(DateError);
    expect(() => plainDate(2026, 4, 31)).toThrow(DateError);
  });

  it('acepta el 29 de febrero solo en ano bisiesto', () => {
    expect(plainDate(2024, 2, 29)).toBe('2024-02-29');
    expect(() => plainDate(2026, 2, 29)).toThrow(DateError);
  });

  it('daysInMonth cubre bisiestos y la regla del siglo', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe('parseo', () => {
  it('acepta YYYY-MM-DD y recorta espacios', () => {
    expect(parsePlainDate('2026-04-13')).toBe('2026-04-13');
    expect(parsePlainDate('  2026-04-13 ')).toBe('2026-04-13');
  });

  it('devuelve null con formato u fecha invalida', () => {
    expect(parsePlainDate('13/04/2026')).toBeNull();
    expect(parsePlainDate('2026-2-3')).toBeNull();
    expect(parsePlainDate('2026-02-30')).toBeNull();
    expect(parsePlainDate('')).toBeNull();
  });

  it('isPlainDate distingue, requirePlainDate lanza', () => {
    expect(isPlainDate('2026-04-13')).toBe(true);
    expect(isPlainDate('2026-02-30')).toBe(false);
    expect(() => requirePlainDate('nope')).toThrow(DateError);
  });
});

describe('componentes', () => {
  it('extrae ano, mes y dia', () => {
    expect(year(d('2026-04-13'))).toBe(2026);
    expect(month(d('2026-04-13'))).toBe(4);
    expect(day(d('2026-04-13'))).toBe(13);
  });
});

describe('today', () => {
  it('usa la fecha civil de Chile, no la del reloj UTC', () => {
    // 02:30 UTC del 18 todavia es el 17 en Chile (UTC-4).
    expect(today(new Date('2026-08-18T02:30:00Z'))).toBe('2026-08-17');
    expect(today(new Date('2026-08-18T13:00:00Z'))).toBe('2026-08-18');
  });
});

describe('aritmetica', () => {
  it('suma dias cruzando fin de mes y fin de ano', () => {
    expect(addDays(d('2026-01-30'), 3)).toBe('2026-02-02');
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2026-01-01'), -1)).toBe('2025-12-31');
  });

  it('sumar dias no se corre con el horario de verano chileno', () => {
    // Chile cambia de hora en septiembre y en abril; con aritmetica en UTC el
    // dia siempre dura 24 horas y no aparece un salto.
    expect(addDays(d('2026-09-05'), 1)).toBe('2026-09-06');
    expect(addDays(d('2026-04-04'), 1)).toBe('2026-04-05');
  });

  it('suma meses recortando al ultimo dia del mes destino', () => {
    expect(addMonths(d('2026-01-31'), 1)).toBe('2026-02-28');
    expect(addMonths(d('2024-01-31'), 1)).toBe('2024-02-29');
    expect(addMonths(d('2026-03-31'), -1)).toBe('2026-02-28');
    expect(addMonths(d('2026-01-15'), 12)).toBe('2027-01-15');
  });

  it('suma anos y recorta el 29 de febrero', () => {
    expect(addYears(d('2024-02-29'), 1)).toBe('2025-02-28');
    expect(addYears(d('2026-04-13'), -1)).toBe('2025-04-13');
  });

  it('rechaza cantidades no enteras', () => {
    expect(() => addDays(d('2026-04-13'), 1.5)).toThrow(DateError);
    expect(() => addMonths(d('2026-04-13'), 0.5)).toThrow(DateError);
  });

  it('inicio y fin de mes', () => {
    expect(startOfMonth(d('2026-04-13'))).toBe('2026-04-01');
    expect(endOfMonth(d('2026-04-13'))).toBe('2026-04-30');
    expect(endOfMonth(d('2026-02-05'))).toBe('2026-02-28');
  });

  it('daysBetween cuenta dias completos con signo', () => {
    expect(daysBetween(d('2026-04-13'), d('2026-04-20'))).toBe(7);
    expect(daysBetween(d('2026-04-20'), d('2026-04-13'))).toBe(-7);
    expect(daysBetween(d('2026-04-13'), d('2026-04-13'))).toBe(0);
    expect(daysBetween(d('2026-01-01'), d('2027-01-01'))).toBe(365);
  });
});

describe('comparacion', () => {
  it('compare ordena cronologicamente', () => {
    const orden = [d('2026-12-01'), d('2026-01-30'), d('2026-04-13')].sort(compareDates);
    expect(orden).toEqual(['2026-01-30', '2026-04-13', '2026-12-01']);
  });

  it('isBefore, isAfter, minDate y maxDate', () => {
    expect(isBefore(d('2026-01-30'), d('2026-04-13'))).toBe(true);
    expect(isAfter(d('2026-04-13'), d('2026-01-30'))).toBe(true);
    expect(minDate(d('2026-04-13'), d('2026-01-30'))).toBe('2026-01-30');
    expect(maxDate(d('2026-04-13'), d('2026-01-30'))).toBe('2026-04-13');
  });
});

describe('weekday', () => {
  it('devuelve 1 para lunes y 7 para domingo', () => {
    expect(weekday(d('2026-08-17'))).toBe(1);
    expect(weekday(d('2026-08-23'))).toBe(7);
  });
});

describe('formato', () => {
  it('formato corto chileno DD-MM-YYYY', () => {
    expect(formatDate(d('2026-04-13'))).toBe('13-04-2026');
    expect(formatDate(d('2026-12-01'))).toBe('01-12-2026');
  });

  it('formato largo en es-CL', () => {
    expect(formatDateLong(d('2026-08-18'))).toBe('18 de agosto de 2026');
  });
});
