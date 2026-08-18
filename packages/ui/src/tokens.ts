/**
 * Tokens de diseno de Iceberg. **Unica fuente de verdad del color.**
 *
 * Regla dura del proyecto: ningun literal hexadecimal vive fuera de este
 * archivo. Ni en una pantalla, ni en un grafico, ni en un estilo suelto. Si algo
 * necesita un color que no esta aca, el color se agrega aca primero.
 *
 * La idea que sostiene la paleta: **todo frio menos un acento calido**, el ambar
 * del pico del pinguino. Cuando el resto de la pantalla es azul-hielo, ese ambar
 * senala lo importante sin necesidad de agrandar, subrayar ni recuadrar nada.
 * Por eso el ambar se gasta con avaricia: si aparece en todos lados, deja de
 * significar.
 *
 * Los grises llevan **tinte azul**, nunca son neutros: un gris puro al lado del
 * hielo se ve sucio.
 */

/**
 * Valores crudos. Nada de la app importa `palette` directamente: se consume
 * `light` / `dark` / `charts`, que dicen para que sirve cada color.
 */
const palette = {
  // Claro "Deshielo"
  hielo: '#F2F7FB',
  blanco: '#FFFFFF',
  tintaProfunda: '#0E2233',
  hairlineClaro: '#D7E3EC',
  silencioClaro: '#6B8299',

  // Oscuro "Noche polar"
  nochePolar: '#0A1620',
  superficieNoche: '#102131',
  tintaClara: '#E6F1F8',
  hairlineOscuro: '#1E3547',
  /**
   * El gris apagado del tema oscuro no venia definido en la paleta original.
   * Se eligio como espejo de `silencioClaro` aclarado hasta cumplir AA (4.5:1)
   * sobre la superficie nocturna; el original a esa altura solo llegaba a 4.11.
   */
  silencioOscuro: '#8299AF',

  // Acento unico
  ambar: '#F59E3C',

  // Serie de graficos: frias, ordenadas por profundidad, no arcoiris
  agua: '#4FB3D9',
  profundidad: '#1B4F72',
  aurora: '#6EE7C8',
  cieloPalido: '#8AB4F8',
  nieblaAzul: '#B9C7D6',

  /** El unico rojo del sistema. Solo para vencido. */
  vencido: '#D9534F',
} as const;

export interface Theme {
  readonly fondo: string;
  readonly superficie: string;
  readonly tinta: string;
  readonly silencio: string;
  readonly hairline: string;
  readonly acento: string;
  readonly ingreso: string;
  readonly gasto: string;
  readonly alerta: string;
  readonly vencido: string;
}

/** Tema claro "Deshielo". */
export const light: Theme = {
  fondo: palette.hielo,
  superficie: palette.blanco,
  tinta: palette.tintaProfunda,
  silencio: palette.silencioClaro,
  hairline: palette.hairlineClaro,
  acento: palette.ambar,
  ingreso: palette.aurora,
  gasto: palette.tintaProfunda,
  alerta: palette.ambar,
  vencido: palette.vencido,
};

/** Tema oscuro "Noche polar". */
export const dark: Theme = {
  fondo: palette.nochePolar,
  superficie: palette.superficieNoche,
  tinta: palette.tintaClara,
  silencio: palette.silencioOscuro,
  hairline: palette.hairlineOscuro,
  acento: palette.ambar,
  ingreso: palette.aurora,
  gasto: palette.tintaClara,
  alerta: palette.ambar,
  vencido: palette.vencido,
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;

/**
 * Serie categorica de graficos, en orden de uso.
 *
 * Estan ordenadas por profundidad de agua, no por matiz: puestas juntas se leen
 * como una escala, no como un arcoiris. La regla del sistema es que un grafico
 * usa esta serie **en orden** y nunca inventa un color intermedio.
 */
export const charts = [
  palette.agua,
  palette.profundidad,
  palette.aurora,
  palette.cieloPalido,
  palette.nieblaAzul,
] as const;

/**
 * Radios. Tres valores a proposito, con roles distintos: un `border-radius`
 * uniforme en toda la pantalla es una de las marcas del look generico.
 */
export const radii = {
  /** Controles chicos: chips, badges, inputs. */
  sm: 10,
  /** Tarjetas y hojas. */
  md: 16,
  /** Piezas grandes y contenedores del iceberg. */
  lg: 28,
  /** Circulos completos: avatares, boton flotante. */
  full: 9999,
} as const;

/** Escala de espaciado en multiplos de 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Tipografia.
 *
 * `ui` es una grotesca; `mono` es monoespaciada y se usa en **toda** cifra de
 * dinero, sin excepcion. Las cifras tabulares hacen que las columnas de montos
 * queden alineadas digito a digito: es el detalle chico que separa una app
 * financiera seria de una plantilla.
 *
 * Se eligio Hanken Grotesk por sobre Satoshi porque viene como paquete de
 * `@expo-google-fonts`, o sea sin archivos que versionar ni licencia que
 * revisar, y funciona igual en web y en Android. Cambiar de familia es cambiar
 * estas dos constantes.
 */
export const fonts = {
  ui: 'HankenGrotesk',
  mono: 'IBMPlexMono',
} as const;

/** Pesos disponibles de cada familia. */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  /** Para la cifra protagonista de Home. */
  display: 40,
} as const;

/**
 * Bordes y profundidad.
 *
 * En claro **no hay sombras difusas**: la separacion la da una linea hairline de
 * 1px. En oscuro una sombra no se ve, asi que la superficie se despega con un
 * glow tenue de 1px del mismo color de la linea.
 */
export const elevation = {
  hairlineWidth: 1,
  glowRadius: 1,
} as const;

/** Duraciones de animacion, en milisegundos. */
export const durations = {
  instant: 120,
  quick: 200,
  calm: 320,
} as const;
