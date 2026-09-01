/**
 * Series por dia: lo que alimenta al calendario y a los graficos de linea.
 *
 * Devuelve **todos** los dias del rango, incluidos los que no tuvieron
 * movimiento. Saltarse los dias vacios haria que un calendario dejara huecos y
 * que una linea uniera dos puntos lejanos con una recta que miente sobre lo que
 * paso en el medio.
 */

import { compareDates, eachDate, weekday, type DateRange, type PlainDate } from '../dates/index';
import { money, type Money } from '../money/index';
import { esGasto, esIngreso, type MovimientoAnalizable } from './movimiento';
import { enRango, mediana } from './resumen';

export interface DiaDeLaSerie {
  readonly fecha: PlainDate;
  readonly gasto: Money;
  readonly ingreso: Money;
  readonly cantidad: number;
}

/** Un dia por cada dia del rango, en orden, sin huecos. */
export function seriePorDia(
  movimientos: readonly MovimientoAnalizable[],
  rango: DateRange,
): DiaDeLaSerie[] {
  const gastos = new Map<string, number>();
  const ingresos = new Map<string, number>();
  const cuenta = new Map<string, number>();

  for (const movimiento of enRango(movimientos, rango)) {
    const clave = movimiento.ocurridoEn;
    if (esGasto(movimiento)) {
      gastos.set(clave, (gastos.get(clave) ?? 0) + movimiento.montoMinor);
    } else if (esIngreso(movimiento)) {
      ingresos.set(clave, (ingresos.get(clave) ?? 0) + movimiento.montoMinor);
    } else {
      continue; // Las transferencias no son flujo real.
    }
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }

  return eachDate(rango).map((fecha) => ({
    fecha,
    gasto: money(gastos.get(fecha) ?? 0, 'CLP'),
    ingreso: money(ingresos.get(fecha) ?? 0, 'CLP'),
    cantidad: cuenta.get(fecha) ?? 0,
  }));
}

export interface DiaConSaldo {
  readonly fecha: PlainDate;
  /** Saldo al **cerrar** ese dia, ya aplicados sus movimientos. */
  readonly saldo: Money;
  /**
   * Lo que entro y salio **ese dia**, que es lo que movio el saldo.
   *
   * Va aca y no en una serie aparte porque quien mira la curva y pregunta "por
   * que baja aca" necesita las dos cosas juntas: el saldo dice donde quedo y el
   * gasto dice por que. Tenerlas separadas obligaba a cruzar dos arreglos por
   * indice en la pantalla, que es la clase de cruce que se desincroniza.
   */
  readonly gasto: Money;
  readonly ingreso: Money;
}

/**
 * El saldo dia a dia, partiendo de lo que habia al empezar el rango.
 *
 * Cada punto es el saldo al **cerrar** el dia, que es como lo muestra un banco.
 * Asi la linea baja durante el mes y pega el salto el dia que entra el sueldo,
 * que es la forma real de un mes y no un promedio suavizado.
 *
 * El saldo de partida se lo tiene que dar quien llama: `analytics` solo ve los
 * movimientos que le pasan, y el saldo verdadero incluye todo lo anterior al
 * rango mas el saldo inicial de las cuentas.
 */
export function saldoAcumulado(
  serie: readonly DiaDeLaSerie[],
  saldoAlEmpezar: Money,
): DiaConSaldo[] {
  let corriente = saldoAlEmpezar.amountMinor;
  return serie.map((dia) => {
    corriente += dia.ingreso.amountMinor - dia.gasto.amountMinor;
    return {
      fecha: dia.fecha,
      saldo: money(corriente, saldoAlEmpezar.currency),
      gasto: dia.gasto,
      ingreso: dia.ingreso,
    };
  });
}

/** El dia que mas se gasto. `null` si no hubo gasto en todo el rango. */
export function diaDeMayorGasto(serie: readonly DiaDeLaSerie[]): DiaDeLaSerie | null {
  let mayor: DiaDeLaSerie | null = null;
  for (const dia of serie) {
    if (dia.gasto.amountMinor === 0) continue;
    if (mayor === null || dia.gasto.amountMinor > mayor.gasto.amountMinor) mayor = dia;
  }
  return mayor;
}

export interface GastoPorDiaDeSemana {
  /** 1 lunes … 7 domingo. */
  readonly dia: number;
  readonly total: Money;
  readonly cantidad: number;
  /** Promedio por vez que ocurrio ese dia de la semana en el rango. */
  readonly promedio: Money;
}

/**
 * Gasto agrupado por dia de la semana.
 *
 * Responde "¿que dia se me va la plata?". El promedio va aparte del total
 * porque un rango puede tener cinco lunes y cuatro martes, y comparar totales
 * crudos le daria ventaja al lunes por existir una vez mas.
 */
export function gastoPorDiaDeSemana(serie: readonly DiaDeLaSerie[]): GastoPorDiaDeSemana[] {
  const totales = new Map<number, number>();
  const ocurrencias = new Map<number, number>();

  for (const dia of serie) {
    const cual = weekday(dia.fecha);
    totales.set(cual, (totales.get(cual) ?? 0) + dia.gasto.amountMinor);
    ocurrencias.set(cual, (ocurrencias.get(cual) ?? 0) + 1);
  }

  return [1, 2, 3, 4, 5, 6, 7].map((dia) => {
    const total = totales.get(dia) ?? 0;
    const veces = ocurrencias.get(dia) ?? 0;
    return {
      dia,
      total: money(total, 'CLP'),
      cantidad: veces,
      promedio: money(veces === 0 ? 0 : Math.round(total / veces), 'CLP'),
    };
  });
}

/** Los dias que cuentan para la racha. Fuera de esto no se mira nada. */
export interface VentanaDeRacha {
  /** El primero que cuenta. Antes de esto no habia datos, no habia ahorro. */
  readonly desde?: PlainDate;
  /** El ultimo que cuenta. Despues de esto el dia no ha pasado todavia. */
  readonly hasta?: PlainDate;
}

/**
 * Rachas de dias seguidos sin gastar nada.
 *
 * La mas larga es el dato interesante: dice cuanto se aguanta sin gastar, que
 * es distinto de gastar poco.
 *
 * **La ventana no es un adorno: sin ella el numero miente.** La serie trae todos
 * los dias del rango, incluidos los que estan fuera de lo que la app sabe. Un mes
 * donde se empezo a anotar el 22 tenia veintiun dias vacios al principio y se
 * reportaban como "21 dias sin gastar", cuando en realidad son veintiun dias sin
 * datos. Lo mismo por el otro lado: los dias que todavia no llegan aparecen
 * vacios porque no han pasado.
 *
 * Los dias de afuera se **saltan**, no se cuentan como dia con gasto. Como la
 * serie viene en orden y sin huecos, saltarse las puntas deja adentro un tramo
 * igual de continuo.
 */
export function rachaMasLargaSinGasto(
  serie: readonly DiaDeLaSerie[],
  ventana: VentanaDeRacha = {},
): number {
  let mejor = 0;
  let actual = 0;
  for (const dia of serie) {
    if (ventana.desde !== undefined && compareDates(dia.fecha, ventana.desde) < 0) continue;
    if (ventana.hasta !== undefined && compareDates(dia.fecha, ventana.hasta) > 0) continue;
    if (dia.gasto.amountMinor === 0) {
      actual += 1;
      if (actual > mejor) mejor = actual;
    } else {
      actual = 0;
    }
  }
  return mejor;
}

export interface GastoDeTanda {
  readonly total: Money;
  /** Cuantos dias de esa clase hubo en el periodo. */
  readonly dias: number;
  /** Total dividido por dias. Es lo unico comparable entre las dos tandas. */
  readonly promedio: Money;
}

export interface FinDeSemanaContraSemana {
  readonly finDeSemana: GastoDeTanda;
  readonly entreSemana: GastoDeTanda;
}

/**
 * El gasto partido en dos: sabado y domingo contra el resto.
 *
 * Reemplaza a la tabla de siete dias, que decia lo mismo repartido en siete
 * filas y por eso no decia nada: para leerla habia que promediar de cabeza
 * mientras se miraba. La pregunta que la gente tiene de verdad es "¿el fin de
 * semana me sale caro?", y esa se contesta con dos numeros.
 *
 * Se compara por **promedio diario** y no por total: un periodo cualquiera
 * tiene cinco veces mas dias entre semana que de fin de semana, asi que el
 * total le da ventaja a la semana por existir mas veces.
 */
export function finDeSemanaContraSemana(
  serie: readonly DiaDeLaSerie[],
): FinDeSemanaContraSemana {
  const tanda = (dias: readonly DiaDeLaSerie[]): GastoDeTanda => {
    const total = dias.reduce((suma, dia) => suma + dia.gasto.amountMinor, 0);
    return {
      total: money(total, 'CLP'),
      dias: dias.length,
      promedio: money(dias.length === 0 ? 0 : Math.round(total / dias.length), 'CLP'),
    };
  };

  return {
    finDeSemana: tanda(serie.filter((dia) => weekday(dia.fecha) >= 6)),
    entreSemana: tanda(serie.filter((dia) => weekday(dia.fecha) < 6)),
  };
}

export interface Concentracion {
  /** Los dias mas caros, del mas caro al menos. */
  readonly dias: readonly DiaDeLaSerie[];
  /** Que parte del gasto del periodo se fue en ellos, de 0 a 1. */
  readonly parte: number;
}

/**
 * Cuanto del periodo se fue en los pocos dias mas caros.
 *
 * Es la cifra que distingue dos meses que gastaron lo mismo y no se parecen en
 * nada: uno donde el 70 % se fue en tres dias --el arriendo, el seguro, una
 * compra grande-- y otro donde se fue en goteo. El primero se arregla mirando
 * tres decisiones; el segundo, cambiando un habito.
 *
 * Los dias sin gasto no entran: un periodo con veinte dias en cero no tiene
 * "tres dias mas caros" entre ellos.
 */
export function concentracion(serie: readonly DiaDeLaSerie[], cuantos = 3): Concentracion {
  const total = serie.reduce((suma, dia) => suma + dia.gasto.amountMinor, 0);
  const conGasto = serie
    .filter((dia) => dia.gasto.amountMinor > 0)
    .sort((uno, otro) => otro.gasto.amountMinor - uno.gasto.amountMinor);

  const dias = conGasto.slice(0, Math.max(0, cuantos));
  const suman = dias.reduce((suma, dia) => suma + dia.gasto.amountMinor, 0);

  return { dias, parte: total === 0 ? 0 : suman / total };
}

/**
 * Lo que se gasta en un dia **de los que se gasta**.
 *
 * La mediana y no el promedio, y solo sobre los dias con gasto. Las dos
 * decisiones apuntan a lo mismo: el promedio diario de un mes con arriendo esta
 * tironeado por un solo dia, y meter los dias en cero lo tira para el otro lado.
 * Lo que queda es el dia normal, que es contra lo que uno compara cuando se
 * pregunta si hoy gasto mucho.
 *
 * Cero si no hubo ningun dia con gasto: no hay dia normal que describir.
 */
export function gastoDiarioTipico(serie: readonly DiaDeLaSerie[]): Money {
  const conGasto = serie
    .filter((dia) => dia.gasto.amountMinor > 0)
    .map((dia) => dia.gasto.amountMinor);
  if (conGasto.length === 0) return money(0, 'CLP');
  return money(Math.round(mediana(conGasto)), 'CLP');
}

/** Cuantos dias del periodo pasaron sin gastar un peso. */
export function diasSinGastar(serie: readonly DiaDeLaSerie[]): number {
  return serie.filter((dia) => dia.gasto.amountMinor === 0).length;
}
