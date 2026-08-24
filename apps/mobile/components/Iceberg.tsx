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
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
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

/**
 * Hasta donde llega el hielo a una altura dada, en pixeles desde el centro.
 *
 * Hace falta para parar cosas **sobre** el iceberg. El ancho total no sirve: la
 * silueta es un pico arriba y se ensancha abajo, asi que a la altura de la linea
 * de agua el hielo puede ser mucho mas angosto que el dibujo. Con mucho gasto
 * variable la linea sube casi hasta la punta y ahi el hielo mide cuatro pixeles.
 *
 * Se resuelve cruzando una horizontal con cada lado del poligono y quedandose
 * con el cruce mas a la derecha. Devuelve cero si la altura cae fuera de la
 * figura.
 */
export function bordeDelHieloEn(y: number, alto: number): number {
  const enElDibujo = (y / alto) * ALTO;
  let derecha = -Infinity;

  for (let i = 0, j = SILUETA.length - 1; i < SILUETA.length; j = i++) {
    const [xi, yi] = SILUETA[i]!;
    const [xj, yj] = SILUETA[j]!;
    if ((yi > enElDibujo) === (yj > enElDibujo)) continue;
    const x = xi + ((xj - xi) * (enElDibujo - yi)) / (yj - yi);
    if (x > derecha) derecha = x;
  }

  if (derecha === -Infinity) return 0;
  // De unidades del `viewBox` a pixeles, y desde el centro.
  return ((derecha - ANCHO / 2) / ANCHO) * anchoDelIceberg(alto);
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
