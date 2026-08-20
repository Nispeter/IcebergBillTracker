/**
 * Rendimiento con 50.000 movimientos.
 *
 * Es el criterio de verificacion de F6 y el unico punto de la fase con un limite
 * medible. Lo que se prueba no es "que sea rapido" en abstracto, sino que el
 * saldo **no dependa de traer las filas**: la diferencia entre sumar en SQLite y
 * sumar en JavaScript se ve recien a esta escala.
 */

import { describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba } from '../pruebas';
import { crearCuenta } from './cuentas';
import { movimientos } from '../schema';
import { columnasNuevas } from '../contexto';
import {
  contarMovimientos, listarMovimientos, resumenDeMovimientos,
} from './movimientos';
import type { BaseDeDatos } from '../tipos';

const CUANTOS = 50_000;
const d = dates.requirePlainDate;

/** Se insertan por SQL directo: crear 50.000 por el repositorio tarda minutos. */
function llenar(base: ReturnType<typeof crearBaseDePrueba>, cuentaId: string): void {
  const filas = Array.from({ length: CUANTOS }, (_, i) => ({
    ...columnasNuevas(base.contexto),
    cuentaId,
    tipo: i % 10 === 0 ? ('ingreso' as const) : ('gasto' as const),
    montoMinor: 1_000 + (i % 500),
    moneda: 'CLP',
    ocurridoEn: d('2026-08-05'),
    nombre: `movimiento ${i}`,
    categoriaId: 'comida',
    notas: null,
    loteId: null,
    origenClave: null,
  }));

  const db = base.db as BaseDeDatos;
  db.transaction((tx) => {
    const dentro = tx as unknown as BaseDeDatos;
    for (let i = 0; i < filas.length; i += 500) {
      dentro.insert(movimientos).values(filas.slice(i, i + 500)).run();
    }
  });
}

describe('50.000 movimientos', () => {
  const base = crearBaseDePrueba();
  const cuentaId = crearCuenta(base.db, base.contexto, { nombre: 'Cuenta', tipo: 'corriente' }).id;
  llenar(base, cuentaId);

  it('la base quedo con las 50.000', () => {
    expect(contarMovimientos(base.db, base.contexto)).toBe(CUANTOS);
  });

  it('el total en SQL da lo mismo que sumar a mano', () => {
    const enSql = resumenDeMovimientos(base.db, base.contexto);
    const aMano = listarMovimientos(base.db, base.contexto).reduce(
      (suma, m) => (m.tipo === 'ingreso'
        ? { ...suma, ingreso: suma.ingreso + m.montoMinor }
        : { ...suma, gasto: suma.gasto + m.montoMinor }),
      { ingreso: 0, gasto: 0 },
    );
    expect(enSql.ingreso.amountMinor).toBe(aMano.ingreso);
    expect(enSql.gasto.amountMinor).toBe(aMano.gasto);
  });

  it('el total en SQL es mucho mas barato que traer las filas', () => {
    // No se fija un numero de milisegundos —depende de la maquina— sino la
    // **proporcion**: sumar sin traer tiene que ser un orden de magnitud mejor.
    const antesSql = performance.now();
    for (let i = 0; i < 5; i += 1) resumenDeMovimientos(base.db, base.contexto);
    const conSql = performance.now() - antesSql;

    const antesFilas = performance.now();
    for (let i = 0; i < 5; i += 1) listarMovimientos(base.db, base.contexto);
    const trayendo = performance.now() - antesFilas;

    console.log({ sql: `${conSql.toFixed(0)}ms`, filas: `${trayendo.toFixed(0)}ms` });
    expect(conSql).toBeLessThan(trayendo / 5);
  });

  it('el listado paginado no se hace lento por el tamano de la tabla', () => {
    const antes = performance.now();
    const pagina = listarMovimientos(base.db, base.contexto, { limite: 50 });
    const tardo = performance.now() - antes;
    expect(pagina).toHaveLength(50);
    expect(tardo).toBeLessThan(100);
  });
});
