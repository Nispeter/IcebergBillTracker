/**
 * El período que se está mirando, compartido por todas las vistas: cambiar de
 * vista no cambia de fecha. Moverse un paso respeta el calendario (después de
 * febrero viene marzo entero), y el rango libre avanza su propio largo.
 */

import { dates } from '@iceberg/core';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useHoy } from './hoy';

/**
 * Dos familias: los de calendario (día, semana, mes, año) son cajones; los
 * móviles (`lastWeek`, `lastMonth`, `lastYear`) terminan en la fecha mirada y
 * duran una unidad hacia atrás. Arranca `lastMonth`: el mes calendario muestra
 * dos días de gasto el día 2, que es cuando más se abre la app.
 */
export type TipoDePeriodo =
  | 'lastWeek' | 'lastMonth' | 'lastYear'
  | 'day' | 'week' | 'month' | 'year'
  | 'custom';

/** Los moviles: terminan en la fecha mirada en vez de en el borde del cajon. */
const RODANTES: Partial<Record<TipoDePeriodo, dates.TrailingUnit>> = {
  lastWeek: 'week',
  lastMonth: 'month',
  lastYear: 'year',
};

function unidadRodante(tipo: TipoDePeriodo): dates.TrailingUnit | undefined {
  return RODANTES[tipo];
}

// Los moviles primero: uno de ellos es el que viene puesto, y ademas es lo que
// se elige mas seguido. Dentro de cada familia, de corto a largo.
export const TIPOS: readonly { valor: TipoDePeriodo; etiqueta: string }[] = [
  { valor: 'lastWeek', etiqueta: 'Última semana' },
  { valor: 'lastMonth', etiqueta: 'Último mes' },
  { valor: 'lastYear', etiqueta: 'Último año' },
  { valor: 'day', etiqueta: 'Día' },
  { valor: 'week', etiqueta: 'Semana' },
  { valor: 'month', etiqueta: 'Mes' },
  { valor: 'year', etiqueta: 'Año' },
  { valor: 'custom', etiqueta: 'Personalizado' },
];

interface ValorDelPeriodo {
  readonly tipo: TipoDePeriodo;
  readonly rango: dates.DateRange;
  /** Hasta donde llegan los datos: el tope de "hoy" para proyecciones. */
  readonly corte: dates.PlainDate;
  cambiarTipo(tipo: TipoDePeriodo): void;
  /** Fija un rango libre. El tipo pasa a `custom`. */
  fijarRango(desde: dates.PlainDate, hasta: dates.PlainDate): void;
  anterior(): void;
  siguiente(): void;
  /** Vuelve al periodo que contiene hoy. */
  alDia(): void;
  /** Salta al periodo --del tipo que este puesto-- que contiene esa fecha. */
  irAlDia(fecha: dates.PlainDate): void;
  /** Si el periodo que se esta mirando contiene hoy. */
  readonly esElActual: boolean;
}

const ContextoDePeriodo = createContext<ValorDelPeriodo | null>(null);

export function ProveedorDePeriodo({ corte, children }: { corte: dates.PlainDate; children: ReactNode }) {
  // La app se para en hoy, no en el último dato: `corte` es hasta dónde llegan
  // los datos y solo lo necesitan las proyecciones.
  const hoy = useHoy();
  const [tipo, setTipo] = useState<TipoDePeriodo>('lastMonth');
  const [referencia, setReferencia] = useState<dates.PlainDate | null>(null);
  const [libre, setLibre] = useState<dates.DateRange | null>(null);

  // La fecha en que se apoya el período: hoy, mientras nadie navegue. Uno de
  // calendario la contiene; uno móvil termina en ella.
  const actual = referencia ?? hoy;

  const rango = useMemo(() => {
    if (tipo === 'custom') {
      // Si todavia no se eligio un rango libre, se arranca con el mes: mejor
      // que una pantalla vacia esperando dos fechas.
      return libre ?? dates.dateRange(
        dates.startOfMonth(actual), dates.endOfMonth(actual), 'custom',
      );
    }
    const rodante = unidadRodante(tipo);
    if (rodante !== undefined) return dates.trailingRange(rodante, actual);

    switch (tipo) {
      case 'day': return dates.dayRange(actual);
      case 'week': return dates.weekRange(actual);
      case 'month': return dates.currentMonth(actual);
      case 'year': return dates.yearRange(dates.year(actual));
      default: return dates.currentMonth(actual);
    }
  }, [tipo, actual, libre]);

  /**
   * Un paso atrás o adelante. Los de calendario saltan de cajón en cajón; los
   * móviles corren su ancla una unidad (correrlos su largo en días se
   * desalinearía con los meses de distinto largo).
   */
  function correr(pasos: number) {
    const rodante = unidadRodante(tipo);
    if (rodante !== undefined) {
      setReferencia(rodante === 'week' ? dates.addDays(actual, 7 * pasos)
        : rodante === 'month' ? dates.addMonths(actual, pasos)
          : dates.addYears(actual, pasos));
      return;
    }
    const destino = pasos < 0 ? dates.previousPeriod(rango) : dates.nextPeriod(rango);
    if (tipo === 'custom') setLibre(destino);
    setReferencia(destino.start);
  }

  const valor = useMemo<ValorDelPeriodo>(() => ({
    tipo,
    rango,
    corte,
    esElActual: dates.containsDate(rango, hoy),
    cambiarTipo: (nuevo) => {
      setTipo(nuevo);
      // Si lo que se mira incluye hoy, se aterriza en hoy (y no en el día 1 del
      // mes); si es otro período, se conserva la fecha para no perder el lugar.
      setReferencia(dates.containsDate(rango, hoy) ? hoy : actual);
      if (nuevo !== 'custom') setLibre(null);
    },
    fijarRango: (desde, hasta) => {
      setTipo('custom');
      setLibre(dates.dateRange(desde, hasta, 'custom'));
      setReferencia(desde);
    },
    anterior: () => correr(-1),
    siguiente: () => correr(1),
    alDia: () => { setReferencia(null); setLibre(null); },
    // Recibe una fecha porque traducirla al ancla de cada familia se sabe acá.
    irAlDia: (fecha) => {
      const destino = dates.periodContaining(rango, fecha);
      if (tipo === 'custom') { setLibre(destino); setReferencia(destino.start); return; }
      setLibre(null);
      setReferencia(unidadRodante(tipo) === undefined ? destino.start : destino.end);
    },
  }), [tipo, rango, corte, actual, hoy]);

  return <ContextoDePeriodo.Provider value={valor}>{children}</ContextoDePeriodo.Provider>;
}

export function usePeriodo(): ValorDelPeriodo {
  const valor = useContext(ContextoDePeriodo);
  if (valor === null) throw new Error('usePeriodo fuera de ProveedorDePeriodo');
  return valor;
}

/**
 * Como se nombra el periodo en pantalla.
 *
 * La mayuscula se pone aca y no con `textTransform: 'capitalize'`, que la pone
 * en **cada palabra**: "Agosto De 2026".
 */
export function nombreDePeriodo(tipo: TipoDePeriodo, rango: dates.DateRange): string {
  const dia = dates.formatDateShort;
  const mes = (fecha: dates.PlainDate) => dates.monthName(dates.month(fecha));

  const crudo = (() => {
    // Los móviles con sus dos fechas: "Último mes" mentiría en cuanto se
    // navega hacia atrás.
    if (tipo === 'lastWeek' || tipo === 'lastMonth' || tipo === 'lastYear') {
      return dates.year(rango.start) === dates.year(rango.end)
        ? `${dia(rango.start)} — ${dia(rango.end)}`
        : `${dates.formatDate(rango.start)} — ${dates.formatDate(rango.end)}`;
    }

    switch (tipo) {
      case 'day':
        return dates.formatDateLong(rango.start);
      case 'week':
        return dates.month(rango.start) === dates.month(rango.end)
          ? `${dates.day(rango.start)} al ${dates.day(rango.end)} de ${mes(rango.start)}`
          : `${dia(rango.start)} — ${dia(rango.end)}`;
      case 'month':
        return `${mes(rango.start)} ${dates.year(rango.start)}`;
      case 'year':
        return String(dates.year(rango.start));
      default:
        return dates.year(rango.start) === dates.year(rango.end)
          ? `${dia(rango.start)} — ${dia(rango.end)}`
          : `${dates.formatDate(rango.start)} — ${dates.formatDate(rango.end)}`;
    }
  })();
  return crudo.charAt(0).toUpperCase() + crudo.slice(1);
}
