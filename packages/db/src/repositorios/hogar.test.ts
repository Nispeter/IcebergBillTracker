/**
 * Compartir hogar entre dos aparatos.
 *
 * Conviene dejar escrito que **fusionar ya funcionaba sin esto**: las filas
 * remotas adoptan el hogar local, asi que dos telefonos que se intercambian
 * archivos convergen igual. Lo que no habia era forma de saber de donde viene
 * un archivo, y por eso cualquiera entraba en silencio.
 *
 * Estas pruebas cubren las dos mitades de ese arreglo: unirse a un hogar sin
 * perder ni alterar lo propio, y que un archivo de otro hogar se rechace salvo
 * que se insista.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { CLAVE_HOGAR, leerAjuste } from './ajustes';
import { crearCuenta } from './cuentas';
import { crearMovimiento, listarMovimientos } from './movimientos';
import { exportarRespaldo } from './respaldo';
import { HogarAjenoError, fusionarRespaldo, unirseAHogar } from './sincronizacion';

const d = dates.requirePlainDate;

let telefonoA: BaseDePrueba;
let telefonoB: BaseDePrueba;

const conGasto = (base: BaseDePrueba, nombre: string) => {
  const cuentaId = crearCuenta(base.db, base.contexto, {
    nombre: 'Cuenta', tipo: 'corriente',
  }).id;
  crearMovimiento(base.db, base.contexto, {
    cuentaId, tipo: 'gasto', montoMinor: 10_000, ocurridoEn: d('2026-08-05'), nombre,
  });
  return cuentaId;
};

beforeEach(() => {
  // Hogares distintos a proposito: por omision las bases de prueba comparten
  // uno, y con el mismo hogar no hay nada que emparejar ni que rechazar.
  telefonoA = crearBaseDePrueba({ householdId: 'hogarA', deviceId: 'telefonoA' });
  telefonoB = crearBaseDePrueba({ householdId: 'hogarB', deviceId: 'telefonoB' });
});

afterEach(() => {
  telefonoA.cerrar();
  telefonoB.cerrar();
});

describe('unirse a un hogar', () => {
  it('se lleva las filas propias al hogar nuevo', () => {
    conGasto(telefonoB, 'Copec');

    const filas = unirseAHogar(telefonoB.db, telefonoB.contexto, telefonoA.contexto.householdId);

    expect(filas).toBeGreaterThan(0);
    expect(leerAjuste(telefonoB.db, CLAVE_HOGAR)).toBe(telefonoA.contexto.householdId);
  });

  it('no pierde nada de lo que ya habia', () => {
    conGasto(telefonoB, 'Copec');
    unirseAHogar(telefonoB.db, telefonoB.contexto, telefonoA.contexto.householdId);

    // El contexto viejo ya no encuentra nada; con el hogar nuevo esta todo.
    const conElNuevo = { ...telefonoB.contexto, householdId: telefonoA.contexto.householdId };
    const nombres = listarMovimientos(telefonoB.db, conElNuevo).map((m) => m.nombre);
    expect(nombres).toEqual(['Copec']);
  });

  it('no toca `updatedAt`', () => {
    // Si lo tocara, unirse a un hogar haria que este aparato ganara **todos**
    // los conflictos contra el otro, que es lo contrario de lo que uno quiere
    // al juntar dos historiales.
    conGasto(telefonoB, 'Copec');
    const antes = listarMovimientos(telefonoB.db, telefonoB.contexto)[0]!.updatedAt;

    unirseAHogar(telefonoB.db, telefonoB.contexto, telefonoA.contexto.householdId);

    const conElNuevo = { ...telefonoB.contexto, householdId: telefonoA.contexto.householdId };
    expect(listarMovimientos(telefonoB.db, conElNuevo)[0]!.updatedAt).toBe(antes);
  });

  it('unirse al hogar en el que ya se esta no hace nada', () => {
    expect(unirseAHogar(telefonoB.db, telefonoB.contexto, telefonoB.contexto.householdId)).toBe(0);
  });

  it('un codigo vacio se rechaza', () => {
    expect(() => unirseAHogar(telefonoB.db, telefonoB.contexto, '   ')).toThrow();
  });
});

describe('un archivo de otro hogar', () => {
  it('se rechaza por defecto', () => {
    conGasto(telefonoA, 'Jumbo');
    const deA = JSON.parse(JSON.stringify(exportarRespaldo(telefonoA.db, telefonoA.contexto)));

    expect(() => fusionarRespaldo(telefonoB.db, telefonoB.contexto, deA))
      .toThrow(HogarAjenoError);
  });

  it('no escribe nada al rechazarlo', () => {
    conGasto(telefonoA, 'Jumbo');
    conGasto(telefonoB, 'Copec');
    const deA = JSON.parse(JSON.stringify(exportarRespaldo(telefonoA.db, telefonoA.contexto)));

    try {
      fusionarRespaldo(telefonoB.db, telefonoB.contexto, deA);
    } catch {
      // Se espera.
    }

    const nombres = listarMovimientos(telefonoB.db, telefonoB.contexto).map((m) => m.nombre);
    expect(nombres).toEqual(['Copec']);
  });

  it('entra si se insiste', () => {
    conGasto(telefonoA, 'Jumbo');
    conGasto(telefonoB, 'Copec');
    const deA = JSON.parse(JSON.stringify(exportarRespaldo(telefonoA.db, telefonoA.contexto)));

    fusionarRespaldo(telefonoB.db, telefonoB.contexto, deA, { permitirOtroHogar: true });

    const nombres = listarMovimientos(telefonoB.db, telefonoB.contexto).map((m) => m.nombre);
    expect(nombres.sort()).toEqual(['Copec', 'Jumbo']);
  });

  it('despues de emparejar, el archivo del otro entra sin insistir', () => {
    // El caso completo: los dos comparten hogar y desde ahi se sincronizan solos.
    conGasto(telefonoA, 'Jumbo');
    conGasto(telefonoB, 'Copec');
    unirseAHogar(telefonoB.db, telefonoB.contexto, telefonoA.contexto.householdId);
    const bEmparejado = { ...telefonoB.contexto, householdId: telefonoA.contexto.householdId };

    const deA = JSON.parse(JSON.stringify(exportarRespaldo(telefonoA.db, telefonoA.contexto)));
    fusionarRespaldo(telefonoB.db, bEmparejado, deA);

    const nombres = listarMovimientos(telefonoB.db, bEmparejado).map((m) => m.nombre);
    expect(nombres.sort()).toEqual(['Copec', 'Jumbo']);
  });
});
