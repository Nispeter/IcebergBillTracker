import { describe, expect, it } from 'vitest';
import { DateError, requirePlainDate } from './plainDate';
import {
  containsDate, currentMonth, dateRange, dayRange, eachDate, lastNDays, lengthInDays, monthRange,
  nextPeriod, overlaps, periodContaining, previousPeriod, quarterRange, sameRangeLastYear,
  trailingRange, weekRange, yearRange, yearToDate,
} from './range';

const d = requirePlainDate;
const ends = (r: { start: string; end: string }) => [r.start, r.end];

describe('construccion', () => {
  it('rechaza un rango que termina antes de empezar', () => {
    expect(() => dateRange(d('2026-04-13'), d('2026-04-01'))).toThrow(DateError);
  });

  it('acepta un rango de un solo dia', () => {
    expect(lengthInDays(dateRange(d('2026-04-13'), d('2026-04-13')))).toBe(1);
  });

  it('dayRange es un solo dia', () => {
    expect(ends(dayRange(d('2026-08-19')))).toEqual(['2026-08-19', '2026-08-19']);
    expect(lengthInDays(dayRange(d('2026-08-19')))).toBe(1);
  });

  it('weekRange va de lunes a domingo', () => {
    // 2026-08-19 es miercoles.
    expect(ends(weekRange(d('2026-08-19')))).toEqual(['2026-08-17', '2026-08-23']);
    expect(lengthInDays(weekRange(d('2026-08-19')))).toBe(7);
  });

  it('estando en lunes, la semana arranca ese mismo dia', () => {
    expect(ends(weekRange(d('2026-08-17')))).toEqual(['2026-08-17', '2026-08-23']);
  });

  it('estando en domingo, la semana es la que ya termina', () => {
    // Es lo que distingue lunes de domingo como primer dia: con semanas que
    // arrancan el domingo, sabado y domingo caen en semanas distintas.
    expect(ends(weekRange(d('2026-08-23')))).toEqual(['2026-08-17', '2026-08-23']);
  });

  it('weekRange cruza el fin de mes sin problema', () => {
    expect(ends(weekRange(d('2026-09-01')))).toEqual(['2026-08-31', '2026-09-06']);
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
  it('de un dia da el dia anterior', () => {
    expect(ends(previousPeriod(dayRange(d('2026-08-01'))))).toEqual(['2026-07-31', '2026-07-31']);
  });

  it('de una semana da la semana anterior completa', () => {
    expect(ends(previousPeriod(weekRange(d('2026-08-19'))))).toEqual(['2026-08-10', '2026-08-16']);
  });

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
    expect(previousPeriod(dayRange(d('2026-08-19'))).kind).toBe('day');
    expect(previousPeriod(weekRange(d('2026-08-19'))).kind).toBe('week');
    expect(previousPeriod(monthRange(2026, 3)).kind).toBe('month');
    expect(previousPeriod(lastNDays(30, d('2026-04-13'))).kind).toBe('days');
  });
});

describe('sameRangeLastYear', () => {
  it('de un dia da el mismo dia del ano pasado', () => {
    expect(ends(sameRangeLastYear(dayRange(d('2026-08-19'))))).toEqual(['2025-08-19', '2025-08-19']);
  });

  it('de una semana da una semana completa, no siete dias corridos', () => {
    // 2025-08-19 es martes, asi que su semana va del lunes 18 al domingo 24.
    expect(ends(sameRangeLastYear(weekRange(d('2026-08-19'))))).toEqual(['2025-08-18', '2025-08-24']);
  });

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

describe('nextPeriod', () => {
  it('es el inverso de previousPeriod', () => {
    for (const rango of [
      dayRange(d('2026-08-19')),
      weekRange(d('2026-08-19')),
      monthRange(2026, 8),
      quarterRange(2026, 2),
      yearRange(2026),
    ]) {
      expect(nextPeriod(previousPeriod(rango))).toEqual(rango);
      expect(previousPeriod(nextPeriod(rango))).toEqual(rango);
    }
  });

  it('de febrero da marzo completo, no 28 dias despues', () => {
    expect(ends(nextPeriod(monthRange(2026, 2)))).toEqual(['2026-03-01', '2026-03-31']);
  });

  it('de diciembre da enero del ano siguiente', () => {
    expect(ends(nextPeriod(monthRange(2026, 12)))).toEqual(['2027-01-01', '2027-01-31']);
  });

  it('de una semana da la semana siguiente completa', () => {
    expect(ends(nextPeriod(weekRange(d('2026-08-19'))))).toEqual(['2026-08-24', '2026-08-30']);
  });

  it('de un rango libre avanza su propio largo sin solaparse', () => {
    const rango = dateRange(d('2026-04-10'), d('2026-04-19'));
    const siguiente = nextPeriod(rango);
    expect(ends(siguiente)).toEqual(['2026-04-20', '2026-04-29']);
    expect(overlaps(rango, siguiente)).toBe(false);
  });

  it('conserva el tipo', () => {
    expect(nextPeriod(weekRange(d('2026-08-19'))).kind).toBe('week');
    expect(nextPeriod(monthRange(2026, 3)).kind).toBe('month');
  });
});

describe('periodContaining', () => {
  it('devuelve el mes que envuelve la fecha, sin cambiar de tipo', () => {
    const agosto = monthRange(2026, 8);
    expect(periodContaining(agosto, d('2026-05-17')))
      .toEqual(monthRange(2026, 5));
  });

  it('sirve para los otros rangos de calendario', () => {
    expect(periodContaining(dayRange(d('2026-09-01')), d('2026-04-03')))
      .toEqual(dayRange(d('2026-04-03')));
    // 2026-04-03 es viernes: la semana va del lunes 30 de marzo al domingo 5.
    expect(periodContaining(weekRange(d('2026-09-01')), d('2026-04-03')))
      .toEqual(weekRange(d('2026-04-03')));
    expect(periodContaining(yearRange(2026), d('2019-07-07')))
      .toEqual(yearRange(2019));
  });

  it('la fecha que ya esta dentro devuelve el mismo periodo', () => {
    const agosto = monthRange(2026, 8);
    expect(periodContaining(agosto, d('2026-08-31'))).toEqual(agosto);
  });

  it('un rango libre retrocede de a un largo hasta alcanzar la fecha', () => {
    // Diez dias: del 21 al 30 de agosto. Cuarenta dias antes, dos ventanas atras.
    const libre = dateRange(d('2026-08-21'), d('2026-08-30'), 'custom');
    const encontrado = periodContaining(libre, d('2026-08-15'));
    expect(encontrado.start).toBe('2026-08-11');
    expect(encontrado.end).toBe('2026-08-20');
    expect(encontrado.kind).toBe('custom');
  });

  it('un rango libre tambien avanza si la fecha quedo adelante', () => {
    const libre = dateRange(d('2026-08-01'), d('2026-08-10'), 'custom');
    const encontrado = periodContaining(libre, d('2026-08-25'));
    expect(encontrado.start).toBe('2026-08-21');
    expect(encontrado.end).toBe('2026-08-30');
  });

  it('con una fecha absurda se topa en vez de colgarse', () => {
    const libre = dateRange(d('2026-08-01'), d('2026-08-10'), 'custom');
    // Un dedazo al importar: no tiene que devolver nada bueno, tiene que volver.
    expect(() => periodContaining(libre, d('1900-01-01'))).not.toThrow();
  });
});

describe('trailingRange', () => {
  it('la semana termina hoy y dura siete dias, no ocho', () => {
    // 2026-09-01 es martes. Del miercoles anterior al martes: un dia de cada uno.
    const r = trailingRange('week', d('2026-09-01'));
    expect(r.start).toBe('2026-08-26');
    expect(r.end).toBe('2026-09-01');
    expect(lengthInDays(r)).toBe(7);
  });

  it('el mes termina hoy y no arrastra un dia de mas', () => {
    const r = trailingRange('month', d('2026-09-01'));
    expect(r.start).toBe('2026-08-02');
    expect(r.end).toBe('2026-09-01');
    expect(lengthInDays(r)).toBe(31);
  });

  it('el ano termina hoy', () => {
    const r = trailingRange('year', d('2026-09-01'));
    expect(r.start).toBe('2025-09-02');
    expect(r.end).toBe('2026-09-01');
    expect(lengthInDays(r)).toBe(365);
  });

  it('sale como rango de dias, asi que el anterior son los dias justo antes', () => {
    const r = trailingRange('month', d('2026-09-01'));
    expect(r.kind).toBe('days');
    const previo = previousPeriod(r);
    expect(previo.end).toBe('2026-08-01');
    expect(lengthInDays(previo)).toBe(lengthInDays(r));
  });

  it('el mes se apoya en el fin de mes cuando el dia no existe atras', () => {
    // No hay 31 de febrero: `addMonths` acota, y el rango sigue siendo valido.
    const r = trailingRange('month', d('2026-03-30'));
    expect(r.end).toBe('2026-03-30');
    expect(r.start).toBe('2026-03-01');
  });

  it('cruza el ano sin despeinarse', () => {
    const r = trailingRange('month', d('2026-01-10'));
    expect(r.start).toBe('2025-12-11');
  });
});
