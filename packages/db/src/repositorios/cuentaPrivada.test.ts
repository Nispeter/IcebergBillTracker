/**
 * Cuentas que no sincronizan.
 *
 * El caso que motiva la marca: un libro compartido con la pareja y otro
 * personal, en el mismo telefono. Lo compartido viaja; lo personal no.
 *
 * Lo que se prueba aca no es tanto que el filtro exista como que sea
 * **simetrico**. Dejar fuera lo privado al exportar es la mitad facil; la que
 * importa es descartar lo que llegue de una cuenta que uno marco como privada,
 * porque si no la marca seria una promesa a medias: bastaria que el otro lado
 * conservara la cuenta de cuando si se compartia para que sus cambios volvieran
 * a entrar sin permiso.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dates } from '@iceberg/core';
import { crearBaseDePrueba, type BaseDePrueba } from '../pruebas';
import { crearCuenta, cuentasQueNoSincronizan, editarCuenta } from './cuentas';
import { crearMovimiento, listarMovimientos } from './movimientos';
import { crearRegla, marcarPagada } from './reglas';
import { exportarRespaldo } from './respaldo';
import { fusionarRespaldo } from './sincronizacion';

const d = dates.requirePlainDate;

/**
 * Un HLC un segundo mas nuevo que el dado.
 *
 * No sirve inventar uno enorme: `adelantarReloj` rechaza cualquier reloj remoto
 * a mas de cinco minutos de este, que es justo la proteccion contra un aparato
 * con la hora mal puesta. Un segundo alcanza para ganar la comparacion.
 */
function unSegundoDespues(hlc: string): string {
  const [millis, contador, ...resto] = hlc.split('-');
  return [String(Number(millis) + 1000).padStart(15, '0'), contador, ...resto].join('-');
}

let base: BaseDePrueba;
let compartida: string;
let privada: string;

beforeEach(() => {
  base = crearBaseDePrueba();
  compartida = crearCuenta(base.db, base.contexto, {
    nombre: 'De la casa', tipo: 'corriente', saldoInicialMinor: 380_000,
  }).id;
  privada = crearCuenta(base.db, base.contexto, {
    nombre: 'Personal', tipo: 'corriente', saldoInicialMinor: 50_000,
  }).id;

  crearMovimiento(base.db, base.contexto, {
    cuentaId: compartida, tipo: 'gasto', montoMinor: 45_000,
    ocurridoEn: d('2026-08-05'), nombre: 'Supermercado', categoriaId: 'comida',
  });
  crearMovimiento(base.db, base.contexto, {
    cuentaId: privada, tipo: 'gasto', montoMinor: 30_000,
    ocurridoEn: d('2026-08-06'), nombre: 'Regalo sorpresa', categoriaId: 'regalos',
  });
  const regla = crearRegla(base.db, base.contexto, {
    cuentaId: privada, tipo: 'gasto', montoMinor: 9_900, nombre: 'Suscripcion',
    categoriaId: 'servicios', frecuencia: 'mensual', cada: 1, desde: d('2026-08-08'),
  });
  marcarPagada(base.db, base.contexto, regla.id, d('2026-08-08'));
});

afterEach(() => base.cerrar());

describe('la marca por cuenta', () => {
  it('todas sincronizan mientras nadie diga lo contrario', () => {
    // La columna llega con 1 por omision, asi que agregarla no cambia lo que
    // hacian las bases que ya existian.
    expect(cuentasQueNoSincronizan(base.db, base.contexto).size).toBe(0);
  });

  it('un respaldo lleva todo, aunque haya cuentas privadas', () => {
    editarCuenta(base.db, base.contexto, privada, { sincroniza: false });

    const respaldo = exportarRespaldo(base.db, base.contexto);

    expect(respaldo.cuentas).toHaveLength(2);
    expect(respaldo.movimientos.map((m) => m.nombre)).toContain('Regalo sorpresa');
  });

  it('el archivo para compartir deja fuera la cuenta y todo lo que cuelga', () => {
    editarCuenta(base.db, base.contexto, privada, { sincroniza: false });

    const paraCompartir = exportarRespaldo(base.db, base.contexto, { soloSincronizables: true });

    expect(paraCompartir.cuentas.map((c) => c.nombre)).toEqual(['De la casa']);
    expect(paraCompartir.movimientos.map((m) => m.nombre)).toEqual(['Supermercado']);
    // La regla vivia en la cuenta privada, y su instancia colgaba de la regla.
    expect(paraCompartir.reglas).toHaveLength(0);
    expect(paraCompartir.instancias).toHaveLength(0);
  });

  it('las reglas de categoria y los miembros no los toca el filtro', () => {
    editarCuenta(base.db, base.contexto, privada, { sincroniza: false });

    const completo = exportarRespaldo(base.db, base.contexto);
    const paraCompartir = exportarRespaldo(base.db, base.contexto, { soloSincronizables: true });

    // No dicen cuanto gastaste: dicen como se llama cada aparato y como
    // clasificar. Son del hogar, no de una cuenta, asi que viajan igual.
    expect(paraCompartir.miembros).toEqual(completo.miembros);
    expect(paraCompartir.reglasCategoria).toEqual(completo.reglasCategoria);
  });
});

describe('la marca vale tambien al recibir', () => {
  it('descarta lo que llegue de una cuenta marcada como privada', () => {
    // El otro aparato todavia tiene la cuenta de cuando si se compartia, y sigue
    // mandandola con movimientos nuevos.
    const desdeElOtro = exportarRespaldo(base.db, base.contexto);
    const conAgregado = {
      ...desdeElOtro,
      movimientos: [
        ...desdeElOtro.movimientos,
        {
          ...desdeElOtro.movimientos.find((m) => m.cuentaId === privada)!,
          id: 'movimiento-ajeno',
          nombre: 'Lo que el otro anoto',
          updatedAt: unSegundoDespues(desdeElOtro.movimientos[0]!.updatedAt),
        },
      ],
    };

    editarCuenta(base.db, base.contexto, privada, { sincroniza: false });
    fusionarRespaldo(base.db, base.contexto, conAgregado);

    const nombres = listarMovimientos(base.db, base.contexto, {}).map((m) => m.nombre);
    expect(nombres).not.toContain('Lo que el otro anoto');
  });

  it('lo de la cuenta compartida si entra', () => {
    const desdeElOtro = exportarRespaldo(base.db, base.contexto);
    const conAgregado = {
      ...desdeElOtro,
      movimientos: [
        ...desdeElOtro.movimientos,
        {
          ...desdeElOtro.movimientos.find((m) => m.cuentaId === compartida)!,
          id: 'movimiento-compartido',
          nombre: 'Lo que el otro pago',
          updatedAt: unSegundoDespues(desdeElOtro.movimientos[0]!.updatedAt),
        },
      ],
    };

    editarCuenta(base.db, base.contexto, privada, { sincroniza: false });
    fusionarRespaldo(base.db, base.contexto, conAgregado);

    const nombres = listarMovimientos(base.db, base.contexto, {}).map((m) => m.nombre);
    expect(nombres).toContain('Lo que el otro pago');
  });

  it('no borra lo que ya habia en la cuenta privada', () => {
    // Descartar lo remoto no puede convertirse en perder lo local.
    editarCuenta(base.db, base.contexto, privada, { sincroniza: false });
    const ajeno = exportarRespaldo(base.db, base.contexto, { soloSincronizables: true });

    fusionarRespaldo(base.db, base.contexto, ajeno);

    const nombres = listarMovimientos(base.db, base.contexto, {}).map((m) => m.nombre);
    expect(nombres).toContain('Regalo sorpresa');
  });
});
