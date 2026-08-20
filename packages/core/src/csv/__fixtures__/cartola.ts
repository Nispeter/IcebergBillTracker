/**
 * Cartola sintetica con la forma exacta de las de Banco de Chile.
 *
 * **No sale de un archivo real.** Las cartolas de verdad llevan nombre, RUT y
 * numero de cuenta, y viven en `datos-privados/`, que nunca se versiona. Esta
 * reproduce la estructura documentada en el ADR 0001 —columnas, fila de
 * encabezado, metadatos, centinelas— con datos inventados, y conserva a
 * proposito los cuatro casos borde que el parser tiene que resolver:
 *
 * 1. El **rollover de ano**: la primera fila es `30/12` en una cartola emitida
 *    el `30/01/2026`, o sea diciembre de 2025.
 * 2. El **duplicado legitimo**: dos compras iguales el mismo dia en el mismo
 *    comercio, que no se pueden colapsar en una.
 * 3. El **saldo disperso**: solo el ultimo movimiento de cada dia lo trae.
 * 4. Las **centinelas** `SALDO INICIAL` y `SALDO FINAL`.
 *
 * El rango util arranca en la columna B, asi que el indice 0 de cada fila es la
 * columna B: es lo que devuelve `sheet_to_json({ header: 1 })` sobre estas hojas.
 */

import type { Celda, Matriz } from '../cartola';

const vacia: Celda[] = [];

/** Una cartola de enero 2026 con el corte de ano en la primera fila. */
export const CARTOLA: Matriz = [
  vacia, vacia, vacia, vacia, vacia, vacia, vacia,
  ['Sr(a): ', 'JUANA PEREZ SOTO'],
  ['Rut:', '11.111.111-1'],
  ['Cuenta:', '00-000-00000-00'],
  ['Moneda:', 'Pesos Chilenos (CLP)'],
  vacia, vacia,
  ['Detalle Cartola Historica', null, 'Fecha de Emision', ' 30/01/2026'],
  vacia,
  ['Folio Cartola', 123],
  ['Saldo Contable', 500000],
  vacia, vacia,
  ['Saldo Inicial', 380000],
  ['Saldo Disponible', 500000],
  vacia, vacia, vacia,
  // Fila 24 (indice): el encabezado.
  ['Fecha', 'Descripcion', 'Canal o Sucursal', 'Cargos (PESOS)', 'Abonos (PESOS)', 'Saldo (PESOS)'],
  ['30/12', 'SALDO INICIAL', '', null, null, 380000],
  ['05/01', 'PAGO:SUPERMERCADO LIDER', 'INTERNET', 45000, null, null],
  ['05/01', 'PAGO:METRO SANTIAGO', 'INTERNET', 1500, null, 333500],
  ['12/01', 'PAGO:MERCADOPAGO*CONCE', 'INTERNET', 3600, null, null],
  // El duplicado legitimo: misma fecha, mismo comercio, mismo monto.
  ['12/01', 'PAGO:MERCADOPAGO*CONCE', 'INTERNET', 3600, null, 326300],
  ['20/01', 'ABONO REMUNERACION', 'CENTRAL', null, 850000, 1176300],
  ['28/01', 'PAGO CUENTA ENEL', 'OF. CONCEPCION', 32000, null, 1144300],
  ['30/01', 'SALDO FINAL', '', null, null, 1144300],
  vacia,
  ['Informate sobre la garantia estatal de los depositos en www.sbif.cl'],
  vacia,
];

/** La misma cartola sin la fila de `Fecha de Emision`. */
export const SIN_EMISION: Matriz = CARTOLA.map(
  (fila) => (fila[2] === 'Fecha de Emision' ? [] : fila),
);

/** Una hoja cualquiera que no es una cartola. */
export const NO_ES_CARTOLA: Matriz = [
  ['Producto', 'Cantidad', 'Precio'],
  ['Café', 2, 4500],
];
