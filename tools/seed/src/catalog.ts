/**
 * Catalogo de gasto chileno.
 *
 * Los comercios y montos son los de un hogar real en Chile en 2026, porque el
 * dataset tiene que servir para dos cosas: probar la matematica de analytics y
 * mirar la pantalla y que se vea creible. Un set de datos con montos redondos y
 * nombres genericos no revela ninguno de los dos problemas.
 */

export type Movement = 'gasto' | 'ingreso';

export interface RecurringSpec {
  readonly name: string;
  readonly category: string;
  readonly type: Movement;
  /** Dia del mes. Se recorta al ultimo dia si el mes es mas corto. */
  readonly dayOfMonth: number;
  readonly center: number;
  readonly spread: number;
  /**
   * Factor por mes (1-12). El gas y la luz suben fuerte en invierno austral
   * (junio a agosto), y es justo el tipo de estacionalidad que el motor de
   * anomalias no debe confundir con un gasto raro.
   */
  readonly seasonal?: readonly number[];
}

export interface VariableSpec {
  readonly category: string;
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

export const RECURRENTES: readonly RecurringSpec[] = [
  { name: 'Sueldo', category: 'Ingresos', type: 'ingreso', dayOfMonth: 30, center: 1_200_000, spread: 15_000 },
  { name: 'Arriendo', category: 'Vivienda', type: 'gasto', dayOfMonth: 5, center: 450_000, spread: 0 },
  { name: 'Enel', category: 'Cuentas', type: 'gasto', dayOfMonth: 12, center: 22_000, spread: 4_000, seasonal: INVIERNO },
  { name: 'Essbio', category: 'Cuentas', type: 'gasto', dayOfMonth: 14, center: 18_000, spread: 3_000 },
  { name: 'Lipigas', category: 'Cuentas', type: 'gasto', dayOfMonth: 18, center: 16_000, spread: 4_000, seasonal: INVIERNO },
  { name: 'VTR Internet', category: 'Cuentas', type: 'gasto', dayOfMonth: 10, center: 25_990, spread: 0 },
  { name: 'Entel Movil', category: 'Cuentas', type: 'gasto', dayOfMonth: 22, center: 12_990, spread: 0 },
  { name: 'Netflix', category: 'Suscripciones', type: 'gasto', dayOfMonth: 8, center: 9_900, spread: 0 },
  { name: 'Spotify', category: 'Suscripciones', type: 'gasto', dayOfMonth: 16, center: 5_900, spread: 0 },
  { name: 'Seguro complementario', category: 'Salud', type: 'gasto', dayOfMonth: 25, center: 18_500, spread: 0 },
];

export const VARIABLES: readonly VariableSpec[] = [
  {
    category: 'Supermercado',
    merchants: ['Lider', 'Jumbo', 'Santa Isabel', 'Unimarc', 'Tottus'],
    type: 'gasto', perMonth: [3, 5], center: 45_000, spread: 18_000, seasonal: FIESTAS,
  },
  {
    category: 'Delivery',
    merchants: ['PedidosYa', 'Rappi', 'Uber Eats'],
    type: 'gasto', perMonth: [2, 6], center: 13_000, spread: 5_000, weekendBias: true,
  },
  {
    category: 'Restaurantes',
    merchants: ['Kazumi Gastro', 'El Refugio', 'La Picada', 'Cafe Colonia', 'Fuente Alemana'],
    type: 'gasto', perMonth: [1, 4], center: 20_000, spread: 9_000, weekendBias: true, seasonal: FIESTAS,
  },
  {
    category: 'Bencina',
    merchants: ['Copec', 'Shell', 'Petrobras', 'Aramco'],
    type: 'gasto', perMonth: [2, 4], center: 32_000, spread: 8_000,
  },
  {
    category: 'Transporte',
    merchants: ['Bip!', 'Uber', 'DiDi'],
    type: 'gasto', perMonth: [2, 6], center: 4_500, spread: 2_500,
  },
  {
    category: 'Farmacia',
    merchants: ['Cruz Verde', 'Salcobrand', 'Farmacias Ahumada'],
    type: 'gasto', perMonth: [0, 2], center: 14_000, spread: 8_000, seasonal: INVIERNO,
  },
  {
    category: 'Compras',
    merchants: ['Falabella', 'Ripley', 'Paris', 'Mercado Libre', 'Sodimac'],
    type: 'gasto', perMonth: [0, 3], center: 28_000, spread: 18_000, seasonal: FIESTAS,
  },
  {
    category: 'Ocio',
    merchants: ['Cinemark', 'Steam', 'Feria del Libro', 'Gimnasio Energy'],
    type: 'gasto', perMonth: [0, 2], center: 12_000, spread: 6_000,
  },
];

export function seasonalFactor(spec: { readonly seasonal?: readonly number[] }, month: number): number {
  return (spec.seasonal ?? NEUTRO)[month - 1] ?? 1;
}
