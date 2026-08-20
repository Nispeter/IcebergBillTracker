/**
 * La linea de saldo del periodo, en SVG, con sus ejes.
 *
 * Cada punto es el saldo al cerrar ese dia, no un promedio: la linea baja
 * durante el mes y pega el salto el dia que entra el sueldo. Esa forma de
 * diente de sierra **es** el mes, y suavizarla lo esconderia.
 *
 * **Los ejes se agregaron despues y hacian falta.** Sin ellos la curva mostraba
 * la forma y no la escala: la misma silueta puede ser un mes que se movio entre
 * $700.000 y $760.000 o uno que se hundio a numeros rojos, y no habia como
 * distinguirlos. Ahora el eje vertical marca el techo, el piso y el cero cuando
 * corresponde, y el horizontal el primer y el ultimo dia.
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
import { charts, elevation, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as TextoSvg } from 'react-native-svg';

const ALTO = 120;
/** Aire arriba y abajo para que la linea no toque los bordes ni se corte el punto. */
const MARGEN = 12;
/** Ancho reservado a la izquierda para las cifras del eje vertical. */
const EJE = 56;

/** Como se escribe un monto en un eje: corto, porque compite con la curva. */
function abreviar(minor: number): string {
  const signo = minor < 0 ? '−' : '';
  const valor = Math.abs(minor);
  if (valor >= 1_000_000) return `${signo}${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `${signo}${Math.round(valor / 1_000)}k`;
  return `${signo}${valor}`;
}

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

  const anchoTrazo = Math.max(ancho - EJE, 1);
  const x = (indice: number) => EJE + (indice / (serie.length - 1)) * anchoTrazo;
  const y = (valor: number) => MARGEN + (1 - (valor - minimo) / alcance) * (ALTO - MARGEN * 2);

  const trazo = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const relleno = `${trazo} L${ancho},${ALTO} L${EJE},${ALTO} Z`;

  const indiceMinimo = valores.indexOf(minimo);
  const fondo = serie[indiceMinimo]!;
  const cierre = serie[serie.length - 1]!;
  const cruzaCero = minimo < 0 && maximo >= 0;

  /** Las marcas del eje vertical. El cero solo si la curva lo cruza. */
  const marcas = cruzaCero ? [maximo, 0, minimo] : [maximo, minimo];

  return (
    <View>
      <View style={styles.lienzo} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
        {ancho > 0 ? (
          <Svg width={ancho} height={ALTO}>
            {/* Las guias horizontales van primero: son fondo, no dibujo. */}
            {marcas.map((valor) => (
              <Line
                key={valor}
                x1={EJE}
                y1={y(valor)}
                x2={ancho}
                y2={y(valor)}
                stroke={valor === 0 ? theme.vencido : theme.hairline}
                strokeWidth={1}
                strokeDasharray={valor === 0 ? '3 3' : undefined}
              />
            ))}
            {marcas.map((valor) => (
              <TextoSvg
                key={`t${valor}`}
                x={EJE - 6}
                y={y(valor) + 3}
                textAnchor="end"
                fontSize={9}
                fontFamily={fonts.mono}
                fill={valor === 0 ? theme.vencidoTexto : theme.silencio}
              >
                {abreviar(valor)}
              </TextoSvg>
            ))}

            <Path d={relleno} fill={charts[0]} fillOpacity={0.12} />
            <Path d={trazo} stroke={charts[0]} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <Circle cx={x(indiceMinimo)} cy={y(minimo)} r={3.5} fill={theme.acento} />
          </Svg>
        ) : null}
      </View>

      {/* El eje horizontal va en texto y no en SVG: son dos etiquetas, y asi
          heredan la fuente y el color del tema sin repetirlos. */}
      <View style={styles.ejeX}>
        <Text style={styles.fecha}>{dates.formatDate(serie[0]!.fecha)}</Text>
        <Text style={styles.fecha}>{dates.formatDate(cierre.fecha)}</Text>
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
    ejeX: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginLeft: EJE,
      paddingTop: 2,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    fecha: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 9, color: theme.silencio },
    pie: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
    dato: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.tinta },
    etiqueta: { fontFamily: fonts.ui, color: theme.silencio },
    vacio: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, paddingVertical: spacing.md },
  });
}
