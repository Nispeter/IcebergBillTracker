import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta } from './cuentas';
import {
  borrarMovimiento, crearMovimiento, editarMovimiento, listarConLapidas, listarMovimientos,
  obtenerMovimiento,
} from './movimientos';
import { crearReglaDeCategoria, listarReglasDeCategoria } from './reglasDeCategoria';
import { exportarRespaldo, restaurarRespaldo } from './respaldo';
import { fusionarRespaldo } from './sincronizacion';

const d = dates.requirePlainDate;

/** Dos bases independientes, como dos telefonos. */
let telefonoA: BaseDePrueba;
let telefonoB: BaseDePrueba;

beforeEach(() => {
  // Dos nodos distintos de verdad: el HLC desempata por nodo, y con el mismo
  // `deviceId` los dos serian el mismo aparato para el reloj.
  telefonoA = crearBaseDePrueba({ deviceId: 'telefonoA' });
  telefonoB = crearBaseDePrueba({ deviceId: 'telefonoB' });
});

afterEach(() => {
  telefonoA.cerrar();
  telefonoB.cerrar();
});

const conCuenta = (base: BaseDePrueba) =>
  crearCuenta(base.db, base.contexto, { nombre: 'Cuenta', tipo: 'corriente' }).id;

const gasto = (base: BaseDePrueba, cuentaId: string, nombre: string, monto = 10_000) =>
  crearMovimiento(base.db, base.contexto, {
    cuentaId, tipo: 'gasto', montoMinor: monto,
    ocurridoEn: d('2026-08-05'), nombre,
  });

const copiar = (base: BaseDePrueba) =>
  JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));

/** Deja las dos bases con exactamente el mismo contenido de partida. */
function emparejar(): { cuentaA: string } {
  const cuentaA = conCuenta(telefonoA);
  restaurarRespaldo(telefonoB.db, telefonoB.contexto, copiar(telefonoA));
  return { cuentaA };
}

describe('fusionar trae lo del otro sin perder lo propio', () => {
  it('cada lado conserva lo suyo y recibe lo ajeno', () => {
    const { cuentaA } = emparejar();
    gasto(telefonoA, cuentaA, 'Jumbo');
    gasto(telefonoB, cuentaA, 'Copec');

    fusionarRespaldo(telefonoA.db, telefonoA.contexto, copiar(telefonoB));
    const nombres = listarMovimientos(telefonoA.db, telefonoA.contexto).map((m) => m.nombre);
    expect(nombres.sort()).toEqual(['Copec', 'Jumbo']);
  });

  it('las dos bases convergen al mismo contenido', () => {
    // Es el criterio de F5: dos instalaciones que editaron por separado
    // convergen despues de intercambiar.
    const { cuentaA } = emparejar();
    gasto(telefonoA, cuentaA, 'Jumbo');
    gasto(telefonoB, cuentaA, 'Copec');

    const deA = copiar(telefonoA);
    const deB = copiar(telefonoB);
    fusionarRespaldo(telefonoA.db, telefonoA.contexto, deB);
    fusionarRespaldo(telefonoB.db, telefonoB.contexto, deA);

    const clave = (base: BaseDePrueba) => listarConLapidas(base.db, base.contexto)
      .map((m) => `${m.id}:${m.updatedAt}:${m.deletedAt ?? ''}`).sort();
    expect(clave(telefonoA)).toEqual(clave(telefonoB));
  });

  it('fusionar dos veces el mismo archivo no cambia nada la segunda', () => {
    const { cuentaA } = emparejar();
    gasto(telefonoB, cuentaA, 'Copec');
    const deB = copiar(telefonoB);

    const primera = fusionarRespaldo(telefonoA.db, telefonoA.contexto, deB);
    const segunda = fusionarRespaldo(telefonoA.db, telefonoA.contexto, deB);
    expect(primera.total.nuevas).toBeGreaterThan(0);
    expect(segunda.total.nuevas).toBe(0);
    expect(segunda.total.actualizadas).toBe(0);
  });

  it('fusionar consigo mismo no cambia nada', () => {
    const cuentaA = conCuenta(telefonoA);
    gasto(telefonoA, cuentaA, 'Jumbo');
    const resultado = fusionarRespaldo(telefonoA.db, telefonoA.contexto, copiar(telefonoA));
    expect(resultado.total.nuevas).toBe(0);
    expect(resultado.total.actualizadas).toBe(0);
    expect(listarMovimientos(telefonoA.db, telefonoA.contexto)).toHaveLength(1);
  });
});

describe('la misma fila editada en los dos lados', () => {
  it('gana la edicion mas nueva y se avisa del conflicto', () => {
    const { cuentaA } = emparejar();
    const movimiento = gasto(telefonoA, cuentaA, 'Jumbo');
    fusionarRespaldo(telefonoB.db, telefonoB.contexto, copiar(telefonoA));

    // A lo edita primero, B despues.
    editarMovimiento(telefonoA.db, telefonoA.contexto, movimiento.id, { nombre: 'Jumbo de A' });
    editarMovimiento(telefonoB.db, telefonoB.contexto, movimiento.id, { nombre: 'Jumbo de B' });

    const resultado = fusionarRespaldo(telefonoA.db, telefonoA.contexto, copiar(telefonoB));
    expect(resultado.total.conflictos).toBe(1);
    expect(obtenerMovimiento(telefonoA.db, telefonoA.contexto, movimiento.id)?.nombre)
      .toBe('Jumbo de B');
  });

  it('el conflicto dice que version se descarto', () => {
    const { cuentaA } = emparejar();
    const movimiento = gasto(telefonoA, cuentaA, 'Jumbo');
    fusionarRespaldo(telefonoB.db, telefonoB.contexto, copiar(telefonoA));
    editarMovimiento(telefonoA.db, telefonoA.contexto, movimiento.id, { nombre: 'Jumbo de A' });
    editarMovimiento(telefonoB.db, telefonoB.contexto, movimiento.id, { nombre: 'Jumbo de B' });

    const { ejemplos } = fusionarRespaldo(telefonoA.db, telefonoA.contexto, copiar(telefonoB));
    expect(ejemplos[0]?.ganadora).toContain('Jumbo de B');
    expect(ejemplos[0]?.descartada).toContain('Jumbo de A');
  });
});

describe('los borrados viajan', () => {
  it('borrar en un telefono borra en el otro al fusionar', () => {
    const { cuentaA } = emparejar();
    const movimiento = gasto(telefonoA, cuentaA, 'Jumbo');
    fusionarRespaldo(telefonoB.db, telefonoB.contexto, copiar(telefonoA));
    expect(listarMovimientos(telefonoB.db, telefonoB.contexto)).toHaveLength(1);

    borrarMovimiento(telefonoA.db, telefonoA.contexto, movimiento.id);
    fusionarRespaldo(telefonoB.db, telefonoB.contexto, copiar(telefonoA));
    expect(listarMovimientos(telefonoB.db, telefonoB.contexto)).toHaveLength(0);
  });

  it('una edicion posterior al borrado revive la fila', () => {
    // El borrado no tiene prioridad: compite por reloj como cualquier escritura.
    const { cuentaA } = emparejar();
    const movimiento = gasto(telefonoA, cuentaA, 'Jumbo');
    fusionarRespaldo(telefonoB.db, telefonoB.contexto, copiar(telefonoA));

    borrarMovimiento(telefonoA.db, telefonoA.contexto, movimiento.id);
    editarMovimiento(telefonoB.db, telefonoB.contexto, movimiento.id, { nombre: 'Jumbo vivo' });

    fusionarRespaldo(telefonoA.db, telefonoA.contexto, copiar(telefonoB));
    expect(obtenerMovimiento(telefonoA.db, telefonoA.contexto, movimiento.id)?.nombre)
      .toBe('Jumbo vivo');
  });
});

describe('todo lo que se sincroniza', () => {
  it('las reglas de categoria tambien viajan', () => {
    emparejar();
    crearReglaDeCategoria(telefonoB.db, telefonoB.contexto, {
      patron: 'comercial alexis', categoriaId: 'comida',
    });
    fusionarRespaldo(telefonoA.db, telefonoA.contexto, copiar(telefonoB));
    expect(listarReglasDeCategoria(telefonoA.db, telefonoA.contexto)).toHaveLength(1);
  });

  it('el resumen separa lo nuevo de lo que ya estaba', () => {
    const { cuentaA } = emparejar();
    gasto(telefonoB, cuentaA, 'Copec');
    const resultado = fusionarRespaldo(telefonoA.db, telefonoA.contexto, copiar(telefonoB));
    expect(resultado.porTabla.movimientos?.nuevas).toBe(1);
    expect(resultado.porTabla.cuentas?.sinCambios).toBe(1);
  });
});

describe('respaldos de otra version', () => {
  it('uno sin reglas de categoria se lee igual: es de la version 1', () => {
    const cuentaA = conCuenta(telefonoA);
    gasto(telefonoA, cuentaA, 'Jumbo');
    const viejo = copiar(telefonoA);
    delete viejo.reglasCategoria;
    viejo.version = 1;

    expect(() => fusionarRespaldo(telefonoB.db, telefonoB.contexto, viejo)).not.toThrow();
    expect(listarMovimientos(telefonoB.db, telefonoB.contexto)).toHaveLength(1);
  });

  it('uno de una version mas nueva se rechaza sin tocar nada', () => {
    const cuentaA = conCuenta(telefonoA);
    gasto(telefonoA, cuentaA, 'Jumbo');
    const futuro = { ...copiar(telefonoA), version: 99 };

    expect(() => fusionarRespaldo(telefonoA.db, telefonoA.contexto, futuro)).toThrow();
    expect(listarMovimientos(telefonoA.db, telefonoA.contexto)).toHaveLength(1);
  });
});
