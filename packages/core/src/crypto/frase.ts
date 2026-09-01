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
 * Ciento veintiocho palabras cortas: sesenta y cuatro de gatos y sesenta y
 * cuatro de videojuegos.
 *
 * El tema no es decorativo. La frase hay que **dictarla**, y una palabra que a
 * uno le hace gracia se retiene el rato que dura pasarsela a la otra persona;
 * `fiordo-galeon-quilla-282` no. Que sean dos mundos distintos ayuda ademas a
 * que la frase se recuerde por lo que dice y no por como suena.
 *
 * Sin tildes y sin ñ, que es la regla de arriba. Son 2^7 exactas: 128 divide a
 * 256, asi que elegir una por byte no le da mas probabilidad a las primeras.
 */
const PALABRAS = [
  'gato', 'gata', 'minino', 'michi', 'felino', 'bigote', 'garra', 'zarpa',
  'cola', 'pelaje', 'maullido', 'ronroneo', 'lengua', 'hocico', 'colmillo', 'pupila',
  'siames', 'persa', 'bengala', 'angora', 'atigrado', 'calico', 'montes', 'lince',
  'tigre', 'puma', 'jaguar', 'ocelote', 'gatera', 'rascador', 'arenero', 'croqueta',
  'pescado', 'leche', 'lana', 'ovillo', 'cascabel', 'collar', 'canasto', 'caja',
  'ventana', 'tejado', 'siesta', 'bostezo', 'acecho', 'cazador', 'nocturno', 'huella',
  'pata', 'patita', 'oreja', 'lomo', 'panza', 'mimo', 'trepar', 'amasar',
  'lamer', 'roedor', 'ceja', 'manta', 'caricia', 'sofa', 'regazo', 'ladrillo',
  'mario', 'luigi', 'peach', 'bowser', 'yoshi', 'zelda', 'link', 'hyrule',
  'ganon', 'samus', 'metroid', 'kirby', 'pikachu', 'pokemon', 'eevee', 'sonic',
  'tails', 'tetris', 'pacman', 'donkey', 'arcade', 'joystick', 'gamepad', 'consola',
  'cartucho', 'pixel', 'sprite', 'nivel', 'jefe', 'combo', 'respawn', 'speedrun',
  'glitch', 'avatar', 'mando', 'palanca', 'pantalla', 'puntaje', 'partida', 'ronda',
  'torneo', 'jugador', 'vida', 'moneda', 'estrella', 'hongo', 'tubo', 'castillo',
  'mazmorra', 'espada', 'escudo', 'elixir', 'cofre', 'portal', 'misil', 'rayo',
  'nave', 'mapa', 'llave', 'sigilo', 'dado', 'ficha', 'tablero', 'comodin',
] as const;

/** Cuantas palabras lleva una frase. */
const CUANTAS = 4;

/** El separador. El guion se escribe igual en cualquier teclado. */
export const SEPARADOR_DE_FRASE = '-';

/**
 * Inventa una frase: `bigote-kirby-siesta-tetris-482`.
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
