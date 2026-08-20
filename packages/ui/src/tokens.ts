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
  //
  // La primera version estaba a 8% de luminosidad: tan oscura que el azul no
  // alcanzaba a leerse y el fondo quedaba como pizarra sucia. Se subio a 11% y
  // se corrio el matiz a 216 para que sea un azul de medianoche de verdad, y se
  // separo mas la superficie del fondo para que una hoja o un menu se despeguen.
  nochePolar: '#0E192A',
  superficieNoche: '#16253D',
  tintaClara: '#E6F1F8',
  hairlineOscuro: '#273C5B',
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
  vencidoSuave: '#E06B68',
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
  /**
   * Lo que se escribe **encima** del relleno ambar.
   *
   * No sirve `acentoTexto`: en el tema oscuro es el mismo ambar que el relleno,
   * asi que un boton solido quedaba naranjo y vacio. Tampoco sirve `fondo`, que
   * en el tema claro es casi blanco sobre ambar. Como el ambar es identico en
   * los dos temas, lo que va encima tambien: la tinta profunda, 7,6:1.
   */
  readonly sobreAcento: string;
  /**
   * El cuerpo del pinguino. **El mismo en los dos temas.**
   *
   * No usa `tinta` como el resto de los dibujos. Una silueta que se da vuelta
   * con el tema funciona para un iceberg, pero en una **cara** invierte los ojos
   * —pupilas claras sobre antifaz oscuro— y deja de leerse como pinguino: parece
   * un buho. Los ojos tienen que ser oscuros sobre claro siempre.
   *
   * Es el azul de profundidad, que se despega tanto del hielo como de la noche
   * polar, asi que sirve fijo en los dos temas.
   */
  readonly pinguinoCuerpo: string;
  /** La cara y la panza del pinguino. Fija, por lo mismo. */
  readonly pinguinoPanza: string;
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
  sobreAcento: palette.tintaProfunda,
  pinguinoCuerpo: palette.profundidad,
  pinguinoPanza: palette.hielo,
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
  sobreAcento: palette.tintaProfunda,
  pinguinoCuerpo: palette.profundidad,
  pinguinoPanza: palette.hielo,
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
 * **Consolas**, la monoespaciada de Windows, para toda la interfaz. Que las
 * etiquetas y las cifras compartan familia le da a la app un aire de instrumento
 * antes que de folleto, y como es monoespaciada las columnas de montos quedan
 * alineadas digito a digito sin esfuerzo.
 *
 * ## Ojo: la pila solo funciona en web
 *
 * El valor es una pila CSS con comas. **Eso solo lo entiende la web**, donde
 * react-native-web lo pasa tal cual al navegador y el fallback funciona: Windows
 * resuelve Consolas, Mac y Linux caen a la siguiente.
 *
 * En Android y iOS, `fontFamily` espera **una sola familia**: el string completo
 * se busca como si fuera un nombre, no se encuentra, y todo cae a la sans-serif
 * del sistema. Ni siquiera aplica el `monospace` del final, asi que las columnas
 * de montos dejan de cuadrar.
 *
 * Encima, Consolas es **propietaria de Microsoft** y no se puede empaquetar.
 *
 * **Antes de F3 hay que empaquetar una sustituta libre y elegir por plataforma**
 * (`Platform.select`, o dos constantes y que la app arme el valor). Candidatas:
 * **Inconsolata** (Google Fonts, disenada explicitamente a partir de Consolas) o
 * **Cascadia Mono** (la sucesora de Microsoft, con licencia SIL OFL).
 *
 * ## Pesos
 *
 * Al ser una fuente del sistema y no un archivo por peso, aca **si** se usa
 * `fontWeight`. La regla de "una familia por peso" existia para evitar que
 * Android sintetizara la negrita deformando la regular, y eso solo aplica cuando
 * uno empaqueta las variantes.
 */
const PILA_CONSOLAS = 'Consolas, "Cascadia Mono", "DejaVu Sans Mono", monospace';

export const fonts = {
  ui: PILA_CONSOLAS,
  mono: PILA_CONSOLAS,
} as const;

export const pesos = {
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
