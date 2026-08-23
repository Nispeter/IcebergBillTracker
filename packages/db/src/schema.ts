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
  /**
   * Si esta cuenta viaja al sincronizar. 1 por omision.
   *
   * Existe para poder tener un libro compartido y otro que no: las cuentas de la
   * casa se comparten con quien corresponda y las personales se quedan en el
   * telefono. La marca es **local a cada aparato** aunque viaje en la fila: lo
   * que decide si algo entra o sale es siempre la marca del lado que exporta o
   * fusiona, nunca la que venga en el archivo. Si no fuera asi, el otro lado
   * podria volver a compartir una cuenta que uno acaba de sacar.
   */
  sincroniza: integer('sincroniza').notNull().default(1),
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
  /**
   * Si este gasto es un compromiso fijo. **Nulo significa "deducilo tu"**.
   *
   * La deduccion mira si el movimiento nacio de una cuenta periodica y, si no,
   * su categoria. Funciona de entrada pero se equivoca seguido, porque la
   * categoria es mal indicio: dentro de vivienda conviven el arriendo --que
   * llega igual-- y un desatornillador que uno decidio comprar. Son la misma
   * categoria y no son la misma clase de gasto.
   *
   * Por eso la columna admite tres estados y no dos: `null` deja que la app
   * decida, `1` y `0` son la persona diciendo que no. Un movimiento nuevo nace
   * en `null`, asi que nada cambia hasta que alguien corrija algo.
   */
  comprometido: integer('comprometido'),
  notas: text('notas'),
  /** El lote de importacion del que vino, o null si se creo a mano. */
  loteId: text('lote_id'),
  /**
   * La clave con la que se reconoce esta fila en el archivo de origen.
   *
   * Es lo que hace idempotente reimportar la misma cartola. Lleva un ordinal de
   * ocurrencia, asi que dos compras iguales el mismo dia en el mismo comercio
   * —que existen de verdad— conservan las dos su fila. Ver `core/csv`.
   */
  origenClave: text('origen_clave'),
}, (tabla) => [
  // El listado siempre filtra por hogar y descarta lapidas, y ordena por fecha.
  index('mov_hogar_fecha_idx').on(tabla.householdId, tabla.deletedAt, tabla.ocurridoEn),
  index('mov_cuenta_idx').on(tabla.cuentaId),
  index('mov_categoria_idx').on(tabla.categoriaId),
  // El chequeo de duplicados corre una vez por fila del archivo importado.
  index('mov_origen_idx').on(tabla.cuentaId, tabla.origenClave),
  index('mov_lote_idx').on(tabla.loteId),
]);

/**
 * Un lote de importacion.
 *
 * Existe para poder **deshacerlo entero**. Importar es la operacion que mas
 * filas escribe de una vez y la que mas facil sale mal —archivo equivocado,
 * cuenta equivocada—; sin una unidad que agrupe, revertir seria borrar a mano
 * doscientos movimientos.
 */
export const lotes = sqliteTable('lotes', {
  ...sincronizable,
  cuentaId: text('cuenta_id').notNull(),
  /** Nombre del archivo, para que el usuario reconozca cual fue. */
  archivo: text('archivo').notNull(),
  /** Cuantos movimientos entraron. Los omitidos por duplicados no cuentan. */
  cantidad: integer('cantidad').notNull(),
  /** Cuantos se saltaron por estar ya importados. */
  duplicados: integer('duplicados').notNull().default(0),
  /** Fecha civil del movimiento mas viejo y del mas nuevo del lote. */
  desde: text('desde'),
  hasta: text('hasta'),
}, (tabla) => [
  index('lotes_hogar_idx').on(tabla.householdId, tabla.deletedAt),
]);

/**
 * Reglas de recurrencia: "el arriendo, $450.000, el 5 de cada mes".
 *
 * La regla guarda **el molde**, no las fechas. Las ocurrencias se calculan con
 * `core/recurrence` cada vez que hacen falta. Materializar doce filas por regla
 * y por ano obligaria a reescribirlas todas cada vez que cambia el monto o el
 * dia, y a decidir que pasa con las que ya estaban.
 */
export const reglas = sqliteTable('reglas', {
  ...sincronizable,
  cuentaId: text('cuenta_id').notNull(),
  tipo: text('tipo', { enum: TIPOS_DE_MOVIMIENTO }).notNull(),
  /** Entero en la unidad menor, siempre positivo. El signo lo da `tipo`. */
  montoMinor: integer('monto_minor').notNull(),
  moneda: text('moneda').notNull().default('CLP'),
  nombre: text('nombre').notNull(),
  categoriaId: text('categoria_id'),
  /** `diaria` | `semanal` | `mensual` | `anual`, de `core/recurrence`. */
  frecuencia: text('frecuencia').notNull(),
  /** Cada cuantas unidades de la frecuencia. */
  cada: integer('cada').notNull().default(1),
  /** Fecha civil del ancla: dice tambien el dia del mes y el de la semana. */
  desde: text('desde').notNull(),
  /** Fecha civil de termino, inclusive. Null si no termina. */
  hasta: text('hasta'),
  /**
   * Una regla apagada deja de proyectar sin perder su historia.
   *
   * Se guarda como entero porque SQLite no tiene booleano.
   */
  activa: integer('activa').notNull().default(1),
  notas: text('notas'),
}, (tabla) => [
  index('reglas_hogar_idx').on(tabla.householdId, tabla.deletedAt),
]);

export const ESTADOS_DE_INSTANCIA = ['pagada', 'omitida'] as const;
export type EstadoDeInstancia = (typeof ESTADOS_DE_INSTANCIA)[number];

/**
 * Lo que se decidio sobre **una** ocurrencia concreta de una regla.
 *
 * Solo se guardan las decisiones, no las ocurrencias. Una fila aca significa
 * "esta fecha de esta regla ya la resolvi"; si no hay fila, la ocurrencia sigue
 * pendiente. Guardar tambien las pendientes seria guardar lo que ya se sabe
 * calcular, y habria que crearlas y borrarlas cada vez que la regla cambia.
 *
 * `movimientoId` enlaza con el gasto real cuando se marca pagada, para poder
 * deshacer sin adivinar cual de los movimientos del dia era.
 */
export const instancias = sqliteTable('instancias', {
  ...sincronizable,
  reglaId: text('regla_id').notNull(),
  /** Fecha civil de la ocurrencia, tal como la devuelve `core/recurrence`. */
  ocurreEn: text('ocurre_en').notNull(),
  estado: text('estado', { enum: ESTADOS_DE_INSTANCIA }).notNull(),
  /** El movimiento que se creo al marcarla pagada, si se creo. */
  movimientoId: text('movimiento_id'),
  /** Lo que se pago de verdad, si no coincide con el monto de la regla. */
  montoMinor: integer('monto_minor'),
}, (tabla) => [
  // Se consulta siempre "las decisiones de estas reglas en este rango".
  index('inst_regla_fecha_idx').on(tabla.reglaId, tabla.ocurreEn),
  index('inst_hogar_idx').on(tabla.householdId, tabla.deletedAt),
]);

/**
 * Quien escribe en este hogar.
 *
 * Cada fila de la base guarda en `createdBy` el id del miembro que la escribio,
 * pero un ULID no le dice nada a nadie. Esta tabla le pone nombre: sin ella, un
 * conflicto de sincronizacion dice "una version gano" y no **quien** la escribio,
 * que es justo lo que uno necesita saber para decidir si estuvo bien.
 *
 * Se sincroniza como todo lo demas, asi que cuando dos telefonos intercambian,
 * cada uno aprende el nombre del otro.
 */
/**
 * Categorias que agrega el usuario, ademas de las doce que trae la app.
 *
 * Las doce viven en `core/categories` y existen siempre: son el piso comun que
 * la app garantiza. Esta tabla es lo que alguien suma encima --"mascotas",
 * "auto", "el gimnasio"-- porque ninguna lista fija le calza a todo el mundo.
 *
 * **El id es el nombre normalizado**, no un ULID, y eso es a proposito. Primero
 * porque cualquier pantalla que no conozca la categoria muestra el id, y
 * "mascotas" se lee bien mientras que un ULID no dice nada. Y segundo porque si
 * dos personas del mismo hogar crean "Mascotas" cada una por su lado, las dos
 * filas tienen el mismo id y la fusion las junta en una sola en vez de dejar la
 * categoria duplicada.
 *
 * Se sincronizan: si no, el otro telefono recibiria movimientos con una
 * categoria que no sabe nombrar.
 */
export const categorias = sqliteTable('categorias', {
  ...sincronizable,
  nombre: text('nombre').notNull(),
}, (tabla) => [
  index('categorias_hogar_idx').on(tabla.householdId, tabla.deletedAt),
]);

export const miembros = sqliteTable('miembros', {
  ...sincronizable,
  nombre: text('nombre').notNull(),
  /**
   * El dispositivo desde el que se registro.
   *
   * Un miembro puede terminar con varios si cambia de telefono; se guarda el
   * ultimo, que es el unico util para reconocerlo.
   */
  dispositivoId: text('dispositivo_id').notNull(),
}, (tabla) => [
  index('miembros_hogar_idx').on(tabla.householdId, tabla.deletedAt),
]);

/**
 * Reglas propias de categorizacion: "si dice X, es comida".
 *
 * El catalogo de comercios que trae la app reconoce el 60 % de las filas que
 * tienen un comercio; el resto son negocios chicos —"COMERCIAL ALEXIS", "LA
 * MAGIA DE ALICI"— que ningun catalogo generico va a conocer y que solo el
 * dueno de la cuenta sabe clasificar.
 *
 * Se sincronizan: una regla escrita en un telefono le sirve al otro.
 */
export const reglasCategoria = sqliteTable('reglas_categoria', {
  ...sincronizable,
  /**
   * Se busca como subcadena en la descripcion normalizada.
   *
   * Se guarda ya normalizado —minusculas, sin tildes, sin espacios de sobra—
   * porque comparar contra un patron sin normalizar no calzaria nunca.
   */
  patron: text('patron').notNull(),
  categoriaId: text('categoria_id').notNull(),
}, (tabla) => [
  index('reglas_cat_hogar_idx').on(tabla.householdId, tabla.deletedAt),
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
export type Regla = typeof reglas.$inferSelect;
export type ReglaInsert = typeof reglas.$inferInsert;
export type Instancia = typeof instancias.$inferSelect;
export type InstanciaInsert = typeof instancias.$inferInsert;
export type Lote = typeof lotes.$inferSelect;
export type LoteInsert = typeof lotes.$inferInsert;
export type ReglaCategoria = typeof reglasCategoria.$inferSelect;
export type ReglaCategoriaInsert = typeof reglasCategoria.$inferInsert;
export type Miembro = typeof miembros.$inferSelect;
export type Categoria = typeof categorias.$inferSelect;
export type MiembroInsert = typeof miembros.$inferInsert;
