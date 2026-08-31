/**
 * La frase con la que se cifra, inventada por la app.
 *
 * El cifrado del respaldo existia desde el principio y **no se usaba nunca**:
 * el campo arrancaba vacio, vacio significa "sin cifrar", y nadie escribe una
 * frase antes de que le haya pasado algo. El archivo que queda en la carpeta
 * compartida --el historial financiero completo de alguien-- salia en claro por
 * omision.
 *
 * Se arregla dando vuelta la omision: la app se inventa una frase la primera
 * vez y desde ahi cifra siempre. Quien quiera puede cambiarla; lo que ya no se
 * puede es no tener ninguna.
 *
 * ## Por que palabras y no caracteres al azar
 *
 * La frase **hay que pasarsela a la otra persona** y esa persona la escribe a
 * mano en su telefono. `k7#pQ2!vX9` tiene mas entropia por caracter y es
 * imposible de dictar sin equivocarse. Cuatro palabras cortas se leen en voz
 * alta, se escriben sin mirar y se recuerdan lo justo para el rato que dura
 * pasarlas.
 *
 * Las palabras no llevan tildes ni ñ a proposito: el teclado del otro telefono
 * puede estar en otro idioma, y una tilde de menos deja el archivo cerrado sin
 * decir por que.
 *
 * ## Cuanta fuerza tiene
 *
 * 128 palabras son 7 bits cada una: cuatro dan 28, y el numero de tres cifras
 * al final agrega casi 10. Son unos 38 bits, que a secas serian pocos. Lo que
 * los vuelve suficientes es scrypt: cada intento cuesta 32 MB y del orden de
 * cien milisegundos, asi que recorrer el espacio entero no se mide en horas.
 */

import { randomBytes } from '@noble/ciphers/utils.js';

/**
 * Ciento veintiocho palabras cortas, sin tildes y sin parejas que se confundan
 * al dictarlas. Son 2^7 exactas: 128 divide a 256, asi que elegir una por byte
 * no le da mas probabilidad a las primeras.
 */
const PALABRAS = [
  'agua', 'aire', 'ala', 'alba', 'alga', 'ancla', 'anillo', 'arbol',
  'arena', 'aroma', 'arpa', 'astro', 'atlas', 'aula', 'ave', 'azul',
  'bahia', 'balsa', 'banco', 'barco', 'brisa', 'bruma', 'buque', 'buzo',
  'cabo', 'calma', 'campo', 'cardo', 'cauce', 'cedro', 'cielo', 'cima',
  'circo', 'clavo', 'cobre', 'coral', 'coro', 'corte', 'costa', 'cresta',
  'cueva', 'dado', 'delta', 'dique', 'disco', 'duna', 'eco', 'faro',
  'fiordo', 'flor', 'foca', 'fresa', 'fuego', 'fuente', 'galeon', 'ganso',
  'gaviota', 'gema', 'glaciar', 'globo', 'grieta', 'gruta', 'hebra', 'helecho',
  'hielo', 'hoja', 'horno', 'huerto', 'humo', 'isla', 'jarra', 'joya',
  'kayak', 'lago', 'lampara', 'lanza', 'lava', 'leon', 'lienzo', 'lima',
  'llave', 'lluvia', 'luna', 'malva', 'mapa', 'marea', 'mirlo', 'monte',
  'morsa', 'musgo', 'nave', 'niebla', 'nieve', 'nido', 'norte', 'nube',
  'oasis', 'olmo', 'onda', 'orca', 'orilla', 'oso', 'pampa', 'panal',
  'perla', 'pico', 'pino', 'pluma', 'polvo', 'puerto', 'quilla', 'rama',
  'remo', 'rio', 'roble', 'roca', 'sal', 'sauce', 'selva', 'sombra',
  'sur', 'trigo', 'tunel', 'valle', 'vela', 'viento', 'zarza', 'zorro',
] as const;

/** Cuantas palabras lleva una frase. */
const CUANTAS = 4;

/** El separador. El guion se escribe igual en cualquier teclado. */
export const SEPARADOR_DE_FRASE = '-';

/**
 * Inventa una frase: `nieve-glaciar-orca-puerto-482`.
 *
 * `azar` se puede pasar para probarla; en la app viene de `@noble`, que en el
 * telefono se apoya en el `getRandomValues` que instala `datos/aleatorio`.
 */
export function generarFrase(azar: (largo: number) => Uint8Array = randomBytes): string {
  // Un byte por palabra, mas dos para el numero.
  const bytes = azar(CUANTAS + 2);

  const palabras: string[] = [];
  for (let i = 0; i < CUANTAS; i += 1) {
    palabras.push(PALABRAS[(bytes[i] ?? 0) % PALABRAS.length]!);
  }

  // De 100 a 999: tres cifras siempre, para que la frase se vea igual de larga
  // cada vez y nadie crea que la app se comio un digito.
  const crudo = ((bytes[CUANTAS] ?? 0) * 256) + (bytes[CUANTAS + 1] ?? 0);
  const numero = 100 + (crudo % 900);

  return [...palabras, String(numero)].join(SEPARADOR_DE_FRASE);
}
