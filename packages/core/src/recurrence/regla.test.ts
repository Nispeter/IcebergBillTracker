import { describe, expect, it } from 'vitest';
import { dateRange, monthRange, requirePlainDate, yearRange } from '../dates/index';
import {
  describirRegla, ocurrencias, ocurrenciaEnesima, proximaOcurrencia, validarRegla,
  type ReglaDeRecurrencia,
} from './regla';

const d = requirePlainDate;

const regla = (parcial: Partial<ReglaDeRecurrencia> = {}): ReglaDeRecurrencia => ({
  frecuencia: 'mensual',
  cada: 1,
  desde: d('2026-01-05'),
  hasta: null,
  ...parcial,
});

describe('ocurrencias mensuales', () => {
  it('el 5 de cada mes da 12 fechas en el año, todas el 5', () => {
    // El criterio de verificacion de F3, tal cual esta escrito en el plan.
    const fechas = ocurrencias(regla(), yearRange(2026));
    expect(fechas).toHaveLength(12);
    expect(fechas[0]).toBe('2026-01-05');
    expect(fechas[1]).toBe('2026-02-05');
    expect(fechas[11]).toBe('2026-12-05');
  });

  it('ancla el 31: cae al ultimo dia cuando el mes es mas corto', () => {
    // RRULE se saltaria febrero. Una cuenta que vence "el 31" vence igual en
    // febrero; saltarla diria que ese mes no hay que pagarla.
    const fechas = ocurrencias(regla({ desde: d('2026-01-31') }), yearRange(2026));
    expect(fechas).toHaveLength(12);
    expect(fechas[1]).toBe('2026-02-28');
    expect(fechas[3]).toBe('2026-04-30');
  });

  it('el recorte no se arrastra: despues de febrero vuelve a ser 31', () => {
    // El bug clasico. Encadenar addMonths de a uno daria 2026-03-28, porque el
    // paso partiria del 28 de febrero en vez del ancla.
    const fechas = ocurrencias(regla({ desde: d('2026-01-31') }), yearRange(2026));
    expect(fechas[2]).toBe('2026-03-31');
    expect(fechas[4]).toBe('2026-05-31');
  });

  it('el 29 existe en febrero solo si el año es bisiesto', () => {
    expect(ocurrencias(regla({ desde: d('2024-01-29') }), monthRange(2024, 2)))
      .toEqual(['2024-02-29']);
    expect(ocurrencias(regla({ desde: d('2026-01-29') }), monthRange(2026, 2)))
      .toEqual(['2026-02-28']);
  });

  it('cada dos meses salta uno', () => {
    expect(ocurrencias(regla({ cada: 2 }), yearRange(2026)))
      .toEqual(['2026-01-05', '2026-03-05', '2026-05-05', '2026-07-05', '2026-09-05', '2026-11-05']);
  });
});

describe('otras frecuencias', () => {
  it('semanal cae siempre el mismo dia de la semana', () => {
    // 2026-08-03 es lunes.
    const fechas = ocurrencias(regla({ frecuencia: 'semanal', desde: d('2026-08-03') }), monthRange(2026, 8));
    expect(fechas).toEqual(['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31']);
  });

  it('cada dos semanas son catorce dias, no medio mes', () => {
    const fechas = ocurrencias(
      regla({ frecuencia: 'semanal', cada: 2, desde: d('2026-08-03') }),
      monthRange(2026, 8),
    );
    expect(fechas).toEqual(['2026-08-03', '2026-08-17', '2026-08-31']);
  });

  it('diaria cada 15 no se desalinea al cambiar de mes', () => {
    const fechas = ocurrencias(
      regla({ frecuencia: 'diaria', cada: 15, desde: d('2026-01-01') }),
      dateRange(d('2026-02-01'), d('2026-03-31'), 'days'),
    );
    expect(fechas).toEqual(['2026-02-15', '2026-03-02', '2026-03-17']);
  });

  it('anual respeta el 29 de febrero: solo ocurre en bisiestos', () => {
    const fechas = ocurrencias(
      regla({ frecuencia: 'anual', desde: d('2024-02-29') }),
      dateRange(d('2024-01-01'), d('2028-12-31'), 'days'),
    );
    expect(fechas).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });
});

describe('limites del rango y de la regla', () => {
  it('no devuelve nada antes del ancla', () => {
    expect(ocurrencias(regla(), monthRange(2025, 12))).toEqual([]);
  });

  it('el ancla misma es la primera ocurrencia', () => {
    expect(ocurrencias(regla(), monthRange(2026, 1))).toEqual(['2026-01-05']);
  });

  it('corta en la fecha de termino, inclusive', () => {
    const fechas = ocurrencias(regla({ hasta: d('2026-03-05') }), yearRange(2026));
    expect(fechas).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
  });

  it('una regla sin termino igual termina: la acota el rango', () => {
    expect(ocurrencias(regla({ frecuencia: 'diaria' }), monthRange(2026, 8))).toHaveLength(31);
  });

  it('un ancla de hace años no pierde ni corre las fechas del rango', () => {
    // La estimacion de pasos podria quedar corta o larga por uno; el motor
    // retrocede antes de avanzar justamente por esto.
    const fechas = ocurrencias(regla({ desde: d('2015-01-05') }), monthRange(2026, 8));
    expect(fechas).toEqual(['2026-08-05']);
  });
});

describe('proximaOcurrencia', () => {
  it('devuelve la fecha misma si ese dia toca', () => {
    expect(proximaOcurrencia(regla(), d('2026-03-05'))).toBe('2026-03-05');
  });

  it('devuelve la siguiente si el dia ya paso', () => {
    expect(proximaOcurrencia(regla(), d('2026-03-06'))).toBe('2026-04-05');
  });

  it('devuelve el ancla si se pregunta desde antes', () => {
    expect(proximaOcurrencia(regla(), d('2020-01-01'))).toBe('2026-01-05');
  });

  it('devuelve null cuando la regla ya termino', () => {
    expect(proximaOcurrencia(regla({ hasta: d('2026-03-05') }), d('2026-04-01'))).toBeNull();
  });

  it('devuelve null si la ultima ocurrencia cae despues del termino', () => {
    // El termino cae entre dos ocurrencias: no hay ninguna que sirva.
    expect(proximaOcurrencia(regla({ hasta: d('2026-03-20') }), d('2026-03-10'))).toBeNull();
  });
});

describe('validarRegla', () => {
  it('acepta una regla sana', () => {
    expect(validarRegla(regla())).toBeNull();
  });

  it('rechaza repetir cero o menos veces', () => {
    expect(validarRegla(regla({ cada: 0 }))).not.toBeNull();
    expect(validarRegla(regla({ cada: -1 }))).not.toBeNull();
  });

  it('rechaza un cada fraccionario', () => {
    expect(validarRegla(regla({ cada: 1.5 }))).not.toBeNull();
  });

  it('rechaza terminar antes de empezar', () => {
    expect(validarRegla(regla({ hasta: d('2025-01-01') }))).not.toBeNull();
  });

  it('acepta terminar el mismo dia que empieza', () => {
    expect(validarRegla(regla({ hasta: d('2026-01-05') }))).toBeNull();
  });

  it('las funciones revientan con una regla invalida en vez de inventar fechas', () => {
    expect(() => ocurrenciaEnesima(regla({ cada: 0 }), 1)).toThrow();
    expect(() => ocurrencias(regla({ cada: 0 }), yearRange(2026))).toThrow();
  });
});

describe('describirRegla', () => {
  it('dice el dia del mes', () => {
    expect(describirRegla(regla())).toBe('El 5 de cada mes');
  });

  it('avisa del recorte cuando el dia no existe todos los meses', () => {
    expect(describirRegla(regla({ desde: d('2026-01-31') })))
      .toBe('El 31 de cada mes (o el último si el mes es más corto)');
  });

  it('nombra el dia de la semana', () => {
    expect(describirRegla(regla({ frecuencia: 'semanal', desde: d('2026-08-03') })))
      .toBe('Todos los lunes');
  });

  it('nombra el mes en las anuales', () => {
    expect(describirRegla(regla({ frecuencia: 'anual', desde: d('2026-03-01') })))
      .toBe('Cada año el 1 de marzo');
  });
});
