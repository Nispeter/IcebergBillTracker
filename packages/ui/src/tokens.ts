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
 *
 * Varios colores vienen en dos versiones, y la distincion importa:
 *
 * - la **viva** es de relleno — una barra, un chip, un punto, un area de grafico.
 *   Ahi lo que manda es que se vea, y eso se mide en distancia perceptual.
 * - la **profunda** es de texto sobre fondo claro. El contraste WCAG solo mide
 *   luminancia, y un color vivo sobre casi-blanco lo reprueba por mas visible
 *   que sea a ojo. Un monto escrito en aurora sobre el fondo claro daba 1,51:1:
 *   se veia el color y no se leia el numero.
 *
 * En el tema oscuro no hace falta la distincion: sobre la noche polar los mismos
 * colores vivos ya pasan AA como texto.
 */
const palette = {
  // Claro "Deshielo"
  hielo: '#F2F7FB',
  blanco: '#FFFFFF',
  tintaProfunda: '#0E2233',
  hairlineClaro: '#D7E3EC',
  silencioClaro: '#5E7388',

  // Oscuro "Noche polar"
  nochePolar: '#0A1620',
  superficieNoche: '#102131',
  tintaClara: '#E6F1F8',
  hairlineOscuro: '#1E3547',
  /**
   * El gris apagado del tema oscuro no venia definido en la paleta original.
   * Se eligio como espejo de `silencioClaro`, aclarado hasta cumplir AA sobre la
   * superficie nocturna.
   */
  silencioOscuro: '#8299AF',

  // Acento unico: el ambar del pico del pinguino
  ambar: '#F59E3C',
  ambarProfundo: '#A95E09',

  // Serie de graficos: frias, ordenadas por profundidad, no arcoiris
  agua: '#4FB3D9',
  profundidad: '#1B4F72',
  aurora: '#6EE7C8',
  auroraProfunda: '#157E63',
  cieloPalido: '#8AB4F8',
  nieblaAzul: '#B9C7D6',

  /** El unico rojo del sistema. Solo para vencido. */
  vencido: '#D9534F',
  vencidoProfundo: '#D2322D',
  vencidoSuave: '#DC5F5C',
} as const;

export interface Theme {
  readonly fondo: string;
  readonly superficie: string;
  readonly tinta: string;
  readonly silencio: string;
  readonly hairline: string;
  /** Relleno del acento: chips, puntos, barras. No usar como texto. */
  readonly acento: string;
  /** El acento cuando hay que **leerlo**. */
  readonly acentoTexto: string;
  /** Relleno del ingreso: areas y barras de grafico. */
  readonly ingreso: string;
  /** El ingreso cuando es un monto escrito. */
  readonly ingresoTexto: string;
  readonly gasto: string;
  readonly alerta: string;
  /** Relleno de vencido: badges y marcadores. */
  readonly vencido: string;
  /** Vencido cuando es texto. */
  readonly vencidoTexto: string;
}

/** Tema claro "Deshielo". */
export const light: Theme = {
  fondo: palette.hielo,
  superficie: palette.blanco,
  tinta: palette.tintaProfunda,
  silencio: palette.silencioClaro,
  hairline: palette.hairlineClaro,
  acento: palette.ambar,
  acentoTexto: palette.ambarProfundo,
  ingreso: palette.aurora,
  ingresoTexto: palette.auroraProfunda,
  gasto: palette.tintaProfunda,
  alerta: palette.ambar,
  vencido: palette.vencido,
  vencidoTexto: palette.vencidoProfundo,
};

/**
 * Tema oscuro "Noche polar".
 *
 * Sobre la noche polar el ambar da 7,7:1 y la aurora 10,9:1, asi que el color de
 * relleno y el de texto son el mismo. El unico que necesita ajuste es el rojo de
 * vencido, que se aclara apenas para cruzar AA sobre la superficie.
 */
export const dark: Theme = {
  fondo: palette.nochePolar,
  superficie: palette.superficieNoche,
  tinta: palette.tintaClara,
  silencio: palette.silencioOscuro,
  hairline: palette.hairlineOscuro,
  acento: palette.ambar,
  acentoTexto: palette.ambar,
  ingreso: palette.aurora,
  ingresoTexto: palette.aurora,
  gasto: palette.tintaClara,
  alerta: palette.ambar,
  vencido: palette.vencido,
  vencidoTexto: palette.vencidoSuave,
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
 * **Schibsted Grotesk** para la interfaz: una grotesca noruega de prensa, algo
 * condensada y de formas sobrias. Aguanta bien la densidad de una tabla de
 * movimientos y tiene caracter propio sin caer en lo ingenioso, que en una app
 * de plata cansa rapido.
 *
 * **Geist Mono** para **toda** cifra de dinero, sin excepcion. Al ser
 * monoespaciada los digitos ocupan lo mismo y las columnas de montos quedan
 * alineadas cifra a cifra: el detalle chico que separa una app financiera seria
 * de una plantilla.
 *
 * Cada peso es una familia propia, no un `fontWeight`. En React Native, poner
 * `fontFamily` y `fontWeight` juntos hace que Android sintetice la negrita
 * deformando la regular en vez de usar el archivo correcto. Por eso aca no hay
 * escala de pesos: se elige la familia y listo.
 *
 * Las dos vienen como paquete de `@expo-google-fonts`, o sea sin archivos que
 * versionar ni licencia que revisar, y funcionan igual en web y en Android.
 * Cambiar de familia es cambiar este objeto y el `useFonts` que las carga.
 */
export const fonts = {
  ui: {
    regular: 'SchibstedGrotesk_400Regular',
    medium: 'SchibstedGrotesk_500Medium',
    semibold: 'SchibstedGrotesk_600SemiBold',
    bold: 'SchibstedGrotesk_700Bold',
  },
  mono: {
    regular: 'GeistMono_400Regular',
    medium: 'GeistMono_500Medium',
    semibold: 'GeistMono_600SemiBold',
  },
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
