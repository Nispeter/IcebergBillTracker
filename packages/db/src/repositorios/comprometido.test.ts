/**
 * La marca de compromiso por movimiento.
 *
 * Existe porque la categoria es mal indicio y se equivoca seguido: dentro de
 * vivienda conviven el arriendo --que llega igual-- y un desatornillador que uno
 * decidio comprar. Son la misma categoria y no son la misma clase de gasto.
 *
 * Tres estados y no dos: `null` deja que la app deduzca, y ese es el valor con
 * el que nace todo movimiento, asi que agregar la columna no cambio nada de lo
 * que ya habia guardado.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta } from './cuentas';
import { crearMovimiento, editarMovimiento, obtenerMovimiento } from './movimientos';

const d = dates.requirePlainDate;

let base: BaseDePrueba;
let cuentaId: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  cuentaId = crearCuenta(base.db, base.contexto, {
    nombre: 'Cuenta', tipo: 'corriente',
  }).id;
});

afterEach(() => base.cerrar());

const gasto = (extra: Record<string, unknown> = {}) => crearMovimiento(base.db, base.contexto, {
  cuentaId,
  tipo: 'gasto',
  montoMinor: 10_000,
  ocurridoEn: d('2026-08-05'),
  nombre: 'Desatornillador',
  categoriaId: 'vivienda',
  ...extra,
});

describe('la marca de compromiso', () => {
  it('nace en automatico', () => {
    // Lo importante de agregar la columna: nada de lo ya guardado cambia de
    // significado hasta que alguien corrija algo a mano.
    expect(gasto().comprometido).toBeNull();
  });

  it('se puede fijar al crear', () => {
    expect(gasto({ comprometido: false }).comprometido).toBe(0);
    expect(gasto({ comprometido: true }).comprometido).toBe(1);
  });

  it('se puede cambiar despues', () => {
    const m = gasto();
    editarMovimiento(base.db, base.contexto, m.id, { comprometido: false });
    expect(obtenerMovimiento(base.db, base.contexto, m.id)?.comprometido).toBe(0);
  });

  it('se puede volver a automatico', () => {
    const m = gasto({ comprometido: true });
    editarMovimiento(base.db, base.contexto, m.id, { comprometido: null });
    expect(obtenerMovimiento(base.db, base.contexto, m.id)?.comprometido).toBeNull();
  });

  it('editar otra cosa no la toca', () => {
    // `undefined` y `null` significan cosas distintas: uno es "no lo mencione",
    // el otro es "vuelve a automatico". Confundirlos borraria la correccion de
    // alguien al renombrar un movimiento.
    const m = gasto({ comprometido: false });
    editarMovimiento(base.db, base.contexto, m.id, { nombre: 'Otro nombre' });
    expect(obtenerMovimiento(base.db, base.contexto, m.id)?.comprometido).toBe(0);
  });
});
