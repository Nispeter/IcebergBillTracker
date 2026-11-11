/**
 * La forma minima que necesita el motor de metricas.
 *
 * A proposito **no** es la fila de la base: analytics no sabe de SQLite, de
 * lapidas ni de columnas de sync. Recibe una lista de cosas con tipo, monto y
 * fecha, y devuelve numeros. Eso permite correr todo el motor sobre la semilla,
 * sobre un fixture escrito a mano en un test, o sobre lo que salga del
 * repositorio, sin cambiar una linea.
 */

import type { PlainDate } from '../dates/index';

export type TipoDeMovimiento = 'gasto' | 'ingreso' | 'transferencia';

export interface MovimientoAnalizable {
  readonly tipo: TipoDeMovimiento;
  /** Entero positivo en la unidad menor. El signo lo da `tipo`. */
  readonly montoMinor: number;
  readonly ocurridoEn: PlainDate;
  /** Id del catalogo de categorias, o null si no tiene. */
  readonly categoriaId?: string | null;
  readonly nombre?: string;
}

/**
 * Las transferencias no son ni gasto ni ingreso: mueven plata entre cuentas
 * propias, y contarlas inflaria cada metrica con plata que nunca se gasto.
 */
export function esGasto(movimiento: MovimientoAnalizable): boolean {
  return movimiento.tipo === 'gasto';
}

export function esIngreso(movimiento: MovimientoAnalizable): boolean {
  return movimiento.tipo === 'ingreso';
}
