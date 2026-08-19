/**
 * El mes como grilla, con el gasto de cada dia.
 *
 * Es la vista que hace evidente algo que ninguna cifra dice: **el gasto no es
 * parejo**. El dia 5 se va el arriendo, el fin de semana se carga el delivery,
 * y hay semanas enteras casi en blanco. Es exactamente lo que el modelo de
 * proyeccion por perfil ya sabe y que hasta ahora no se veia.
 *
 * La intensidad de cada celda es proporcional al gasto de ese dia contra el dia
 * mas caro del mes. Un solo color con opacidad, no una escala de colores: la
 * pregunta es "cuanto", no "de que tipo".
 */

import { dates, money } from '@iceberg/core';
import type { analytics } from '@iceberg/core';
import {
  charts, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { StyleSheet, Text, View } from 'react-native';

/** Lunes primero, como el resto de la app. */
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Opacidad minima de un dia con gasto, para que nunca desaparezca. */
const PISO = 0.18;

export function Calendario(
  { serie, theme, hoy }:
  { serie: readonly analytics.DiaDeLaSerie[]; theme: Theme; hoy: dates.PlainDate },
) {
  const styles = crearEstilos(theme);
  if (serie.length === 0) return null;

  const mayor = serie.reduce((max, dia) => Math.max(max, dia.gasto.amountMinor), 0);

  // El mes no empieza en lunes: se rellena con celdas vacias para que cada
  // columna sea siempre el mismo dia de la semana.
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
          const intensidad = mayor === 0 || gastado === 0
            ? 0
            : PISO + ((gastado / mayor) * (1 - PISO));
          const esHoy = dia.fecha === hoy;
          return (
            <View key={dia.fecha} style={styles.celda}>
              {gastado === 0 ? (
                <View style={[styles.marca, styles.marcaVacia]} />
              ) : (
                <View style={[styles.marca, { backgroundColor: charts[0], opacity: intensidad }]} />
              )}
              <Text style={esHoy ? styles.numeroHoy : styles.numero}>{dates.day(dia.fecha)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.pie}>
        <Text style={styles.escala}>menos</Text>
        {[0.2, 0.4, 0.6, 0.8, 1].map((nivel) => (
          <View key={nivel} style={[styles.muestra, { backgroundColor: charts[0], opacity: nivel }]} />
        ))}
        <Text style={styles.escala}>más · máx {money.format(money.money(mayor))}</Text>
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
    celda: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      padding: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // El numero va encima de la marca, no al lado: en una grilla de siete
    // columnas no hay ancho para las dos cosas.
    marca: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: radii.sm },
    // Un dia sin gasto no se pinta: se marca con la hairline, que ya es el
    // token para "esto existe pero no pesa".
    marcaVacia: { borderWidth: elevation.hairlineWidth, borderColor: theme.hairline },
    numero: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.tinta },
    numeroHoy: { fontFamily: fonts.mono, fontWeight: pesos.semibold, fontSize: 10, color: theme.acentoTexto },

    pie: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing.sm },
    muestra: { width: 10, height: 10, borderRadius: 2 },
    escala: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 9, color: theme.silencio },
  });
}
