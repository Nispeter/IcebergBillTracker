/**
 * La linea de saldo del periodo, en SVG.
 *
 * Cada punto es el saldo al cerrar ese dia, no un promedio: la linea baja
 * durante el mes y pega el salto el dia que entra el sueldo. Esa forma de
 * diente de sierra **es** el mes, y suavizarla lo esconderia.
 *
 * En `react-native-svg` y no en Victory Native XL, que depende de Skia, y Skia
 * en web necesita CanvasKit por WASM. Una linea son dos `path`; no vale la pena
 * pagar esa dependencia por eso.
 *
 * El ancho lo da `onLayout` en vez de estirar un `viewBox` fijo: estirar
 * deformaria el grosor del trazo en horizontal.
 */

import { dates, money } from '@iceberg/core';
import type { analytics } from '@iceberg/core';
import { charts, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

const ALTO = 96;
/** Aire arriba y abajo para que la linea no toque los bordes ni se corte el punto. */
const MARGEN = 10;

export function LineaDeSaldo(
  { serie, theme }: { serie: readonly analytics.DiaConSaldo[]; theme: Theme },
) {
  const styles = crearEstilos(theme);
  const [ancho, setAncho] = useState(0);

  if (serie.length < 2) {
    return <Text style={styles.vacio}>Se necesitan al menos dos días para dibujar la línea.</Text>;
  }

  const valores = serie.map((d) => d.saldo.amountMinor);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  // Un periodo sin ningun movimiento es una recta; sin este piso el divisor
  // seria cero y todos los puntos caerian en NaN.
  const alcance = maximo - minimo || 1;

  const x = (indice: number) => (indice / (serie.length - 1)) * ancho;
  const y = (valor: number) => MARGEN + (1 - (valor - minimo) / alcance) * (ALTO - MARGEN * 2);

  const trazo = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const relleno = `${trazo} L${ancho},${ALTO} L0,${ALTO} Z`;

  const indiceMinimo = valores.indexOf(minimo);
  const fondo = serie[indiceMinimo]!;
  const cierre = serie[serie.length - 1]!;
  const cruzaCero = minimo < 0 && maximo >= 0;

  return (
    <View>
      <View style={styles.lienzo} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
        {ancho > 0 ? (
          <Svg width={ancho} height={ALTO}>
            <Path d={relleno} fill={charts[0]} fillOpacity={0.12} />
            {cruzaCero ? (
              // Quedarse sin plata es un hecho distinto de gastar menos: la
              // linea del cero se dibuja solo cuando el saldo la cruza.
              <Line x1={0} y1={y(0)} x2={ancho} y2={y(0)} stroke={theme.vencido} strokeWidth={1} strokeDasharray="3 3" />
            ) : null}
            <Path d={trazo} stroke={charts[0]} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <Circle cx={x(indiceMinimo)} cy={y(minimo)} r={3} fill={theme.acento} />
          </Svg>
        ) : null}
      </View>

      <View style={styles.pie}>
        <Text style={styles.dato}>
          <Text style={styles.etiqueta}>Más bajo </Text>
          {money.format(fondo.saldo)} el {dates.day(fondo.fecha)}
        </Text>
        <Text style={styles.dato}>
          <Text style={styles.etiqueta}>Cierra </Text>
          {money.format(cierre.saldo)}
        </Text>
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    lienzo: { height: ALTO, width: '100%' },
    pie: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.xs },
    dato: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.tinta },
    etiqueta: { fontFamily: fonts.ui, color: theme.silencio },
    vacio: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, paddingVertical: spacing.md },
  });
}
