/**
 * Reglas propias de categorizacion, y aplicarlas a lo que ya esta guardado.
 *
 * El catalogo que trae la app reconoce el 60 % de las filas que tienen un
 * comercio. El resto son negocios chicos que solo el dueno de la cuenta sabe
 * clasificar, y escribir una regla una vez es mucho mejor que categorizar el
 * mismo almacen todos los meses.
 *
 * Dos piezas:
 *
 * 1. El **catalogo combinado**: las reglas propias primero, las de la app
 *    despues. Empatan por largo, gana la propia.
 * 2. **Aplicar** el catalogo a los movimientos que quedaron sin categoria. Sin
 *    esto, una regla nueva solo serviria para lo que se importe de aqui en
 *    adelante, y lo que ya esta —que es el motivo de escribirla— quedaria igual.
 */

import { categories, rules } from '@iceberg/core';
import { and, eq, isNull } from 'drizzle-orm';
import { columnasEditadas, columnasNuevas, type Contexto } from '../contexto';
import { movimientos, reglasCategoria, type Movimiento, type ReglaCategoria } from '../schema';
import type { BaseDeDatos } from '../tipos';
import { listarCategorias } from './categorias';
import { RepositorioError } from './movimientos';

export interface DatosDeReglaCategoria {
  readonly patron: string;
  /** `string` y no `CategoryId`: puede ser una categoria propia del hogar. */
  readonly categoriaId: string;
}

export function crearReglaDeCategoria(
  db: BaseDeDatos,
  contexto: Contexto,
  datos: DatosDeReglaCategoria,
): ReglaCategoria {
  // Se guarda normalizado porque asi es como se va a comparar. Un patron con
  // mayusculas o tildes no calzaria nunca y el usuario no tendria como saberlo.
  const patron = rules.normalizar(datos.patron);
  if (patron === '') throw new RepositorioError('el patrón no puede estar vacío');
  // Las propias cuentan igual que las de la app: si alguien creo "mascotas",
  // poder escribir "si dice VETERINARIA, es mascotas" es justamente el motivo.
  if (categories.categoryById(datos.categoriaId) === null
    && !listarCategorias(db, contexto).some((c) => c.id === datos.categoriaId)) {
    throw new RepositorioError(`no existe la categoría ${datos.categoriaId}`);
  }
  if (listarReglasDeCategoria(db, contexto).some((r) => r.patron === patron)) {
    throw new RepositorioError(`ya hay una regla para "${patron}"`);
  }

  const fila: ReglaCategoria = {
    ...columnasNuevas(contexto),
    patron,
    categoriaId: datos.categoriaId,
  };
  db.insert(reglasCategoria).values(fila).run();
  return fila;
}

/** La consulta sin ejecutar, para `useLiveQuery`. */
export function consultaDeReglasDeCategoria(db: BaseDeDatos, contexto: Contexto) {
  return db.select().from(reglasCategoria)
    .where(and(
      eq(reglasCategoria.householdId, contexto.householdId),
      isNull(reglasCategoria.deletedAt),
    )!)
    .orderBy(reglasCategoria.patron);
}

export function listarReglasDeCategoria(db: BaseDeDatos, contexto: Contexto): ReglaCategoria[] {
  return consultaDeReglasDeCategoria(db, contexto).all() as ReglaCategoria[];
}

export function borrarReglaDeCategoria(
  db: BaseDeDatos,
  contexto: Contexto,
  id: string,
): boolean {
  const existe = listarReglasDeCategoria(db, contexto).some((r) => r.id === id);
  if (!existe) return false;
  const ahora = contexto.ahora();
  db.update(reglasCategoria)
    .set({ deletedAt: ahora, updatedAt: ahora, originDeviceId: contexto.deviceId })
    .where(eq(reglasCategoria.id, id))
    .run();
  return true;
}

/**
 * El catalogo que usa la app: lo propio primero, lo que trae la app despues.
 *
 * `rules.categorizar` elige el patron mas largo que calce y, en empate, el
 * primero del arreglo. Poniendo las propias adelante, una regla del usuario le
 * gana a una de la app del mismo largo.
 */
export function catalogoDe(
  db: BaseDeDatos,
  contexto: Contexto,
): rules.ReglaDeCategoria[] {
  return [
    ...listarReglasDeCategoria(db, contexto).map((r) => ({
      patron: r.patron,
      categoriaId: r.categoriaId,
    })),
    ...rules.REGLAS_CHILE,
  ];
}

/** Los gastos sin categoria que el catalogo actual sabria clasificar. */
export function sinCategoriaQueSeReconocen(
  db: BaseDeDatos,
  contexto: Contexto,
): { movimiento: Movimiento; categoriaId: string }[] {
  const catalogo = catalogoDe(db, contexto);
  const pendientes = db.select().from(movimientos)
    .where(and(
      eq(movimientos.householdId, contexto.householdId),
      isNull(movimientos.deletedAt),
      isNull(movimientos.categoriaId),
      eq(movimientos.tipo, 'gasto'),
    )!)
    .all() as Movimiento[];

  const salida: { movimiento: Movimiento; categoriaId: string }[] = [];
  for (const movimiento of pendientes) {
    const categoriaId = rules.categorizar(movimiento.nombre, catalogo);
    if (categoriaId !== null) salida.push({ movimiento, categoriaId });
  }
  return salida;
}

/**
 * Categoriza los gastos que quedaron sin categoria. Devuelve cuantos cambiaron.
 *
 * **Solo toca los que no tienen ninguna.** Recategorizar lo que ya tiene una
 * pisaria las correcciones hechas a mano, que son justamente las que hay que
 * respetar: si alguien movio un gasto de "comida" a "familia", sabe algo que la
 * regla no.
 */
export function aplicarCategorias(db: BaseDeDatos, contexto: Contexto): number {
  const porCategorizar = sinCategoriaQueSeReconocen(db, contexto);
  if (porCategorizar.length === 0) return 0;

  db.transaction((tx) => {
    const base = tx as unknown as BaseDeDatos;
    for (const { movimiento, categoriaId } of porCategorizar) {
      base.update(movimientos)
        .set({ ...columnasEditadas(contexto), categoriaId })
        .where(eq(movimientos.id, movimiento.id))
        .run();
    }
  });

  return porCategorizar.length;
}
