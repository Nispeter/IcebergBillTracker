import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { escribirAjuste, leerAjuste } from './ajustes';
import { crearCuenta, listarCuentas } from './cuentas';
import { borrarMovimiento, crearMovimiento, listarConLapidas, listarMovimientos } from './movimientos';
import { crearRegla, listarReglas, marcarPagada } from './reglas';
import {
  VERSION_DE_RESPALDO, borrarTodo, contarRespaldo, estaVacia, exportarRespaldo,
  leerRespaldo, restaurarRespaldo,
} from './respaldo';

const d = dates.requirePlainDate;

let base: BaseDePrueba;
let cuentaId: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  cuentaId = crearCuenta(base.db, base.contexto, {
    nombre: 'Cuenta corriente', tipo: 'corriente', saldoInicialMinor: 380_000,
  }).id;
});

afterEach(() => base.cerrar());

const poblar = () => {
  crearMovimiento(base.db, base.contexto, {
    cuentaId, tipo: 'gasto', montoMinor: 45_000,
    ocurridoEn: d('2026-08-05'), nombre: 'Jumbo', categoriaId: 'comida',
  });
  crearMovimiento(base.db, base.contexto, {
    cuentaId, tipo: 'ingreso', montoMinor: 850_000,
    ocurridoEn: d('2026-08-30'), nombre: 'Sueldo',
  });
  const regla = crearRegla(base.db, base.contexto, {
    cuentaId, tipo: 'gasto', montoMinor: 450_000, nombre: 'Arriendo',
    categoriaId: 'vivienda', frecuencia: 'mensual', cada: 1, desde: d('2026-08-05'),
  });
  marcarPagada(base.db, base.contexto, regla.id, d('2026-08-05'));
};

describe('exportar', () => {
  it('saca todo lo del hogar', () => {
    poblar();
    const respaldo = exportarRespaldo(base.db, base.contexto);
    expect(respaldo.version).toBe(VERSION_DE_RESPALDO);
    expect(respaldo.cuentas).toHaveLength(1);
    // Dos a mano mas el que creo la marca de pagada.
    expect(respaldo.movimientos).toHaveLength(3);
    expect(respaldo.reglas).toHaveLength(1);
    expect(respaldo.instancias).toHaveLength(1);
  });

  it('incluye las lapidas: son la unica forma de que un borrado viaje', () => {
    poblar();
    const uno = listarMovimientos(base.db, base.contexto)[0]!;
    borrarMovimiento(base.db, base.contexto, uno.id);

    const respaldo = exportarRespaldo(base.db, base.contexto);
    expect(respaldo.movimientos).toHaveLength(3);
    expect(respaldo.movimientos.filter((m) => m.deletedAt !== null)).toHaveLength(1);
  });

  it('no incluye los ajustes: la identidad del aparato no se copia', () => {
    escribirAjuste(base.db, 'device_id', 'este-aparato');
    const respaldo = exportarRespaldo(base.db, base.contexto) as unknown as Record<string, unknown>;
    expect(respaldo.ajustes).toBeUndefined();
  });

  it('es serializable a JSON tal cual', () => {
    poblar();
    const vuelta = JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));
    expect(vuelta.movimientos).toHaveLength(3);
  });

  it('cuenta las filas que trae', () => {
    poblar();
    expect(contarRespaldo(exportarRespaldo(base.db, base.contexto))).toBe(6);
  });
});

describe('borrarTodo', () => {
  it('vacia la base sin dejar lapidas', () => {
    poblar();
    borrarTodo(base.db, base.contexto);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
    // Ni siquiera con lapidas: se vacio a proposito, no se borro fila por fila.
    expect(listarConLapidas(base.db, base.contexto)).toHaveLength(0);
    expect(listarCuentas(base.db, base.contexto)).toHaveLength(0);
    expect(listarReglas(base.db, base.contexto)).toHaveLength(0);
  });

  it('no toca los ajustes: el aparato sigue siendo el mismo', () => {
    escribirAjuste(base.db, 'device_id', 'este-aparato');
    borrarTodo(base.db, base.contexto);
    expect(leerAjuste(base.db, 'device_id')).toBe('este-aparato');
  });
});

describe('restaurar', () => {
  it('deja la base exactamente como estaba', () => {
    poblar();
    const respaldo = JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));
    const antes = listarMovimientos(base.db, base.contexto);

    borrarTodo(base.db, base.contexto);
    expect(restaurarRespaldo(base.db, base.contexto, respaldo)).toBe(6);

    const despues = listarMovimientos(base.db, base.contexto);
    expect(despues.map((m) => m.id).sort()).toEqual(antes.map((m) => m.id).sort());
    expect(listarCuentas(base.db, base.contexto)[0]?.saldoInicialMinor).toBe(380_000);
    expect(listarReglas(base.db, base.contexto)).toHaveLength(1);
  });

  it('reemplaza en vez de fusionar', () => {
    // Fusionar sin el motor de sync produciria duplicados silenciosos, que es la
    // peor forma de perder datos porque no se nota.
    poblar();
    const respaldo = JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));
    crearMovimiento(base.db, base.contexto, {
      cuentaId, tipo: 'gasto', montoMinor: 9_900, ocurridoEn: d('2026-08-06'), nombre: 'Kiosco',
    });

    restaurarRespaldo(base.db, base.contexto, respaldo);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(3);
    expect(listarMovimientos(base.db, base.contexto).some((m) => m.nombre === 'Kiosco')).toBe(false);
  });

  it('las lapidas vuelven como lapidas, no resucitan', () => {
    poblar();
    const uno = listarMovimientos(base.db, base.contexto)[0]!;
    borrarMovimiento(base.db, base.contexto, uno.id);
    const respaldo = JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));

    borrarTodo(base.db, base.contexto);
    restaurarRespaldo(base.db, base.contexto, respaldo);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(2);
    expect(listarConLapidas(base.db, base.contexto)).toHaveLength(3);
  });

  it('restaurar dos veces el mismo respaldo no duplica nada', () => {
    poblar();
    const respaldo = JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));
    restaurarRespaldo(base.db, base.contexto, respaldo);
    restaurarRespaldo(base.db, base.contexto, respaldo);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(3);
  });

  it('un respaldo de otro hogar entra visible: es el caso de reinstalar', () => {
    // Una instalacion nueva genera un hogar nuevo al arrancar. Si las filas
    // conservaran el hogar del respaldo, entrarian pero **ninguna consulta las
    // encontraria**: todas filtran por hogar. Los datos estarian y la app se
    // veria vacia.
    poblar();
    const ajeno = JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));
    ajeno.householdId = 'hogar-de-otro-telefono';
    for (const tabla of ['cuentas', 'movimientos', 'reglas', 'instancias', 'lotes']) {
      for (const fila of ajeno[tabla]) fila.householdId = 'hogar-de-otro-telefono';
    }

    borrarTodo(base.db, base.contexto);
    restaurarRespaldo(base.db, base.contexto, ajeno);
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(3);
    expect(listarCuentas(base.db, base.contexto)).toHaveLength(1);
    expect(listarReglas(base.db, base.contexto)).toHaveLength(1);
  });

  it('un respaldo vacio deja la base vacia', () => {
    poblar();
    restaurarRespaldo(base.db, base.contexto, {
      version: 1, exportadoEn: '', householdId: 'x',
      cuentas: [], movimientos: [], reglas: [], instancias: [], lotes: [],
    });
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(0);
  });
});

describe('validacion antes de tocar nada', () => {
  const noDeberiaBorrar = (crudo: unknown) => {
    poblar();
    expect(() => restaurarRespaldo(base.db, base.contexto, crudo)).toThrow();
    // Lo importante: la base sigue entera. Un archivo equivocado no puede llegar
    // a la parte destructiva.
    expect(listarMovimientos(base.db, base.contexto)).toHaveLength(3);
  };

  it('rechaza algo que no es un objeto', () => noDeberiaBorrar('hola'));
  it('rechaza null', () => noDeberiaBorrar(null));
  it('rechaza un JSON cualquiera', () => noDeberiaBorrar({ hola: 'mundo' }));

  it('rechaza un respaldo al que le falta una tabla', () => {
    noDeberiaBorrar({ version: 1, cuentas: [], movimientos: [], reglas: [], instancias: [] });
  });

  it('rechaza un respaldo de una version mas nueva', () => {
    noDeberiaBorrar({
      version: VERSION_DE_RESPALDO + 1, cuentas: [], movimientos: [],
      reglas: [], instancias: [], lotes: [],
    });
  });

  it('leerRespaldo acepta uno bien formado', () => {
    poblar();
    expect(() => leerRespaldo(JSON.parse(JSON.stringify(
      exportarRespaldo(base.db, base.contexto),
    )))).not.toThrow();
  });
});

describe('estaVacia', () => {
  it('una base recien creada esta vacia', () => {
    expect(estaVacia(base.db, base.contexto)).toBe(true);
  });

  it('deja de estarlo con el primer movimiento', () => {
    poblar();
    expect(estaVacia(base.db, base.contexto)).toBe(false);
  });

  it('borrar todos los movimientos la vuelve a dejar vacia', () => {
    poblar();
    for (const m of listarMovimientos(base.db, base.contexto)) {
      borrarMovimiento(base.db, base.contexto, m.id);
    }
    expect(estaVacia(base.db, base.contexto)).toBe(true);
  });
});
