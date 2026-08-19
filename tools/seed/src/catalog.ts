/**
 * Catalogo de gasto chileno.
 *
 * Los comercios y montos son los de un hogar real en Chile en 2026, porque el
 * dataset tiene que servir para dos cosas: probar la matematica de analytics y
 * mirar la pantalla y que se vea creible. Un set de datos con montos redondos y
 * nombres genericos no revela ninguno de los dos problemas.
 *
 * El catalogo cubre **las doce categorias** a proposito. En la vida real un
 * hogar puede no tener deuda ni hijos, pero un dataset con categorias vacias
 * dejaria sin probar justo el codigo que las recorre.
 */

import type { categories } from '@iceberg/core';

type CategoryId = categories.CategoryId;

export type Movement = 'gasto' | 'ingreso';

export interface RecurringSpec {
  readonly name: string;
  /** Ausente en los ingresos: un sueldo no es un tipo de gasto. */
  readonly category?: CategoryId;
  readonly type: Movement;
  /** Dia del mes. Se recorta al ultimo dia si el mes es mas corto. */
  readonly dayOfMonth: number;
  readonly center: number;
  readonly spread: number;
  /**
   * Meses (1-12) en que ocurre. Ausente significa todos los meses.
   *
   * Existe por los impuestos: el permiso de circulacion es una vez al ano y las
   * contribuciones son cuatro cuotas. Modelarlos como mensuales daria un gasto
   * fijo que no existe y arruinaria la proyeccion de fin de mes.
   */
  readonly months?: readonly number[];
  /**
   * Factor por mes (1-12). El gas y la luz suben fuerte en invierno austral
   * (junio a agosto), y es justo el tipo de estacionalidad que el motor de
   * anomalias no debe confundir con un gasto raro.
   */
  readonly seasonal?: readonly number[];
}

export interface VariableSpec {
  readonly category: CategoryId;
  readonly merchants: readonly string[];
  readonly type: Movement;
  /** Cantidad de veces al mes, entre min y max. */
  readonly perMonth: readonly [number, number];
  readonly center: number;
  readonly spread: number;
  /** Si prefiere fin de semana (delivery, restaurantes). */
  readonly weekendBias?: boolean;
  /** Factor por mes (1-12), igual que en los recurrentes. */
  readonly seasonal?: readonly number[];
}

const NEUTRO = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const;

/** Invierno austral: junio, julio y agosto. */
const INVIERNO = [1, 1, 1, 1.2, 1.5, 2.1, 2.3, 2, 1.4, 1.1, 1, 1] as const;

/** Diciembre de regalos y marzo de vuelta a clases. */
const FIESTAS = [0.9, 0.9, 1.3, 1, 1, 1, 1, 1, 1, 1, 1.1, 1.8] as const;

/** Saldo con que arranca la cuenta el primer dia del dataset. */
export const SALDO_INICIAL = 380_000;

export const RECURRENTES: readonly RecurringSpec[] = [
  // Ingreso — sin categoria
  { name: 'Sueldo', type: 'ingreso', dayOfMonth: 30, center: 1_480_000, spread: 15_000 },

  // Vivienda
  { name: 'Arriendo', category: 'vivienda', type: 'gasto', dayOfMonth: 5, center: 450_000, spread: 0 },

  // Servicios — incluye streaming
  { name: 'Enel', category: 'servicios', type: 'gasto', dayOfMonth: 12, center: 22_000, spread: 4_000, seasonal: INVIERNO },
  { name: 'Essbio', category: 'servicios', type: 'gasto', dayOfMonth: 14, center: 18_000, spread: 3_000 },
  { name: 'Lipigas', category: 'servicios', type: 'gasto', dayOfMonth: 18, center: 16_000, spread: 4_000, seasonal: INVIERNO },
  { name: 'VTR Internet', category: 'servicios', type: 'gasto', dayOfMonth: 10, center: 25_990, spread: 0 },
  { name: 'Entel Móvil', category: 'servicios', type: 'gasto', dayOfMonth: 22, center: 12_990, spread: 0 },
  { name: 'Netflix', category: 'servicios', type: 'gasto', dayOfMonth: 8, center: 9_900, spread: 0 },
  { name: 'Spotify', category: 'servicios', type: 'gasto', dayOfMonth: 16, center: 5_900, spread: 0 },

  // Salud
  { name: 'Seguro complementario', category: 'salud', type: 'gasto', dayOfMonth: 25, center: 18_500, spread: 0 },

  // Ahorros e inversiones
  { name: 'Aporte fondo mutuo', category: 'ahorros', type: 'gasto', dayOfMonth: 30, center: 150_000, spread: 0 },

  // Deudas y creditos
  { name: 'Cuota crédito de consumo', category: 'deudas', type: 'gasto', dayOfMonth: 15, center: 95_000, spread: 0 },

  // Impuestos — no son mensuales
  { name: 'Permiso de circulación', category: 'impuestos', type: 'gasto', dayOfMonth: 20, center: 85_000, spread: 12_000, months: [3] },
  { name: 'Contribuciones', category: 'impuestos', type: 'gasto', dayOfMonth: 28, center: 62_000, spread: 5_000, months: [4, 6, 9, 11] },
];

export const VARIABLES: readonly VariableSpec[] = [
  {
    category: 'comida',
    merchants: ['Lider', 'Jumbo', 'Santa Isabel', 'Unimarc', 'Tottus'],
    type: 'gasto', perMonth: [3, 5], center: 45_000, spread: 18_000, seasonal: FIESTAS,
  },
  {
    category: 'comida',
    merchants: ['PedidosYa', 'Rappi', 'Uber Eats'],
    type: 'gasto', perMonth: [2, 6], center: 13_000, spread: 5_000, weekendBias: true,
  },
  {
    category: 'comida',
    merchants: ['Kazumi Gastro', 'El Refugio', 'La Picada', 'Café Colonia', 'Fuente Alemana'],
    type: 'gasto', perMonth: [1, 4], center: 20_000, spread: 9_000, weekendBias: true, seasonal: FIESTAS,
  },
  {
    category: 'transporte',
    merchants: ['Copec', 'Shell', 'Petrobras', 'Aramco'],
    type: 'gasto', perMonth: [2, 4], center: 32_000, spread: 8_000,
  },
  {
    category: 'transporte',
    merchants: ['Bip!', 'Uber', 'DiDi'],
    type: 'gasto', perMonth: [2, 6], center: 4_500, spread: 2_500,
  },
  {
    category: 'salud',
    merchants: ['Cruz Verde', 'Salcobrand', 'Farmacias Ahumada', 'Megasalud'],
    type: 'gasto', perMonth: [0, 2], center: 14_000, spread: 8_000, seasonal: INVIERNO,
  },
  {
    category: 'personales',
    merchants: ['Falabella', 'Ripley', 'Paris', 'Mercado Libre', 'Sodimac'],
    type: 'gasto', perMonth: [0, 3], center: 28_000, spread: 18_000, seasonal: FIESTAS,
  },
  {
    category: 'personales',
    merchants: ['Cinemark', 'Steam', 'Gimnasio Energy', 'Feria del Libro'],
    type: 'gasto', perMonth: [0, 2], center: 12_000, spread: 6_000,
  },
  {
    category: 'familia',
    merchants: ['Colegio San Pedro', 'Veterinaria Andalué', 'Aporte a mamá', 'Cumpleaños sobrino'],
    type: 'gasto', perMonth: [0, 3], center: 25_000, spread: 15_000, seasonal: FIESTAS,
  },
  {
    category: 'regalos',
    merchants: ['Regalo de cumpleaños', 'Techo Chile', 'Colecta bomberos', 'Regalo aniversario'],
    type: 'gasto', perMonth: [0, 2], center: 22_000, spread: 12_000, seasonal: FIESTAS,
  },
  {
    category: 'deudas',
    merchants: ['Pago tarjeta de crédito', 'Avance en cuotas'],
    type: 'gasto', perMonth: [0, 1], center: 45_000, spread: 25_000,
  },
  {
    category: 'trabajo',
    merchants: ['Coworking Biobío', 'Dominio y hosting', 'Insumos oficina', 'Notaría'],
    type: 'gasto', perMonth: [0, 2], center: 18_000, spread: 10_000,
  },
];

export function seasonalFactor(spec: { readonly seasonal?: readonly number[] }, month: number): number {
  return (spec.seasonal ?? NEUTRO)[month - 1] ?? 1;
}

/** Si la regla corre este mes. Sin `months` declarados, corre todos. */
export function occursInMonth(spec: RecurringSpec, month: number): boolean {
  return spec.months === undefined || spec.months.includes(month);
}
