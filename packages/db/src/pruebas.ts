/**
 * Base de datos en memoria para los tests.
 *
 * No se exporta desde `index.ts` a proposito: `better-sqlite3` es una
 * dependencia de desarrollo y no debe terminar en el bundle de la app.
 *
 * Que esto exista es el punto de tener los repositorios en un paquete y no en
 * las pantallas: la logica de datos se prueba en Node en milisegundos, con la
 * base real y las migraciones reales, sin emulador ni navegador.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { crearContexto, type Contexto } from './contexto';
import type { BaseDeDatos } from './tipos';

const AQUI = dirname(fileURLToPath(import.meta.url));
const MIGRACIONES = resolve(AQUI, '..', 'migraciones');

export interface BaseDePrueba {
  readonly db: BaseDeDatos;
  readonly contexto: Contexto;
  /** Avanza el reloj de pared simulado. */
  avanzarReloj(millis: number): void;
  cerrar(): void;
}

export interface OpcionesDePrueba {
  readonly householdId?: string;
  readonly deviceId?: string;
  readonly memberId?: string;
  /** Momento inicial del reloj simulado. */
  readonly desde?: number;
}

let secuencia = 0;

export function crearBaseDePrueba(opciones: OpcionesDePrueba = {}): BaseDePrueba {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite) as unknown as BaseDeDatos;
  migrate(drizzle(sqlite), { migrationsFolder: MIGRACIONES });

  let reloj = opciones.desde ?? 1_756_000_000_000;

  const contexto = crearContexto({
    householdId: opciones.householdId ?? 'hogar1',
    deviceId: opciones.deviceId ?? 'telefono1',
    memberId: opciones.memberId ?? 'nico',
    reloj: () => reloj,
    // Ids deterministas y ordenables, para que los tests puedan afirmar el
    // orden sin depender del azar.
    generarId: () => `id${String(secuencia++).padStart(6, '0')}`,
  });

  return {
    db,
    contexto,
    avanzarReloj(millis) { reloj += millis; },
    cerrar() { sqlite.close(); },
  };
}
