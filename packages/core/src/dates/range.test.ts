import { describe, expect, it } from 'vitest';
import { DateError, requirePlainDate } from './plainDate.js';
import {
  containsDate, currentMonth, dateRange, eachDate, lastNDays, lengthInDays, monthRange,
  overlaps, previousPeriod, quarterRange, sameRangeLastYear, yearRange, yearToDate,
} from './range.js';

const d = requirePlainDate;
const ends = (r: { start: string; end: string }) => [r.start, r.end];

describe('construccion', () => {
  it('rechaza un rango que termina antes de empezar', () => {
    expect(() => dateRange(d('2026-04-13'), d('2026-04-01'))).toThrow(DateError);
  });

  it('acepta un rango de un solo dia', () => {
    expect(lengthInDays(dateRange(d('2026-04-13'), d('2026-04-13')))).toBe(1);
  });

  it('monthRange cubre el mes completo, incluido febrero', () => {
    expect(ends(monthRange(2026, 4))).toEqual(['2026-04-01', '2026-04-30']);
    expect(ends(monthRange(2026, 2))).toEqual(['2026-02-01', '2026-02-28']);
    expect(ends(monthRange(2024, 2))).toEqual(['2024-02-01', '2024-02-29']);
  });

  it('quarterRange cubre los tres meses del trimestre', () => {
    expect(ends(quarterRange(2026, 1))).toEqual(['2026-01-01', '2026-03-31']);
    expect(ends(quarterRange(2026, 4))).toEqual(['2026-10-01', '2026-12-31']);
    expect(() => quarterRange(2026, 5)).toThrow(DateError);
  });

  it('yearRange cubre el ano completo', () => {
    expect(ends(yearRange(2026))).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('currentMonth toma el mes de la fecha de referencia', () => {
    expect(ends(currentMonth(d('2026-04-13')))).toEqual(['2026-04-01', '2026-04-30']);
  });

  it('lastNDays incluye la fecha de referencia como ultimo dia', () => {
    expect(ends(lastNDays(30, d('2026-04-13')))).toEqual(['2026-03-15', '2026-04-13']);
    expect(lengthInDays(lastNDays(30, d('2026-04-13')))).toBe(30);
    expect(ends(lastNDays(1, d('2026-04-13')))).toEqual(['2026-04-13', '2026-04-13']);
    expect(() => lastNDays(0, d('2026-04-13'))).toThrow(DateError);
  });

  it('yearToDate va del 1 de enero a la referencia', () => {
    expect(ends(yearToDate(d('2026-08-18')))).toEqual(['2026-01-01', '2026-08-18']);
  });
});

describe('consultas', () => {
  it('lengthInDays cuenta ambos extremos', () => {
    expect(lengthInDays(monthRange(2026, 1))).toBe(31);
    expect(lengthInDays(monthRange(2026, 2))).toBe(28);
    expect(lengthInDays(yearRange(2024))).toBe(366);
  });

  it('containsDate incluye los bordes', () => {
    const abril = monthRange(2026, 4);
    expect(containsDate(abril, d('2026-04-01'))).toBe(true);
    expect(containsDate(abril, d('2026-04-30'))).toBe(true);
    expect(containsDate(abril, d('2026-03-31'))).toBe(false);
    expect(containsDate(abril, d('2026-05-01'))).toBe(false);
  });

  it('overlaps detecta el solape, incluso de un solo dia', () => {
    expect(overlaps(monthRange(2026, 4), monthRange(2026, 5))).toBe(false);
    expect(overlaps(monthRange(2026, 4), lastNDays(1, d('2026-04-30')))).toBe(true);
    expect(overlaps(
      dateRange(d('2026-04-01'), d('2026-04-15')),
      dateRange(d('2026-04-15'), d('2026-04-30')),
    )).toBe(true);
  });

  it('eachDate entrega todas las fechas en orden', () => {
    const dias = eachDate(dateRange(d('2026-01-30'), d('2026-02-02')));
    expect(dias).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
    expect(eachDate(monthRange(2026, 2))).toHaveLength(28);
  });
});

describe('previousPeriod', () => {
  it('de un mes da el mes anterior completo, no 31 dias atras', () => {
    expect(ends(previousPeriod(monthRange(2026, 3)))).toEqual(['2026-02-01', '2026-02-28']);
    expect(ends(previousPeriod(monthRange(2026, 1)))).toEqual(['2025-12-01', '2025-12-31']);
  });

  it('de un trimestre da el trimestre anterior', () => {
    expect(ends(previousPeriod(quarterRange(2026, 2)))).toEqual(['2026-01-01', '2026-03-31']);
    expect(ends(previousPeriod(quarterRange(2026, 1)))).toEqual(['2025-10-01', '2025-12-31']);
  });

  it('de un ano da el ano anterior', () => {
    expect(ends(previousPeriod(yearRange(2026)))).toEqual(['2025-01-01', '2025-12-31']);
  });

  it('de N dias retrocede exactamente N dias, para que sean comparables', () => {
    const anterior = previousPeriod(lastNDays(30, d('2026-04-13')));
    expect(ends(anterior)).toEqual(['2026-02-13', '2026-03-14']);
    expect(lengthInDays(anterior)).toBe(30);
  });

  it('de un rango libre retrocede su propio largo sin solaparse', () => {
    const rango = dateRange(d('2026-04-10'), d('2026-04-19'));
    const anterior = previousPeriod(rango);
    expect(ends(anterior)).toEqual(['2026-03-31', '2026-04-09']);
    expect(overlaps(rango, anterior)).toBe(false);
  });

  it('de un YTD da el mismo tramo del ano pasado, no el ano completo', () => {
    expect(ends(previousPeriod(yearToDate(d('2026-08-18'))))).toEqual(['2025-01-01', '2025-08-18']);
  });

  it('conserva el tipo de rango', () => {
    expect(previousPeriod(monthRange(2026, 3)).kind).toBe('month');
    expect(previousPeriod(lastNDays(30, d('2026-04-13'))).kind).toBe('days');
  });
});

describe('sameRangeLastYear', () => {
  it('de un mes da el mismo mes completo del ano anterior', () => {
    expect(ends(sameRangeLastYear(monthRange(2026, 3)))).toEqual(['2025-03-01', '2025-03-31']);
  });

  it('de febrero bisiesto da febrero del ano anterior con sus 28 dias', () => {
    expect(ends(sameRangeLastYear(monthRange(2024, 2)))).toEqual(['2023-02-01', '2023-02-28']);
  });

  it('de un trimestre y de un ano', () => {
    expect(ends(sameRangeLastYear(quarterRange(2026, 2)))).toEqual(['2025-04-01', '2025-06-30']);
    expect(ends(sameRangeLastYear(yearRange(2026)))).toEqual(['2025-01-01', '2025-12-31']);
  });

  it('de N dias mantiene el mismo dia y mes un ano antes', () => {
    expect(ends(sameRangeLastYear(lastNDays(30, d('2026-04-13'))))).toEqual(['2025-03-15', '2025-04-13']);
  });
});
