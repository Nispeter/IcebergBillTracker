/**
 * Consultas reactivas de las pantallas.
 *
 * `useLiveQuery` se queda escuchando los cambios de SQLite y vuelve a correr la
 * consulta sola.
 *
 * **Ojo con el segundo argumento**: su valor por defecto es `[]`, asi que el
 * efecto corre **una sola vez al montar**. Si la consulta cambia —otro filtro,
 * otro limite— y no se le pasan dependencias, sigue devolviendo el resultado de
 * la primera. Todo hook de aca abajo que arme una consulta variable **tiene que
 * pasarlas**. Por eso ninguna pantalla necesita refrescar a mano despues de
 * escribir: se agrega un movimiento y el listado, los totales y el iceberg se
 * actualizan solos, porque todos salen de la misma base.
 *
 * La alternativa —estado global replicando la base— es justo lo que el plan del
 * proyecto descarta: dos fuentes de verdad que se desincronizan.
 */

import { analytics, dates, money } from '@iceberg/core';
import {
  consultaDeCuentas, consultaDeMovimientos, resumenDeMovimientos,
  type Cuenta, type FiltroDeMovimientos, type Movimiento, type ResumenDeFiltro,
} from '@iceberg/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { useDatos } from './BaseDeDatos';

/** Todos los movimientos vivos del hogar, del mas nuevo al mas viejo. */
export function useMovimientos(limite?: number): Movimiento[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(
    () => consultaDeMovimientos(db, contexto, limite === undefined ? {} : { limite }),
    [db, contexto, limite],
  );
  const { data } = useLiveQuery(consulta, [limite]);
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
  return useDesgloseDelSaldo(saldoInicialMinor).saldo;
}

export interface DesgloseDelSaldo {
  readonly saldo: money.Money;
  readonly inicial: money.Money;
  /** Todo lo que entro, desde siempre. */
  readonly ingresos: money.Money;
  /** Todo lo que salio, desde siempre. */
  readonly gastos: money.Money;
}

/**
 * El saldo y las tres piezas de las que sale.
 *
 * Existe para que la hoja de "de donde sale este numero" no tenga que rehacer
 * la cuenta ni abrir una segunda consulta identica: si el desglose se calculara
 * aparte, podria decir algo distinto de lo que muestra la cifra.
 */
export function useDesgloseDelSaldo(saldoInicialMinor: number): DesgloseDelSaldo {
  const movimientos = useMovimientos();
  return useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    for (const m of movimientos) {
      // Una transferencia mueve plata **entre cuentas propias**: no entra ni
      // sale del hogar, asi que no toca el saldo. Contarla como salida dejaba
      // el saldo mas bajo que la suma real de las cuentas.
      if (m.tipo === 'transferencia') continue;
      if (m.tipo === 'ingreso') ingresos += m.montoMinor;
      else gastos += m.montoMinor;
    }
    return {
      saldo: money.money(saldoInicialMinor + ingresos - gastos, 'CLP'),
      inicial: money.money(saldoInicialMinor, 'CLP'),
      ingresos: money.money(ingresos, 'CLP'),
      gastos: money.money(gastos, 'CLP'),
    };
  }, [movimientos, saldoInicialMinor]);
}

/**
 * El saldo justo antes de que empiece el rango.
 *
 * Hace falta para dibujar la linea de saldo del periodo: `analytics` solo ve los
 * movimientos que le pasan, y el saldo de verdad arrastra todo lo anterior mas
 * el saldo inicial de las cuentas. Sin esto la linea arrancaria en cero y diria
 * que uno empieza cada mes quebrado.
 */
export function useSaldoAlEmpezar(rango: dates.DateRange): money.Money {
  const movimientos = useMovimientos();
  const inicial = useSaldoInicial();

  return useMemo(() => {
    let total = inicial;
    for (const m of movimientos) {
      if (m.tipo === 'transferencia') continue;
      if (m.ocurridoEn >= rango.start) continue;
      total += m.tipo === 'ingreso' ? m.montoMinor : -m.montoMinor;
    }
    return money.money(total, 'CLP');
  }, [movimientos, inicial, rango.start]);
}

/**
 * El analisis de **cualquier** rango: resumen, comparacion y ritmo.
 *
 * Toma un `DateRange` y no un mes porque el rango ya sabe de que tipo es: el
 * anterior de una semana es la semana pasada completa, y el de marzo es febrero.
 * Toda la logica de "contra que se compara" vive en `core/dates`, no aca.
 */
export function useAnalisisDeRango(rango: dates.DateRange, hoy: dates.PlainDate) {
  const movimientos = useMovimientos();
  const claveRango = `${rango.kind}:${rango.start}:${rango.end}`;

  return useMemo(() => {
    const analizables: analytics.MovimientoAnalizable[] = movimientos.map((m) => ({
      tipo: m.tipo,
      montoMinor: m.montoMinor,
      ocurridoEn: m.ocurridoEn as dates.PlainDate,
      categoriaId: m.categoriaId,
      nombre: m.nombre,
    }));

    const porCategoria = analytics.gastoPorCategoria(analizables, rango);
    return {
      resumen: analytics.resumirRango(analizables, rango),
      comparacion: analytics.compararConAnterior(analizables, rango),
      ritmo: analytics.calcularRitmo(analizables, rango, hoy),
      porCategoria,
      mayorCategoria: porCategoria[0]?.total.amountMinor ?? 1,
      serie: analytics.seriePorDia(analizables, rango),
      // Que categoria explica el cambio contra el periodo anterior. El "contra
      // que" lo decide el rango: el anterior de una semana es la semana pasada
      // completa, no siete dias atras.
      deriva: analytics.derivaPorCategoria(analizables, rango, dates.previousPeriod(rango)),
      // El comprometido se aproxima por categorias hasta que F3 traiga las
      // reglas de recurrencia.
      fijo: money.money(
        analizables
          .filter((m) => m.tipo === 'gasto'
            && dates.containsDate(rango, m.ocurridoEn)
            && m.categoriaId != null
            && COMPROMETIDAS.has(m.categoriaId))
          .reduce((s, m) => s + m.montoMinor, 0),
        'CLP',
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, claveRango, hoy]);
}

/**
 * Categorias que son compromiso fijo por naturaleza.
 *
 * Es una aproximacion hasta F3: cuando existan las reglas de recurrencia, el
 * "comprometido" se leera de la marca de cada movimiento y no de su categoria.
 */
const COMPROMETIDAS = new Set(['vivienda', 'servicios', 'deudas', 'ahorros', 'impuestos']);

/** Si un gasto de esa categoria cuenta como compromiso fijo. */
export function esComprometido(categoriaId: string | null): boolean {
  return categoriaId !== null && COMPROMETIDAS.has(categoriaId);
}

/**
 * Movimientos filtrados, reactivos.
 *
 * El filtro va a SQL, no a un `.filter()` sobre todo lo cargado: con 50.000
 * movimientos la diferencia deja de ser academica.
 */
export function useMovimientosFiltrados(filtro: FiltroDeMovimientos): Movimiento[] {
  const { db, contexto } = useDatos();
  const clave = JSON.stringify(filtro);
  const consulta = useMemo(
    () => consultaDeMovimientos(db, contexto, filtro),
    // El filtro es un objeto nuevo en cada render; se compara por su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contexto, clave],
  );
  // Sin `[clave]`, cambiar de filtro no hacia nada: la lista seguia mostrando
  // el resultado de la primera consulta.
  const { data } = useLiveQuery(consulta, [clave]);
  return (data ?? []) as Movimiento[];
}

/**
 * Cuantos movimientos cumplen el filtro y cuanto suman, **sin traerlos**.
 *
 * Va aparte de la lista porque con paginado el encabezado tiene que decir el
 * total, no lo que se alcanzo a cargar. Se recalcula cuando cambian los
 * movimientos —el largo de la lista alcanza como senal— o cuando cambia el
 * filtro.
 */
export function useResumenDeFiltro(filtro: FiltroDeMovimientos): ResumenDeFiltro {
  const { db, contexto } = useDatos();
  const movimientos = useMovimientos();
  const clave = JSON.stringify(filtro);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resumenDeMovimientos(db, contexto, filtro), [db, contexto, clave, movimientos]);
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

/**
 * Hasta que fecha mira Home.
 *
 * Es la del movimiento mas nuevo, **pero nunca mas alla de hoy**. Sin ese tope,
 * un solo movimiento con fecha futura —un dedazo al escribir el ano, o una
 * cuenta anotada por adelantado— arrastraba toda la pantalla a ese mes: el
 * titulo, ingreso, gasto, neto, el iceberg y las categorias pasaban a mostrar un
 * mes vacio mientras el saldo seguia contando todo.
 */
export function useFechaDeCorte(): dates.PlainDate {
  const movimientos = useMovimientos(1);
  const masNuevo = movimientos[0]?.ocurridoEn as dates.PlainDate | undefined;
  const hoy = dates.today();
  return masNuevo === undefined ? hoy : dates.minDate(masNuevo, hoy);
}

/**
 * Los gastos que se salen de lo normal **para ese comercio**, por id.
 *
 * El agrupamiento es la decision de esta capa, y no fue la primera que probe:
 * agrupar por **categoria** marcaba 23 de 54 movimientos de Transporte, porque
 * ahi conviven viajes de $6.500 con bencinas de $32.000 y mediana + MAD suponen
 * una sola poblacion. Sobre los 661 gastos de la semilla, por categoria marca el
 * 9,2% y por comercio el 1,2%. Contra el mismo comercio si hay una sola
 * poblacion: los Copec se parecen entre ellos.
 *
 * Se compara contra **toda la historia**: un mes no da los cinco datos que el
 * motor exige para que "lo normal" signifique algo.
 */
export function useAnomalias(): ReadonlySet<string> {
  const movimientos = useMovimientos();

  return useMemo(() => new Set(
    analytics.anomaliasAltasPorGrupo(
      movimientos.filter((m) => m.tipo === 'gasto'),
      // "Copec" y "COPEC " son el mismo comercio.
      (m) => m.nombre.trim().toLowerCase(),
      (m) => m.montoMinor,
    ).map((anomalia) => anomalia.item.id),
  ), [movimientos]);
}
