/**
 * Repositorio de reglas de recurrencia y de lo que se decide sobre ellas.
 *
 * La idea que sostiene el modulo: **la regla es el molde y las ocurrencias se
 * calculan**. En la base solo viven la regla y las decisiones ya tomadas
 * ("esta la pague", "esta la salto"). Lo pendiente no se guarda, porque se sabe
 * deducir: es toda ocurrencia sin decision.
 *
 * Materializar las pendientes obligaria a crearlas y borrarlas cada vez que la
 * regla cambia de dia o de monto, y a decidir que hacer con las que ya estaban
 * escritas. Asi, cambiar la regla cambia la proyeccion y no hay nada que migrar.
 */

import { dates, recurrence } from '@iceberg/core';
import { and, eq, gte, isNull, lte, type SQL } from 'drizzle-orm';
import { columnasEditadas, columnasNuevas, type Contexto } from '../contexto';
import {
  instancias, reglas,
  type EstadoDeInstancia, type Instancia, type Regla, type TipoDeMovimiento,
} from '../schema';
import type { BaseDeDatos } from '../tipos';
import { crearMovimiento, borrarMovimiento, RepositorioError } from './movimientos';

export interface DatosDeRegla {
  readonly cuentaId: string;
  readonly tipo: TipoDeMovimiento;
  readonly montoMinor: number;
  readonly nombre: string;
  readonly categoriaId?: string | null;
  readonly frecuencia: recurrence.Frecuencia;
  readonly cada: number;
  readonly desde: dates.PlainDate;
  readonly hasta?: dates.PlainDate | null;
  readonly notas?: string | null;
}

export interface CambiosDeRegla {
  readonly cuentaId?: string;
  readonly tipo?: TipoDeMovimiento;
  readonly montoMinor?: number;
  readonly nombre?: string;
  readonly categoriaId?: string | null;
  readonly frecuencia?: recurrence.Frecuencia;
  readonly cada?: number;
  readonly desde?: dates.PlainDate;
  readonly hasta?: dates.PlainDate | null;
  readonly activa?: boolean;
  readonly notas?: string | null;
}

/** Una ocurrencia concreta, con lo que se haya decidido sobre ella. */
export interface Tempano {
  readonly regla: Regla;
  readonly ocurreEn: dates.PlainDate;
  /** Lo que se pago de verdad si difiere, si no el monto de la regla. */
  readonly montoMinor: number;
  readonly estado: 'pendiente' | EstadoDeInstancia;
  readonly instanciaId: string | null;
  readonly movimientoId: string | null;
  /** Negativo si ya vencio. Cero es hoy. */
  readonly diasRestantes: number;
}

function validarDatos(datos: DatosDeRegla | CambiosDeRegla, base?: Regla): void {
  const frecuencia = datos.frecuencia ?? base?.frecuencia;
  const cada = datos.cada ?? base?.cada;
  const desde = datos.desde ?? base?.desde;
  const hasta = datos.hasta !== undefined ? datos.hasta : base?.hasta ?? null;
  if (frecuencia === undefined || cada === undefined || desde === undefined) return;

  const problema = recurrence.validarRegla({
    frecuencia: frecuencia as recurrence.Frecuencia,
    cada,
    desde: desde as dates.PlainDate,
    hasta: (hasta ?? null) as dates.PlainDate | null,
  });
  if (problema !== null) throw new RepositorioError(problema);
}

/** Las lapidas quedan fuera: para el resto de la app, la fila ya no existe. */
function reglasVivas(contexto: Contexto, extra: SQL[] = []): SQL {
  return and(
    eq(reglas.householdId, contexto.householdId),
    isNull(reglas.deletedAt),
    ...extra,
  )!;
}

export function crearRegla(db: BaseDeDatos, contexto: Contexto, datos: DatosDeRegla): Regla {
  validarDatos(datos);
  if (datos.montoMinor <= 0) {
    throw new RepositorioError(`el monto debe ser positivo, el signo lo da el tipo: ${datos.montoMinor}`);
  }
  const nombre = datos.nombre.trim();
  if (nombre.length === 0) throw new RepositorioError('el nombre no puede estar vacio');

  const fila = {
    ...columnasNuevas(contexto),
    cuentaId: datos.cuentaId,
    tipo: datos.tipo,
    montoMinor: datos.montoMinor,
    moneda: 'CLP',
    nombre,
    categoriaId: datos.categoriaId ?? null,
    frecuencia: datos.frecuencia,
    cada: datos.cada,
    desde: datos.desde,
    hasta: datos.hasta ?? null,
    activa: 1,
    notas: datos.notas ?? null,
  };
  db.insert(reglas).values(fila).run();
  return fila as Regla;
}

export function obtenerRegla(db: BaseDeDatos, contexto: Contexto, id: string): Regla | null {
  return db.select().from(reglas)
    .where(reglasVivas(contexto, [eq(reglas.id, id)]))
    .limit(1)
    .all()[0] ?? null;
}

/** La consulta sin ejecutar, para `useLiveQuery`. */
export function consultaDeReglas(db: BaseDeDatos, contexto: Contexto) {
  return db.select().from(reglas).where(reglasVivas(contexto)).orderBy(reglas.nombre);
}

export function listarReglas(db: BaseDeDatos, contexto: Contexto): Regla[] {
  return consultaDeReglas(db, contexto).all() as Regla[];
}

export function editarRegla(
  db: BaseDeDatos,
  contexto: Contexto,
  id: string,
  cambios: CambiosDeRegla,
): Regla | null {
  const actual = obtenerRegla(db, contexto, id);
  if (actual === null) return null;
  validarDatos(cambios, actual);

  const parche: Record<string, unknown> = { ...columnasEditadas(contexto) };
  if (cambios.cuentaId !== undefined) parche.cuentaId = cambios.cuentaId;
  if (cambios.tipo !== undefined) parche.tipo = cambios.tipo;
  if (cambios.montoMinor !== undefined) {
    if (cambios.montoMinor <= 0) throw new RepositorioError('el monto debe ser positivo');
    parche.montoMinor = cambios.montoMinor;
  }
  if (cambios.nombre !== undefined) parche.nombre = cambios.nombre.trim();
  if (cambios.categoriaId !== undefined) parche.categoriaId = cambios.categoriaId;
  if (cambios.frecuencia !== undefined) parche.frecuencia = cambios.frecuencia;
  if (cambios.cada !== undefined) parche.cada = cambios.cada;
  if (cambios.desde !== undefined) parche.desde = cambios.desde;
  if (cambios.hasta !== undefined) parche.hasta = cambios.hasta;
  if (cambios.activa !== undefined) parche.activa = cambios.activa ? 1 : 0;
  if (cambios.notas !== undefined) parche.notas = cambios.notas;

  db.update(reglas).set(parche).where(eq(reglas.id, id)).run();
  return obtenerRegla(db, contexto, id);
}

/**
 * Borrado logico de la regla.
 *
 * Las instancias ya decididas **no se tocan**: el movimiento que se pago existio
 * y sigue existiendo. Lo que desaparece es la proyeccion hacia adelante.
 */
export function borrarRegla(db: BaseDeDatos, contexto: Contexto, id: string): boolean {
  if (obtenerRegla(db, contexto, id) === null) return false;
  const ahora = contexto.ahora();
  db.update(reglas)
    .set({ deletedAt: ahora, updatedAt: ahora, originDeviceId: contexto.deviceId })
    .where(eq(reglas.id, id))
    .run();
  return true;
}

/** La consulta sin ejecutar de las decisiones del rango, para `useLiveQuery`. */
export function consultaDeInstancias(
  db: BaseDeDatos,
  contexto: Contexto,
  rango: dates.DateRange,
) {
  return db.select().from(instancias).where(and(
    eq(instancias.householdId, contexto.householdId),
    isNull(instancias.deletedAt),
    gte(instancias.ocurreEn, rango.start),
    lte(instancias.ocurreEn, rango.end),
  )!);
}

/**
 * Combina reglas y decisiones en las ocurrencias del rango, ordenadas por fecha.
 *
 * Va aparte de `proyectarTempanos` —que ademas consulta— porque la pantalla
 * necesita las dos listas por `useLiveQuery`, que entrega filas y no puede
 * llamar a una funcion que abre consultas por su cuenta. Con la parte pura
 * suelta, la app y los tests hacen la misma cuenta.
 *
 * Solo proyecta reglas activas: una apagada conserva su historia pero deja de
 * mirar hacia adelante.
 */
export function combinarTempanos(
  todasLasReglas: readonly Regla[],
  decisiones: readonly Instancia[],
  rango: dates.DateRange,
  hoy: dates.PlainDate,
): Tempano[] {
  const activas = todasLasReglas.filter((regla) => regla.activa === 1 && regla.deletedAt === null);

  // Clave compuesta: una regla puede tener varias fechas decididas en el rango.
  const porClave = new Map<string, Instancia>();
  for (const instancia of decisiones) {
    if (instancia.deletedAt !== null) continue;
    porClave.set(`${instancia.reglaId}|${instancia.ocurreEn}`, instancia);
  }

  const salida: Tempano[] = [];
  for (const regla of activas) {
    const fechas = recurrence.ocurrencias({
      frecuencia: regla.frecuencia as recurrence.Frecuencia,
      cada: regla.cada,
      desde: regla.desde as dates.PlainDate,
      hasta: (regla.hasta ?? null) as dates.PlainDate | null,
    }, rango);

    for (const ocurreEn of fechas) {
      const instancia = porClave.get(`${regla.id}|${ocurreEn}`);
      salida.push({
        regla,
        ocurreEn,
        montoMinor: instancia?.montoMinor ?? regla.montoMinor,
        estado: instancia?.estado ?? 'pendiente',
        instanciaId: instancia?.id ?? null,
        movimientoId: instancia?.movimientoId ?? null,
        diasRestantes: dates.daysBetween(hoy, ocurreEn),
      });
    }
  }

  return salida.sort((a, b) =>
    dates.compareDates(a.ocurreEn, b.ocurreEn) || a.regla.nombre.localeCompare(b.regla.nombre));
}

/** Lo mismo, consultando la base. Lo que usan los tests y cualquier script. */
export function proyectarTempanos(
  db: BaseDeDatos,
  contexto: Contexto,
  rango: dates.DateRange,
  hoy: dates.PlainDate,
): Tempano[] {
  return combinarTempanos(
    listarReglas(db, contexto),
    consultaDeInstancias(db, contexto, rango).all() as Instancia[],
    rango,
    hoy,
  );
}

/**
 * Marca una ocurrencia como pagada y **crea el movimiento**.
 *
 * Las dos cosas van juntas a proposito: marcar pagada sin registrar el gasto
 * dejaria el saldo mintiendo, y es exactamente el error que uno no notaria hasta
 * fin de mes.
 */
export function marcarPagada(
  db: BaseDeDatos,
  contexto: Contexto,
  reglaId: string,
  ocurreEn: dates.PlainDate,
  montoMinor?: number,
): Instancia {
  const regla = obtenerRegla(db, contexto, reglaId);
  if (regla === null) throw new RepositorioError(`no existe la regla ${reglaId}`);

  const yaEsta = instanciaDe(db, contexto, reglaId, ocurreEn);
  if (yaEsta !== null) throw new RepositorioError('esa fecha ya estaba resuelta');

  const monto = montoMinor ?? regla.montoMinor;
  const movimiento = crearMovimiento(db, contexto, {
    cuentaId: regla.cuentaId,
    tipo: regla.tipo,
    montoMinor: monto,
    ocurridoEn: ocurreEn,
    nombre: regla.nombre,
    categoriaId: regla.categoriaId,
  });

  const fila = {
    ...columnasNuevas(contexto),
    reglaId,
    ocurreEn,
    estado: 'pagada' as const,
    movimientoId: movimiento.id,
    // Solo se guarda si difiere: si no, el monto de la regla manda y cambiarlo
    // se refleja en todo lo que todavia no se pago.
    montoMinor: monto === regla.montoMinor ? null : monto,
  };
  db.insert(instancias).values(fila).run();
  return fila as Instancia;
}

/** Marca una ocurrencia como omitida. No crea movimiento: no hubo gasto. */
export function marcarOmitida(
  db: BaseDeDatos,
  contexto: Contexto,
  reglaId: string,
  ocurreEn: dates.PlainDate,
): Instancia {
  if (obtenerRegla(db, contexto, reglaId) === null) {
    throw new RepositorioError(`no existe la regla ${reglaId}`);
  }
  if (instanciaDe(db, contexto, reglaId, ocurreEn) !== null) {
    throw new RepositorioError('esa fecha ya estaba resuelta');
  }

  const fila = {
    ...columnasNuevas(contexto),
    reglaId,
    ocurreEn,
    estado: 'omitida' as const,
    movimientoId: null,
    montoMinor: null,
  };
  db.insert(instancias).values(fila).run();
  return fila as Instancia;
}

export function instanciaDe(
  db: BaseDeDatos,
  contexto: Contexto,
  reglaId: string,
  ocurreEn: dates.PlainDate,
): Instancia | null {
  return db.select().from(instancias)
    .where(and(
      eq(instancias.householdId, contexto.householdId),
      isNull(instancias.deletedAt),
      eq(instancias.reglaId, reglaId),
      eq(instancias.ocurreEn, ocurreEn),
    )!)
    .limit(1)
    .all()[0] as Instancia ?? null;
}

/**
 * Deshace la decision y vuelve a dejar la ocurrencia pendiente.
 *
 * Si habia movimiento, tambien se borra: se creo por esta marca y no por una
 * decision aparte del usuario. Dejarlo suelto seria peor que no deshacer nada,
 * porque el gasto quedaria sin nadie que lo reclame.
 */
export function desmarcar(
  db: BaseDeDatos,
  contexto: Contexto,
  reglaId: string,
  ocurreEn: dates.PlainDate,
): boolean {
  const instancia = instanciaDe(db, contexto, reglaId, ocurreEn);
  if (instancia === null) return false;

  if (instancia.movimientoId !== null) {
    borrarMovimiento(db, contexto, instancia.movimientoId);
  }
  const ahora = contexto.ahora();
  db.update(instancias)
    .set({ deletedAt: ahora, updatedAt: ahora, originDeviceId: contexto.deviceId })
    .where(eq(instancias.id, instancia.id))
    .run();
  return true;
}
