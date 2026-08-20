/**
 * Fusionar la base con la de otro dispositivo.
 *
 * El formato de intercambio es el **mismo del respaldo**: un JSON con todas las
 * filas y sus marcas de HLC. No hace falta otro. Un respaldo ya trae lo que la
 * fusión necesita —quién escribió cuándo, y las lápidas— porque el esquema nació
 * pensado para esto.
 *
 * La diferencia con restaurar es toda la que importa:
 *
 * | | Restaurar | Fusionar |
 * |---|---|---|
 * | Lo local | se borra | se conserva |
 * | Filas que solo están de un lado | quedan las del archivo | quedan las dos |
 * | Misma fila en los dos | la del archivo | la de `updatedAt` mayor |
 *
 * El motor está en `core/sync/fusion`, es puro y tiene un test de propiedad de
 * convergencia. Aquí solo se lee la base, se le pasa, y se escribe el resultado.
 */

import { sync } from '@iceberg/core';
import { eq } from 'drizzle-orm';
import type { Contexto } from '../contexto';
import {
  cuentas, instancias, lotes, movimientos, reglas, reglasCategoria,
} from '../schema';
import type { BaseDeDatos } from '../tipos';
import { leerRespaldo, type Respaldo } from './respaldo';

/** Lo que cambió en la base, por tabla y en total. */
export interface ResultadoDeSincronizacion {
  readonly porTabla: Record<string, sync.ResumenDeFusion>;
  readonly total: sync.ResumenDeFusion;
  /**
   * Hasta diez conflictos, con las dos versiones.
   *
   * Se recortan a proposito: la lista completa de una fusión grande no la mira
   * nadie, y lo que hace falta es que el usuario **sepa que pasó** y pueda ver
   * un par de ejemplos.
   */
  readonly ejemplos: readonly ConflictoLegible[];
}

export interface ConflictoLegible {
  readonly tabla: string;
  readonly id: string;
  readonly ganadora: string;
  readonly descartada: string;
}

const TOPE_DE_EJEMPLOS = 10;

/** Las tablas que se sincronizan, en orden de dependencia. */
const TABLAS = [
  { nombre: 'cuentas', tabla: cuentas, de: (r: Respaldo) => r.cuentas },
  { nombre: 'reglas', tabla: reglas, de: (r: Respaldo) => r.reglas },
  { nombre: 'lotes', tabla: lotes, de: (r: Respaldo) => r.lotes },
  { nombre: 'instancias', tabla: instancias, de: (r: Respaldo) => r.instancias },
  { nombre: 'movimientos', tabla: movimientos, de: (r: Respaldo) => r.movimientos },
  { nombre: 'reglas de categoría', tabla: reglasCategoria, de: (r: Respaldo) => r.reglasCategoria },
] as const;

const VACIO: sync.ResumenDeFusion = {
  nuevas: 0, actualizadas: 0, sinCambios: 0, conflictos: 0,
};

function sumar(a: sync.ResumenDeFusion, b: sync.ResumenDeFusion): sync.ResumenDeFusion {
  return {
    nuevas: a.nuevas + b.nuevas,
    actualizadas: a.actualizadas + b.actualizadas,
    sinCambios: a.sinCambios + b.sinCambios,
    conflictos: a.conflictos + b.conflictos,
  };
}

/** Cómo se nombra una fila para mostrarla en un conflicto. */
function describir(fila: Record<string, unknown>): string {
  const nombre = typeof fila.nombre === 'string' ? fila.nombre : String(fila.id);
  const monto = typeof fila.montoMinor === 'number' ? ` · ${fila.montoMinor}` : '';
  const borrada = fila.deletedAt === null ? '' : ' · borrada';
  return `${nombre}${monto}${borrada}`;
}

/**
 * Fusiona un respaldo ajeno con lo que hay, sin perder nada de ninguno de los dos.
 *
 * **Las filas remotas adoptan el hogar de este aparato**, por la misma razón que
 * al restaurar: si conservaran el suyo, entrarían pero ninguna consulta las
 * encontraría. El `householdId` es una clave de filtro local, no parte de la
 * identidad de la fila, y reescribirlo no toca `updatedAt`, así que la fusión
 * sigue siendo idempotente.
 */
export function fusionarRespaldo(
  db: BaseDeDatos,
  contexto: Contexto,
  crudo: unknown,
): ResultadoDeSincronizacion {
  const respaldo = leerRespaldo(crudo);
  adelantarReloj(contexto, respaldo);

  const porTabla: Record<string, sync.ResumenDeFusion> = {};
  const ejemplos: ConflictoLegible[] = [];
  let total = VACIO;

  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;

    for (const { nombre, tabla, de } of TABLAS) {
      // Se leen **con lápidas**: una fila borrada acá tiene que competir con su
      // versión remota, no desaparecer del cálculo.
      const locales = base.select().from(tabla)
        .where(eq(tabla.householdId, contexto.householdId))
        .all() as unknown as sync.FilaSincronizable[];

      const remotas = de(respaldo).map((fila) => ({
        ...fila,
        householdId: contexto.householdId,
      })) as unknown as sync.FilaSincronizable[];

      const resultado = sync.fusionarTabla(locales, remotas);
      const resumen = sync.resumirFusion(locales, resultado);
      porTabla[nombre] = resumen;
      total = sumar(total, resumen);

      for (const conflicto of resultado.conflictos) {
        if (ejemplos.length >= TOPE_DE_EJEMPLOS) break;
        ejemplos.push({
          tabla: nombre,
          id: conflicto.id,
          ganadora: describir(conflicto.ganadora as unknown as Record<string, unknown>),
          descartada: describir(conflicto.descartada as unknown as Record<string, unknown>),
        });
      }

      // Nada que escribir si el resultado es idéntico a lo que había.
      if (resumen.nuevas === 0 && resumen.actualizadas === 0) continue;

      base.delete(tabla).where(eq(tabla.householdId, contexto.householdId)).run();
      const TANDA = 200;
      const filas = resultado.filas as unknown as Record<string, unknown>[];
      for (let i = 0; i < filas.length; i += TANDA) {
        base.insert(tabla).values(filas.slice(i, i + TANDA) as never).run();
      }
    }
  });

  return { porTabla, total, ejemplos };
}

/**
 * Deja el reloj local por delante de todo lo que trae el archivo.
 *
 * Se hace **antes** de escribir nada. Si no, la primera edicion despues de
 * fusionar podria nacer con un sello menor que el de una fila recien recibida y
 * perder contra ella: el usuario editaria, guardaria, y su cambio desapareceria
 * en la siguiente fusion sin ningun error de por medio.
 */
function adelantarReloj(contexto: Contexto, respaldo: Respaldo): void {
  let mayor = '';
  for (const { de } of TABLAS) {
    for (const fila of de(respaldo)) {
      if (fila.updatedAt > mayor) mayor = fila.updatedAt;
    }
  }
  if (mayor !== '') contexto.recibir(mayor);
}
