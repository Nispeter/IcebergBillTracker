import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import {
  borrarCuenta, crearCuenta, editarCuenta, listarCuentas, obtenerCuenta,
} from './cuentas';
import { RepositorioError } from './movimientos';

let base: BaseDePrueba;

beforeEach(() => { base = crearBaseDePrueba(); });
afterEach(() => base.cerrar());

describe('crear', () => {
  it('guarda la cuenta con sus columnas de sync', () => {
    const cuenta = crearCuenta(base.db, base.contexto, { nombre: 'Cuenta corriente', tipo: 'corriente' });
    expect(cuenta.nombre).toBe('Cuenta corriente');
    expect(cuenta.tipo).toBe('corriente');
    expect(cuenta.moneda).toBe('CLP');
    expect(cuenta.saldoInicialMinor).toBe(0);
    expect(cuenta.householdId).toBe('hogar1');
    expect(cuenta.deletedAt).toBeNull();
  });

  it('acepta saldo inicial negativo: una tarjeta parte en deuda', () => {
    const tarjeta = crearCuenta(base.db, base.contexto, {
      nombre: 'Tarjeta',
      tipo: 'credito',
      saldoInicialMinor: -465_792,
    });
    expect(tarjeta.saldoInicialMinor).toBe(-465_792);
  });

  it('rechaza un saldo inicial con decimales', () => {
    expect(() => crearCuenta(base.db, base.contexto, {
      nombre: 'Rara', tipo: 'vista', saldoInicialMinor: 100.5,
    })).toThrow();
  });

  it('el nombre no puede quedar vacio y se recorta', () => {
    expect(() => crearCuenta(base.db, base.contexto, { nombre: '  ', tipo: 'vista' }))
      .toThrow(RepositorioError);
    expect(crearCuenta(base.db, base.contexto, { nombre: '  Vista  ', tipo: 'vista' }).nombre)
      .toBe('Vista');
  });
});

describe('listar', () => {
  it('devuelve las cuentas por nombre', () => {
    crearCuenta(base.db, base.contexto, { nombre: 'Vista', tipo: 'vista' });
    crearCuenta(base.db, base.contexto, { nombre: 'Ahorro', tipo: 'ahorro' });
    crearCuenta(base.db, base.contexto, { nombre: 'Corriente', tipo: 'corriente' });
    expect(listarCuentas(base.db, base.contexto).map((c) => c.nombre))
      .toEqual(['Ahorro', 'Corriente', 'Vista']);
  });

  it('sin cuentas devuelve lista vacia', () => {
    expect(listarCuentas(base.db, base.contexto)).toEqual([]);
  });
});

describe('editar', () => {
  it('cambia solo lo que se le pasa y adelanta updatedAt', () => {
    const cuenta = crearCuenta(base.db, base.contexto, { nombre: 'Vista', tipo: 'vista' });
    base.avanzarReloj(5_000);
    const editada = editarCuenta(base.db, base.contexto, cuenta.id, { nombre: 'Cuenta vista' })!;
    expect(editada.nombre).toBe('Cuenta vista');
    expect(editada.tipo).toBe('vista');
    expect(editada.createdAt).toBe(cuenta.createdAt);
    expect(editada.updatedAt > cuenta.updatedAt).toBe(true);
  });

  it('devuelve null si no existe', () => {
    expect(editarCuenta(base.db, base.contexto, 'no-existe', { nombre: 'x' })).toBeNull();
  });
});

describe('borrar', () => {
  it('deja lapida y desaparece del listado', () => {
    const cuenta = crearCuenta(base.db, base.contexto, { nombre: 'Vista', tipo: 'vista' });
    expect(borrarCuenta(base.db, base.contexto, cuenta.id)).toBe(true);
    expect(listarCuentas(base.db, base.contexto)).toHaveLength(0);
    expect(obtenerCuenta(base.db, base.contexto, cuenta.id)).toBeNull();
  });

  it('borrar dos veces devuelve false la segunda', () => {
    const cuenta = crearCuenta(base.db, base.contexto, { nombre: 'Vista', tipo: 'vista' });
    expect(borrarCuenta(base.db, base.contexto, cuenta.id)).toBe(true);
    expect(borrarCuenta(base.db, base.contexto, cuenta.id)).toBe(false);
  });
});
