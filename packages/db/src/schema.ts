/**
 * Esquema de la base local.
 *
 * Nace **listo para sincronizar** aunque el motor de sync sea F5. Cada fila
 * lleva de quien es, quien la escribio, desde que dispositivo y cuando —en
 * reloj logico, no en fecha— y los borrados dejan lapida en vez de eliminar.
 *
 * Hacerlo despues obligaria a migrar cada fila ya escrita, y a decidir que
 * valores inventarle a las columnas nuevas.
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Columnas que lleva **toda** tabla sincronizable.
 *
 * `createdAt` y `updatedAt` son HLC en texto, no fechas: se comparan como
 * strings y ese orden coincide con el orden causal. Ver `core/sync/hlc`.
 *
 * `deletedAt` es la lapida. Una fila borrada **no se elimina**: se le pone la
 * marca. Sin eso, borrar en un dispositivo y editar en otro terminaria
 * resucitando la fila al fusionar, porque el que borro no tendria como contarlo.
 */
const sincronizable = {
  /** ULID: ordenable por tiempo de creacion y unico entre dispositivos. */
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  originDeviceId: text('origin_device_id').notNull(),
};

export const TIPOS_DE_CUENTA = ['corriente', 'vista', 'ahorro', 'credito', 'efectivo'] as const;
export type TipoDeCuenta = (typeof TIPOS_DE_CUENTA)[number];

export const cuentas = sqliteTable('cuentas', {
  ...sincronizable,
  nombre: text('nombre').notNull(),
  tipo: text('tipo', { enum: TIPOS_DE_CUENTA }).notNull(),
  /** ISO 4217. CLP por ahora; la columna existe para no migrar despues. */
  moneda: text('moneda').notNull().default('CLP'),
  /** Saldo con que arranca la cuenta, entero en la unidad menor. */
  saldoInicialMinor: integer('saldo_inicial_minor').notNull().default(0),
}, (tabla) => [
  index('cuentas_hogar_idx').on(tabla.householdId, tabla.deletedAt),
]);

export const TIPOS_DE_MOVIMIENTO = ['gasto', 'ingreso', 'transferencia'] as const;
export type TipoDeMovimiento = (typeof TIPOS_DE_MOVIMIENTO)[number];

export const movimientos = sqliteTable('movimientos', {
  ...sincronizable,
  cuentaId: text('cuenta_id').notNull(),
  tipo: text('tipo', { enum: TIPOS_DE_MOVIMIENTO }).notNull(),
  /**
   * Entero en la unidad menor, **siempre positivo**. El signo lo da `tipo`.
   *
   * Guardar el signo en el monto invita a que en algun lugar se sume sin mirar
   * el tipo y el resultado quede al reves sin que nada falle.
   */
  montoMinor: integer('monto_minor').notNull(),
  moneda: text('moneda').notNull().default('CLP'),
  /** Fecha civil `YYYY-MM-DD`. Sin hora y sin zona: ver `core/dates`. */
  ocurridoEn: text('ocurrido_en').notNull(),
  nombre: text('nombre').notNull(),
  /**
   * Id del catalogo de `core/categories`, o null. Es texto suelto a proposito:
   * si llega una categoria de una version mas nueva de la app en otro
   * dispositivo, la fila entra igual y la UI muestra el id crudo.
   */
  categoriaId: text('categoria_id'),
  notas: text('notas'),
}, (tabla) => [
  // El listado siempre filtra por hogar y descarta lapidas, y ordena por fecha.
  index('mov_hogar_fecha_idx').on(tabla.householdId, tabla.deletedAt, tabla.ocurridoEn),
  index('mov_cuenta_idx').on(tabla.cuentaId),
  index('mov_categoria_idx').on(tabla.categoriaId),
]);

/**
 * Ajustes locales del dispositivo, como clave-valor.
 *
 * **No lleva columnas de sync y no se sincroniza**: guarda justamente lo que
 * distingue a este aparato de los otros —su id de dispositivo— y el hogar al que
 * esta apuntando. Copiar eso a otro telefono seria un error, no una feature.
 */
export const ajustes = sqliteTable('ajustes', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
});

export type Ajuste = typeof ajustes.$inferSelect;

export type Cuenta = typeof cuentas.$inferSelect;
export type CuentaInsert = typeof cuentas.$inferInsert;
export type Movimiento = typeof movimientos.$inferSelect;
export type MovimientoInsert = typeof movimientos.$inferInsert;
