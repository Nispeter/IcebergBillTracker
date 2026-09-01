/**
 * El periodo que se esta mirando, compartido por **todas** las vistas.
 *
 * Vive en un contexto y no en cada pantalla porque cambiar de vista no deberia
 * cambiar de fecha: si uno esta mirando julio en el resumen y toca "Categorias",
 * espera ver las categorias **de julio**, no las del mes actual.
 *
 * El rango sabe de que tipo es, asi que moverse un paso respeta el calendario:
 * el siguiente de febrero es marzo con sus 31 dias, no "28 dias despues". Eso
 * vale tambien para el rango libre, que avanza su propio largo.
 */

import { dates } from '@iceberg/core';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useHoy } from './hoy';

export type TipoDePeriodo = 'day' | 'week' | 'month' | 'year' | 'custom';

export const TIPOS: readonly { valor: TipoDePeriodo; etiqueta: string }[] = [
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
  /**
   * Hoy, no el corte. **La app se para en el dia, no en el ultimo dato.**
   *
   * Son cosas distintas y confundirlas era un bug con nombre y hora: `corte` es
   * `min(ultimo movimiento, hoy)` --hasta donde llegan los datos, que es lo que
   * necesita una proyeccion-- y se usaba tambien como la fecha que se esta
   * mirando. Con el ultimo gasto anotado el 30 de agosto, a las 00:27 del 1 de
   * septiembre la app seguia mostrando agosto, y seguiria mostrandolo hasta que
   * alguien anotara algo. Ningun calculo estaba mal: la pregunta "que periodo
   * miro" nunca fue sobre los datos.
   *
   * `corte` sigue existiendo y sigue saliendo en el contexto: lo usan las
   * proyecciones, que si tienen que saber hasta donde hay datos.
   */
  const hoy = useHoy();
  const [tipo, setTipo] = useState<TipoDePeriodo>('month');
  const [referencia, setReferencia] = useState<dates.PlainDate | null>(null);
  const [libre, setLibre] = useState<dates.DateRange | null>(null);

  // Mientras nadie navegue, la referencia sigue a hoy: la app abre en el
  // periodo actual y cruza sola la medianoche --y el fin de mes-- porque
  // `useHoy` redibuja cuando el dia cambia.
  const actual = referencia ?? hoy;

  const rango = useMemo(() => {
    if (tipo === 'custom') {
      // Si todavia no se eligio un rango libre, se arranca con el mes: mejor
      // que una pantalla vacia esperando dos fechas.
      return libre ?? dates.dateRange(
        dates.startOfMonth(actual), dates.endOfMonth(actual), 'custom',
      );
    }
    switch (tipo) {
      case 'day': return dates.dayRange(actual);
      case 'week': return dates.weekRange(actual);
      case 'month': return dates.currentMonth(actual);
      case 'year': return dates.yearRange(dates.year(actual));
    }
  }, [tipo, actual, libre]);

  const valor = useMemo<ValorDelPeriodo>(() => ({
    tipo,
    rango,
    corte,
    esElActual: dates.containsDate(rango, hoy),
    cambiarTipo: (nuevo) => {
      setTipo(nuevo);
      /*
        Si el periodo que se esta mirando incluye hoy, se aterriza **en hoy**.
        Antes se conservaba siempre la fecha de referencia, que despues de
        navegar es el primer dia del rango: estando en el mes actual y pasando a
        "Dia" la app mostraba el 1 del mes, que es el dia menos util de los
        treinta. Si el mes es otro --julio, mirando hacia atras-- se conserva la
        fecha mirada, porque ahi saltar a hoy seria perder el lugar.
      */
      setReferencia(dates.containsDate(rango, hoy) ? hoy : actual);
      if (nuevo !== 'custom') setLibre(null);
    },
    fijarRango: (desde, hasta) => {
      setTipo('custom');
      setLibre(dates.dateRange(desde, hasta, 'custom'));
      setReferencia(desde);
    },
    anterior: () => {
      const previo = dates.previousPeriod(rango);
      if (tipo === 'custom') setLibre(previo);
      setReferencia(previo.start);
    },
    siguiente: () => {
      const proximo = dates.nextPeriod(rango);
      if (tipo === 'custom') setLibre(proximo);
      setReferencia(proximo.start);
    },
    alDia: () => { setReferencia(null); setLibre(null); },
    irAlDia: (fecha) => { setReferencia(fecha); setLibre(null); },
  }), [tipo, rango, corte, actual, hoy]);

  return <ContextoDePeriodo.Provider value={valor}>{children}</ContextoDePeriodo.Provider>;
}

export function usePeriodo(): ValorDelPeriodo {
  const valor = useContext(ContextoDePeriodo);
  if (valor === null) throw new Error('usePeriodo fuera de ProveedorDePeriodo');
  return valor;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const CORTOS = MESES.map((mes) => mes.slice(0, 3));

/**
 * Como se nombra el periodo en pantalla.
 *
 * La mayuscula se pone aca y no con `textTransform: 'capitalize'`, que la pone
 * en **cada palabra**: "Agosto De 2026".
 */
export function nombreDePeriodo(tipo: TipoDePeriodo, rango: dates.DateRange): string {
  const dia = (fecha: dates.PlainDate) => `${dates.day(fecha)} ${CORTOS[dates.month(fecha) - 1]}`;

  const crudo = (() => {
    switch (tipo) {
      case 'day':
        return dates.formatDateLong(rango.start);
      case 'week':
        return dates.month(rango.start) === dates.month(rango.end)
          ? `${dates.day(rango.start)} al ${dates.day(rango.end)} de ${MESES[dates.month(rango.start) - 1]}`
          : `${dia(rango.start)} — ${dia(rango.end)}`;
      case 'month':
        return `${MESES[dates.month(rango.start) - 1]} ${dates.year(rango.start)}`;
      case 'year':
        return String(dates.year(rango.start));
      case 'custom':
        return dates.year(rango.start) === dates.year(rango.end)
          ? `${dia(rango.start)} — ${dia(rango.end)}`
          : `${dates.formatDate(rango.start)} — ${dates.formatDate(rango.end)}`;
    }
  })();
  return crudo.charAt(0).toUpperCase() + crudo.slice(1);
}
