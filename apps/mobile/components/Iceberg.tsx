/**
 * El iceberg: la pantalla estrella del proyecto hecha grafico.
 *
 * Sobre la linea de agua va el gasto **comprometido** —arriendo, cuentas,
 * cuotas— y debajo el **variable**, que es el que uno no ve venir. La linea de
 * agua no esta puesta a ojo: se calcula para que el **area** sobre ella sea
 * exactamente la proporcion del gasto comprometido.
 *
 * Eso importa porque la silueta es angosta arriba y ancha abajo. Trazar la
 * linea al 62% de la **altura** dejaria muchisimo menos del 62% de superficie
 * pintada, y lo que la persona lee es la superficie. El calculo vive en
 * `@iceberg/ui/geometry`, con sus tests.
 */

import { toPathData, waterlineForShare, type Point, type Theme } from '@iceberg/ui';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { View } from 'react-native';

const ANCHO = 200;
const ALTO = 236;

/**
 * Silueta. Un pico principal y dos espolones menores, con la masa submarina
 * ancha e irregular. Se dibujo a mano y se verifico rasterizandola: las curvas
 * suaves se leian como una gota y no como hielo.
 */
const SILUETA: Point[] = [
  [92, 0], [104, 26], [98, 44], [126, 30], [136, 62], [150, 52],
  [162, 96], [186, 118], [168, 150], [194, 180], [150, 216], [100, 236],
  [48, 222], [12, 186], [36, 152], [4, 118], [40, 92], [58, 62], [78, 30],
];

const RUTA = toPathData(SILUETA);

/**
 * Motas de textura, en coordenadas del `viewBox`.
 *
 * **No se recortan con la silueta**: cada punto se eligió comprobando que cae
 * dentro del polígono con ocho unidades de holgura, y separado de los demás.
 * Recortar era el camino obvio y es justamente el que ya falló acá: un
 * `ClipPath` funcionaba en web y en Android dejaba el iceberg de un solo color.
 * Un punto que ya está adentro no necesita que nadie lo recorte.
 *
 * Cada mota decide sola qué es: **burbuja** si queda bajo la línea de agua,
 * **nieve** si queda encima. Como la línea se mueve con la proporción del gasto,
 * la textura cambia con ella.
 */
const TEXTURA: readonly Point[] = [
  [143, 201], [62, 165], [127, 151], [87, 104], [105, 214], [53, 201], [152, 120],
  [115, 74], [23, 117], [55, 85], [168, 167], [96, 176], [81, 53], [94, 138],
];

export interface IcebergProps {
  /** Proporcion del gasto que es comprometido, de 0 a 1. */
  readonly shareComprometido: number;
  readonly theme: Theme;
  readonly agua: string;
  readonly profundidad: string;
  readonly alto?: number;
  /**
   * Si el dibujo pinta su propia linea de agua.
   *
   * En falso la omite para que la pantalla dibuje una **a todo el ancho**, con
   * `alturaDeLineaDeAgua` para saber donde. Es la diferencia entre un iceberg
   * metido en una caja y un iceberg flotando en la pantalla.
   */
  readonly dibujarLinea?: boolean;
}

/**
 * A que altura cae la linea de agua dentro de un iceberg de `alto` pixeles.
 *
 * La pantalla la necesita para alinear su propia linea con la del dibujo. El
 * calculo del area vive en `waterlineForShare`; aca solo se pasa de las
 * unidades del `viewBox` a pixeles.
 */
export function alturaDeLineaDeAgua(shareComprometido: number, alto: number): number {
  return (waterlineForShare(SILUETA, shareComprometido) / ALTO) * alto;
}

/**
 * Cuanto mide de ancho el dibujo para un alto dado.
 *
 * La pantalla lo necesita para poner cosas **encima del hielo**: la escena es
 * mucho mas ancha que el iceberg --la linea de agua cruza de borde a borde-- asi
 * que un porcentaje del contenedor no cae donde uno cree.
 */
export function anchoDelIceberg(alto: number): number {
  return alto * (ANCHO / ALTO);
}

export function Iceberg(
  { shareComprometido, theme, agua, profundidad, alto = 200, dibujarLinea = true }: IcebergProps,
) {
  const linea = waterlineForShare(SILUETA, shareComprometido);
  const ancho = alto * (ANCHO / ALTO);
  // Donde corta el degradado, en la escala 0..1 que piden los `offset`.
  const corte = Math.min(1, Math.max(0, linea / ALTO));

  return (
    <View style={{ width: ancho, height: alto }}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ANCHO} ${ALTO}`}>
        <Defs>
          {/*
            Hielo arriba y agua abajo **en un solo degradado**, con dos paradas
            en el mismo `offset` para que el cambio sea un corte y no una mezcla.

            La primera version recortaba: la silueta dibujada dos veces, cada una
            dentro de un `ClipPath` con un `Rect`. En web se veia bien y en
            Android salia el iceberg **entero del color del agua**, porque el
            recorte del hielo no se aplicaba y ese trozo no llegaba a pintarse.
            Un degradado no depende de que el recorte funcione: es un relleno, y
            un relleno se pinta igual en las dos plataformas.

            Debajo del corte sigue oscureciendose con la profundidad. Los dos
            extremos son colores de la serie de graficos, no inventados.
          */}
          <LinearGradient id="hieloYAgua" x1="0" y1="0" x2="0" y2={ALTO} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={theme.hieloSobreAgua} />
            <Stop offset={corte} stopColor={theme.hieloSobreAgua} />
            <Stop offset={corte} stopColor={agua} />
            <Stop offset="1" stopColor={profundidad} />
          </LinearGradient>
        </Defs>

        <Path d={RUTA} fill="url(#hieloYAgua)" />

        {/*
          La textura. Los radios varían con el índice y no al azar: el dibujo
          tiene que ser el mismo en cada render, o las motas titilarían cada vez
          que cambia el período.
        */}
        {TEXTURA.map(([x, y], indice) => {
          const bajoElAgua = y > linea;
          const radio = 1.5 + (indice % 3) * 0.6;
          return bajoElAgua ? (
            <Circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={radio}
              fill={theme.hieloSobreAgua}
              opacity={0.38}
            />
          ) : (
            // Sobre el hielo no sirve una mota más clara: el hielo ya es casi
            // blanco. La que se ve es la sombra, que es como se lee la nieve de
            // lejos.
            <Circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={radio * 0.85}
              fill={theme.sobreElHielo}
              opacity={0.12}
            />
          );
        })}

        {/* La linea de agua cruza entera, no solo el ancho del hielo: es el
            nivel del mar, no un borde de la figura. Cuando la dibuja la
            pantalla, aca se omite para no pintarla dos veces. */}
        {dibujarLinea ? (
          <Line
            x1={0}
            y1={linea}
            x2={ANCHO}
            y2={linea}
            stroke={theme.acento}
            strokeWidth={2}
          />
        ) : null}
      </Svg>
    </View>
  );
}
