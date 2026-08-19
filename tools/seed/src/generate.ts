/**
 * Generador de datos semilla: 18 meses de gasto chileno realista.
 *
 * Existe para que las metricas de analytics se puedan probar contra un dataset
 * con forma de vida real —estacionalidad, recurrentes, ruido— y no contra tres
 * filas inventadas que hacen pasar cualquier formula.
 *
 * Es **determinista**: misma semilla, mismo dataset.
 */

import { categories, dates, money } from '@iceberg/core';
import {
  RECURRENTES, SALDO_INICIAL, VARIABLES, occursInMonth, seasonalFactor, type Movement,
} from './catalog';
import { Random } from './random';

type PlainDate = dates.PlainDate;
type CategoryId = categories.CategoryId;

export interface SeedTransaction {
  readonly id: string;
  readonly type: Movement;
  /** Entero en pesos. CLP tiene exponente 0. */
  readonly amountMinor: number;
  readonly currency: 'CLP';
  readonly occurredAt: PlainDate;
  readonly name: string;
  /** Ausente en los ingresos: el ingreso no se categoriza. */
  readonly category?: CategoryId;
  /** Presente solo en gasto variable; los recurrentes no tienen comercio. */
  readonly merchant?: string;
  /** Marca los movimientos que nacen de una regla, para probar la deteccion. */
  readonly recurring: boolean;
}

export interface SeedDataset {
  readonly seed: number;
  readonly range: dates.DateRange;
  /** Saldo de la cuenta el primer dia del rango, en pesos enteros. */
  readonly saldoInicialMinor: number;
  readonly categories: readonly CategoryId[];
  readonly transactions: readonly SeedTransaction[];
}

export interface SeedOptions {
  /** Meses completos a generar. Por defecto 18. */
  readonly months?: number;
  /** Ultimo mes incluido. Por defecto el mes de la fecha dada. */
  readonly endDate?: PlainDate;
  readonly seed?: number;
}

const DEFAULT_SEED = 20_260_818;

/** Reparte `count` dias dentro del mes, sin repetir, opcionalmente cargados al fin de semana. */
function pickDays(random: Random, year: number, month: number, count: number, weekendBias: boolean): number[] {
  const total = dates.daysInMonth(year, month);
  const chosen = new Set<number>();
  let guard = 0;
  while (chosen.size < count && guard < count * 20) {
    guard += 1;
    const day = random.int(1, total);
    if (weekendBias && !random.chance(0.55)) {
      const isWeekend = dates.weekday(dates.plainDate(year, month, day)) >= 5;
      if (!isWeekend) continue;
    }
    chosen.add(day);
  }
  return [...chosen].sort((a, b) => a - b);
}

export function generateSeed(options: SeedOptions = {}): SeedDataset {
  const months = options.months ?? 18;
  if (!Number.isInteger(months) || months < 1) {
    throw new Error(`meses invalido: ${months}`);
  }

  const seed = options.seed ?? DEFAULT_SEED;
  const random = new Random(seed);
  const lastMonth = dates.startOfMonth(options.endDate ?? dates.today());
  const firstMonth = dates.addMonths(lastMonth, -(months - 1));

  const transactions: SeedTransaction[] = [];
  let counter = 0;
  const push = (tx: Omit<SeedTransaction, 'id' | 'currency'>) => {
    // El monto pasa por `money` para que un decimal reviente aca y no termine
    // silenciosamente en la base de datos.
    transactions.push({
      ...tx,
      id: `seed-${String(counter++).padStart(5, '0')}`,
      currency: 'CLP',
      amountMinor: money.money(tx.amountMinor, 'CLP').amountMinor,
    });
  };

  for (let offset = 0; offset < months; offset++) {
    const cursor = dates.addMonths(firstMonth, offset);
    const year = dates.year(cursor);
    const month = dates.month(cursor);
    const lastDay = dates.daysInMonth(year, month);

    for (const spec of RECURRENTES) {
      if (!occursInMonth(spec, month)) continue;
      const day = Math.min(spec.dayOfMonth, lastDay);
      const base = spec.spread === 0 ? spec.center : random.around(spec.center, spec.spread);
      const amount = Math.round(base * seasonalFactor(spec, month));
      push({
        type: spec.type,
        amountMinor: amount,
        occurredAt: dates.plainDate(year, month, day),
        name: spec.name,
        ...(spec.category === undefined ? {} : { category: spec.category }),
        recurring: true,
      });
    }

    for (const spec of VARIABLES) {
      // La estacionalidad se reparte entre "cuantas veces" y "cuanto cada vez".
      // En diciembre uno hace **mas** regalos, no un regalo mas caro; en invierno
      // en cambio llega la misma boleta de gas por mas plata. Cada mitad toma la
      // raiz para que el efecto total siga siendo el factor declarado.
      const reparto = Math.sqrt(seasonalFactor(spec, month));
      const [min, max] = spec.perMonth;
      const count = Math.round(random.int(min, max) * reparto);
      for (const day of pickDays(random, year, month, count, spec.weekendBias ?? false)) {
        const merchant = random.pick(spec.merchants);
        const amount = Math.round(random.around(spec.center, spec.spread) * reparto);
        push({
          type: spec.type,
          amountMinor: amount,
          occurredAt: dates.plainDate(year, month, day),
          name: merchant,
          category: spec.category,
          merchant,
          recurring: false,
        });
      }
    }
  }

  transactions.sort((a, b) => dates.compareDates(a.occurredAt, b.occurredAt) || a.id.localeCompare(b.id));

  const usadas = new Set(transactions.flatMap((tx) => (tx.category ? [tx.category] : [])));

  return {
    seed,
    range: dates.dateRange(
      firstMonth,
      dates.plainDate(dates.year(lastMonth), dates.month(lastMonth), dates.daysInMonth(dates.year(lastMonth), dates.month(lastMonth))),
      'custom',
    ),
    saldoInicialMinor: SALDO_INICIAL,
    // En el orden canonico del catalogo, no en el de aparicion.
    categories: categories.CATEGORY_IDS.filter((id) => usadas.has(id)),
    transactions,
  };
}

/** Total de un tipo de movimiento, para chequear el dataset de un vistazo. */
export function totalOf(dataset: SeedDataset, type: Movement): money.Money {
  return money.sum(
    dataset.transactions.filter((tx) => tx.type === type).map((tx) => money.money(tx.amountMinor, 'CLP')),
    'CLP',
  );
}

/**
 * La plata que queda: saldo inicial + todo lo que entro − todo lo que salio.
 *
 * Es un saldo de cuenta, no un ahorro acumulado: los aportes a fondo mutuo salen
 * de aca como cualquier otro gasto, porque desde la cuenta corriente eso es
 * plata que se fue. El ahorro invertido se mira aparte.
 */
export function saldoActual(dataset: SeedDataset): money.Money {
  const inicial = money.money(dataset.saldoInicialMinor, 'CLP');
  return money.subtract(
    money.add(inicial, totalOf(dataset, 'ingreso')),
    totalOf(dataset, 'gasto'),
  );
}

/** Gasto agrupado por categoria, de mayor a menor. Sin categoria queda fuera. */
export function gastoPorCategoria(
  transactions: readonly SeedTransaction[],
): { categoria: CategoryId; total: money.Money }[] {
  const acumulado = new Map<CategoryId, number>();
  for (const tx of transactions) {
    if (tx.type !== 'gasto' || tx.category === undefined) continue;
    acumulado.set(tx.category, (acumulado.get(tx.category) ?? 0) + tx.amountMinor);
  }
  return [...acumulado.entries()]
    .map(([categoria, total]) => ({ categoria, total: money.money(total, 'CLP') }))
    .sort((a, b) => money.compare(b.total, a.total));
}
