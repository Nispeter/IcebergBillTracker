/**
 * El tamano de letra de toda la app, en cuatro pasos.
 *
 * `fontSizes` de `tokens` es la escala **de diseno**: las proporciones entre un
 * titulo, un cuerpo y una etiqueta, que no cambian nunca. Esto es otra cosa: un
 * multiplicador que la persona elige en Ajustes y que se aplica encima de esa
 * escala, sin tocar las proporciones.
 *
 * Existe porque la app se lee con una mano, de pie y a veces con poca luz, y
 * porque la mitad de sus textos son cifras de once puntos. El ajuste del sistema
 * operativo no alcanza: React Native solo lo aplica cuando el estilo **no** fija
 * `fontSize`, y aca todos lo fijan.
 *
 * ## Por que un objeto y no una funcion suelta
 *
 * Cada pantalla arma sus estilos con `StyleSheet.create`, que congela los
 * numeros en el momento de la llamada. Si la escala fuera una variable de
 * modulo, cambiarla no redibujaria nada. Al pasar el objeto como argumento de
 * `crearEstilos(theme, letra)`, cambiar de tamano cambia la identidad del
 * objeto y las pantallas recalculan igual que cuando cambia el tema.
 */

import { fontSizes } from './tokens';

/** Los cuatro pasos, de menor a mayor. El nombre es lo que se ve en Ajustes. */
export const ESCALAS_DE_LETRA = [
  { valor: 0.9, etiqueta: 'Chica' },
  { valor: 1, etiqueta: 'Normal' },
  { valor: 1.15, etiqueta: 'Grande' },
  { valor: 1.3, etiqueta: 'Enorme' },
] as const;

export const ESCALA_POR_OMISION = 1;

export interface Letra {
  /** El multiplicador, por si algo tiene que escalar algo que no es texto. */
  readonly escala: number;
  /** Como se llama este paso en Ajustes. */
  readonly etiqueta: string;
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly display: number;
  /**
   * Un tamano suelto, escalado.
   *
   * La app tiene cuarenta y tantos `fontSize` con numero a mano --las cifras de
   * ocho puntos del calendario, las etiquetas de diez de los paneles-- que no
   * salen de `fontSizes` porque son mas chicos que `xs`. Pasan por aca para que
   * tambien crezcan.
   */
  px(tamano: number): number;
}

/**
 * Acota lo que venga a un paso conocido.
 *
 * Se acota al leer y no solo al escribir, por lo mismo que los pinguinos: el
 * valor pudo quedar guardado por una version con otra tabla de escalas, y una
 * pantalla no puede romperse por un ajuste viejo.
 */
export function escalaValida(crudo: unknown): number {
  const numero = Number(crudo);
  if (!Number.isFinite(numero)) return ESCALA_POR_OMISION;
  const paso = ESCALAS_DE_LETRA.find((e) => Math.abs(e.valor - numero) < 0.001);
  return paso?.valor ?? ESCALA_POR_OMISION;
}

/**
 * Los tamanos ya multiplicados.
 *
 * Se redondea a entero: un `fontSize` con decimales no se ve mal por si solo,
 * pero desalinea columnas de montos que deberian caer en la misma linea base.
 */
export function letraConEscala(escala: number): Letra {
  const acotada = escalaValida(escala);
  const px = (tamano: number) => Math.round(tamano * acotada);
  return {
    escala: acotada,
    etiqueta: ESCALAS_DE_LETRA.find((e) => e.valor === acotada)?.etiqueta ?? 'Normal',
    xs: px(fontSizes.xs),
    sm: px(fontSizes.sm),
    md: px(fontSizes.md),
    lg: px(fontSizes.lg),
    xl: px(fontSizes.xl),
    display: px(fontSizes.display),
    px,
  };
}

/** El tamano de siempre, para lo que se dibuja antes de que la base abra. */
export const LETRA_NORMAL: Letra = letraConEscala(ESCALA_POR_OMISION);
