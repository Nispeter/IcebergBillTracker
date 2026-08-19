import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta } from './cuentas';
import { listarMovimientos, obtenerMovimiento } from './movimientos';
import {
  borrarRegla, crearRegla, desmarcar, editarRegla, instanciaDe, listarReglas,
  marcarOmitida, marcarPagada, obtenerRegla, proyectarTempanos,
} from './reglas';

const d = dates.requirePlainDate;

let base: BaseDePrueba;
let cuentaId: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  cuentaId = crearCuenta(base.db, base.contexto, { nombre: 'Cuenta corriente', tipo: 'corriente' }).id;
});

afterEach(() => base.cerrar());

const nueva = (parcial: Partial<Parameters<typeof crearRegla>[2]> = {}) =>
  crearRegla(base.db, base.contexto, {
    cuentaId,
    tipo: 'gasto',
    montoMinor: 450_000,
    nombre: 'Arriendo',
    categoriaId: 'vivienda',
    frecuencia: 'mensual',
    cada: 1,
    desde: d('2026-01-05'),
    ...parcial,
  });

describe('crear y editar reglas', () => {
  it('guarda la regla completa y nace activa', () => {
    const regla = nueva();
    expect(regla.nombre).toBe('Arriendo');
    expect(regla.montoMinor).toBe(450_000);
    expect(regla.activa).toBe(1);
    expect(regla.hasta).toBeNull();
  });

  it('rechaza una regla que no se puede calcular', () => {
    expect(() => nueva({ cada: 0 })).toThrow();
    expect(() => nueva({ hasta: d('2025-01-01') })).toThrow();
  });

  it('rechaza monto negativo: el signo lo da el tipo', () => {
    expect(() => nueva({ montoMinor: -1 })).toThrow();
  });

  it('rechaza nombre vacio', () => {
    expect(() => nueva({ nombre: '   ' })).toThrow();
  });

  it('editar valida la regla resultante, no solo lo que llega', () => {
    // `cada` viene bien pero el resultado combinado con lo guardado no sirve.
    const regla = nueva();
    expect(() => editarRegla(base.db, base.contexto, regla.id, { hasta: d('2020-01-01') })).toThrow();
  });

  it('apagar una regla la deja fuera de la proyeccion sin perderla', () => {
    const regla = nueva();
    editarRegla(base.db, base.contexto, regla.id, { activa: false });

    expect(listarReglas(base.db, base.contexto)).toHaveLength(1);
    expect(proyectarTempanos(base.db, base.contexto, dates.yearRange(2026), d('2026-08-19'))).toHaveLength(0);
  });

  it('borrar deja lapida: no se lista ni proyecta', () => {
    const regla = nueva();
    expect(borrarRegla(base.db, base.contexto, regla.id)).toBe(true);
    expect(obtenerRegla(base.db, base.contexto, regla.id)).toBeNull();
    expect(listarReglas(base.db, base.contexto)).toHaveLength(0);
  });
});

describe('proyectarTempanos', () => {
  it('el 5 de cada mes da doce tempanos en el ano', () => {
    nueva();
    const tempanos = proyectarTempanos(base.db, base.contexto, dates.yearRange(2026), d('2026-08-19'));
    expect(tempanos).toHaveLength(12);
    expect(tempanos.every((t) => t.estado === 'pendiente')).toBe(true);
    expect(tempanos[0]!.ocurreEn).toBe('2026-01-05');
  });

  it('vienen ordenados por fecha aunque las reglas se hayan creado al reves', () => {
    nueva({ nombre: 'Luz', desde: d('2026-08-20'), montoMinor: 32_000 });
    nueva({ nombre: 'Arriendo', desde: d('2026-08-05') });
    const tempanos = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempanos.map((t) => t.regla.nombre)).toEqual(['Arriendo', 'Luz']);
  });

  it('los dias restantes son negativos cuando ya vencio', () => {
    nueva({ desde: d('2026-08-05') });
    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.diasRestantes).toBe(-14);
  });

  it('cero dias restantes es hoy', () => {
    nueva({ desde: d('2026-08-19') });
    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.diasRestantes).toBe(0);
  });

  it('hereda el monto de la regla mientras nadie lo cambie', () => {
    nueva({ desde: d('2026-08-05') });
    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.montoMinor).toBe(450_000);
  });

  it('subir el monto de la regla mueve todo lo que aun no se paga', () => {
    // Es la razon de no materializar las ocurrencias: no hay filas que migrar.
    const regla = nueva({ desde: d('2026-08-05') });
    editarRegla(base.db, base.contexto, regla.id, { montoMinor: 500_000 });
    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.montoMinor).toBe(500_000);
  });
});

describe('marcar pagada', () => {
  it('deja la ocurrencia pagada y crea el movimiento', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'));

    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.estado).toBe('pagada');
    expect(tempano!.movimientoId).not.toBeNull();

    const movimientos = listarMovimientos(base.db, base.contexto);
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]!.nombre).toBe('Arriendo');
    expect(movimientos[0]!.montoMinor).toBe(450_000);
    expect(movimientos[0]!.ocurridoEn).toBe('2026-08-05');
    expect(movimientos[0]!.categoriaId).toBe('vivienda');
  });

  it('acepta un monto distinto al de la regla y lo recuerda', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'), 470_000);

    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.montoMinor).toBe(470_000);
    expect(listarMovimientos(base.db, base.contexto)[0]!.montoMinor).toBe(470_000);
  });

  it('pagar un mes con otro monto no contagia a los demas', () => {
    const regla = nueva();
    marcarPagada(base.db, base.contexto, regla.id, d('2026-02-05'), 470_000);
    const tempanos = proyectarTempanos(base.db, base.contexto, dates.yearRange(2026), d('2026-08-19'));

    expect(tempanos.find((t) => t.ocurreEn === '2026-02-05')!.montoMinor).toBe(470_000);
    expect(tempanos.find((t) => t.ocurreEn === '2026-03-05')!.montoMinor).toBe(450_000);
  });

  it('no se puede pagar dos veces la misma fecha', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'));
    expect(() => marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'))).toThrow();
  });

  it('la misma fecha en reglas distintas son decisiones distintas', () => {
    const arriendo = nueva({ desde: d('2026-08-05') });
    const luz = nueva({ nombre: 'Luz', desde: d('2026-08-05'), montoMinor: 32_000 });
    marcarPagada(base.db, base.contexto, arriendo.id, d('2026-08-05'));

    const tempanos = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempanos.find((t) => t.regla.id === arriendo.id)!.estado).toBe('pagada');
    expect(tempanos.find((t) => t.regla.id === luz.id)!.estado).toBe('pendiente');
  });

  it('revienta si la regla no existe, en vez de crear un movimiento huerfano', () => {
    expect(() => marcarPagada(base.db, base.contexto, 'no-existe', d('2026-08-05'))).toThrow();
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
  });
});

describe('marcar omitida', () => {
  it('deja la ocurrencia omitida y no crea movimiento: no hubo gasto', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    marcarOmitida(base.db, base.contexto, regla.id, d('2026-08-05'));

    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.estado).toBe('omitida');
    expect(tempano!.movimientoId).toBeNull();
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
  });

  it('omitir un mes no toca los otros', () => {
    const regla = nueva();
    marcarOmitida(base.db, base.contexto, regla.id, d('2026-02-05'));
    const tempanos = proyectarTempanos(base.db, base.contexto, dates.yearRange(2026), d('2026-08-19'));
    expect(tempanos.filter((t) => t.estado === 'omitida')).toHaveLength(1);
    expect(tempanos.filter((t) => t.estado === 'pendiente')).toHaveLength(11);
  });
});

describe('desmarcar', () => {
  it('vuelve a dejarla pendiente y borra el movimiento que habia creado', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    const instancia = marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'));

    expect(desmarcar(base.db, base.contexto, regla.id, d('2026-08-05'))).toBe(true);

    const [tempano] = proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'));
    expect(tempano!.estado).toBe('pendiente');
    // El movimiento se creo por la marca, asi que se va con ella: dejarlo suelto
    // seria un gasto que nadie reclama.
    expect(obtenerMovimiento(base.db, base.contexto, instancia.movimientoId!)).toBeNull();
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
  });

  it('deshacer una omitida no busca ningun movimiento', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    marcarOmitida(base.db, base.contexto, regla.id, d('2026-08-05'));
    expect(desmarcar(base.db, base.contexto, regla.id, d('2026-08-05'))).toBe(true);
    expect(instanciaDe(base.db, base.contexto, regla.id, d('2026-08-05'))).toBeNull();
  });

  it('desmarcar algo que nunca se marco no hace nada', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    expect(desmarcar(base.db, base.contexto, regla.id, d('2026-08-05'))).toBe(false);
  });

  it('despues de desmarcar se puede volver a pagar', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'));
    desmarcar(base.db, base.contexto, regla.id, d('2026-08-05'));
    expect(() => marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'))).not.toThrow();
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(1);
  });
});

describe('borrar la regla no reescribe la historia', () => {
  it('el movimiento ya pagado sobrevive al borrado de la regla', () => {
    const regla = nueva({ desde: d('2026-08-05') });
    marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'));
    borrarRegla(base.db, base.contexto, regla.id);

    // La proyeccion desaparece, el gasto real no: se pago de verdad.
    expect(proyectarTempanos(base.db, base.contexto, dates.monthRange(2026, 8), d('2026-08-19'))).toHaveLength(0);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(1);
  });
});
