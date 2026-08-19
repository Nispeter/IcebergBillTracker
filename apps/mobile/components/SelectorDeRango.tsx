/**
 * Pestañas de rango: dia, semana, mes, ano.
 *
 * Es el control del que cuelga toda la pantalla: el resumen, las categorias y
 * —cuando lleguen— la torta y el calendario son todos "de este rango". Por eso
 * vive arriba de todo y no dentro de una seccion.
 *
 * El rango sabe **de que tipo es** (ver `core/dates/range`), asi que elegir
 * "semana" no solo cambia las fechas: cambia contra que se compara. El anterior
 * de una semana es la semana pasada completa, no "siete dias atras".
 */

import { dates } from '@iceberg/core';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type TipoDeRango = 'day' | 'week' | 'month' | 'year';

export const RANGOS: readonly { valor: TipoDeRango; etiqueta: string }[] = [
  { valor: 'day', etiqueta: 'Día' },
  { valor: 'week', etiqueta: 'Semana' },
  { valor: 'month', etiqueta: 'Mes' },
  { valor: 'year', etiqueta: 'Año' },
];

/** Arma el rango concreto a partir del tipo y una fecha de referencia. */
export function rangoDe(tipo: TipoDeRango, referencia: dates.PlainDate): dates.DateRange {
  switch (tipo) {
    case 'day': return dates.dayRange(referencia);
    case 'week': return dates.weekRange(referencia);
    case 'month': return dates.currentMonth(referencia);
    case 'year': return dates.yearRange(dates.year(referencia));
  }
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Primera letra en mayuscula, el resto tal cual. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Como se nombra el rango en pantalla.
 *
 * La mayuscula se pone aca y no con `textTransform: 'capitalize'`, que la pone
 * en **cada palabra**: "Agosto De 2026", "17 Al 23 De Agosto".
 */
export function nombreDeRango(tipo: TipoDeRango, rango: dates.DateRange): string {
  return capitalizar(nombreCrudo(tipo, rango));
}

function nombreCrudo(tipo: TipoDeRango, rango: dates.DateRange): string {
  const inicio = rango.start;
  switch (tipo) {
    case 'day':
      return dates.formatDateLong(inicio);
    case 'week':
      // Si la semana cruza de mes, se nombra el mes en los dos extremos.
      return dates.month(rango.start) === dates.month(rango.end)
        ? `${dates.day(rango.start)} al ${dates.day(rango.end)} de ${MESES[dates.month(rango.start) - 1]}`
        : `${dates.day(rango.start)} ${MESES[dates.month(rango.start) - 1]?.slice(0, 3)} al ${dates.day(rango.end)} ${MESES[dates.month(rango.end) - 1]?.slice(0, 3)}`;
    case 'month':
      return `${MESES[dates.month(inicio) - 1]} de ${dates.year(inicio)}`;
    case 'year':
      return String(dates.year(inicio));
  }
}

export function SelectorDeRango(
  { theme, valor, onElegir }:
  { theme: Theme; valor: TipoDeRango; onElegir: (tipo: TipoDeRango) => void },
) {
  const styles = crearEstilos(theme);
  return (
    <View style={styles.barra}>
      {RANGOS.map((rango) => {
        const activo = rango.valor === valor;
        return (
          <Pressable
            key={rango.valor}
            onPress={() => onElegir(rango.valor)}
            style={[styles.pestana, activo && styles.pestanaActiva]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={`Ver por ${rango.etiqueta.toLowerCase()}`}
          >
            <Text style={activo ? styles.textoActivo : styles.texto}>{rango.etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    barra: {
      flexDirection: 'row',
      gap: 2,
      padding: 2,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    pestana: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radii.sm - 2,
    },
    pestanaActiva: { backgroundColor: theme.tinta },
    texto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.silencio },
    textoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.fondo },
  });
}
