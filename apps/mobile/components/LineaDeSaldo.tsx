/**
 * La línea de saldo del período, con sus ejes.
 *
 * Cada punto es el saldo al cerrar ese día: la línea baja durante el mes y
 * salta el día del sueldo, y esa forma de diente de sierra es el mes. Los ejes
 * dan la escala (techo, piso y el cero si la curva lo cruza) y van escritos
 * dentro del aire de arriba y abajo, para que la curva use todo el ancho.
 *
 * En `react-native-svg` y no en una librería sobre Skia, que en web necesita
 * CanvasKit: una línea son dos `path`. El ancho sale de `onLayout`; estirar un
 * `viewBox` fijo deformaría el trazo.
 *
 * Tocar la curva elige el día más cercano. Es un toque y no un arrastre: el
 * gráfico vive dentro de un `ScrollView`, y un `Pressable` cede el gesto si el
 * dedo se mueve, así que desplazar encima del dibujo sigue funcionando.
 */

import { dates, money } from '@iceberg/core';
import type { analytics } from '@iceberg/core';
import { charts, spacing } from '@iceberg/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as TextoSvg } from 'react-native-svg';
import { useEstilo, useEstilos, type Estilo } from '../datos/estilos';

const ALTO = 180;
/** Aire arriba y abajo: que el trazo no toque los bordes y que las cifras del eje tengan dónde ir. */
const MARGEN = 18;

/** Un monto en un eje: corto, porque compite con la curva. */
function abreviar(minor: number): string {
  const signo = minor < 0 ? '−' : '';
  const valor = Math.abs(minor);
  if (valor >= 1_000_000) return `${signo}${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `${signo}${Math.round(valor / 1_000)}k`;
  return `${signo}${valor}`;
}

/**
 * Dónde cayó el toque, desde el borde izquierdo. Android lo da en `locationX`;
 * react-native-web pasa el evento del DOM, donde se llama `offsetX`.
 */
function dondeSeToco(evento: { locationX?: number; offsetX?: number }): number {
  return evento.locationX ?? evento.offsetX ?? NaN;
}

/** Qué pasó ese día, en una línea. Un día quieto se dice: explica por qué la curva no baja. */
function queSeMovio(dia: analytics.DiaConSaldo): string {
  const gasto = dia.gasto.amountMinor;
  const ingreso = dia.ingreso.amountMinor;
  if (gasto === 0 && ingreso === 0) return 'No se movió nada';
  const partes: string[] = [];
  if (ingreso > 0) partes.push(`entró ${money.format(dia.ingreso)}`);
  if (gasto > 0) partes.push(`salió ${money.format(dia.gasto)}`);
  return partes.join(' · ');
}

export function LineaDeSaldo({ serie }: { serie: readonly analytics.DiaConSaldo[] }) {
  const styles = useEstilos(crearEstilos);
  const { theme, t } = useEstilo();
  const [ancho, setAncho] = useState(0);
  /** El día que se está mirando, por índice. */
  const [elegido, setElegido] = useState<number | null>(null);

  if (serie.length < 2) {
    return <Text style={styles.vacio}>Se necesitan al menos dos días para dibujar la línea.</Text>;
  }

  const valores = serie.map((d) => d.saldo.amountMinor);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  // Sin movimientos el saldo no cambia: la recta va al medio, que es lo único
  // que se puede afirmar sin rango, y no pegada al piso como si tocara fondo.
  const plano = maximo === minimo;
  const alcance = maximo - minimo || 1;

  const x = (indice: number) => (indice / (serie.length - 1)) * Math.max(ancho, 1);
  const y = (valor: number) => {
    const parte = plano ? 0.5 : 1 - (valor - minimo) / alcance;
    return MARGEN + parte * (ALTO - MARGEN * 2);
  };

  const trazo = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const relleno = `${trazo} L${ancho},${ALTO} L0,${ALTO} Z`;

  const indiceMinimo = valores.indexOf(minimo);
  const fondo = serie[indiceMinimo]!;
  const cierre = serie[serie.length - 1]!;
  const cruzaCero = minimo < 0 && maximo >= 0;
  // Sin repetir: plano, o terminando justo en cero, dos marcas coinciden.
  const marcas = [...new Set(cruzaCero ? [maximo, 0, minimo] : [maximo, minimo])];

  // Al día más cercano, redondeando: truncar le daba al de la izquierda todo el
  // tramo. Un toque sin coordenada da `NaN`, y eso no puede llegar al índice.
  const diaTocado = (donde: number): number | null => {
    if (!Number.isFinite(donde)) return null;
    const crudo = Math.round((donde / Math.max(ancho, 1)) * (serie.length - 1));
    return Math.min(Math.max(crudo, 0), serie.length - 1);
  };

  // Al cambiar de período la serie se acorta y el índice guardado puede quedar afuera.
  const dia = elegido === null ? null : serie[elegido] ?? null;

  return (
    <View>
      <Pressable
        style={styles.lienzo}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        onPress={(e) => {
          const cual = diaTocado(dondeSeToco(e.nativeEvent));
          if (cual === null) return;
          // Volver a tocar el mismo día lo suelta.
          setElegido((antes) => (antes === cual ? null : cual));
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Saldo día a día"
        accessibilityHint="Tocar un punto de la curva para ver el saldo de ese día"
      >
        {ancho > 0 ? (
          <Svg width={ancho} height={ALTO}>
            {marcas.map((valor) => (
              <Line
                key={valor}
                x1={0}
                y1={y(valor)}
                x2={ancho}
                y2={y(valor)}
                stroke={valor === 0 ? theme.vencido : theme.hairline}
                strokeWidth={1}
                strokeDasharray={valor === 0 ? '3 3' : undefined}
              />
            ))}
            {/* El techo y el cero se escriben encima de su guía y el piso
                debajo: así ninguna cifra cae sobre la curva. */}
            {marcas.map((valor) => (
              <TextoSvg
                key={`t${valor}`}
                x={0}
                y={valor === minimo ? y(valor) + 13 : y(valor) - 5}
                textAnchor="start"
                fontSize={t.cifraDeGrafico.fontSize}
                fontFamily={t.cifraDeGrafico.fontFamily}
                fill={valor === 0 ? theme.vencidoTexto : theme.silencio}
              >
                {abreviar(valor)}
              </TextoSvg>
            ))}

            <Path d={relleno} fill={charts[0]} fillOpacity={0.12} />
            <Path d={trazo} stroke={charts[0]} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {/* En ámbar: el acento es el agua, del mismo color que la curva. */}
            <Circle cx={x(indiceMinimo)} cy={y(minimo)} r={3.5} fill={theme.alerta} />

            {elegido === null || dia === null ? null : (
              <>
                <Line
                  x1={x(elegido)}
                  y1={0}
                  x2={x(elegido)}
                  y2={ALTO}
                  stroke={theme.silencio}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                {/* El aro del color del fondo despega el punto del trazo, que es del mismo color. */}
                <Circle cx={x(elegido)} cy={y(dia.saldo.amountMinor)} r={6} fill={theme.fondo} />
                <Circle cx={x(elegido)} cy={y(dia.saldo.amountMinor)} r={4} fill={charts[0]} />
              </>
            )}
          </Svg>
        ) : null}
      </Pressable>

      <View style={styles.ejeX}>
        <Text style={styles.fecha}>{dates.formatDateShort(serie[0]!.fecha)}</Text>
        <Text style={styles.fecha}>{dates.formatDateShort(cierre.fecha)}</Text>
      </View>

      {/* La pista y el día elegido se turnan en el mismo lugar, con el alto
          reservado: si no, elegir un día movería el gráfico bajo el dedo. */}
      {dia === null ? (
        <Text style={styles.pista}>Toca la curva para ver un día.</Text>
      ) : (
        <View style={styles.elegido}>
          <View style={styles.filaElegido}>
            <Text style={styles.fechaElegida}>{dates.formatDateLong(dia.fecha)}</Text>
            <Text style={styles.saldoElegido}>{money.format(dia.saldo)}</Text>
          </View>
          <Text style={styles.movimientoElegido}>{queSeMovio(dia)}</Text>
        </View>
      )}

      <View style={styles.pie}>
        <Text style={styles.dato}>
          <Text style={styles.etiqueta}>Más bajo </Text>
          {money.format(fondo.saldo)} el {dates.formatDateShort(fondo.fecha)}
        </Text>
        <Text style={styles.dato}>
          <Text style={styles.etiqueta}>Cierra </Text>
          {money.format(cierre.saldo)}
        </Text>
      </View>
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    lienzo: { height: ALTO, width: '100%' },
    ejeX: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.xs },
    fecha: t.cifraDeGrafico,
    pista: { ...t.nota, minHeight: 34, paddingTop: spacing.sm },
    elegido: { minHeight: 34, paddingTop: spacing.sm },
    filaElegido: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    fechaElegida: { ...t.etiqueta, fontWeight: t.seccion.fontWeight, color: theme.tinta },
    saldoElegido: { ...t.cifra, fontWeight: t.accion.fontWeight },
    movimientoElegido: t.cifraDeGrafico,
    pie: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
    dato: { ...t.cifraDeGrafico, color: theme.tinta },
    etiqueta: { fontFamily: t.nota.fontFamily, color: theme.silencio },
    vacio: { ...t.etiqueta, paddingVertical: spacing.md },
  });
}
