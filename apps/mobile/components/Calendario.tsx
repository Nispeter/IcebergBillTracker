/**
 * El periodo como grilla de dias, con el gasto de cada uno.
 *
 * Es la vista que hace evidente algo que ninguna cifra dice: **el gasto no es
 * parejo**. El dia 5 se va el arriendo, el fin de semana se carga el delivery,
 * y hay semanas casi en blanco. Es lo que el modelo de proyeccion por perfil ya
 * sabia y que no se veia en ninguna parte.
 *
 * Cada celda muestra **el monto**, no solo la intensidad. El color dice "cuanto"
 * de un vistazo; el numero contesta "cuanto exactamente" sin tener que tocar.
 */

import { dates, money } from '@iceberg/core';
import type { analytics } from '@iceberg/core';
import {
  charts, elevation, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Lunes primero, como el resto de la app. */
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Opacidad minima de un dia con gasto, para que nunca desaparezca. */
const PISO = 0.22;

/** Abrevia a miles: en una celda de 45px no entra "150.000". */
function abreviar(minor: number): string {
  if (minor === 0) return '';
  if (minor < 1_000) return String(minor);
  const miles = minor / 1_000;
  return miles >= 100 ? `${Math.round(miles)}k` : `${miles.toFixed(miles < 10 ? 1 : 0)}k`;
}

export function Calendario(
  { serie, theme, hoy, onElegirDia }:
  {
    serie: readonly analytics.DiaDeLaSerie[];
    theme: Theme;
    hoy: dates.PlainDate;
    onElegirDia?: (fecha: dates.PlainDate) => void;
  },
) {
  const styles = crearEstilos(theme);
  if (serie.length === 0) return null;

  const mayor = serie.reduce((max, dia) => Math.max(max, dia.gasto.amountMinor), 0);
  // El periodo no empieza en lunes: se rellena para que cada columna sea
  // siempre el mismo dia de la semana.
  const relleno = dates.weekday(serie[0]!.fecha) - 1;

  return (
    <View>
      <View style={styles.cabecera}>
        {DIAS.map((letra, indice) => (
          <Text key={indice} style={styles.diaSemana}>{letra}</Text>
        ))}
      </View>

      <View style={styles.grilla}>
        {Array.from({ length: relleno }, (_, i) => <View key={`v${i}`} style={styles.celda} />)}

        {serie.map((dia) => {
          const gastado = dia.gasto.amountMinor;
          const intensidad = mayor === 0 || gastado === 0 ? 0 : PISO + ((gastado / mayor) * (1 - PISO));
          const esHoy = dia.fecha === hoy;
          const fuerte = intensidad > 0.55;

          return (
            <Pressable
              key={dia.fecha}
              style={styles.celda}
              onPress={onElegirDia ? () => onElegirDia(dia.fecha) : undefined}
              disabled={!onElegirDia || gastado === 0}
              accessibilityRole={onElegirDia && gastado > 0 ? 'button' : undefined}
              accessibilityLabel={`${dates.formatDate(dia.fecha)}: ${money.format(dia.gasto)}`}
            >
              {gastado === 0 ? (
                <View style={[styles.marca, styles.marcaVacia]} />
              ) : (
                <View style={[styles.marca, { backgroundColor: charts[0], opacity: intensidad }]} />
              )}
              <View style={styles.textos}>
                <Text style={[styles.numero, esHoy && styles.numeroHoy, fuerte && styles.sobreFuerte]}>
                  {dates.day(dia.fecha)}
                </Text>
                <Text style={[styles.monto, fuerte && styles.sobreFuerte]}>{abreviar(gastado)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    cabecera: { flexDirection: 'row', marginBottom: spacing.xs },
    diaSemana: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontFamily: fonts.ui,
      fontWeight: pesos.medium,
      fontSize: 9,
      color: theme.silencio,
    },
    grilla: { flexDirection: 'row', flexWrap: 'wrap' },
    celda: { width: `${100 / 7}%`, aspectRatio: 0.95, padding: 2, alignItems: 'center', justifyContent: 'center' },
    marca: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: radii.sm },
    // Un dia sin gasto no se pinta: la hairline ya es el token para "existe
    // pero no pesa".
    marcaVacia: { borderWidth: elevation.hairlineWidth, borderColor: theme.hairline },
    textos: { alignItems: 'center' },
    numero: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.tinta },
    numeroHoy: { fontWeight: pesos.bold, color: theme.acentoTexto },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 8, color: theme.silencio },
    // Sobre una celda muy saturada, la tinta del tema claro no contrasta: se
    // usa el fondo, que es su opuesto por definicion.
    sobreFuerte: { color: theme.fondo },
  });
}
