import { describe, expect, it } from 'vitest';
import { addDays, requirePlainDate } from '../dates/index';
import {
  detectarRecurrentes, frecuenciaDe, normalizarNombre, type MovimientoObservado,
} from './deteccion';

const d = requirePlainDate;
const HOY = d('2026-08-19');

/** Una serie regular: `veces` cobros de `monto` cada `cadaDias`, hacia atras. */
function serie(
  nombre: string,
  monto: number,
  cadaDias: number,
  veces: number,
  ultima = d('2026-08-05'),
  categoriaId: string | null = 'servicios',
): MovimientoObservado[] {
  return Array.from({ length: veces }, (_, i) => ({
    nombre,
    montoMinor: monto,
    ocurridoEn: addDays(ultima, -cadaDias * (veces - 1 - i)),
    categoriaId,
  }));
}

describe('normalizarNombre', () => {
  it('junta mayusculas, espacios de sobra y espacios repetidos', () => {
    expect(normalizarNombre('  ENEL   S.A. ')).toBe('enel s.a.');
    expect(normalizarNombre('Enel S.A.')).toBe('enel s.a.');
  });
});

describe('frecuenciaDe', () => {
  it('reconoce los ciclos habituales', () => {
    expect(frecuenciaDe(7)).toEqual({ frecuencia: 'semanal', cada: 1 });
    expect(frecuenciaDe(14)).toEqual({ frecuencia: 'semanal', cada: 2 });
    expect(frecuenciaDe(30)).toEqual({ frecuencia: 'mensual', cada: 1 });
    expect(frecuenciaDe(365)).toEqual({ frecuencia: 'anual', cada: 1 });
  });

  it('acepta un mes de 28 y uno de 31: los meses no miden lo mismo', () => {
    expect(frecuenciaDe(28)?.frecuencia).toBe('mensual');
    expect(frecuenciaDe(31)?.frecuencia).toBe('mensual');
  });

  it('descarta lo que no se parece a ningun ciclo', () => {
    expect(frecuenciaDe(20)).toBeNull();
    expect(frecuenciaDe(200)).toBeNull();
  });
});

describe('detectarRecurrentes', () => {
  it('propone una cuenta mensual con la mediana de lo pagado', () => {
    const candidatas = detectarRecurrentes(serie('Enel', 32_000, 30, 6), HOY);
    expect(candidatas).toHaveLength(1);
    expect(candidatas[0]).toMatchObject({
      nombre: 'Enel',
      montoMinor: 32_000,
      frecuencia: 'mensual',
      cada: 1,
      veces: 6,
      categoriaId: 'servicios',
    });
  });

  it('el ancla apunta hacia adelante, no a la ultima vista', () => {
    // Anclar en la ultima haria que la vista arrancara llena de vencidas falsas.
    const candidatas = detectarRecurrentes(serie('Enel', 32_000, 30, 6, d('2026-08-05')), HOY);
    expect(candidatas[0]!.desde >= HOY).toBe(true);
    expect(candidatas[0]!.desde).toBe('2026-09-04');
  });

  it('junta nombres que solo difieren en mayusculas y espacios', () => {
    const mezclado = serie('Enel', 32_000, 30, 6).map((m, i) => ({
      ...m,
      nombre: i % 2 === 0 ? 'ENEL ' : 'enel',
    }));
    expect(detectarRecurrentes(mezclado, HOY)).toHaveLength(1);
  });

  it('tolera que el monto varie: el agua sube en verano', () => {
    const variable = serie('Essbio', 16_000, 30, 6)
      .map((m, i) => ({ ...m, montoMinor: 16_000 + i * 800 }));
    const candidatas = detectarRecurrentes(variable, HOY);
    expect(candidatas).toHaveLength(1);
    expect(candidatas[0]!.montoMinor).toBeGreaterThan(16_000);
  });

  it('tolera que el cobro caiga uno o dos dias corrido', () => {
    const irregular = serie('VTR', 25_000, 30, 6)
      .map((m, i) => ({ ...m, ocurridoEn: addDays(m.ocurridoEn, i % 2 === 0 ? 0 : 2) }));
    expect(detectarRecurrentes(irregular, HOY)).toHaveLength(1);
  });

  it('acepta que una cuenta se duplique en invierno', () => {
    // La luz de la semilla va de $23.000 a $46.000 y es la misma cuenta.
    const estacional = serie('Enel', 30_000, 30, 8)
      .map((m, i) => ({ ...m, montoMinor: i % 2 === 0 ? 23_000 : 46_000 }));
    expect(detectarRecurrentes(estacional, HOY)).toHaveLength(1);
  });

  it('descarta un monto de otro orden: eso ya no es la misma cuenta', () => {
    const saltado = serie('Jumbo', 30_000, 30, 6)
      .map((m, i) => ({ ...m, montoMinor: i === 3 ? 200_000 : 30_000 }));
    expect(detectarRecurrentes(saltado, HOY)).toHaveLength(0);
  });

  it('descarta lo que ocurre a destiempo', () => {
    const caotico: MovimientoObservado[] = [
      { nombre: 'Uber', montoMinor: 4_000, ocurridoEn: d('2026-06-01') },
      { nombre: 'Uber', montoMinor: 4_000, ocurridoEn: d('2026-06-03') },
      { nombre: 'Uber', montoMinor: 4_000, ocurridoEn: d('2026-07-28') },
      { nombre: 'Uber', montoMinor: 4_000, ocurridoEn: d('2026-08-02') },
    ];
    expect(detectarRecurrentes(caotico, HOY)).toHaveLength(0);
  });

  it('con dos apariciones no alcanza: un salto no es un patron', () => {
    expect(detectarRecurrentes(serie('Enel', 32_000, 30, 2), HOY)).toHaveLength(0);
  });

  it('dos cobros el mismo dia no cuentan como dos vueltas del ciclo', () => {
    // El salto de cero dias arrastraria la mediana y la cuenta dejaria de
    // parecer mensual.
    const conDuplicado = [
      ...serie('Enel', 32_000, 30, 4),
      { nombre: 'Enel', montoMinor: 32_000, ocurridoEn: d('2026-08-05'), categoriaId: 'servicios' },
    ];
    const candidatas = detectarRecurrentes(conDuplicado, HOY);
    expect(candidatas).toHaveLength(1);
    expect(candidatas[0]!.frecuencia).toBe('mensual');
  });

  it('reconoce una semanal sin confundirla con mensual', () => {
    const candidatas = detectarRecurrentes(serie('Feria', 18_000, 7, 8), HOY);
    expect(candidatas[0]).toMatchObject({ frecuencia: 'semanal', cada: 1, cadaDias: 7 });
  });

  it('devuelve varias, la mas repetida primero', () => {
    const candidatas = detectarRecurrentes([
      ...serie('Enel', 32_000, 30, 4),
      ...serie('Feria', 18_000, 7, 10),
    ], HOY);
    expect(candidatas.map((c) => c.nombre)).toEqual(['Feria', 'Enel']);
  });

  it('sin movimientos no inventa nada', () => {
    expect(detectarRecurrentes([], HOY)).toEqual([]);
  });

  it('ignora los nombres vacios en vez de agruparlos entre si', () => {
    const sinNombre = serie('   ', 32_000, 30, 6);
    expect(detectarRecurrentes(sinNombre, HOY)).toEqual([]);
  });
});
