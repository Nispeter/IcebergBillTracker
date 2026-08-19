/**
 * Encontrar las cuentas periodicas que ya estan en el historial.
 *
 * Cargar a mano el arriendo, la luz, el agua, el internet y el gimnasio es
 * exactamente el trabajo que hace que nadie use una app de finanzas mas de una
 * semana. Los movimientos ya estan; el patron se puede leer de ahi.
 *
 * Tres condiciones, y las tres tienen que darse:
 *
 * 1. **Se repite el nombre.** Agrupado normalizado, porque "ENEL " y "Enel" son
 *    el mismo cobro.
 * 2. **El intervalo es regular.** Se mide con la mediana de los saltos, no con
 *    el promedio: un solo mes salteado corre el promedio lo suficiente para que
 *    una cuenta mensual deje de parecerlo.
 * 3. **El monto se mantiene en el mismo orden de magnitud.** Se mide como
 *    proporcion contra la mediana, no como porcentaje de desviacion: la luz y el
 *    gas van de $23.000 a $46.000 segun la estacion y siguen siendo la misma
 *    cuenta, pero un cobro seis veces mayor ya es otra cosa. Lo que se propone
 *    es la mediana, no el ultimo.
 *
 * Lo que sale de aca es una **propuesta**, no una regla. La confirma el usuario:
 * adivinar y crear solo seria peor que no adivinar.
 */

import {
  addDays, compareDates, daysBetween, type PlainDate,
} from '../dates/index';
import { mediana } from '../analytics/resumen';
import type { Frecuencia } from './regla';

/** Lo minimo que hace falta de un movimiento para buscarle un patron. */
export interface MovimientoObservado {
  readonly nombre: string;
  readonly montoMinor: number;
  readonly ocurridoEn: PlainDate;
  readonly categoriaId?: string | null;
}

export interface Candidata {
  /** El nombre tal como aparece, no el normalizado: es lo que se va a mostrar. */
  readonly nombre: string;
  readonly categoriaId: string | null;
  /** La mediana de lo pagado, que es lo que se propone como monto de la regla. */
  readonly montoMinor: number;
  readonly frecuencia: Frecuencia;
  readonly cada: number;
  /**
   * Ancla propuesta: la **siguiente** fecha, no la ultima vista.
   *
   * Si se anclara en la ultima, la regla proyectaria hacia atras sobre meses ya
   * pagados y la vista de tempanos arrancaria llena de cuentas vencidas falsas.
   */
  readonly desde: PlainDate;
  /** Cuantas veces se vio. Mas veces, mas confiable. */
  readonly veces: number;
  /** Dias entre una y otra, en mediana. */
  readonly cadaDias: number;
}

export interface OpcionesDeDeteccion {
  /** Cuantas apariciones se exigen. Con menos de tres hay un solo salto y un salto no es un patron. */
  readonly minimoDeVeces?: number;
  /** Cuanto puede desviarse un salto de la mediana, en proporcion. */
  readonly toleranciaDelIntervalo?: number;
  /**
   * Cuantas veces la mediana puede llegar a ser el monto mas alto —y al reves
   * con el mas bajo— antes de descartar el grupo.
   */
  readonly factorDelMonto?: number;
}

const POR_DEFECTO = {
  minimoDeVeces: 3,
  toleranciaDelIntervalo: 0.25,
  // 2,5 sale de mirar la semilla: la luz mas cara del ano es 1,4 veces la
  // mediana y el gas 2,2. Con el 35% de desviacion que habia antes, las dos
  // quedaban fuera pese a tener un intervalo perfecto de 30 dias.
  factorDelMonto: 2.5,
} as const;

/** "ENEL  S.A. " y "Enel S.A." son el mismo cobro. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * De cuantos dias a que frecuencia.
 *
 * Los rangos son anchos a proposito: los meses tienen entre 28 y 31 dias, y una
 * cuenta que llega "el 5" puede cobrarse el 4 o el 7 segun el dia habil.
 * `null` si no se parece a nada que valga la pena proponer.
 */
export function frecuenciaDe(dias: number): { frecuencia: Frecuencia; cada: number } | null {
  if (dias >= 1 && dias <= 2) return { frecuencia: 'diaria', cada: Math.round(dias) };
  if (dias >= 6 && dias <= 8) return { frecuencia: 'semanal', cada: 1 };
  if (dias >= 13 && dias <= 16) return { frecuencia: 'semanal', cada: 2 };
  if (dias >= 26 && dias <= 34) return { frecuencia: 'mensual', cada: 1 };
  if (dias >= 55 && dias <= 66) return { frecuencia: 'mensual', cada: 2 };
  if (dias >= 85 && dias <= 96) return { frecuencia: 'mensual', cada: 3 };
  if (dias >= 350 && dias <= 380) return { frecuencia: 'anual', cada: 1 };
  return null;
}

/** Si todos los valores caen dentro de la tolerancia respecto de su mediana. */
function pareceEstable(valores: readonly number[], tolerancia: number): boolean {
  const centro = mediana(valores);
  if (centro === 0) return false;
  return valores.every((valor) => Math.abs(valor - centro) / centro <= tolerancia);
}

/**
 * Si ningun valor se aleja de la mediana mas de `factor` veces, en cualquiera de
 * los dos sentidos.
 *
 * Es una proporcion y no un porcentaje de desviacion a proposito. Una cuenta de
 * servicios se duplica entre verano e invierno sin dejar de ser la misma cuenta;
 * lo que delata a un grupo mal armado es un monto de otro orden.
 */
function mismoOrden(valores: readonly number[], factor: number): boolean {
  const centro = mediana(valores);
  if (centro <= 0) return false;
  return valores.every((valor) => valor > 0 && valor <= centro * factor && valor * factor >= centro);
}

/**
 * Las cuentas periodicas que se pueden proponer, de la mas frecuente a la menos.
 *
 * `hoy` decide desde donde se proyecta el ancla: la propuesta apunta siempre a
 * la proxima fecha, no a una ya pasada.
 */
export function detectarRecurrentes(
  movimientos: readonly MovimientoObservado[],
  hoy: PlainDate,
  opciones: OpcionesDeDeteccion = {},
): Candidata[] {
  const config = { ...POR_DEFECTO, ...opciones };

  const grupos = new Map<string, MovimientoObservado[]>();
  for (const movimiento of movimientos) {
    const clave = normalizarNombre(movimiento.nombre);
    if (clave === '') continue;
    const lista = grupos.get(clave);
    if (lista === undefined) grupos.set(clave, [movimiento]);
    else lista.push(movimiento);
  }

  const candidatas: Candidata[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.length < config.minimoDeVeces) continue;

    const orden = [...grupo].sort((a, b) => compareDates(a.ocurridoEn, b.ocurridoEn));

    // Dos cobros el mismo dia no son dos vueltas del ciclo: dejarian un salto de
    // cero dias que arrastra la mediana hacia abajo.
    const saltos: number[] = [];
    for (let i = 1; i < orden.length; i += 1) {
      const salto = daysBetween(orden[i - 1]!.ocurridoEn, orden[i]!.ocurridoEn);
      if (salto > 0) saltos.push(salto);
    }
    if (saltos.length < config.minimoDeVeces - 1) continue;
    if (!pareceEstable(saltos, config.toleranciaDelIntervalo)) continue;

    const montos = orden.map((m) => m.montoMinor);
    if (!mismoOrden(montos, config.factorDelMonto)) continue;

    const cadaDias = Math.round(mediana(saltos));
    const encaja = frecuenciaDe(cadaDias);
    if (encaja === null) continue;

    const ultima = orden[orden.length - 1]!;
    // Se avanza de a un ciclo desde la ultima vista hasta pasar hoy, para que la
    // regla nazca apuntando hacia adelante.
    let ancla = addDays(ultima.ocurridoEn, cadaDias);
    while (compareDates(ancla, hoy) < 0) ancla = addDays(ancla, cadaDias);

    candidatas.push({
      nombre: ultima.nombre.trim(),
      categoriaId: ultima.categoriaId ?? null,
      montoMinor: Math.round(mediana(montos)),
      frecuencia: encaja.frecuencia,
      cada: encaja.cada,
      desde: ancla,
      veces: orden.length,
      cadaDias,
    });
  }

  // Las que mas se repiten primero: son las que uno reconoce y confirma sin dudar.
  return candidatas.sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));
}
