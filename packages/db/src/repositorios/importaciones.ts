/**
 * Importar un archivo de movimientos, y poder deshacerlo entero.
 *
 * Dos cosas sostienen el modulo:
 *
 * 1. **Reimportar el mismo archivo no duplica nada.** Cada fila trae una clave
 *    estable desde `core/csv`, y las que ya estan se saltan. Es el criterio de
 *    verificacion de F4.
 * 2. **Un lote se deshace de una.** Importar es lo que mas filas escribe de una
 *    vez y lo que mas facil sale mal —archivo equivocado, cuenta equivocada—.
 *    Sin una unidad que agrupe, revertir seria borrar doscientas filas a mano.
 *
 * La categorizacion automatica se aplica **aca** y no en la pantalla, para que
 * cualquier camino de importacion —hoy la cartola, manana un CSV— clasifique
 * igual.
 */

import { csv, dates, rules } from '@iceberg/core';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { columnasNuevas, type Contexto } from '../contexto';
import { lotes, movimientos, type Lote, type Movimiento } from '../schema';
import type { BaseDeDatos } from '../tipos';
import { RepositorioError } from './movimientos';

export interface DatosDeImportacion {
  readonly cuentaId: string;
  /** Nombre del archivo, para que el usuario reconozca el lote despues. */
  readonly archivo: string;
  readonly movimientos: readonly csv.MovimientoImportado[];
}

export interface Previsualizacion {
  /** Los que entrarian, ya categorizados. */
  readonly nuevos: readonly MovimientoAImportar[];
  /** Cuantos se saltarian por estar ya importados. */
  readonly duplicados: number;
  /** De los nuevos, cuantos quedarian con categoria. */
  readonly categorizados: number;
  readonly desde: dates.PlainDate | null;
  readonly hasta: dates.PlainDate | null;
}

export interface MovimientoAImportar {
  readonly ocurridoEn: dates.PlainDate;
  readonly nombre: string;
  readonly montoMinor: number;
  readonly tipo: 'gasto' | 'ingreso';
  readonly categoriaId: string | null;
  readonly clave: string;
}

/** Las claves de esa cuenta que ya estan en la base. */
function clavesYaImportadas(
  db: BaseDeDatos,
  contexto: Contexto,
  cuentaId: string,
  claves: readonly string[],
): Set<string> {
  if (claves.length === 0) return new Set();

  // SQLite tiene un tope de variables por consulta (999 por defecto), y una
  // cartola de un ano pasa de eso. Se pregunta por tandas.
  const TANDA = 400;
  const encontradas = new Set<string>();
  for (let i = 0; i < claves.length; i += TANDA) {
    const filas = db.select({ clave: movimientos.origenClave })
      .from(movimientos)
      .where(and(
        eq(movimientos.householdId, contexto.householdId),
        isNull(movimientos.deletedAt),
        eq(movimientos.cuentaId, cuentaId),
        inArray(movimientos.origenClave, claves.slice(i, i + TANDA)),
      )!)
      .all() as { clave: string | null }[];
    for (const fila of filas) if (fila.clave !== null) encontradas.add(fila.clave);
  }
  return encontradas;
}

/**
 * Que pasaria si se importa, sin escribir nada.
 *
 * Existe para que la vista previa muestre numeros de verdad y no una promesa:
 * cuantos entran, cuantos ya estaban y cuantos quedan sin categoria.
 */
export function previsualizarImportacion(
  db: BaseDeDatos,
  contexto: Contexto,
  datos: DatosDeImportacion,
): Previsualizacion {
  const yaEstan = clavesYaImportadas(
    db, contexto, datos.cuentaId, datos.movimientos.map((m) => m.clave),
  );

  const nuevos: MovimientoAImportar[] = [];
  let duplicados = 0;
  for (const movimiento of datos.movimientos) {
    if (yaEstan.has(movimiento.clave)) {
      duplicados += 1;
      continue;
    }
    nuevos.push({
      ocurridoEn: movimiento.ocurridoEn,
      nombre: movimiento.descripcion,
      montoMinor: movimiento.montoMinor,
      tipo: movimiento.tipo,
      // Solo los gastos llevan categoria: un sueldo no es un tipo de gasto.
      categoriaId: movimiento.tipo === 'gasto' ? rules.categorizar(movimiento.descripcion) : null,
      clave: movimiento.clave,
    });
  }

  const fechas = nuevos.map((m) => m.ocurridoEn).sort(dates.compareDates);
  return {
    nuevos,
    duplicados,
    categorizados: nuevos.filter((m) => m.categoriaId !== null).length,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
  };
}

/**
 * Escribe el lote. Devuelve el lote creado, o `null` si no habia nada nuevo.
 *
 * Todo va **dentro de una transaccion**: un lote a medio escribir es peor que
 * ninguno, porque nadie sabria hasta donde llego.
 */
export function importarLote(
  db: BaseDeDatos,
  contexto: Contexto,
  datos: DatosDeImportacion,
): Lote | null {
  if (datos.archivo.trim() === '') throw new RepositorioError('el archivo necesita un nombre');

  const previa = previsualizarImportacion(db, contexto, datos);
  if (previa.nuevos.length === 0) return null;

  const lote = {
    ...columnasNuevas(contexto),
    cuentaId: datos.cuentaId,
    archivo: datos.archivo.trim(),
    cantidad: previa.nuevos.length,
    duplicados: previa.duplicados,
    desde: previa.desde,
    hasta: previa.hasta,
  };

  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;
    base.insert(lotes).values(lote).run();
    for (const movimiento of previa.nuevos) {
      base.insert(movimientos).values({
        ...columnasNuevas(contexto),
        cuentaId: datos.cuentaId,
        tipo: movimiento.tipo,
        montoMinor: movimiento.montoMinor,
        moneda: 'CLP',
        ocurridoEn: movimiento.ocurridoEn,
        nombre: movimiento.nombre,
        categoriaId: movimiento.categoriaId,
        notas: null,
        loteId: lote.id,
        origenClave: movimiento.clave,
      }).run();
    }
  });

  return lote as Lote;
}

function lotesVivos(contexto: Contexto, extra: SQL[] = []): SQL {
  return and(eq(lotes.householdId, contexto.householdId), isNull(lotes.deletedAt), ...extra)!;
}

/** La consulta sin ejecutar, para `useLiveQuery`. */
export function consultaDeLotes(db: BaseDeDatos, contexto: Contexto) {
  return db.select().from(lotes).where(lotesVivos(contexto)).orderBy(lotes.createdAt);
}

export function listarLotes(db: BaseDeDatos, contexto: Contexto): Lote[] {
  return consultaDeLotes(db, contexto).all() as Lote[];
}

export function obtenerLote(db: BaseDeDatos, contexto: Contexto, id: string): Lote | null {
  return db.select().from(lotes).where(lotesVivos(contexto, [eq(lotes.id, id)])).limit(1)
    .all()[0] ?? null;
}

export function movimientosDelLote(
  db: BaseDeDatos,
  contexto: Contexto,
  loteId: string,
): Movimiento[] {
  return db.select().from(movimientos).where(and(
    eq(movimientos.householdId, contexto.householdId),
    isNull(movimientos.deletedAt),
    eq(movimientos.loteId, loteId),
  )!).all() as Movimiento[];
}

/**
 * Deshace un lote entero: lapida a sus movimientos y al lote.
 *
 * **Lo editado a mano tambien se va.** Un movimiento que vino del archivo y
 * despues se recategorizo sigue siendo del archivo; dejarlo huerfano seria
 * peor, porque volveria a entrar en la proxima importacion —su clave ya no
 * estaria— y quedaria duplicado.
 */
export function deshacerLote(db: BaseDeDatos, contexto: Contexto, loteId: string): number {
  if (obtenerLote(db, contexto, loteId) === null) return 0;

  const delLote = movimientosDelLote(db, contexto, loteId);
  const ahora = contexto.ahora();
  const lapida = { deletedAt: ahora, updatedAt: ahora, originDeviceId: contexto.deviceId };

  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;
    for (const movimiento of delLote) {
      base.update(movimientos).set(lapida).where(eq(movimientos.id, movimiento.id)).run();
    }
    base.update(lotes).set(lapida).where(eq(lotes.id, loteId)).run();
  });

  return delLote.length;
}
