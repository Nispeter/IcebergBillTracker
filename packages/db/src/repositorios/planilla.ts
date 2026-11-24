/**
 * La planilla de una cuenta compartida: lo que se escribe en el Excel de la
 * carpeta, y cómo se leen de vuelta los cambios que alguien hizo en Google
 * Sheets.
 *
 * Acá no se abre ningún archivo: entra y sale como filas de celdas. Leer y
 * escribir el Excel es de la app, que es quien tiene la librería y la carpeta.
 *
 * ## Quién la escribe
 *
 * Solo el teléfono del miembro que creó la cuenta (`createdBy`, que no cambia
 * al editar). Si la escribieran los dos, cada uno pisaría la versión del otro
 * en la nube antes de que llegara, y los cambios hechos en Sheets se perderían
 * entre medio. El otro teléfono recibe todo igual, por los archivos de
 * sincronización de siempre.
 *
 * ## Cómo se sabe qué cambió
 *
 * Cada fila lleva, en dos columnas ocultas, el id del movimiento y su huella:
 * el contenido tal como la app lo escribió. Al leer:
 *
 * - Fila sin id: la agregó alguien en la planilla. Movimiento nuevo.
 * - Fila con id cuya huella ya no coincide: la corrigieron. Se edita.
 * - Id que la app escribió y ya no está: la borraron. Se borra.
 *
 * La lista de ids escritos viaja **dentro del mismo archivo**, en una hoja
 * oculta, y no guardada en el teléfono. Si alguien edita una versión vieja de
 * la planilla, los borrados se miden contra esa versión: un movimiento anotado
 * después en el teléfono no está en esa lista, así que no se toma por borrado.
 */

import { categories, dates } from '@iceberg/core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Contexto } from '../contexto';
import { categorias, cuentas, movimientos, type Categoria, type Cuenta, type Movimiento } from '../schema';
import type { BaseDeDatos } from '../tipos';
import { idDeCategoria } from './categorias';
import { borrarMovimiento, crearMovimiento, editarMovimiento, obtenerMovimiento } from './movimientos';

/** Los títulos de las columnas que se ven, en orden. */
export const COLUMNAS_DE_PLANILLA = ['Fecha', 'Descripción', 'Tipo', 'Monto', 'Categoría', 'Notas'] as const;

const NOMBRE_DE_TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' } as const;
type Tipo = keyof typeof NOMBRE_DE_TIPO;

/** Una fila lista para escribir. La fecha va como `YYYY-MM-DD`: la app la vuelve fecha de planilla. */
export interface FilaEscrita {
  readonly fecha: string;
  readonly descripcion: string;
  readonly tipo: string;
  readonly monto: number;
  readonly categoria: string;
  readonly notas: string;
  readonly id: string;
  readonly huella: string;
}

/**
 * Una fila tal como se leyó. Las celdas llegan como vinieron: texto, número o
 * nada. Las fechas que la planilla guarda como fecha llegan ya como
 * `YYYY-MM-DD`; las escritas a mano, como el texto que alguien tecleó.
 */
export interface FilaLeida {
  readonly fecha: unknown;
  readonly descripcion: unknown;
  readonly tipo: unknown;
  readonly monto: unknown;
  readonly categoria: unknown;
  readonly notas: unknown;
  readonly id: unknown;
  readonly huella: unknown;
}

export interface PlanillaLeida {
  /** La cuenta que dice la hoja oculta. Si no es la esperada, no se toca nada. */
  readonly cuentaId: string | null;
  /** Los ids que había cuando la app la escribió. */
  readonly idsEscritos: readonly string[];
  readonly filas: readonly FilaLeida[];
}

export interface ResultadoDePlanilla {
  readonly nuevas: number;
  readonly editadas: number;
  readonly borradas: number;
  /** Filas que no se pudieron entender: sin fecha válida, sin monto o sin descripción. */
  readonly ilegibles: number;
}

/** Las cuentas cuya planilla escribe este teléfono: compartidas, vivas y creadas por este miembro. */
export function cuentasConPlanilla(db: BaseDeDatos, contexto: Contexto): Cuenta[] {
  return (db.select().from(cuentas).where(and(
    eq(cuentas.householdId, contexto.householdId),
    isNull(cuentas.deletedAt),
    eq(cuentas.sincroniza, 1),
    eq(cuentas.createdBy, contexto.memberId),
  )!).all() as Cuenta[]);
}

// ────────────────────────────── escribir ──────────────────────────────

/** Los movimientos vivos de la cuenta, del más viejo al más nuevo: así se agrega abajo. */
export function filasDePlanilla(db: BaseDeDatos, contexto: Contexto, cuentaId: string): FilaEscrita[] {
  const catalogo = catalogoDeCategorias(db, contexto);
  const filas = db.select().from(movimientos).where(and(
    eq(movimientos.householdId, contexto.householdId),
    eq(movimientos.cuentaId, cuentaId),
    isNull(movimientos.deletedAt),
  )!).orderBy(asc(movimientos.ocurridoEn), asc(movimientos.createdAt)).all() as Movimiento[];

  return filas.map((m) => {
    const celdas = {
      fecha: m.ocurridoEn,
      descripcion: m.nombre,
      tipo: NOMBRE_DE_TIPO[m.tipo as Tipo] ?? m.tipo,
      monto: m.montoMinor,
      categoria: catalogo.nombre(m.categoriaId),
      notas: m.notas ?? '',
    };
    return { ...celdas, id: m.id, huella: huella(celdas) };
  });
}

/**
 * Si la planilla leída ya muestra exactamente estas filas. Entonces no hay
 * nada que reescribir, y no se pisa el formato que alguien le haya dado.
 */
export function planillaAlDia(escritas: readonly FilaEscrita[], leida: PlanillaLeida | null): boolean {
  if (leida === null) return false;
  if (leida.idsEscritos.length !== escritas.length) return false;
  if (leida.filas.length !== escritas.length) return false;
  return escritas.every((escrita, i) => {
    const fila = leida.filas[i]!;
    return leida.idsEscritos[i] === escrita.id
      && texto(fila.id) === escrita.id
      && texto(fila.huella) === escrita.huella
      && huellaDeLeida(fila) === escrita.huella;
  });
}

// ─────────────────────────────── leer ───────────────────────────────

/**
 * Lleva a la base lo que cambió en la planilla. Lo que se aplica queda como un
 * cambio hecho en este teléfono, con su hora, así que viaja al otro igual que
 * si se hubiera anotado acá.
 */
export function aplicarPlanilla(
  db: BaseDeDatos,
  contexto: Contexto,
  cuentaId: string,
  leida: PlanillaLeida,
): ResultadoDePlanilla {
  const resultado = { nuevas: 0, editadas: 0, borradas: 0, ilegibles: 0 };
  // Una planilla de otra cuenta (copiada, renombrada) no se mezcla con esta.
  if (leida.cuentaId !== cuentaId) return resultado;

  const catalogo = catalogoDeCategorias(db, contexto);
  const presentes = new Set<string>();

  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;

    for (const fila of leida.filas) {
      // Una fila con las celdas vaciadas cuenta como borrada, igual que si se
      // hubiera eliminado: por eso no se anota como presente.
      if (estaVacia(fila)) continue;
      const id = texto(fila.id);
      if (id !== '') presentes.add(id);

      const actual = id === '' ? null : obtenerMovimiento(base, contexto, id);
      const deEstaCuenta = actual !== null && actual.cuentaId === cuentaId;
      if (deEstaCuenta && huellaDeLeida(fila) === texto(fila.huella)) continue;
      // Sin tocar y de un movimiento que ya no está: se borró en un teléfono.
      if (id !== '' && !deEstaCuenta && huellaDeLeida(fila) === texto(fila.huella)) continue;

      const datos = interpretar(fila, catalogo);
      if (datos === null) { resultado.ilegibles += 1; continue; }

      if (deEstaCuenta) {
        editarMovimiento(base, contexto, id, datos);
        resultado.editadas += 1;
      } else {
        crearMovimiento(base, contexto, { cuentaId, ...datos });
        resultado.nuevas += 1;
      }
    }

    for (const id of leida.idsEscritos) {
      if (presentes.has(id)) continue;
      const actual = obtenerMovimiento(base, contexto, id);
      if (actual === null || actual.cuentaId !== cuentaId) continue;
      borrarMovimiento(base, contexto, id);
      resultado.borradas += 1;
    }
  });

  return resultado;
}

interface DatosDeFila {
  readonly ocurridoEn: dates.PlainDate;
  readonly nombre: string;
  readonly tipo: Tipo;
  readonly montoMinor: number;
  readonly categoriaId: string | null;
  readonly notas: string | null;
}

function interpretar(fila: FilaLeida, catalogo: CatalogoDeCategorias): DatosDeFila | null {
  const ocurridoEn = leerFecha(fila.fecha);
  const montoMinor = leerMonto(fila.monto);
  const nombre = texto(fila.descripcion);
  if (ocurridoEn === null || montoMinor === null || nombre === '') return null;
  const notas = texto(fila.notas);
  return {
    ocurridoEn,
    nombre,
    tipo: leerTipo(fila.tipo),
    montoMinor,
    categoriaId: catalogo.id(texto(fila.categoria)),
    notas: notas === '' ? null : notas,
  };
}

function estaVacia(fila: FilaLeida): boolean {
  return [fila.fecha, fila.descripcion, fila.tipo, fila.monto, fila.categoria, fila.notas]
    .every((celda) => texto(celda) === '');
}

function texto(celda: unknown): string {
  if (celda === null || celda === undefined) return '';
  return String(celda).trim().replace(/\s+/g, ' ');
}

/**
 * `YYYY-MM-DD` o lo que se escribe a mano en Chile: `24/11/2026`, `24-11-26`.
 */
function leerFecha(celda: unknown): dates.PlainDate | null {
  const escrita = texto(celda);
  const iso = dates.parsePlainDate(escrita);
  if (iso !== null) return iso;
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(escrita);
  if (local === null) return null;
  const anio = local[3]!.length === 2 ? 2000 + Number(local[3]) : Number(local[3]);
  return dates.parsePlainDate(
    `${anio}-${local[2]!.padStart(2, '0')}-${local[1]!.padStart(2, '0')}`,
  );
}

/**
 * Pesos enteros y positivos: el signo lo da el tipo. Un número de la planilla
 * se toma tal cual; uno escrito como texto, como en Chile (`$12.990`), sin
 * puntos ni signo.
 */
function leerMonto(celda: unknown): number | null {
  const numero = typeof celda === 'number'
    ? Math.round(Math.abs(celda))
    : Number(texto(celda).replace(/[^\d,]/g, '').replace(/,\d*$/, ''));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/** Vacío o desconocido es gasto: es casi todo lo que se anota. */
function leerTipo(celda: unknown): Tipo {
  const escrito = idDeCategoria(texto(celda));
  if (escrito.startsWith('ingreso')) return 'ingreso';
  if (escrito.startsWith('transfer')) return 'transferencia';
  return 'gasto';
}

// ─────────────────────────────── huellas ───────────────────────────────

interface Celdas {
  readonly fecha: string;
  readonly descripcion: string;
  readonly tipo: string;
  readonly monto: number;
  readonly categoria: string;
  readonly notas: string;
}

/**
 * El contenido de una fila, reducido a lo que importa: la misma fila escrita
 * por la app y devuelta por Sheets da la misma huella aunque cambie el formato
 * de la fecha, las mayúsculas o los espacios.
 */
function huella(celdas: Celdas): string {
  return fnv1a([
    celdas.fecha,
    texto(celdas.descripcion),
    leerTipo(celdas.tipo),
    String(celdas.monto),
    idDeCategoria(celdas.categoria),
    texto(celdas.notas),
  ].join('\u0001'));
}

/** La huella de lo que hay hoy en la fila, o una que no coincide con nada si no se entiende. */
function huellaDeLeida(fila: FilaLeida): string {
  const fecha = leerFecha(fila.fecha);
  const monto = leerMonto(fila.monto);
  if (fecha === null || monto === null) return 'ilegible';
  return huella({
    fecha,
    descripcion: texto(fila.descripcion),
    tipo: texto(fila.tipo),
    monto,
    categoria: texto(fila.categoria),
    notas: texto(fila.notas),
  });
}

/** FNV-1a de 32 bits: corto y suficiente para notar que una fila cambió. */
function fnv1a(entrada: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < entrada.length; i++) {
    hash ^= entrada.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ───────────────────────────── categorías ─────────────────────────────

interface CatalogoDeCategorias {
  nombre(id: string | null): string;
  /** El id de un nombre escrito en la planilla, o `null` si no es ninguna. */
  id(nombre: string): string | null;
}

/**
 * Los nombres como los ve la app: una propia viva primero (puede renombrar una
 * de la app), luego las de la app, luego las borradas, y si no, el id.
 */
function catalogoDeCategorias(db: BaseDeDatos, contexto: Contexto): CatalogoDeCategorias {
  const filas = db.select().from(categorias)
    .where(eq(categorias.householdId, contexto.householdId)).all() as Categoria[];
  const vivas = new Map(filas.filter((c) => c.deletedAt === null).map((c) => [c.id, c.nombre]));
  const todas = new Map(filas.map((c) => [c.id, c.nombre]));

  const porNombre = new Map<string, string>();
  for (const c of categories.CATEGORIES) {
    porNombre.set(idDeCategoria(c.id), c.id);
    porNombre.set(idDeCategoria(c.nombre), c.id);
    porNombre.set(idDeCategoria(c.nombreCorto), c.id);
  }
  for (const [id, nombre] of vivas) porNombre.set(idDeCategoria(nombre), id);

  return {
    nombre: (id) => (id === null
      ? ''
      : vivas.get(id) ?? categories.categoryById(id)?.nombre ?? todas.get(id) ?? id),
    id: (nombre) => (nombre === '' ? null : porNombre.get(idDeCategoria(nombre)) ?? null),
  };
}
