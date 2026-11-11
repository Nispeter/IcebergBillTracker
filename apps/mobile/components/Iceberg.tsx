/**
 * El iceberg: sobre la línea de agua el gasto comprometido, debajo el variable.
 *
 * La línea no está a ojo: se calcula para que el área sobre ella sea la
 * proporción del gasto comprometido. La silueta es angosta arriba, así que una
 * línea al 62 % de la altura pintaría mucho menos del 62 % de la superficie, y
 * lo que se lee es la superficie. El cálculo vive en `@iceberg/ui/geometry`.
 *
 * El dibujo no pinta su línea de agua: la dibuja la pantalla a todo el ancho,
 * con `alturaDeLineaDeAgua`, para que el iceberg flote en vez de estar en una caja.
 */

import { charts, toPathData, waterlineForShare, type Point } from '@iceberg/ui';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTema } from '../datos/tema';

const ANCHO = 200;
const ALTO = 236;

/**
 * Un pico principal y dos espolones, con la masa submarina ancha e irregular.
 * A mano y con aristas: con curvas suaves se leía como una gota.
 */
const SILUETA: Point[] = [
  [92, 0], [104, 26], [98, 44], [126, 30], [136, 62], [150, 52],
  [162, 96], [186, 118], [168, 150], [194, 180], [150, 216], [100, 236],
  [48, 222], [12, 186], [36, 152], [4, 118], [40, 92], [58, 62], [78, 30],
];

const RUTA = toPathData(SILUETA);

/** A qué altura cae la línea de agua en un iceberg de `alto` píxeles. */
export function alturaDeLineaDeAgua(shareComprometido: number, alto: number): number {
  return (waterlineForShare(SILUETA, shareComprometido) / ALTO) * alto;
}

/** El ancho del dibujo para un alto dado: la escena es mucho más ancha que el hielo. */
export function anchoDelIceberg(alto: number): number {
  return alto * (ANCHO / ALTO);
}

/**
 * Hasta dónde llega el hielo a una altura dada, en píxeles desde el centro, o
 * cero si la altura cae fuera. Cruza una horizontal con cada lado del polígono
 * y se queda con el cruce más a la derecha.
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
  return ((derecha - ANCHO / 2) / ANCHO) * anchoDelIceberg(alto);
}

export function Iceberg(
  { shareComprometido, alto }: {
    /** Proporción del gasto que es comprometido, de 0 a 1. */
    shareComprometido: number;
    alto: number;
  },
) {
  const { theme } = useTema();
  const ancho = anchoDelIceberg(alto);
  // Dónde corta el degradado, en la escala 0..1 de los `offset`.
  const corte = Math.min(1, Math.max(0, waterlineForShare(SILUETA, shareComprometido) / ALTO));

  return (
    <View style={{ width: ancho, height: alto }}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ANCHO} ${ALTO}`}>
        <Defs>
          {/* Hielo y agua en un solo degradado, con dos paradas en el mismo
              punto para que sea un corte y no una mezcla. Recortar con
              `ClipPath` dejaba el iceberg entero del color del agua en Android. */}
          <LinearGradient id="hieloYAgua" x1="0" y1="0" x2="0" y2={ALTO} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={theme.hieloSobreAgua} />
            <Stop offset={corte} stopColor={theme.hieloSobreAgua} />
            <Stop offset={corte} stopColor={charts[0]} />
            <Stop offset="1" stopColor={charts[1]} />
          </LinearGradient>
        </Defs>
        <Path d={RUTA} fill="url(#hieloYAgua)" />
      </Svg>
    </View>
  );
}
