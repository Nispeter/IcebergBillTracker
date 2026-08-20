/**
 * El pingüino, en SVG. Es la marca de la app.
 *
 * La forma sigue una referencia que dio el usuario: un pingüino panzón de frente,
 * con la **panza y la cara en una sola mancha blanca**, ojos chicos y altos,
 * pico redondeado y dos aletas que salen a los lados y terminan en punta.
 *
 * Antes hubo dos intentos que no funcionaron, y por qué falló cada uno importa:
 *
 * 1. **Cuerpo con cuello y aletas pegadas**: a 20 px las aletas eran dos manchas
 *    y el conjunto se leía como un huevo con ojos.
 * 2. **Solo la cara**: se leía, pero como búho. Faltaba la silueta del cuerpo,
 *    que es lo que dice "pingüino" antes que cualquier detalle.
 *
 * Lo que resuelve las dos cosas es que la mancha blanca sea **una sola y grande**:
 * ocupa casi todo el frente, así que sobrevive al achique, y el contorno negro
 * con aletas da la silueta.
 *
 * El acento ámbar de toda la paleta está definido en `tokens.ts` como "el ámbar
 * del pico del pingüino", así que el pico es lo único que lo lleva.
 *
 * **Sus colores son fijos, no se dan vuelta con el tema.** El iceberg sí se
 * invierte y funciona; acá invertir dejaría las pupilas claras sobre blanco
 * oscuro y la cara deja de leerse. Por eso tiene sus propios tokens.
 */

import type { Theme } from '@iceberg/ui';
import Svg, { Circle, Path } from 'react-native-svg';

const ANCHO = 64;
const ALTO = 72;
/** Las aletas se salen un poco a los lados: el viewBox las deja entrar. */
const VIEWBOX = '-2 0 68 72';

/** Cuerpo: un huevo ancho, más panzón abajo que arriba. */
const CUERPO = 'M32,2 C45,2 53,13 53,27 C53,33 55,40 55,47 C55,60 45,69 32,69'
  + ' C19,69 9,60 9,47 C9,40 11,33 11,27 C11,13 19,2 32,2 Z';

/**
 * Aletas: salen del costado y bajan hasta terminar en punta.
 *
 * Son lo que rompe el ovalo. Sin ellas la silueta es un huevo y podria ser
 * cualquier animal.
 */
const ALETA_IZQUIERDA = 'M13,27 C3,33 -1,49 3,60 C5,65 11,64 12,57 C13,48 13,36 13,27 Z';
const ALETA_DERECHA = 'M51,27 C61,33 65,49 61,60 C59,65 53,64 52,57 C51,48 51,36 51,27 Z';

/** Panza y cara en una sola mancha: es la que tiene que sobrevivir al achique. */
const PANZA = 'M32,16 C40,16 45,23 46,31 C48,37 49,42 49,48 C49,58 42,65 32,65'
  + ' C22,65 15,58 15,48 C15,42 16,37 18,31 C19,23 24,16 32,16 Z';

/** Pico: redondeado y chico, entre los ojos y un poco más abajo. */
const PICO = 'M32,32 C36,32 40,35 40,38 C40,42 36,45 32,45 C28,45 24,42 24,38 C24,35 28,32 32,32 Z';

export function Pinguino({ theme, tamano = 20 }: { theme: Theme; tamano?: number }) {
  const alto = (tamano / ANCHO) * ALTO;

  return (
    <Svg width={tamano} height={alto} viewBox={VIEWBOX}>
      <Path d={ALETA_IZQUIERDA} fill={theme.pinguinoCuerpo} />
      <Path d={ALETA_DERECHA} fill={theme.pinguinoCuerpo} />
      <Path d={CUERPO} fill={theme.pinguinoCuerpo} />
      <Path d={PANZA} fill={theme.pinguinoPanza} />
      <Circle cx={25} cy={27} r={3} fill={theme.pinguinoCuerpo} />
      <Circle cx={39} cy={27} r={3} fill={theme.pinguinoCuerpo} />
      <Path d={PICO} fill={theme.acento} />
    </Svg>
  );
}
