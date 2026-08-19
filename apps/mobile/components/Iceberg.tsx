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
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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

export interface IcebergProps {
  /** Proporcion del gasto que es comprometido, de 0 a 1. */
  readonly shareComprometido: number;
  readonly theme: Theme;
  readonly agua: string;
  readonly profundidad: string;
  readonly alto?: number;
}

export function Iceberg({ shareComprometido, theme, agua, profundidad, alto = 200 }: IcebergProps) {
  const linea = waterlineForShare(SILUETA, shareComprometido);
  const ancho = alto * (ANCHO / ALTO);

  return (
    <View style={{ width: ancho, height: alto }}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ANCHO} ${ALTO}`}>
        <Defs>
          <ClipPath id="sobreElAgua">
            <Rect x={0} y={0} width={ANCHO} height={linea} />
          </ClipPath>
          <ClipPath id="bajoElAgua">
            <Rect x={0} y={linea} width={ANCHO} height={ALTO - linea} />
          </ClipPath>
          {/* Frio y de arriba hacia abajo: el agua se oscurece con la
              profundidad. Los dos extremos son colores de la serie de graficos,
              no un degradado inventado. */}
          <LinearGradient id="profundidadAgua" x1="0" y1={linea} x2="0" y2={ALTO} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={agua} stopOpacity="0.85" />
            <Stop offset="1" stopColor={profundidad} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Lo sumergido primero, para que la linea de agua quede encima. */}
        <G clipPath="url(#bajoElAgua)">
          <Path d={RUTA} fill="url(#profundidadAgua)" />
        </G>

        <G clipPath="url(#sobreElAgua)">
          <Path d={RUTA} fill={theme.gasto} />
        </G>

        {/* La linea de agua cruza entera, no solo el ancho del hielo: es el
            nivel del mar, no un borde de la figura. */}
        <Line
          x1={0}
          y1={linea}
          x2={ANCHO}
          y2={linea}
          stroke={theme.acento}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}
