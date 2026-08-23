/**
 * Fusionar de a varios: lo que hace la carpeta compartida en cada pasada.
 *
 * En la carpeta hay un archivo por aparato y se leen todos juntos. Lo que estas
 * pruebas cuidan es que la pasada sea **robusta**: que un archivo de otro hogar
 * no impida que entren los demas, y que pasar dos veces no duplique nada,
 * porque la sincronizacion se va a repetir seguido sobre los mismos archivos.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta, editarCuenta } from './cuentas';
import { crearMovimiento, listarMovimientos } from './movimientos';
import { exportarRespaldo } from './respaldo';
import { fusionarVarios } from './sincronizacion';
import { nombreDelArchivo, pasarPorCarpeta } from './carpeta';

const d = dates.requirePlainDate;

/** Un respaldo suelto, tal como saldria de un archivo de la carpeta. */
function archivoCon(base: BaseDePrueba, nombre: string): unknown {
  const cuentaId = crearCuenta(base.db, base.contexto, {
    nombre: 'Cuenta', tipo: 'corriente',
  }).id;
  crearMovimiento(base.db, base.contexto, {
    cuentaId, tipo: 'gasto', montoMinor: 10_000, ocurridoEn: d('2026-08-05'), nombre,
  });
  return JSON.parse(JSON.stringify(exportarRespaldo(base.db, base.contexto)));
}

let mio: BaseDePrueba;
let otroA: BaseDePrueba;
let otroB: BaseDePrueba;

beforeEach(() => {
  mio = crearBaseDePrueba({ householdId: 'casa', deviceId: 'mio' });
  otroA = crearBaseDePrueba({ householdId: 'casa', deviceId: 'otroA' });
  otroB = crearBaseDePrueba({ householdId: 'casa', deviceId: 'otroB' });
});

afterEach(() => {
  mio.cerrar();
  otroA.cerrar();
  otroB.cerrar();
});

describe('una pasada por la carpeta', () => {
  it('trae lo de todos los archivos', () => {
    const archivos = [archivoCon(otroA, 'Jumbo'), archivoCon(otroB, 'Copec')];

    const resultado = fusionarVarios(mio.db, mio.contexto, archivos);

    expect(resultado.fusionados).toBe(2);
    const nombres = listarMovimientos(mio.db, mio.contexto).map((m) => m.nombre);
    expect(nombres.sort()).toEqual(['Copec', 'Jumbo']);
  });

  it('los totales suman los de cada archivo', () => {
    const archivos = [archivoCon(otroA, 'Jumbo'), archivoCon(otroB, 'Copec')];

    const resultado = fusionarVarios(mio.db, mio.contexto, archivos);

    // Dos cuentas y dos movimientos, uno de cada aparato.
    expect(resultado.total.nuevas).toBe(4);
    expect(resultado.total.conflictos).toBe(0);
  });

  it('pasar de nuevo no trae nada', () => {
    // Es lo normal: la carpeta se relee cada vez y casi siempre esta igual.
    const archivos = [archivoCon(otroA, 'Jumbo'), archivoCon(otroB, 'Copec')];
    fusionarVarios(mio.db, mio.contexto, archivos);

    const segunda = fusionarVarios(mio.db, mio.contexto, archivos);

    expect(segunda.total.nuevas).toBe(0);
    expect(segunda.total.actualizadas).toBe(0);
    expect(listarMovimientos(mio.db, mio.contexto)).toHaveLength(2);
  });

  it('sin archivos no hace nada', () => {
    const resultado = fusionarVarios(mio.db, mio.contexto, []);
    expect(resultado.fusionados).toBe(0);
    expect(resultado.total.nuevas).toBe(0);
  });
});

describe('un archivo de otro hogar en la carpeta', () => {
  it('se salta y los demas entran igual', () => {
    // Lo que motiva contar en vez de tirar error: un archivo ajeno tirado en la
    // carpeta no puede dejar la sincronizacion inservible para todos.
    const deOtraCasa = crearBaseDePrueba({ householdId: 'otraCasa', deviceId: 'ajeno' });
    const archivos = [
      archivoCon(otroA, 'Jumbo'),
      archivoCon(deOtraCasa, 'Gasto ajeno'),
      archivoCon(otroB, 'Copec'),
    ];

    const resultado = fusionarVarios(mio.db, mio.contexto, archivos);

    expect(resultado.ajenos).toBe(1);
    expect(resultado.fusionados).toBe(2);
    const nombres = listarMovimientos(mio.db, mio.contexto).map((m) => m.nombre);
    expect(nombres.sort()).toEqual(['Copec', 'Jumbo']);
    deOtraCasa.cerrar();
  });

  it('entra si se insiste', () => {
    const deOtraCasa = crearBaseDePrueba({ householdId: 'otraCasa', deviceId: 'ajeno' });
    const archivos = [archivoCon(deOtraCasa, 'Gasto ajeno')];

    const resultado = fusionarVarios(mio.db, mio.contexto, archivos, { permitirOtroHogar: true });

    expect(resultado.ajenos).toBe(0);
    expect(listarMovimientos(mio.db, mio.contexto).map((m) => m.nombre)).toEqual(['Gasto ajeno']);
    deOtraCasa.cerrar();
  });
});

describe('dos aparatos y una carpeta', () => {
  /**
   * La carpeta, de mentira: nombre de archivo -> contenido.
   *
   * Alcanza con un `Map` porque el transporte real --SAF en Android, la File
   * System Access API en web-- no hace nada mas que esto. Lo que se prueba aca
   * es el criterio de F5: que dos aparatos apuntando a la misma carpeta
   * terminen viendo lo mismo.
   */
  type Nube = Map<string, string>;

  /** Una pasada completa: leer lo ajeno, fusionarlo, dejar lo propio. */
  function sincronizar(base: BaseDePrueba, nube: Nube, frase?: string) {
    const propio = nombreDelArchivo(base.contexto);
    const ajenos = [...nube.entries()]
      .filter(([nombre]) => !nombre.startsWith(propio))
      .map(([nombre, texto]) => ({ nombre, texto }));

    const pasada = pasarPorCarpeta(base.db, base.contexto, ajenos, { frase });
    nube.set(propio + '.json', pasada.propio);
    return pasada;
  }

  const gastoEn = (base: BaseDePrueba, cuentaId: string, nombre: string) => crearMovimiento(
    base.db, base.contexto,
    { cuentaId, tipo: 'gasto', montoMinor: 10_000, ocurridoEn: d('2026-08-05'), nombre },
  );

  it('lo que anota uno aparece en el otro', () => {
    const nube: Nube = new Map();
    const cuenta = crearCuenta(otroA.db, otroA.contexto, {
      nombre: 'De la casa', tipo: 'corriente',
    }).id;
    gastoEn(otroA, cuenta, 'Jumbo');

    sincronizar(otroA, nube);
    sincronizar(otroB, nube);

    expect(listarMovimientos(otroB.db, otroB.contexto).map((m) => m.nombre)).toEqual(['Jumbo']);
  });

  it('los dos terminan viendo lo mismo', () => {
    // El criterio de F5, tal cual: cada uno anota algo sin saber del otro, y
    // despues de una pasada de cada lado los dos ven las dos cosas.
    const nube: Nube = new Map();
    const cuenta = crearCuenta(otroA.db, otroA.contexto, {
      nombre: 'De la casa', tipo: 'corriente',
    }).id;
    gastoEn(otroA, cuenta, 'Jumbo');
    sincronizar(otroA, nube);
    sincronizar(otroB, nube);

    gastoEn(otroB, cuenta, 'Copec');
    sincronizar(otroB, nube);
    sincronizar(otroA, nube);

    const enA = listarMovimientos(otroA.db, otroA.contexto).map((m) => m.nombre).sort();
    const enB = listarMovimientos(otroB.db, otroB.contexto).map((m) => m.nombre).sort();
    expect(enA).toEqual(['Copec', 'Jumbo']);
    expect(enB).toEqual(enA);
  });

  it('cada aparato escribe solo su archivo', () => {
    // De aca sale que no haya conflictos a nivel de nube: nunca hay dos
    // escritores sobre el mismo archivo.
    const nube: Nube = new Map();
    sincronizar(otroA, nube);
    sincronizar(otroB, nube);

    expect([...nube.keys()].sort()).toEqual([
      nombreDelArchivo(otroA.contexto) + '.json',
      nombreDelArchivo(otroB.contexto) + '.json',
    ].sort());
  });

  it('pasar de nuevo sin cambios no trae nada', () => {
    const nube: Nube = new Map();
    const cuenta = crearCuenta(otroA.db, otroA.contexto, {
      nombre: 'De la casa', tipo: 'corriente',
    }).id;
    gastoEn(otroA, cuenta, 'Jumbo');
    sincronizar(otroA, nube);
    sincronizar(otroB, nube);

    const otraVez = sincronizar(otroB, nube);

    expect(otraVez.total.nuevas).toBe(0);
    expect(otraVez.total.actualizadas).toBe(0);
  });

  it('lo privado no sale a la carpeta', () => {
    // La promesa de la marca por cuenta, mirada desde el transporte.
    const nube: Nube = new Map();
    const compartida = crearCuenta(otroA.db, otroA.contexto, {
      nombre: 'De la casa', tipo: 'corriente',
    }).id;
    const privada = crearCuenta(otroA.db, otroA.contexto, {
      nombre: 'Personal', tipo: 'corriente',
    }).id;
    gastoEn(otroA, compartida, 'Jumbo');
    gastoEn(otroA, privada, 'Regalo sorpresa');
    editarCuenta(otroA.db, otroA.contexto, privada, { sincroniza: false });

    sincronizar(otroA, nube);
    sincronizar(otroB, nube);

    expect(listarMovimientos(otroB.db, otroB.contexto).map((m) => m.nombre)).toEqual(['Jumbo']);
  });

  it('con frase, los dos lados se entienden', () => {
    const nube: Nube = new Map();
    const cuenta = crearCuenta(otroA.db, otroA.contexto, {
      nombre: 'De la casa', tipo: 'corriente',
    }).id;
    gastoEn(otroA, cuenta, 'Jumbo');

    sincronizar(otroA, nube, 'la misma frase larga');
    // Lo que quedo en la carpeta no se puede leer sin la frase.
    expect([...nube.values()][0]).not.toContain('Jumbo');

    sincronizar(otroB, nube, 'la misma frase larga');
    expect(listarMovimientos(otroB.db, otroB.contexto).map((m) => m.nombre)).toEqual(['Jumbo']);
  });

  it('con otra frase, el archivo se cuenta como cerrado y no se pierde nada', () => {
    // Es el caso de alguien que se equivoco de frase. No puede quedar como si
    // la carpeta estuviera vacia ni, peor, borrar lo que hay.
    const nube: Nube = new Map();
    const cuenta = crearCuenta(otroA.db, otroA.contexto, {
      nombre: 'De la casa', tipo: 'corriente',
    }).id;
    gastoEn(otroA, cuenta, 'Jumbo');
    sincronizar(otroA, nube, 'la frase de uno');

    const pasada = sincronizar(otroB, nube, 'una frase distinta');

    expect(pasada.encontrados).toBe(1);
    expect(pasada.cerrados).toBe(1);
    expect(pasada.total.nuevas).toBe(0);
  });

  it('un archivo cualquiera en la carpeta no rompe la pasada', () => {
    // La carpeta es del usuario y adentro puede tener lo que se le ocurra.
    const nube: Nube = new Map([['apuntes.json', 'esto no es un respaldo']]);

    const pasada = sincronizar(otroA, nube);

    expect(pasada.cerrados).toBe(1);
    expect(pasada.fusionados).toBe(0);
  });
});
