/**
 * Categorias de gasto.
 *
 * Son el nivel raiz del arbol: el modelo de datos permite subcategorias, pero
 * estas doce son las que existen siempre y las unicas que la app garantiza. Un
 * gasto puede quedar **sin categoria** —el campo es opcional— y eso es un estado
 * valido, no un error a corregir.
 *
 * El orden no es alfabetico ni casual: va de lo mas comprometido a lo mas
 * discrecional, y ese mismo orden se usa en los selectores y en los listados.
 * Es el orden en que la plata efectivamente se va del mes.
 *
 * El **ingreso no lleva categoria**. Un sueldo no es un tipo de gasto, y meterlo
 * en la misma lista obligaria a filtrarla en cada pantalla.
 */

export type CategoryId =
  | 'vivienda'
  | 'servicios'
  | 'comida'
  | 'transporte'
  | 'salud'
  | 'personales'
  | 'familia'
  | 'regalos'
  | 'ahorros'
  | 'deudas'
  | 'impuestos'
  | 'trabajo';

export interface Category {
  readonly id: CategoryId;
  readonly nombre: string;
  /**
   * Version de una palabra, para listas densas.
   *
   * Existe porque en la tabla de gasto por categoria "Impuestos y obligaciones
   * legales" se cortaba en "Impuestos y ob…", que es peor que no mostrar nada:
   * la elipsis ocupa lugar y no informa. En el selector y en el detalle se usa
   * `nombre` completo.
   */
  readonly nombreCorto: string;
  /** Que entra y que no. Alimenta la ayuda del selector y las reglas de F4. */
  readonly descripcion: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'vivienda',
    nombre: 'Vivienda',
    nombreCorto: 'Vivienda',
    descripcion: 'Arriendo o dividendo, gastos comunes, contribuciones, reparaciones.',
  },
  {
    id: 'servicios',
    nombre: 'Servicios',
    nombreCorto: 'Servicios',
    descripcion: 'Luz, agua, gas, internet, celular y suscripciones de streaming.',
  },
  {
    id: 'comida',
    nombre: 'Comida',
    nombreCorto: 'Comida',
    descripcion: 'Supermercado, feria, delivery, restaurantes y café.',
  },
  {
    id: 'transporte',
    nombre: 'Transporte',
    nombreCorto: 'Transporte',
    descripcion: 'Bencina, peajes, transporte público, apps de viaje, mantención.',
  },
  {
    id: 'salud',
    nombre: 'Salud',
    nombreCorto: 'Salud',
    descripcion: 'Consultas, exámenes, farmacia, seguros y planes de salud.',
  },
  {
    id: 'personales',
    nombre: 'Personales',
    nombreCorto: 'Personales',
    descripcion: 'Ropa, cuidado personal, tecnología, ocio, hobbies y educación propia.',
  },
  {
    id: 'familia',
    nombre: 'Familia',
    nombreCorto: 'Familia',
    descripcion: 'Hijos, colegio, mascotas y aportes a familiares.',
  },
  {
    id: 'regalos',
    nombre: 'Regalos y donaciones',
    nombreCorto: 'Regalos',
    descripcion: 'Regalos, celebraciones y aportes a causas u organizaciones.',
  },
  {
    id: 'ahorros',
    nombre: 'Ahorros e inversiones',
    nombreCorto: 'Ahorros',
    descripcion: 'Aportes a fondos, depósito a plazo, APV y cuentas de ahorro.',
  },
  {
    id: 'deudas',
    nombre: 'Deudas y créditos',
    nombreCorto: 'Deudas',
    descripcion: 'Cuotas de crédito, pago de tarjeta, intereses y línea de crédito.',
  },
  {
    id: 'impuestos',
    nombre: 'Impuestos y obligaciones legales',
    nombreCorto: 'Impuestos',
    descripcion: 'Renta, permiso de circulación, multas, trámites y patentes.',
  },
  {
    id: 'trabajo',
    nombre: 'Trabajo y negocio',
    nombreCorto: 'Trabajo',
    descripcion: 'Insumos, herramientas, servicios y gastos del trabajo propio.',
  },
];

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((categoria) => categoria.id);

const BY_ID = new Map<CategoryId, Category>(CATEGORIES.map((categoria) => [categoria.id, categoria]));

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}

/**
 * Devuelve la categoria o `null` si el id no existe.
 *
 * Devuelve `null` en vez de lanzar porque el id puede venir de la base de datos
 * de otro dispositivo, escrita por una version futura de la app que agrego una
 * categoria: en modo hogar eso pasa, y no es motivo para reventar la pantalla.
 */
export function categoryById(id: string): Category | null {
  return BY_ID.get(id as CategoryId) ?? null;
}

/** El nombre para mostrar, con un respaldo para ids desconocidos. */
export function categoryName(id: string | undefined): string {
  if (id === undefined) return 'Sin categoría';
  return categoryById(id)?.nombre ?? id;
}

/** El nombre de una palabra, para listas densas donde el largo se corta. */
export function categoryShortName(id: string | undefined): string {
  if (id === undefined) return 'Sin categoría';
  return categoryById(id)?.nombreCorto ?? id;
}
