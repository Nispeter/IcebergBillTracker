/**
 * El periodo que se esta mirando, compartido por **todas** las vistas.
 *
 * Vive en un contexto y no en cada pantalla porque cambiar de vista no deberia
 * cambiar de fecha: si uno esta mirando julio en el resumen y toca "Categorias",
 * espera ver las categorias **de julio**, no las del mes actual.
 *
 * El rango sabe de que tipo es, asi que moverse un paso respeta el calendario:
 * el siguiente de febrero es marzo con sus 31 dias, no "28 dias despues".
 */

import { dates } from '@iceberg/core';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type TipoDePeriodo = 'day' | 'week' | 'month' | 'year';

export const TIPOS: readonly { valor: TipoDePeriodo; etiqueta: string }[] = [
  { valor: 'day', etiqueta: 'Día' },
  { valor: 'week', etiqueta: 'Semana' },
  { valor: 'month', etiqueta: 'Mes' },
  { valor: 'year', etiqueta: 'Año' },
];

function armar(tipo: TipoDePeriodo, referencia: dates.PlainDate): dates.DateRange {
  switch (tipo) {
    case 'day': return dates.dayRange(referencia);
    case 'week': return dates.weekRange(referencia);
    case 'month': return dates.currentMonth(referencia);
    case 'year': return dates.yearRange(dates.year(referencia));
  }
}

interface ValorDelPeriodo {
  readonly tipo: TipoDePeriodo;
  readonly rango: dates.DateRange;
  /** Hasta donde llegan los datos: el tope de "hoy" para proyecciones. */
  readonly corte: dates.PlainDate;
  cambiarTipo(tipo: TipoDePeriodo): void;
  anterior(): void;
  siguiente(): void;
  /** Vuelve al periodo que contiene la fecha de corte. */
  alDia(): void;
  /** Si ya se esta en el periodo mas reciente con datos. */
  readonly esElUltimo: boolean;
}

const ContextoDePeriodo = createContext<ValorDelPeriodo | null>(null);

export function ProveedorDePeriodo({ corte, children }: { corte: dates.PlainDate; children: ReactNode }) {
  const [tipo, setTipo] = useState<TipoDePeriodo>('month');
  const [referencia, setReferencia] = useState<dates.PlainDate | null>(null);

  // Mientras nadie navegue, la referencia sigue al corte: al cargar mas datos,
  // la pantalla se mueve sola al periodo nuevo en vez de quedarse pegada.
  const actual = referencia ?? corte;
  const rango = useMemo(() => armar(tipo, actual), [tipo, actual]);

  const valor = useMemo<ValorDelPeriodo>(() => ({
    tipo,
    rango,
    corte,
    esElUltimo: dates.containsDate(rango, corte),
    cambiarTipo: (nuevo) => {
      setTipo(nuevo);
      // Se conserva la fecha mirada, no se salta a hoy: pasar de "mes" a
      // "semana" estando en julio debe mostrar una semana de julio.
      setReferencia(actual);
    },
    anterior: () => setReferencia(dates.previousPeriod(rango).start),
    siguiente: () => setReferencia(dates.nextPeriod(rango).start),
    alDia: () => setReferencia(null),
  }), [tipo, rango, corte, actual]);

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

/**
 * Como se nombra el periodo en pantalla.
 *
 * La mayuscula se pone aca y no con `textTransform: 'capitalize'`, que la pone
 * en **cada palabra**: "Agosto De 2026".
 */
export function nombreDePeriodo(tipo: TipoDePeriodo, rango: dates.DateRange): string {
  const crudo = (() => {
    switch (tipo) {
      case 'day':
        return dates.formatDateLong(rango.start);
      case 'week':
        return dates.month(rango.start) === dates.month(rango.end)
          ? `${dates.day(rango.start)} al ${dates.day(rango.end)} de ${MESES[dates.month(rango.start) - 1]}`
          : `${dates.day(rango.start)} ${MESES[dates.month(rango.start) - 1]?.slice(0, 3)} — ${dates.day(rango.end)} ${MESES[dates.month(rango.end) - 1]?.slice(0, 3)}`;
      case 'month':
        return `${MESES[dates.month(rango.start) - 1]} ${dates.year(rango.start)}`;
      case 'year':
        return String(dates.year(rango.start));
    }
  })();
  return crudo.charAt(0).toUpperCase() + crudo.slice(1);
}
