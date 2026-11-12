/**
 * Las consultas reactivas de las pantallas.
 *
 * `useLiveQuery` escucha a SQLite y vuelve a correr la consulta sola, así que
 * nadie refresca a mano: se agrega un movimiento y la lista, los totales y el
 * iceberg cambian juntos, porque salen de la misma base.
 *
 * Su segundo argumento son las dependencias y por omisión es `[]`: una consulta
 * que cambia (otro filtro, otro límite) tiene que pasarlas, o sigue devolviendo
 * el resultado de la primera.
 */

import { analytics, dates, money, recurrence } from '@iceberg/core';
import {
  combinarTempanos, consultaDeAjuste, consultaDeCuentas, consultaDeInstancias, consultaDeLotes,
  consultaDeMiembros, consultaDeMovimientos, consultaDeReglas, consultaDeReglasDeCategoria,
  consultaDeResumen, consultaDelPrimerDia, escribirAjuste, leerAjuste, resumenDesde,
  CLAVE_CATEGORIAS_COMPROMETIDAS, CLAVE_EXPLICACION_DE_A_POCO, CLAVE_PINGUINOS,
  type BaseDeDatos, type Cuenta, type FiltroDeMovimientos, type Instancia, type Lote,
  type Miembro, type Movimiento, type Regla, type ReglaCategoria, type ResumenDeFiltro,
  type Tempano,
} from '@iceberg/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo } from 'react';
import { useDatos } from './BaseDeDatos';
import { useCuentaActiva } from './cuenta';
import { useHoy } from './hoy';

/** El valor crudo de un ajuste, reactivo. `undefined` mientras no esté o no cargue. */
export function useAjuste(clave: string): string | undefined {
  const { db } = useDatos();
  const consulta = useMemo(() => consultaDeAjuste(db, clave), [db, clave]);
  const { data } = useLiveQuery(consulta, [clave]);
  return data?.[0]?.valor;
}

/**
 * Aplica el alcance de cuenta a un filtro. Lo explícito gana: una pantalla que
 * pide una cuenta concreta sabe más que el alcance global.
 */
function conCuentaActiva(filtro: FiltroDeMovimientos, cuentaId: string | null): FiltroDeMovimientos {
  if (cuentaId === null || filtro.cuentaId !== undefined) return filtro;
  return { ...filtro, cuentaId };
}

/**
 * Los movimientos vivos, del más nuevo al más viejo, dentro de la cuenta
 * activa. Casi todo el análisis cuelga de acá, así que filtrar en este punto
 * deja todas las vistas dentro del alcance sin que ninguna se acuerde.
 */
export function useMovimientos(limite?: number): Movimiento[] {
  const { db, contexto } = useDatos();
  const { cuentaId } = useCuentaActiva();
  const consulta = useMemo(
    () => consultaDeMovimientos(db, contexto, conCuentaActiva(limite === undefined ? {} : { limite }, cuentaId)),
    [db, contexto, limite, cuentaId],
  );
  const { data } = useLiveQuery(consulta, [limite, cuentaId]);
  return (data ?? []) as Movimiento[];
}

/** El saldo: el inicial de las cuentas más lo que entró menos lo que salió. */
export function useSaldo(saldoInicialMinor: number): money.Money {
  return useDesgloseDelSaldo(saldoInicialMinor).saldo;
}

export interface DesgloseDelSaldo {
  readonly saldo: money.Money;
  readonly inicial: money.Money;
  /** Todo lo que entró, desde siempre. */
  readonly ingresos: money.Money;
  /** Todo lo que salió, desde siempre. */
  readonly gastos: money.Money;
}

/** Para que el filtro vacío no sea un objeto nuevo en cada render. */
const SIN_FILTRO: FiltroDeMovimientos = {};

/**
 * El saldo y las piezas de las que sale, de una misma consulta: así la hoja de
 * "de dónde sale" no puede decir algo distinto de la cifra. Suma en SQL, sin
 * traer las filas; las transferencias las descarta la consulta.
 */
export function useDesgloseDelSaldo(saldoInicialMinor: number): DesgloseDelSaldo {
  const total = useResumenDeFiltro(SIN_FILTRO);
  return useMemo(() => ({
    saldo: money.money(saldoInicialMinor + total.ingreso.amountMinor - total.gasto.amountMinor, 'CLP'),
    inicial: money.money(saldoInicialMinor, 'CLP'),
    ingresos: total.ingreso,
    gastos: total.gasto,
  }), [total, saldoInicialMinor]);
}

/**
 * El saldo justo antes de que empiece el rango, para que la línea de saldo no
 * arranque en cero: `analytics` solo ve los movimientos que le pasan.
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
 * El análisis de cualquier rango: resumen, comparación, ritmo, categorías y
 * serie diaria. Contra qué se compara lo decide `core/dates` según el tipo de
 * rango: el anterior de una semana es la semana pasada completa.
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
 * Las categorías que suelen ser compromiso fijo. Es el respaldo, no la verdad
 * (la verdad es haber nacido de una regla): sin él, un historial recién
 * importado mostraría el comprometido en cero.
 */
const COMPROMETIDAS_POR_OMISION: readonly string[] = [
  'vivienda', 'servicios', 'deudas', 'ahorros', 'impuestos',
];

/** Ausente es la lista de siempre; una lista vacía es una elección válida. */
function interpretarComprometidas(crudo: string | undefined | null): ReadonlySet<string> {
  if (crudo === undefined || crudo === null) return new Set(COMPROMETIDAS_POR_OMISION);
  try {
    const lista = JSON.parse(crudo) as unknown;
    return Array.isArray(lista) ? new Set(lista.map(String)) : new Set(COMPROMETIDAS_POR_OMISION);
  } catch {
    return new Set(COMPROMETIDAS_POR_OMISION);
  }
}

/** Qué categorías cuentan como compromiso, según lo elegido en Ajustes. */
export function useComprometidas(): ReadonlySet<string> {
  const crudo = useAjuste(CLAVE_CATEGORIAS_COMPROMETIDAS);
  return useMemo(() => interpretarComprometidas(crudo), [crudo]);
}

/**
 * Lo mismo, leído una vez y sin suscribirse, para sembrar formularios:
 * `useLiveQuery` devuelve vacío en el primer render y el `useState` no se
 * enteraría del valor de verdad.
 */
export function leerComprometidas(db: BaseDeDatos): ReadonlySet<string> {
  return interpretarComprometidas(leerAjuste(db, CLAVE_CATEGORIAS_COMPROMETIDAS));
}

/**
 * Marca una categoría como compromiso o le saca la marca. Guarda la lista
 * entera: escribir solo la tocada borraría de un saque las de omisión.
 */
export function useMarcarComprometida(): (categoriaId: string, valor: boolean) => void {
  const { db } = useDatos();
  const comprometidas = useComprometidas();
  return (categoriaId, valor) => {
    const siguiente = new Set(comprometidas);
    if (valor) siguiente.add(categoriaId);
    else siguiente.delete(categoriaId);
    escribirAjuste(db, CLAVE_CATEGORIAS_COMPROMETIDAS, JSON.stringify([...siguiente]));
  };
}

/** Cuántos pingüinos pueden acompañar al iceberg. */
export const PINGUINOS_MINIMO = 1;
export const PINGUINOS_MAXIMO = 6;
const PINGUINOS_POR_OMISION = 1;

/** Cuántos pingüinos mostrar. Se acota al leer: el valor pudo quedar de otra versión. */
export function usePinguinos(): number {
  const cuantos = Number(useAjuste(CLAVE_PINGUINOS));
  if (!Number.isFinite(cuantos)) return PINGUINOS_POR_OMISION;
  return Math.min(PINGUINOS_MAXIMO, Math.max(PINGUINOS_MINIMO, Math.round(cuantos)));
}

/** Si el pingüino cuenta las explicaciones de a un párrafo, y cómo cambiarlo. */
export function useExplicacionDeAPoco(): { deAPoco: boolean; cambiar: (valor: boolean) => void } {
  const { db } = useDatos();
  return {
    deAPoco: (useAjuste(CLAVE_EXPLICACION_DE_A_POCO) ?? '') === '1',
    cambiar: (valor) => escribirAjuste(db, CLAVE_EXPLICACION_DE_A_POCO, valor ? '1' : ''),
  };
}

/** Si un gasto de esa categoría cuenta como compromiso fijo. */
export function esComprometido(
  categoriaId: string | null,
  comprometidas: ReadonlySet<string> = new Set(COMPROMETIDAS_POR_OMISION),
): boolean {
  return categoriaId !== null && comprometidas.has(categoriaId);
}

/**
 * Si un gasto es comprometido. Manda la marca del propio movimiento (quien lo
 * corrigió a mano sabe más que cualquier deducción); si no tiene, haber nacido
 * de una regla; y si no, lo que diga su categoría.
 */
export function esGastoComprometido(
  movimiento: Movimiento,
  deRegla: ReadonlySet<string>,
  comprometidas?: ReadonlySet<string>,
): boolean {
  if (movimiento.comprometido !== null) return movimiento.comprometido === 1;
  return deRegla.has(movimiento.id) || esComprometido(movimiento.categoriaId, comprometidas);
}

/**
 * Los movimientos del rango que nacieron de una regla, por id: al marcar una
 * cuenta como pagada, la instancia guarda el movimiento que se creó.
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

/** Movimientos filtrados en SQL, no con un `.filter()` sobre todo lo cargado. */
export function useMovimientosFiltrados(entrada: FiltroDeMovimientos): Movimiento[] {
  const { db, contexto } = useDatos();
  const { cuentaId } = useCuentaActiva();
  const filtro = conCuentaActiva(entrada, cuentaId);
  // El filtro es un objeto nuevo en cada render: se compara por su contenido.
  const clave = JSON.stringify(filtro);
  const consulta = useMemo(
    () => consultaDeMovimientos(db, contexto, filtro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contexto, clave],
  );
  const { data } = useLiveQuery(consulta, [clave]);
  return (data ?? []) as Movimiento[];
}

/**
 * Cuántos movimientos cumplen el filtro y cuánto suman, sin traerlos: con
 * tandas, el encabezado tiene que decir el total y no lo que se alcanzó a cargar.
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
 * Si se borró la cuenta que se mira (o la de la estrella), volver a "todas":
 * con un id muerto todas las consultas devuelven vacío y la app queda en blanco.
 * Lo llama el layout, montado mientras la app vive: un invariante escondido en
 * un componente de dibujo solo corre cuando ese componente está dibujado.
 */
export function useVolverATodasSiSeBorroLaCuenta(): void {
  const cuentas = useCuentas();
  const { cuentaId, elegir, porDefecto, marcarPorDefecto } = useCuentaActiva();

  useEffect(() => {
    // Vacía es "todavía no carga", no "no hay cuentas": sin esta guarda, en cada
    // arranque se borraba la estrella.
    if (cuentas.length === 0) return;
    const existe = (id: string | null) => id === null || cuentas.some((c) => c.id === id);
    if (!existe(cuentaId)) elegir(null);
    if (!existe(porDefecto)) marcarPorDefecto(null);
  }, [cuentas, cuentaId, elegir, porDefecto, marcarPorDefecto]);
}

/** El saldo inicial de la cuenta activa, o la suma de todas: sigue al alcance como los movimientos. */
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
 * Hasta qué fecha mira la app: la del movimiento más nuevo, pero nunca después
 * de hoy. Un solo movimiento con fecha futura arrastraba toda la pantalla a un
 * mes vacío.
 */
export function useFechaDeCorte(): dates.PlainDate {
  const movimientos = useMovimientos(1);
  const masNuevo = movimientos[0]?.ocurridoEn as dates.PlainDate | undefined;
  // `useHoy` cambia a medianoche; `dates.today()` suelto se quedaría con ayer.
  const hoy = useHoy();
  return masNuevo === undefined ? hoy : dates.minDate(masNuevo, hoy);
}

/**
 * El día del movimiento más viejo, o `null`: distingue un día sin gastar de un
 * día sin datos. Ignora la cuenta activa, porque la pregunta es desde cuándo se
 * usa la app.
 */
export function usePrimerDia(): dates.PlainDate | null {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDelPrimerDia(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta);
  const dia = data?.[0]?.dia;
  return dia == null ? null : (dia as dates.PlainDate);
}

/**
 * Los gastos fuera de lo normal para su comercio, por id. Por comercio y no por
 * categoría: Transporte junta viajes de $6.500 con bencinas de $32.000, y el
 * método supone una sola población. Se compara contra toda la historia: un mes
 * no da los datos que el motor exige.
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

/** Las reglas de recurrencia del hogar. */
function useReglas(): Regla[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeReglas(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as Regla[];
}

/**
 * Los témpanos del rango: cada ocurrencia con lo decidido sobre ella. Reglas e
 * instancias se piden aparte (`useLiveQuery` entrega una sola consulta) y se
 * combinan con la misma función que usan los tests.
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
 * Cuentas periódicas que se pueden proponer, sin las que ya son regla. Se
 * compara normalizado, igual que el detector: "Enel" y "ENEL" son la misma.
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

/** Los lotes de importación, del más viejo al más nuevo. */
export function useLotes(): Lote[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeLotes(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as Lote[];
}

/** Las reglas propias de categorización. */
export function useReglasDeCategoria(): ReglaCategoria[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeReglasDeCategoria(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as ReglaCategoria[];
}

/** Quiénes escriben en este hogar. */
export function useMiembros(): Miembro[] {
  const { db, contexto } = useDatos();
  const consulta = useMemo(() => consultaDeMiembros(db, contexto), [db, contexto]);
  const { data } = useLiveQuery(consulta, []);
  return (data ?? []) as Miembro[];
}
