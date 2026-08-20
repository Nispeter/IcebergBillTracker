import { describe, expect, it } from 'vitest';
import { requirePlainDate } from '../dates/index';
import { CARTOLA, NO_ES_CARTOLA, SIN_EMISION } from './__fixtures__/cartola';
import {
  anoDeFila, claveDeDedupe, comprobarCuadratura, detectarMapeo, parsearCartola,
  parsearFechaDeEmision, rangoDe, type Matriz,
} from './cartola';

const d = requirePlainDate;

const leer = (matriz: Matriz = CARTOLA) => {
  const resultado = parsearCartola(matriz);
  if (!resultado.ok) throw new Error(resultado.motivo);
  return resultado.cartola;
};

describe('detectarMapeo', () => {
  it('encuentra el encabezado y de que columna sale cada campo', () => {
    expect(detectarMapeo(CARTOLA)).toEqual({
      filaEncabezado: 24,
      fecha: 0,
      descripcion: 1,
      canal: 2,
      cargos: 3,
      abonos: 4,
      saldo: 5,
    });
  });

  it('lo busca en vez de fijar la fila 25', () => {
    // Una linea de mas en los metadatos no puede romper el importador.
    const corrida = [[], [], ...CARTOLA];
    expect(detectarMapeo(corrida)?.filaEncabezado).toBe(26);
  });

  it('devuelve null si no hay tabla de movimientos', () => {
    expect(detectarMapeo(NO_ES_CARTOLA)).toBeNull();
  });
});

describe('el ano que la fecha no trae', () => {
  it('parsea la emision aunque venga con espacio adelante', () => {
    expect(parsearFechaDeEmision(' 30/01/2026')).toBe('2026-01-30');
  });

  it('un mes posterior al de emision es del ano anterior', () => {
    // Caso real de cartola_30012026.xls: la primera fila es 30/12.
    expect(anoDeFila(12, d('2026-01-30'))).toBe(2025);
  });

  it('el mismo mes o uno anterior es del mismo ano', () => {
    expect(anoDeFila(1, d('2026-01-30'))).toBe(2026);
    expect(anoDeFila(11, d('2026-12-05'))).toBe(2026);
  });

  it('la fila de diciembre queda en el ano anterior, no en el de emision', () => {
    const cartola = leer();
    expect(cartola.emitidaEn).toBe('2026-01-30');
    // El SALDO INICIAL del 30/12 es centinela, pero fija el rollover; los
    // movimientos de enero tienen que quedar en 2026.
    expect(cartola.movimientos[0]!.ocurridoEn).toBe('2026-01-05');
  });

  it('sin fecha de emision falla en vez de adivinar el ano', () => {
    const resultado = parsearCartola(SIN_EMISION);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toMatch(/emisión/);
  });
});

describe('movimientos', () => {
  it('lee todos los movimientos y descarta las centinelas', () => {
    const cartola = leer();
    expect(cartola.movimientos).toHaveLength(6);
    expect(cartola.movimientos.some((m) => m.descripcion.includes('SALDO'))).toBe(false);
  });

  it('el signo sale de la columna, no del numero', () => {
    const cartola = leer();
    const sueldo = cartola.movimientos.find((m) => m.descripcion === 'ABONO REMUNERACION');
    const lider = cartola.movimientos.find((m) => m.descripcion === 'PAGO:SUPERMERCADO LIDER');
    expect(sueldo).toMatchObject({ tipo: 'ingreso', montoMinor: 850_000 });
    expect(lider).toMatchObject({ tipo: 'gasto', montoMinor: 45_000 });
  });

  it('los montos entran enteros: CLP no tiene decimales', () => {
    for (const movimiento of leer().movimientos) {
      expect(Number.isInteger(movimiento.montoMinor)).toBe(true);
      expect(movimiento.montoMinor).toBeGreaterThan(0);
    }
  });

  it('guarda el saldo solo donde el banco lo escribio', () => {
    const cartola = leer();
    const conSaldo = cartola.movimientos.filter((m) => m.saldoMinor !== null);
    expect(conSaldo.length).toBeLessThan(cartola.movimientos.length);
    expect(conSaldo.length).toBeGreaterThan(0);
  });

  it('ignora el pie legal y las filas vacias del final', () => {
    expect(leer().movimientos.some((m) => m.descripcion.includes('garantia'))).toBe(false);
  });

  it('conserva el canal', () => {
    expect(leer().movimientos[0]!.canal).toBe('INTERNET');
  });
});

describe('duplicados legitimos', () => {
  it('dos compras iguales el mismo dia son dos movimientos', () => {
    // Contraejemplo real de cartola_30042026.xls, filas 45 y 46.
    const repetidos = leer().movimientos.filter((m) => m.descripcion === 'PAGO:MERCADOPAGO*CONCE');
    expect(repetidos).toHaveLength(2);
  });

  it('y llevan claves distintas gracias al ordinal', () => {
    const repetidos = leer().movimientos.filter((m) => m.descripcion === 'PAGO:MERCADOPAGO*CONCE');
    expect(repetidos[0]!.clave).not.toBe(repetidos[1]!.clave);
  });

  it('las claves son estables: releer el mismo archivo da las mismas', () => {
    // Es lo que hace idempotente reimportar la misma cartola.
    expect(leer().movimientos.map((m) => m.clave)).toEqual(leer().movimientos.map((m) => m.clave));
  });

  it('todas las claves del archivo son distintas entre si', () => {
    const claves = leer().movimientos.map((m) => m.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('la clave cambia si cambia cualquier parte', () => {
    const base = claveDeDedupe(d('2026-01-12'), 'X', 1000, 'INTERNET', 0);
    expect(claveDeDedupe(d('2026-01-13'), 'X', 1000, 'INTERNET', 0)).not.toBe(base);
    expect(claveDeDedupe(d('2026-01-12'), 'Y', 1000, 'INTERNET', 0)).not.toBe(base);
    expect(claveDeDedupe(d('2026-01-12'), 'X', 1001, 'INTERNET', 0)).not.toBe(base);
    expect(claveDeDedupe(d('2026-01-12'), 'X', 1000, 'CENTRAL', 0)).not.toBe(base);
    expect(claveDeDedupe(d('2026-01-12'), 'X', 1000, 'INTERNET', 1)).not.toBe(base);
  });
});

describe('cuadratura', () => {
  it('la cartola completa cuadra contra el saldo del banco', () => {
    const cartola = leer();
    expect(cartola.saldoInicial?.amountMinor).toBe(380_000);
    expect(cartola.saldoFinal?.amountMinor).toBe(1_144_300);
    expect(cartola.cuadra).toBe(true);
  });

  it('perder un movimiento la rompe, que es para lo que sirve', () => {
    const cartola = leer();
    const incompleta = cartola.movimientos.slice(1);
    expect(comprobarCuadratura(incompleta, cartola.saldoInicial, cartola.saldoFinal)).toBe(false);
  });

  it('sin saldos declarados devuelve null en vez de mentir que cuadra', () => {
    expect(comprobarCuadratura([], null, null)).toBeNull();
  });
});

describe('errores', () => {
  it('una hoja que no es cartola falla con un motivo legible', () => {
    const resultado = parsearCartola(NO_ES_CARTOLA);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toMatch(/cartola/i);
  });

  it('una matriz vacia no revienta', () => {
    expect(parsearCartola([]).ok).toBe(false);
  });
});

describe('rangoDe', () => {
  it('devuelve el primer y el ultimo dia con movimiento', () => {
    expect(rangoDe(leer().movimientos)).toEqual({ desde: '2026-01-05', hasta: '2026-01-28' });
  });

  it('null si no hay movimientos', () => {
    expect(rangoDe([])).toBeNull();
  });
});
