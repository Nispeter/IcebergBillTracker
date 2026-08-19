/**
 * Consultas reactivas de las pantallas.
 *
 * `useLiveQuery` se queda escuchando los cambios de SQLite y vuelve a correr la
 * consulta sola. Por eso ninguna pantalla necesita refrescar a mano despues de
 * escribir: se agrega un movimiento y el listado, los totales y el iceberg se
 * actualizan solos, porque todos salen de la misma base.
 *
 * La alternativa —estado global replicando la base— es justo lo que el plan del
 * proyecto descarta: dos fuentes de verdad que se desincronizan.
 */

import { dates, money } from '@iceberg/core';
import { consultaDeCuentas, consultaDeMovimientos, type Cuenta, type Movimiento } from '@iceberg/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { useDatos } from './BaseDeDatos';

export interface TotalPorCategoria {
  readonly categoria: string;
  readonly total: money.Money;
}

export interface ResumenDelMes {
  readonly rango: dates.DateRange;
  readonly gasto: money.Money;
  readonly ingreso: money.Money;
  readonly neto: money.Money;
  readonly fijo: money.Money;
  readonly variable: money.Money;
  readonly shareComprometido: number;
  readonly porCategoria: readonly TotalPorCategoria[];
  readonly mayorCategoria: number;
}

/** Todos los movimientos vivos del hogar, del mas nuevo al mas viejo. */
export function useMovimientos(limite?: number): Movimiento[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(
    () => consultaDeMovimientos(db, contexto, limite === undefined ? {} : { limite }),
    [db, contexto, limite],
  );
  const { data } = useLiveQuery(consulta);
  return (data ?? []) as Movimiento[];
}

/**
 * El saldo: saldo inicial de las cuentas mas lo que entro menos lo que salio.
 *
 * Se calcula sobre los movimientos ya cargados en vez de con un `SUM` en SQL
 * porque asi hay una sola consulta reactiva en la pantalla. Con 50.000 filas eso
 * deja de servir y pasa a ser un `SUM` incremental; esta anotado como riesgo
 * para F6.
 */
export function useSaldo(saldoInicialMinor: number): money.Money {
  const movimientos = useMovimientos();
  return useMemo(() => {
    const total = movimientos.reduce(
      (suma, m) => suma + (m.tipo === 'ingreso' ? m.montoMinor : -m.montoMinor),
      saldoInicialMinor,
    );
    return money.money(total, 'CLP');
  }, [movimientos, saldoInicialMinor]);
}

/** El resumen del mes que contiene la fecha dada. */
export function useResumenDelMes(referencia: dates.PlainDate): ResumenDelMes {
  const movimientos = useMovimientos();

  return useMemo(() => {
    const rango = dates.currentMonth(referencia);
    const delMes = movimientos.filter(
      (m) => dates.containsDate(rango, m.ocurridoEn as dates.PlainDate),
    );

    const sumar = (filtro: (m: Movimiento) => boolean) =>
      money.money(delMes.filter(filtro).reduce((s, m) => s + m.montoMinor, 0), 'CLP');

    const gasto = sumar((m) => m.tipo === 'gasto');
    const ingreso = sumar((m) => m.tipo === 'ingreso');

    // Recurrente todavia no existe como campo —es F3—, asi que "comprometido"
    // se aproxima por las categorias que son compromisos fijos por naturaleza.
    // Cuando F3 traiga las reglas, esto pasa a leer la marca de verdad.
    const comprometidas = new Set(['vivienda', 'servicios', 'deudas', 'ahorros', 'impuestos']);
    const fijo = sumar((m) => m.tipo === 'gasto' && m.categoriaId !== null && comprometidas.has(m.categoriaId));
    const variable = money.subtract(gasto, fijo);

    const acumulado = new Map<string, number>();
    for (const m of delMes) {
      if (m.tipo !== 'gasto' || m.categoriaId === null) continue;
      acumulado.set(m.categoriaId, (acumulado.get(m.categoriaId) ?? 0) + m.montoMinor);
    }
    const porCategoria = [...acumulado.entries()]
      .map(([categoria, total]) => ({ categoria, total: money.money(total, 'CLP') }))
      .sort((a, b) => money.compare(b.total, a.total));

    return {
      rango,
      gasto,
      ingreso,
      neto: money.subtract(ingreso, gasto),
      fijo,
      variable,
      shareComprometido: money.ratio(fijo, gasto) ?? 0,
      porCategoria,
      mayorCategoria: porCategoria[0]?.total.amountMinor ?? 1,
    };
  }, [movimientos, referencia]);
}

/** Las cuentas vivas del hogar. */
export function useCuentas(): Cuenta[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeCuentas(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta);
  return (data ?? []) as Cuenta[];
}

/** Suma de los saldos iniciales de todas las cuentas. */
export function useSaldoInicial(): number {
  const cuentas = useCuentas();
  return useMemo(() => cuentas.reduce((s, c) => s + c.saldoInicialMinor, 0), [cuentas]);
}

/** La fecha del movimiento mas nuevo, o hoy si la base esta vacia. */
export function useFechaDeCorte(): dates.PlainDate {
  const movimientos = useMovimientos(1);
  const primero = movimientos[0];
  return (primero?.ocurridoEn as dates.PlainDate | undefined) ?? dates.today();
}
