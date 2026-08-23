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
  categorias, cuentas, instancias, lotes, miembros, movimientos, reglas, reglasCategoria,
  type Miembro, type Regla,
} from '../schema';
import type { BaseDeDatos } from '../tipos';
import { CLAVE_HOGAR, escribirAjuste } from './ajustes';
import { cuentasQueNoSincronizan } from './cuentas';
import { RepositorioError } from './movimientos';
import { leerRespaldo, sinLasCuentas, type Respaldo } from './respaldo';

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
  /** Quien escribio la version que quedo, si se sabe. */
  readonly escribioGanadora: string;
  readonly escribioDescartada: string;
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
  { nombre: 'miembros', tabla: miembros, de: (r: Respaldo) => r.miembros },
  { nombre: 'categorías', tabla: categorias, de: (r: Respaldo) => r.categorias },
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
 * Quien hizo la ultima escritura de una fila.
 *
 * Se mira `originDeviceId` y no `createdBy`: el conflicto es entre dos
 * **ediciones**, y quien creo la fila hace un ano no tiene nada que ver con
 * quien la cambio hoy. Devuelve cadena vacia si ese aparato no tiene todavia su
 * fila de miembro, que pasa cuando llega antes el movimiento que el nombre.
 */
function quienEscribio(
  fila: Record<string, unknown>,
  porDispositivo: ReadonlyMap<string, string>,
): string {
  const dispositivo = typeof fila.originDeviceId === 'string' ? fila.originDeviceId : '';
  return porDispositivo.get(dispositivo) ?? '';
}

/**
 * Une este aparato al hogar de otro.
 *
 * ## Por que hace falta, si fusionar ya funcionaba
 *
 * Funcionaba, y conviene ser exacto: las filas remotas **adoptan el hogar
 * local**, asi que dos telefonos que se intercambian archivos convergen sin
 * nada de esto. Lo que no habia era una forma de saber **de donde viene** un
 * archivo. Cualquier respaldo de cualquier persona entraba en silencio, y si
 * alguien te manda el suyo por equivocacion sus finanzas se mezclan con las
 * tuyas sin un solo aviso.
 *
 * Compartir el hogar convierte eso en una decision explicita: los dos aparatos
 * acuerdan un identificador, y desde ahi `fusionarRespaldo` puede distinguir
 * "esto es del hogar" de "esto viene de otra parte" y preguntar.
 *
 * ## Que reescribe
 *
 * El `householdId` de cada fila y el ajuste. **No toca `updatedAt`**, por la
 * misma razon que la fusion: el hogar es una clave de filtro local, no parte de
 * la identidad de la fila. Si lo tocara, unirse a un hogar haria que este
 * aparato ganara todos los conflictos contra el otro.
 *
 * La identidad del **aparato** y la del **miembro** no se tocan: son de este
 * telefono y tienen que seguir siendo distintas de las del otro.
 */
export function unirseAHogar(
  db: BaseDeDatos,
  contexto: Contexto,
  hogarNuevo: string,
): number {
  const limpio = hogarNuevo.trim();
  if (limpio === '') throw new RepositorioError('el código del hogar no puede estar vacío');
  if (limpio === contexto.householdId) return 0;

  let filas = 0;
  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;
    for (const { tabla } of TABLAS) {
      const afectadas = base.select().from(tabla)
        .where(eq(tabla.householdId, contexto.householdId)).all();
      base.update(tabla)
        .set({ householdId: limpio })
        .where(eq(tabla.householdId, contexto.householdId))
        .run();
      filas += afectadas.length;
    }
    escribirAjuste(base, CLAVE_HOGAR, limpio);
  });
  return filas;
}

/**
 * Fusiona un respaldo ajeno con lo que hay, sin perder nada de ninguno de los dos.
 *
 * **Las filas remotas adoptan el hogar de este aparato**, por la misma razón que
 * al restaurar: si conservaran el suyo, entrarían pero ninguna consulta las
 * encontraría. El `householdId` es una clave de filtro local, no parte de la
 * identidad de la fila, y reescribirlo no toca `updatedAt`, así que la fusión
 * sigue siendo idempotente.
 *
 * **Un archivo de otro hogar se rechaza salvo que se insista.** Es la unica
 * defensa contra mezclar las finanzas de otra persona con las propias por abrir
 * el archivo equivocado: sin esto, cualquier respaldo entra en silencio y
 * deshacerlo a mano es imposible.
 */
export class HogarAjenoError extends RepositorioError {
  override name = 'HogarAjenoError';

  constructor(readonly hogarDelArchivo: string) {
    super('Ese archivo viene de otro hogar, no del tuyo.');
  }
}

export interface OpcionesDeFusion {
  /** Fusionar igual aunque el archivo venga de otro hogar. */
  readonly permitirOtroHogar?: boolean;
}

export function fusionarRespaldo(
  db: BaseDeDatos,
  contexto: Contexto,
  crudo: unknown,
  opciones: OpcionesDeFusion = {},
): ResultadoDeSincronizacion {
  const leido = leerRespaldo(crudo);
  if (!opciones.permitirOtroHogar && leido.householdId !== contexto.householdId) {
    throw new HogarAjenoError(leido.householdId);
  }

  // Lo que llegue de una cuenta que este aparato marco como privada se descarta
  // antes de fusionar nada. Ver `sinLasCuentas`.
  const respaldo = sinLasCuentas(
    leido,
    cuentasQueNoSincronizan(db, contexto),
    db.select().from(reglas).where(eq(reglas.householdId, contexto.householdId)).all() as Regla[],
  );
  adelantarReloj(contexto, respaldo);

  const porTabla: Record<string, sync.ResumenDeFusion> = {};
  const ejemplos: ConflictoLegible[] = [];
  let total = VACIO;

  // Los nombres salen de los dos lados: el aparato que escribio la version
  // descartada puede ser justamente el que todavia no conocemos.
  const porDispositivo = new Map<string, string>();
  for (const miembro of [
    ...(db.select().from(miembros)
      .where(eq(miembros.householdId, contexto.householdId)).all() as Miembro[]),
    ...respaldo.miembros,
  ]) {
    if (miembro.deletedAt === null) porDispositivo.set(miembro.dispositivoId, miembro.nombre);
  }

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
        const gana = conflicto.ganadora as unknown as Record<string, unknown>;
        const pierde = conflicto.descartada as unknown as Record<string, unknown>;
        ejemplos.push({
          tabla: nombre,
          id: conflicto.id,
          ganadora: describir(gana),
          descartada: describir(pierde),
          escribioGanadora: quienEscribio(gana, porDispositivo),
          escribioDescartada: quienEscribio(pierde, porDispositivo),
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

/** Lo que dejó una pasada por la carpeta compartida. */
export interface ResultadoDeVarios extends ResultadoDeSincronizacion {
  /** Cuántos archivos entraron. */
  readonly fusionados: number;
  /**
   * Cuántos se saltaron por venir de otro hogar.
   *
   * Se cuentan en vez de tirar error: en una carpeta compartida basta que
   * alguien deje ahí el archivo de otra casa para que la sincronización entera
   * dejara de funcionar, y lo que corresponde es ignorarlo y seguir.
   */
  readonly ajenos: number;
}

/**
 * Fusiona varios archivos, sin que uno malo eche a perder al resto.
 *
 * Es la operación de la carpeta compartida: ahí adentro hay un archivo por
 * aparato y todos se leen de una vez. Cada uno se fusiona por separado --la
 * fusión es idempotente y conmutativa, así que el orden no importa-- y los
 * totales se suman.
 */
export function fusionarVarios(
  db: BaseDeDatos,
  contexto: Contexto,
  archivos: readonly unknown[],
  opciones: OpcionesDeFusion = {},
): ResultadoDeVarios {
  const porTabla: Record<string, sync.ResumenDeFusion> = {};
  const ejemplos: ConflictoLegible[] = [];
  let total = VACIO;
  let fusionados = 0;
  let ajenos = 0;

  for (const archivo of archivos) {
    let resultado: ResultadoDeSincronizacion;
    try {
      resultado = fusionarRespaldo(db, contexto, archivo, opciones);
    } catch (e) {
      if (e instanceof HogarAjenoError) { ajenos += 1; continue; }
      throw e;
    }
    fusionados += 1;
    total = sumar(total, resultado.total);
    for (const [nombre, resumen] of Object.entries(resultado.porTabla)) {
      porTabla[nombre] = sumar(porTabla[nombre] ?? VACIO, resumen);
    }
    // El mismo recorte que hace una fusión sola: diez alcanzan para entender
    // qué pasó, y la lista completa de varios archivos no la mira nadie.
    for (const conflicto of resultado.ejemplos) {
      if (ejemplos.length < 10) ejemplos.push(conflicto);
    }
  }

  return { porTabla, total, ejemplos, fusionados, ajenos };
}
