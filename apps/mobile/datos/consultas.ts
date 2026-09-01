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
  consultaDeResumen, consultaDelPrimerDia, resumenDesde,
  type Cuenta, type FiltroDeMovimientos, type Instancia, type Lote, type Miembro,
  CLAVE_CATEGORIAS_COMPROMETIDAS, CLAVE_EXPLICACION_DE_A_POCO, CLAVE_PINGUINOS,
  consultaDeAjuste, escribirAjuste,
  type Movimiento, type Regla, type ReglaCategoria, type ResumenDeFiltro, type Tempano,
} from '@iceberg/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { useDatos } from './BaseDeDatos';
import { useCuentaActiva } from './cuenta';
import { useHoy } from './hoy';

/**
 * Aplica el alcance de cuenta a un filtro, sin pisar lo que ya venga puesto.
 *
 * Que el filtro explicito gane es a proposito: una pantalla que pide una cuenta
 * concreta --el detalle de esa cuenta-- sabe mas que el alcance global.
 */
function conCuentaActiva(
  filtro: FiltroDeMovimientos,
  cuentaId: string | null,
): FiltroDeMovimientos {
  if (cuentaId === null || filtro.cuentaId !== undefined) return filtro;
  return { ...filtro, cuentaId };
}

/**
 * Todos los movimientos vivos del hogar, del mas nuevo al mas viejo.
 *
 * **Respeta la cuenta activa.** Casi todo el analisis de la app cuelga de aca
 * --el resumen, las categorias, el calendario, las anomalias-- asi que filtrar
 * en este punto deja todas esas vistas dentro del alcance sin que ninguna tenga
 * que acordarse.
 */
export function useMovimientos(limite?: number): Movimiento[] {
  const { db, contexto } = useDatos();
  const { cuentaId } = useCuentaActiva();
  const consulta = useMemo(
    () => consultaDeMovimientos(
      db,
      contexto,
      conCuentaActiva(limite === undefined ? {} : { limite }, cuentaId),
    ),
    [db, contexto, limite, cuentaId],
  );
  const { data } = useLiveQuery(consulta, [limite, cuentaId]);
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
  // Suma en SQL, sin traer las filas. Antes cargaba **todos** los movimientos
  // solo para volver a sumarlos en memoria: con seiscientos daba igual, con
  // cincuenta mil son cincuenta mil filas cruzando el puente cada vez que
  // cambia una. Las transferencias las descarta la propia consulta.
  const total = useResumenDeFiltro(SIN_FILTRO);

  return useMemo(() => ({
    saldo: money.money(
      saldoInicialMinor + total.ingreso.amountMinor - total.gasto.amountMinor, 'CLP',
    ),
    inicial: money.money(saldoInicialMinor, 'CLP'),
    ingresos: total.ingreso,
    gastos: total.gasto,
  }), [total, saldoInicialMinor]);
}

/** Constante para que el filtro vacio no sea un objeto nuevo en cada render. */
const SIN_FILTRO: FiltroDeMovimientos = {};

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
  const comprometidas = useComprometidas();

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
            && esGastoComprometido(m, deRegla, comprometidas))
          .reduce((s, m) => s + m.montoMinor, 0),
        'CLP',
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, deRegla, comprometidas, claveRango, hoy]);
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
export const COMPROMETIDAS_POR_OMISION: readonly string[] = [
  'vivienda', 'servicios', 'deudas', 'ahorros', 'impuestos',
];

/**
 * Que categorias cuentan como compromiso, segun lo que haya elegido el usuario.
 *
 * Reactiva a proposito: se edita en Ajustes y el Resumen tiene que recalcular
 * sin que haya que salir y volver a entrar.
 */
export function useComprometidas(): ReadonlySet<string> {
  const { db } = useDatos();
  const consulta = useMemo(
    () => consultaDeAjuste(db, CLAVE_CATEGORIAS_COMPROMETIDAS),
    [db],
  );
  const { data } = useLiveQuery(consulta);
  const crudo = data?.[0]?.valor;

  return useMemo(() => {
    if (crudo === undefined) return new Set(COMPROMETIDAS_POR_OMISION);
    try {
      const lista = JSON.parse(crudo) as unknown;
      // Una lista vacia es una eleccion valida --"ninguna categoria es
      // compromiso por si sola"--, asi que no se cae de vuelta a la de omision.
      return Array.isArray(lista) ? new Set(lista.map(String)) : new Set(COMPROMETIDAS_POR_OMISION);
    } catch {
      return new Set(COMPROMETIDAS_POR_OMISION);
    }
  }, [crudo]);
}

/** Cuantos pinguinos pueden acompanar al iceberg. */
export const PINGUINOS_MINIMO = 1;
export const PINGUINOS_MAXIMO = 6;
export const PINGUINOS_POR_OMISION = 1;

/**
 * Cuantos pinguinos mostrar, segun lo que haya elegido el usuario.
 *
 * Reactiva por lo mismo que `useComprometidas`: se cambia en Ajustes y el
 * Resumen tiene que reflejarlo sin salir y volver a entrar.
 */
export function usePinguinos(): number {
  const { db } = useDatos();
  const consulta = useMemo(() => consultaDeAjuste(db, CLAVE_PINGUINOS), [db]);
  const { data } = useLiveQuery(consulta);
  const crudo = data?.[0]?.valor;

  const cuantos = Number(crudo);
  if (!Number.isFinite(cuantos)) return PINGUINOS_POR_OMISION;
  // Se acota al leer y no solo al escribir: el valor pudo quedar de una version
  // con otros limites, y una pantalla no puede romperse por un ajuste viejo.
  return Math.min(PINGUINOS_MAXIMO, Math.max(PINGUINOS_MINIMO, Math.round(cuantos)));
}

/**
 * Si el pinguino cuenta las explicaciones de a un parrafo.
 *
 * Devuelve tambien como cambiarlo: es un interruptor de dos estados y quien lo
 * lee en la hoja de explicaciones y quien lo mueve en Ajustes son dos pantallas
 * distintas, asi que el par viaja junto para que no haya dos formas de
 * escribirlo.
 */
export function useExplicacionDeAPoco(): { deAPoco: boolean; cambiar: (valor: boolean) => void } {
  const { db } = useDatos();
  const consulta = useMemo(() => consultaDeAjuste(db, CLAVE_EXPLICACION_DE_A_POCO), [db]);
  const { data } = useLiveQuery(consulta);

  return {
    deAPoco: (data?.[0]?.valor ?? '') === '1',
    cambiar: (valor) => escribirAjuste(db, CLAVE_EXPLICACION_DE_A_POCO, valor ? '1' : ''),
  };
}

/** Si un gasto de esa categoria cuenta como compromiso fijo. */
export function esComprometido(
  categoriaId: string | null,
  comprometidas: ReadonlySet<string> = new Set(COMPROMETIDAS_POR_OMISION),
): boolean {
  return categoriaId !== null && comprometidas.has(categoriaId);
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
  comprometidas?: ReadonlySet<string>,
): boolean {
  // La marca del movimiento gana sobre todo lo demas, incluso sobre haber
  // nacido de una regla: si alguien se tomo el trabajo de corregirlo, sabe mas
  // que cualquier deduccion nuestra.
  if (movimiento.comprometido !== null) return movimiento.comprometido === 1;
  return deRegla.has(movimiento.id) || esComprometido(movimiento.categoriaId, comprometidas);
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
export function useMovimientosFiltrados(entrada: FiltroDeMovimientos): Movimiento[] {
  const { db, contexto } = useDatos();
  const { cuentaId } = useCuentaActiva();
  const filtro = conCuentaActiva(entrada, cuentaId);
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
export function useResumenDeFiltro(entrada: FiltroDeMovimientos): ResumenDeFiltro {
  const { db, contexto } = useDatos();
  const { cuentaId } = useCuentaActiva();
  const filtro = conCuentaActiva(entrada, cuentaId);
  const clave = JSON.stringify(filtro);
  const consulta = useMemo(
    () => consultaDeResumen(db, contexto, filtro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contexto, clave],
  );
  const { data } = useLiveQuery(consulta, [clave]);
  return resumenDesde(data?.[0]);
}

/** Las cuentas vivas del hogar. */
export function useCuentas(): Cuenta[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeCuentas(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta);
  return (data ?? []) as Cuenta[];
}

/**
 * Saldo inicial de la cuenta activa, o suma de todas si el alcance es "todas".
 *
 * Tiene que seguir al alcance igual que los movimientos: un saldo que sumara
 * todas las cuentas mientras la lista muestra una sola daria una cifra que no
 * corresponde a nada.
 */
export function useSaldoInicial(): number {
  const cuentas = useCuentas();
  const { cuentaId } = useCuentaActiva();
  return useMemo(
    () => cuentas
      .filter((c) => cuentaId === null || c.id === cuentaId)
      .reduce((s, c) => s + c.saldoInicialMinor, 0),
    [cuentas, cuentaId],
  );
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
  // `useHoy` y no `dates.today()`: con la app abierta cruzando la medianoche,
  // una llamada suelta se queda con el dia de ayer hasta que algo mas redibuje.
  const hoy = useHoy();
  return masNuevo === undefined ? hoy : dates.minDate(masNuevo, hoy);
}

/**
 * Desde cuando esta app sabe algo: el dia del movimiento mas viejo.
 *
 * `null` mientras no haya ninguno. Sirve para distinguir **un dia sin gastar**
 * de **un dia del que no hay datos**, que en una serie por dia se ven igual: los
 * dos vienen en cero.
 *
 * Ignora la cuenta activa a proposito. La pregunta es cuando empezo a usarse la
 * app, no cuando empezo a usarse una cuenta; si no, cambiar de cuenta movia el
 * comienzo de la historia.
 */
export function usePrimerDia(): dates.PlainDate | null {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDelPrimerDia(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta);
  const dia = data?.[0]?.dia;
  return dia == null ? null : (dia as dates.PlainDate);
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
