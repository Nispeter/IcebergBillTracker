/**
 * La planilla editable desde Google Sheets.
 *
 * Lo que se cuida: que una planilla sin tocar no cambie nada, que lo que alguien
 * agrega, corrige o borra en ella llegue a la base, y que una versión vieja de
 * la planilla no borre lo que se anotó después en el teléfono.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta, editarCuenta } from './cuentas';
import { crearMovimiento, listarMovimientos } from './movimientos';
import {
  aplicarPlanilla, cuentasConPlanilla, filasDePlanilla, planillaAlDia,
  type FilaEscrita, type FilaLeida, type PlanillaLeida,
} from './planilla';

const d = dates.requirePlainDate;

let base: BaseDePrueba;
let cuentaId: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  cuentaId = crearCuenta(base.db, base.contexto, { nombre: 'Casa', tipo: 'corriente' }).id;
});

afterEach(() => base.cerrar());

function gasto(nombre: string, montoMinor: number, fecha = '2026-11-05', categoriaId: string | null = null) {
  return crearMovimiento(base.db, base.contexto, {
    cuentaId, tipo: 'gasto', montoMinor, ocurridoEn: d(fecha), nombre, categoriaId,
  });
}

/** Lo que Sheets devuelve de lo que la app escribió, sin que nadie lo toque. */
function comoQuedo(filas: readonly FilaEscrita[]): PlanillaLeida {
  return { cuentaId, idsEscritos: filas.map((f) => f.id), filas: filas.map((f) => ({ ...f })) };
}

function nombres(): string[] {
  return listarMovimientos(base.db, base.contexto).map((m) => m.nombre).sort();
}

describe('escribir', () => {
  it('va del más viejo al más nuevo, con el tipo y la categoría por nombre', () => {
    gasto('Copec', 30_000, '2026-11-10', 'transporte');
    gasto('Jumbo', 45_990, '2026-11-02', 'comida');

    const filas = filasDePlanilla(base.db, base.contexto, cuentaId);

    expect(filas.map((f) => [f.fecha, f.descripcion, f.tipo, f.monto, f.categoria])).toEqual([
      ['2026-11-02', 'Jumbo', 'Gasto', 45_990, 'Comida'],
      ['2026-11-10', 'Copec', 'Gasto', 30_000, 'Transporte'],
    ]);
  });

  it('solo las cuentas compartidas que creó este teléfono', () => {
    const privada = crearCuenta(base.db, base.contexto, { nombre: 'Personal', tipo: 'vista' }).id;
    editarCuenta(base.db, base.contexto, privada, { sincroniza: false });

    expect(cuentasConPlanilla(base.db, base.contexto).map((c) => c.id)).toEqual([cuentaId]);
  });
});

describe('leer de vuelta', () => {
  it('una planilla sin tocar no cambia nada y ya está al día', () => {
    gasto('Jumbo', 45_990);
    const filas = filasDePlanilla(base.db, base.contexto, cuentaId);

    const resultado = aplicarPlanilla(base.db, base.contexto, cuentaId, comoQuedo(filas));

    expect(resultado).toEqual({ nuevas: 0, editadas: 0, borradas: 0, ilegibles: 0 });
    expect(planillaAlDia(filas, comoQuedo(filas))).toBe(true);
  });

  it('una corrección en la planilla llega a la base', () => {
    gasto('Jumbo', 45_990);
    const filas = filasDePlanilla(base.db, base.contexto, cuentaId);
    const leida = comoQuedo(filas);
    const corregida: PlanillaLeida = { ...leida, filas: [{ ...leida.filas[0]!, monto: 46_990 }] };

    const resultado = aplicarPlanilla(base.db, base.contexto, cuentaId, corregida);

    expect(resultado.editadas).toBe(1);
    expect(listarMovimientos(base.db, base.contexto)[0]!.montoMinor).toBe(46_990);
  });

  it('una fila nueva escrita a mano, a la chilena, entra como movimiento', () => {
    const nueva: FilaLeida = {
      fecha: '24/11/2026', descripcion: 'Feria', tipo: '', monto: '$12.990',
      categoria: 'comida', notas: '', id: undefined, huella: undefined,
    };

    const resultado = aplicarPlanilla(base.db, base.contexto, cuentaId, {
      cuentaId, idsEscritos: [], filas: [nueva],
    });

    expect(resultado.nuevas).toBe(1);
    const [m] = listarMovimientos(base.db, base.contexto);
    expect([m!.ocurridoEn, m!.tipo, m!.montoMinor, m!.categoriaId]).toEqual(['2026-11-24', 'gasto', 12_990, 'comida']);
  });

  it('el tipo escrito se respeta', () => {
    const sueldo: FilaLeida = {
      fecha: '2026-11-30', descripcion: 'Sueldo', tipo: 'Ingreso', monto: 1_500_000,
      categoria: '', notas: '', id: '', huella: '',
    };

    aplicarPlanilla(base.db, base.contexto, cuentaId, { cuentaId, idsEscritos: [], filas: [sueldo] });

    expect(listarMovimientos(base.db, base.contexto)[0]!.tipo).toBe('ingreso');
  });

  it('una fila borrada en la planilla se borra', () => {
    gasto('Jumbo', 45_990);
    gasto('Copec', 30_000);
    const leida = comoQuedo(filasDePlanilla(base.db, base.contexto, cuentaId));
    const sinCopec: PlanillaLeida = { ...leida, filas: leida.filas.filter((f) => f.descripcion !== 'Copec') };

    const resultado = aplicarPlanilla(base.db, base.contexto, cuentaId, sinCopec);

    expect(resultado.borradas).toBe(1);
    expect(nombres()).toEqual(['Jumbo']);
  });

  it('una fila con las celdas vaciadas también cuenta como borrada', () => {
    gasto('Jumbo', 45_990);
    const leida = comoQuedo(filasDePlanilla(base.db, base.contexto, cuentaId));
    const vaciada: FilaLeida = {
      ...leida.filas[0]!, fecha: '', descripcion: '', tipo: '', monto: '', categoria: '', notas: '',
    };

    aplicarPlanilla(base.db, base.contexto, cuentaId, { ...leida, filas: [vaciada] });

    expect(nombres()).toEqual([]);
  });

  it('una versión vieja de la planilla no borra lo anotado después en el teléfono', () => {
    gasto('Jumbo', 45_990);
    const vieja = comoQuedo(filasDePlanilla(base.db, base.contexto, cuentaId));
    gasto('Anotado después', 5_000);

    const resultado = aplicarPlanilla(base.db, base.contexto, cuentaId, vieja);

    expect(resultado.borradas).toBe(0);
    expect(nombres()).toEqual(['Anotado después', 'Jumbo']);
  });

  it('lo que no se entiende no entra, y se cuenta', () => {
    const rara: FilaLeida = {
      fecha: 'ayer', descripcion: 'Algo', tipo: '', monto: 1_000,
      categoria: '', notas: '', id: '', huella: '',
    };

    const resultado = aplicarPlanilla(base.db, base.contexto, cuentaId, {
      cuentaId, idsEscritos: [], filas: [rara],
    });

    expect(resultado.ilegibles).toBe(1);
    expect(nombres()).toEqual([]);
  });

  it('una planilla de otra cuenta no toca nada', () => {
    gasto('Jumbo', 45_990);
    const leida = comoQuedo(filasDePlanilla(base.db, base.contexto, cuentaId));

    const resultado = aplicarPlanilla(base.db, base.contexto, cuentaId, {
      ...leida, cuentaId: 'otra', filas: [],
    });

    expect(resultado.borradas).toBe(0);
    expect(nombres()).toEqual(['Jumbo']);
  });

  it('después de aplicar, la planilla ya no está al día y hay que reescribirla', () => {
    gasto('Jumbo', 45_990);
    const leida = comoQuedo(filasDePlanilla(base.db, base.contexto, cuentaId));
    const corregida: PlanillaLeida = { ...leida, filas: [{ ...leida.filas[0]!, monto: 46_990 }] };
    aplicarPlanilla(base.db, base.contexto, cuentaId, corregida);

    expect(planillaAlDia(filasDePlanilla(base.db, base.contexto, cuentaId), corregida)).toBe(false);
  });
});
