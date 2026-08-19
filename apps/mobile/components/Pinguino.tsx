/**
 * El pingüino, en SVG. Es la marca de la app.
 *
 * El acento ámbar de toda la paleta está definido en `tokens.ts` como "el ámbar
 * del pico del pingüino", así que el pico es lo único que lo lleva. Si el logo
 * gastara ámbar en el cuerpo, el color dejaría de significar "esto importa" en
 * el resto de la pantalla.
 *
 * **Es una silueta que se da vuelta con el tema**, igual que el iceberg: cuerpo
 * en `tinta`, panza en `fondo`. En el tema oscuro queda un pingüino claro, que
 * no es el color de un pingüino de verdad pero sí es lo único que se lee sobre
 * la noche polar. Un cuerpo oscuro fijo desaparecería contra el fondo.
 *
 * Dibujado para leerse **a 20 px**, que es el tamaño al que se usa. La primera
 * versión era un huevo con dos ojos y a ese tamaño quedaba una bola: sin cuello
 * ni aletas no hay pingüino, hay mancha.
 *
 * No tiene estados todavía (mirar el iceberg, resbalar, abrigarse). Eso es F6;
 * agregarlos ahora sería decorar antes de que exista el motivo.
 */

import type { Theme } from '@iceberg/ui';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const ANCHO = 56;
const ALTO = 64;

/**
 * Cuerpo: cabeza redonda, cuello marcado y torso ancho.
 *
 * El estrechamiento del cuello (y≈30) es lo que separa la cabeza del cuerpo. Sin
 * el, la silueta es un ovalo y podria ser cualquier cosa.
 */
const CUERPO = 'M28,2 C38,2 45,11 45,21 C45,25 44,28 42,31'
  + ' C48,36 51,44 51,52 C51,60 41,63 28,63 C15,63 5,60 5,52'
  + ' C5,44 8,36 14,31 C12,28 11,25 11,21 C11,11 18,2 28,2 Z';

/** Panza: ovalo inset, sin tocar el borde del cuerpo. */
const PANZA = 'M28,34 C35,34 40,42 40,50 C40,57 35,60 28,60 C21,60 16,57 16,50 C16,42 21,34 28,34 Z';

/** Pico: triangulo hacia abajo, justo bajo los ojos. */
const PICO = 'M23,24 L33,24 L28,31 Z';

export function Pinguino({ theme, tamano = 20 }: { theme: Theme; tamano?: number }) {
  const alto = (tamano / ANCHO) * ALTO;

  return (
    <Svg width={tamano} height={alto} viewBox={`0 0 ${ANCHO} ${ALTO}`}>
      <Path d={CUERPO} fill={theme.tinta} />
      {/* Aletas: dos ovalos inclinados que sobresalen del torso. Son lo que
          convierte la silueta en un pinguino y no en un huevo. */}
      <Ellipse cx={8} cy={45} rx={5} ry={11} fill={theme.tinta} transform="rotate(16 8 45)" />
      <Ellipse cx={48} cy={45} rx={5} ry={11} fill={theme.tinta} transform="rotate(-16 48 45)" />
      <Path d={PANZA} fill={theme.fondo} />
      <Circle cx={21} cy={18} r={3} fill={theme.fondo} />
      <Circle cx={35} cy={18} r={3} fill={theme.fondo} />
      <Path d={PICO} fill={theme.acento} />
    </Svg>
  );
}
