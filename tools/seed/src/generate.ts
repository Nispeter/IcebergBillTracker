/**
 * Generador de datos semilla: 18 meses de gasto chileno realista.
 *
 * Existe para que las metricas de analytics se puedan probar contra un dataset
 * con forma de vida real —estacionalidad, recurrentes, ruido— y no contra tres
 * filas inventadas que hacen pasar cualquier formula.
 *
 * Es **determinista**: misma semilla, mismo dataset.
 */

import { dates, money } from '@iceberg/core';
import { RECURRENTES, VARIABLES, seasonalFactor, type Movement } from './catalog';
import { Random } from './random';

type PlainDate = dates.PlainDate;

export interface SeedTransaction {
  readonly id: string;
  readonly type: Movement;
  /** Entero en pesos. CLP tiene exponente 0. */
  readonly amountMinor: number;
  readonly currency: 'CLP';
  readonly occurredAt: PlainDate;
  readonly name: string;
  readonly category: string;
  /** Presente solo en gasto variable; los recurrentes no tienen comercio. */
  readonly merchant?: string;
  /** Marca los movimientos que nacen de una regla, para probar la deteccion. */
  readonly recurring: boolean;
}

export interface SeedDataset {
  readonly seed: number;
  readonly range: dates.DateRange;
  readonly categories: readonly string[];
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
      const day = Math.min(spec.dayOfMonth, lastDay);
      const base = spec.spread === 0
        ? spec.center
        : random.around(spec.center, spec.spread);
      const amount = Math.round(base * seasonalFactor(spec, month));
      push({
        type: spec.type,
        amountMinor: amount,
        occurredAt: dates.plainDate(year, month, day),
        name: spec.name,
        category: spec.category,
        recurring: true,
      });
    }

    for (const spec of VARIABLES) {
      const [min, max] = spec.perMonth;
      const count = random.int(min, max);
      for (const day of pickDays(random, year, month, count, spec.weekendBias ?? false)) {
        const merchant = random.pick(spec.merchants);
        const amount = Math.round(random.around(spec.center, spec.spread) * seasonalFactor(spec, month));
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

  return {
    seed,
    range: dates.dateRange(firstMonth, dates.plainDate(dates.year(lastMonth), dates.month(lastMonth), dates.daysInMonth(dates.year(lastMonth), dates.month(lastMonth))), 'custom'),
    categories: [...new Set(transactions.map((tx) => tx.category))].sort(),
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
