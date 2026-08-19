/**
 * Ritmo de quema y proyeccion de fin de mes — el "Deshielo".
 *
 * La pregunta que responde es "si sigo asi, ¿en cuanto termino el mes?", y tiene
 * una trampa: **la gente no gasta parejo**. El dia 1 se va el arriendo, el 5 las
 * cuentas, el 30 el sueldo. Proyectar linealmente el dia 3 —cuando ya paso el
 * arriendo— dice que uno va a gastar tres millones.
 *
 * Por eso hay dos modelos y la app muestra los dos: el lineal, que se entiende
 * sin explicacion, y el de **perfil de dia del mes**, que aprende de los meses
 * anteriores en que parte del mes suele irse la plata.
 */

import {
  addDays, containsDate, daysBetween, day as diaDelMes, daysInMonth, lengthInDays,
  minDate, month as mesDe, year as anoDe, type DateRange, type PlainDate,
} from '../dates/index';
import { divide, money, multiply, sum, type Money } from '../money/index';
import { esGasto, type MovimientoAnalizable } from './movimiento';
import { enRango } from './resumen';

export interface Ritmo {
  /** Gasto acumulado hasta `hasta`, inclusive. */
  readonly gastadoHastaAhora: Money;
  readonly diasTranscurridos: number;
  readonly diasDelRango: number;
  readonly diasRestantes: number;
  readonly promedioDiario: Money;
  /** Proyeccion suponiendo que lo que queda se gasta al promedio diario. */
  readonly proyeccionLineal: Money;
  /**
   * Proyeccion usando el perfil historico de dia-del-mes.
   *
   * `null` cuando no hay meses anteriores completos de donde aprender: es
   * preferible no mostrar nada a mostrar un numero inventado.
   */
  readonly proyeccionPorPerfil: Money | null;
}

/** Gasto acumulado dentro del rango hasta la fecha dada, inclusive. */
function gastoHasta(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
  hasta: PlainDate,
): Money {
  const montos = enRango(movimientos, rango)
    .filter((movimiento) => esGasto(movimiento) && movimiento.ocurridoEn <= hasta)
    .map((movimiento) => money(movimiento.montoMinor, 'CLP'));
  return sum(montos);
}

/**
 * Que fraccion del gasto de un mes suele haberse ido al llegar al dia N.
 *
 * Se promedia sobre los meses completos que haya en el historico. Los meses sin
 * gasto se saltan: dividir por cero no aporta un dato, aporta un NaN.
 */
function perfilAcumulado(
  movimientos: readonly MovimientoAnalizable[],
  hastaDia: number,
  excluir: DateRange,
): number | null {
  const porMes = new Map<string, { total: number; hasta: number }>();

  for (const movimiento of movimientos) {
    if (!esGasto(movimiento)) continue;
    if (containsDate(excluir, movimiento.ocurridoEn)) continue;

    const clave = movimiento.ocurridoEn.slice(0, 7);
    const acumulado = porMes.get(clave) ?? { total: 0, hasta: 0 };
    acumulado.total += movimiento.montoMinor;
    // El corte se hace por **proporcion del mes**, no por numero de dia: el dia
    // 15 de febrero es mas de la mitad del mes y el 15 de enero no llega.
    if (diaDelMes(movimiento.ocurridoEn) <= hastaDia) acumulado.hasta += movimiento.montoMinor;
    porMes.set(clave, acumulado);
  }

  const fracciones = [...porMes.values()]
    .filter((acumulado) => acumulado.total > 0)
    .map((acumulado) => acumulado.hasta / acumulado.total);

  if (fracciones.length === 0) return null;
  return fracciones.reduce((suma, fraccion) => suma + fraccion, 0) / fracciones.length;
}

export function calcularRitmo(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
  hoy: PlainDate,
): Ritmo {
  const diasDelRango = lengthInDays(rango);
  // Si `hoy` cae despues del rango, el rango esta cerrado: transcurrio entero.
  const corte = minDate(hoy, rango.end);
  const transcurridos = Math.max(1, daysBetween(rango.start, corte) + 1);
  const restantes = Math.max(0, diasDelRango - transcurridos);

  const gastado = gastoHasta(movimientos, rango, corte);
  const promedioDiario = divide(gastado, transcurridos);
  const proyeccionLineal = multiply(promedioDiario, diasDelRango);

  const fraccion = perfilAcumulado(movimientos, diaDelMes(corte), rango);
  // Con una fraccion muy chica la division amplifica el ruido hasta lo absurdo:
  // el dia 1 se conoce el 2% del mes y dividir por 0,02 multiplica por 50.
  const proyeccionPorPerfil = fraccion !== null && fraccion >= 0.05
    ? divide(gastado, fraccion)
    : null;

  return {
    gastadoHastaAhora: gastado,
    diasTranscurridos: transcurridos,
    diasDelRango,
    diasRestantes: restantes,
    promedioDiario,
    proyeccionLineal,
    proyeccionPorPerfil,
  };
}

/**
 * Grosor del hielo: cuantos dias aguanta el saldo al ritmo actual.
 *
 * `null` si no se esta gastando nada — no es que aguante infinito, es que la
 * pregunta no aplica y mostrar "∞ dias" seria ruido.
 */
export function grosorDelHielo(saldo: Money, quemaDiaria: Money): number | null {
  if (quemaDiaria.amountMinor <= 0) return null;
  if (saldo.amountMinor <= 0) return 0;
  return Math.floor(saldo.amountMinor / quemaDiaria.amountMinor);
}

/**
 * Cuanto se puede gastar por dia sin comerse lo comprometido ni la meta.
 *
 * (saldo − lo que falta pagar − meta de ahorro) / dias que quedan.
 */
export function seguroGastarHoy(
  saldo: Money,
  comprometido: Money,
  metaDeAhorro: Money,
  diasRestantes: number,
): Money {
  if (diasRestantes <= 0) return money(0, 'CLP');
  const disponible = saldo.amountMinor - comprometido.amountMinor - metaDeAhorro.amountMinor;
  if (disponible <= 0) return money(0, 'CLP');
  return divide(money(disponible, 'CLP'), diasRestantes);
}

/** Ultimo dia del mes que contiene la fecha. Util para armar rangos. */
export function finDelMesDe(fecha: PlainDate): number {
  return daysInMonth(anoDe(fecha), mesDe(fecha));
}

/** El dia siguiente. Se exporta porque las series diarias lo usan mucho. */
export { addDays };
