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

import { analytics, dates, money, recurrence } from '@iceberg/core';
import {
  combinarTempanos, consultaDeCuentas, consultaDeInstancias, consultaDeLotes,
  consultaDeMiembros, consultaDeMovimientos, consultaDeReglas, consultaDeReglasDeCategoria,
  resumenDeMovimientos,
  type Cuenta, type FiltroDeMovimientos, type Instancia, type Lote, type Miembro,
  type Movimiento, type Regla, type ReglaCategoria, type ResumenDeFiltro, type Tempano,
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
  const deRegla = useMovimientosDeRegla(rango);

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
      fijo: money.money(
        movimientos
          .filter((m) => m.tipo === 'gasto'
            && dates.containsDate(rango, m.ocurridoEn as dates.PlainDate)
            && esGastoComprometido(m, deRegla))
          .reduce((s, m) => s + m.montoMinor, 0),
        'CLP',
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, deRegla, claveRango, hoy]);
}

/**
 * Categorias que **suelen** ser compromiso fijo.
 *
 * Es el respaldo, no la verdad: la verdad es que el movimiento haya nacido de
 * una regla. Se conserva porque sin el, un historial recien importado —o la
 * semilla, que no trae reglas— mostraria el comprometido en cero y el iceberg
 * entero bajo el agua. A medida que el usuario crea sus reglas, esta mitad va
 * pesando menos sola.
 */
const COMPROMETIDAS = new Set(['vivienda', 'servicios', 'deudas', 'ahorros', 'impuestos']);

/** Si un gasto de esa categoria cuenta como compromiso fijo. */
export function esComprometido(categoriaId: string | null): boolean {
  return categoriaId !== null && COMPROMETIDAS.has(categoriaId);
}

/**
 * Si un gasto es comprometido: **nacio de una regla**, o su categoria lo delata.
 *
 * El "o" es a proposito y es temporal por naturaleza. Nacer de una regla es la
 * respuesta correcta y no admite discusion; la categoria es lo que salva a los
 * movimientos que ya existian antes de que hubiera reglas.
 */
export function esGastoComprometido(
  movimiento: Movimiento,
  deRegla: ReadonlySet<string>,
): boolean {
  return deRegla.has(movimiento.id) || esComprometido(movimiento.categoriaId);
}

/**
 * Los movimientos del rango que nacieron de una regla, por id.
 *
 * Se lee de las instancias: cuando se marca una cuenta como pagada se guarda
 * ahi el id del movimiento que se creo. Es el enlace que permite dejar de
 * adivinar el comprometido a partir de la categoria.
 */
export function useMovimientosDeRegla(rango: dates.DateRange): ReadonlySet<string> {
  const { db, contexto } = useDatos();
  const clave = `${rango.start}:${rango.end}`;
  const consulta = useMemo(
    () => consultaDeInstancias(db, contexto, rango),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contexto, clave],
  );
  const { data } = useLiveQuery(consulta, [clave]);

  return useMemo(() => {
    const ids = new Set<string>();
    for (const instancia of (data ?? []) as Instancia[]) {
      if (instancia.movimientoId !== null) ids.add(instancia.movimientoId);
    }
    return ids;
  }, [data]);
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

/** Las reglas de recurrencia del hogar, reactivas. */
export function useReglas(): Regla[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeReglas(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as Regla[];
}

/**
 * Los tempanos del rango: cada ocurrencia con lo que se haya decidido sobre ella.
 *
 * Se piden las dos tablas por separado y se combinan en memoria porque
 * `useLiveQuery` entrega filas de **una** consulta: no puede llamar a una
 * funcion que abre varias. La combinacion vive en `@iceberg/db`, asi que la
 * pantalla y los tests hacen exactamente la misma cuenta.
 */
export function useTempanos(rango: dates.DateRange, hoy: dates.PlainDate): Tempano[] {
  const { db, contexto } = useDatos();
  const reglas = useReglas();

  const clave = `${rango.start}:${rango.end}`;
  const consulta = useMemo(
    () => consultaDeInstancias(db, contexto, rango),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contexto, clave],
  );
  const { data } = useLiveQuery(consulta, [clave]);
  const decisiones = (data ?? []) as Instancia[];

  return useMemo(
    () => combinarTempanos(reglas, decisiones, rango, hoy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reglas, decisiones, clave, hoy],
  );
}

/**
 * Cuentas periodicas que se pueden proponer, sin las que ya son regla.
 *
 * El filtro por nombre es lo que evita que la pantalla ofrezca crear el arriendo
 * cuando el arriendo ya existe. Se compara normalizado, igual que agrupa el
 * detector: si no, "Enel" y "ENEL" se propondrian como dos cuentas distintas.
 */
export function useCandidatasARegla(hoy: dates.PlainDate): recurrence.Candidata[] {
  const movimientos = useMovimientos();
  const reglas = useReglas();

  return useMemo(() => {
    const yaSonRegla = new Set(reglas.map((r) => recurrence.normalizarNombre(r.nombre)));
    const observados = movimientos
      .filter((m) => m.tipo === 'gasto')
      .map((m) => ({
        nombre: m.nombre,
        montoMinor: m.montoMinor,
        ocurridoEn: m.ocurridoEn as dates.PlainDate,
        categoriaId: m.categoriaId,
      }));
    return recurrence.detectarRecurrentes(observados, hoy)
      .filter((c) => !yaSonRegla.has(recurrence.normalizarNombre(c.nombre)));
  }, [movimientos, reglas, hoy]);
}

/** Los lotes de importacion, del mas viejo al mas nuevo. */
export function useLotes(): Lote[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeLotes(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as Lote[];
}

/** Las reglas propias de categorizacion, reactivas. */
export function useReglasDeCategoria(): ReglaCategoria[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeReglasDeCategoria(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as ReglaCategoria[];
}

/** Quienes escriben en este hogar, reactivos. */
export function useMiembros(): Miembro[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeMiembros(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as Miembro[];
}
