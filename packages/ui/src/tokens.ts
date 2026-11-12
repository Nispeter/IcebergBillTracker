/**
 * Los tokens de diseño de Iceberg: la única fuente de verdad del color, el
 * espacio, la letra y el movimiento.
 *
 * Regla dura del proyecto: ningún hexadecimal vive fuera de este archivo. Si
 * algo necesita un color que no está, se agrega acá primero.
 *
 * La paleta es fría entera, con el agua como acento, y un solo cálido: el ámbar
 * del pico del pingüino, que además marca lo que pide atención (el más de la
 * barra, un gasto fuera de lo normal). Se gasta con avaricia: en todos lados
 * dejaría de significar. Los grises llevan tinte azul; uno neutro junto al hielo
 * se ve sucio.
 */

/**
 * Los valores crudos. La app no los importa: consume `light`, `dark` y
 * `charts`, que dicen para qué sirve cada color.
 *
 * Varios vienen en dos versiones: la viva es de relleno (lo que manda es que se
 * vea) y la profunda es de texto sobre fondo claro, porque un color vivo sobre
 * casi blanco no llega a AA por más visible que sea. Sobre la noche polar los
 * vivos ya pasan como texto.
 */
const palette = {
  // Claro, "Deshielo".
  hielo: '#F2F7FB',
  blanco: '#FFFFFF',
  tintaProfunda: '#0E2233',
  hairlineClaro: '#D7E3EC',
  silencioClaro: '#5E7388',

  // Oscuro, "Noche polar": un azul de medianoche a 11 % de luz, con la
  // superficie separada del fondo para que lo que flota se despegue.
  /**
   * Repetido a mano en `apps/mobile/app.json` como fondo de la ventana de
   * Android (el JSON no puede importar). Si cambia acá, cambia allá.
   */
  nochePolar: '#0E192A',
  superficieNoche: '#16253D',
  tintaClara: '#E6F1F8',
  hairlineOscuro: '#273C5B',
  silencioOscuro: '#8299AF',

  ambar: '#F59E3C',

  // La serie de gráficos: fría y ordenada por profundidad, no un arcoíris.
  agua: '#4FB3D9',
  /** El agua como texto sobre fondo claro: el mismo matiz con menos luz. */
  aguaHonda: '#1A6C8C',
  profundidad: '#1B4F72',
  aurora: '#6EE7C8',
  auroraProfunda: '#157E63',
  cieloPalido: '#8AB4F8',
  nieblaAzul: '#B9C7D6',

  // Los dos extremos de la columna de agua del fondo, y la superficie hundida.
  abismo: '#070E18',
  deshieloProfundo: '#DDE9F2',
  deshieloHondo: '#D3E1EC',
  /**
   * El gris de etiqueta para el fondo hundido del tema claro: `silencioClaro`
   * pasa AA sobre el hielo por muy poco y sobre algo más oscuro ya no.
   */
  silencioHondido: '#4C6070',

  /** El único rojo del sistema, solo para vencido. */
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
  /** Relleno del acento: chips, puntos, barras. No como texto. */
  readonly acento: string;
  /** El acento cuando hay que leerlo. */
  readonly acentoTexto: string;
  /** Lo que se escribe encima de un relleno de acento o de ámbar. */
  readonly sobreAcento: string;
  /**
   * El cuerpo del pingüino, igual en los dos temas: invertido con el tema, la
   * cara queda con ojos claros sobre antifaz oscuro y parece un búho.
   */
  readonly pinguinoCuerpo: string;
  /** La cara y la panza del pingüino. Fija, por lo mismo. */
  readonly pinguinoPanza: string;
  /** El pico, y el más de la barra: el único ámbar de la app. */
  readonly pinguinoPico: string;
  /**
   * La tinta que se escribe encima del iceberg: una tinta profunda que se lee
   * sobre el hielo y sobre el agua, en los dos temas.
   */
  readonly sobreElHielo: string;
  /**
   * El hielo que asoma sobre el agua: siempre el hielo más claro que se
   * despegue del fondo. No sale de `gasto`, que se invierte con el tema y
   * pintaba la punta de negro en el tema claro.
   */
  readonly hieloSobreAgua: string;
  /** El agua junto a la superficie: el tope del degradado de la pantalla. */
  readonly aguaSuperficie: string;
  /** El agua honda: el pie del degradado. */
  readonly aguaProfunda: string;
  /**
   * Una superficie que se hunde en vez de levantarse. Sobre la noche polar una
   * sombra es invisible, así que la profundidad se hace con luz: hundir es
   * alejarse de ella. `superficie` queda para lo que flota.
   */
  readonly superficieHonda: string;
  /** El gris de etiqueta que se lee sobre `superficieHonda`. */
  readonly silencioHondo: string;
  /** Relleno del ingreso: áreas y barras de gráfico. */
  readonly ingreso: string;
  /** El ingreso cuando es un monto escrito. */
  readonly ingresoTexto: string;
  readonly gasto: string;
  readonly alerta: string;
  /** Relleno de vencido: marcadores. */
  readonly vencido: string;
  /** Vencido cuando es texto. */
  readonly vencidoTexto: string;
}

/** Tema claro, "Deshielo". */
export const light: Theme = {
  fondo: palette.hielo,
  superficie: palette.blanco,
  tinta: palette.tintaProfunda,
  silencio: palette.silencioClaro,
  hairline: palette.hairlineClaro,
  acento: palette.agua,
  // El agua sobre casi blanco da 2,2:1 como texto; el mismo matiz más oscuro, 5,5:1.
  acentoTexto: palette.aguaHonda,
  sobreAcento: palette.tintaProfunda,
  pinguinoCuerpo: palette.profundidad,
  pinguinoPanza: palette.hielo,
  pinguinoPico: palette.ambar,
  sobreElHielo: palette.tintaProfunda,
  // El blanco desaparecería sobre el fondo hielo: niebla azul, nieve en sombra.
  hieloSobreAgua: palette.nieblaAzul,
  aguaSuperficie: palette.blanco,
  aguaProfunda: palette.deshieloProfundo,
  superficieHonda: palette.deshieloHondo,
  silencioHondo: palette.silencioHondido,
  ingreso: palette.aurora,
  ingresoTexto: palette.auroraProfunda,
  gasto: palette.tintaProfunda,
  alerta: palette.ambar,
  vencido: palette.vencido,
  vencidoTexto: palette.vencidoProfundo,
};

/**
 * Tema oscuro, "Noche polar". Acá los colores vivos ya sirven de texto; solo el
 * rojo de vencido se aclara un poco para cruzar AA sobre la superficie.
 */
export const dark: Theme = {
  fondo: palette.nochePolar,
  superficie: palette.superficieNoche,
  tinta: palette.tintaClara,
  silencio: palette.silencioOscuro,
  hairline: palette.hairlineOscuro,
  acento: palette.agua,
  acentoTexto: palette.agua,
  sobreAcento: palette.tintaProfunda,
  pinguinoCuerpo: palette.profundidad,
  pinguinoPanza: palette.hielo,
  pinguinoPico: palette.ambar,
  sobreElHielo: palette.tintaProfunda,
  hieloSobreAgua: palette.hielo,
  aguaSuperficie: palette.superficieNoche,
  aguaProfunda: palette.abismo,
  superficieHonda: palette.abismo,
  // Sobre el abismo el gris de siempre ya da 6,6:1.
  silencioHondo: palette.silencioOscuro,
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
 * La serie de los gráficos, que se usa en orden y nunca inventa un color
 * intermedio. Ordenada por profundidad de agua: junta se lee como una escala.
 */
export const charts = [
  palette.agua,
  palette.profundidad,
  palette.aurora,
  palette.cieloPalido,
  palette.nieblaAzul,
] as const;

/** Tres radios con papeles distintos: un radio uniforme en todo es el look genérico. */
export const radii = {
  /** Controles: fichas, campos, botones. */
  sm: 10,
  /** Paneles y hojas. */
  md: 16,
  /** Piezas grandes. */
  lg: 28,
  /** Círculos. */
  full: 9999,
} as const;

/** El espaciado, en múltiplos de 4. */
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
 * El alto de la barra de navegación, sin el margen del sistema. Acá y no en la
 * barra porque las pantallas reservan ese aire al final: tienen que coincidir.
 */
export const ALTO_DE_LA_BARRA = 58;

/** Ancho máximo del contenido: en una tableta o en web la columna no se estira. */
export const ANCHO_MAXIMO = 480;

/** El área mínima que se puede tocar con el pulgar, en dp. La de Android. */
export const TOQUE_MINIMO = 48;

/** El `hitSlop` que lleva algo de `lado` dp hasta el área mínima de toque. */
export function holguraDeToque(lado: number): number {
  return Math.max(0, Math.ceil((TOQUE_MINIMO - lado) / 2));
}

/** La columna de contenido de cada vista: centrada, con el margen lateral de siempre. */
export const columna = {
  paddingHorizontal: spacing.lg,
  maxWidth: ANCHO_MAXIMO,
  width: '100%',
  alignSelf: 'center',
} as const;

/**
 * Dos familias con roles distintos: `texto` (la sans del sistema) para lo que se
 * lee como texto, y `mono` solo para cifras y fechas, donde la alineación en
 * columna importa. Una interfaz entera en mono se lee como terminal.
 *
 * Son pilas CSS, y solo la web las entiende: Android espera una sola familia por
 * nombre. Por eso existe `fontsNativas`, y la app elige con `Platform`. Las
 * fuentes son del sistema y no se empaquetan, así que `fontWeight` sí sirve.
 */
export const fonts = {
  texto: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'Consolas, "Cascadia Mono", "DejaVu Sans Mono", monospace',
} as const;

/** Los nombres genéricos que Android sí resuelve: Roboto y su monoespaciada. */
export const fontsNativas = {
  texto: 'sans-serif',
  mono: 'monospace',
} as const;

export const pesos = {
  /** Para cifras muy grandes, donde el regular pesa demasiado. */
  ligero: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** La escala de diseño. El tamaño que elige cada persona se aplica encima: ver `letra`. */
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  display: 40,
} as const;

/** Sin sombras: la separación la da una línea de un píxel. */
export const elevation = {
  hairlineWidth: 1,
} as const;

/**
 * Duraciones de las transiciones, en milisegundos. Lo que se va sale más rápido
 * de lo que llega: al cerrar, uno ya decidió.
 */
export const durations = {
  /** Algo que se cierra o se va. */
  salida: 160,
  /** El cambio entre vistas hermanas: un acuse de recibo, no una escena. */
  cambio: 180,
  /** Un panel o una burbuja que aparece. */
  entrada: 200,
  /** Una hoja que se levanta desde abajo. */
  escena: 240,
} as const;

/**
 * Qué va encima de qué, de abajo hacia arriba. En un solo lugar porque
 * repartidas en los componentes ya causaron que el encabezado tapara el menú.
 *
 * Un `zIndex` solo ordena hermanos dentro de su contexto de apilado: el
 * tutorial le gana a la barra y al menú de cuentas, que comparten padre con él,
 * no al aviso ni a la hoja, que viven en otra rama.
 */
export const capas = {
  /** La barra de abajo con el más. */
  flotante: 10,
  /** Un desplegable abierto, sobre el contenido. */
  desplegable: 20,
  /** El encabezado, que lleva el selector de período. */
  encabezado: 40,
  /** El menú de cuentas, que ocupa la pantalla entera. */
  lateral: 50,
  /** La hoja que sube desde abajo. */
  hoja: 55,
  /** El aviso de lo que se acaba de hacer. */
  aviso: 60,
  tutorial: 70,
} as const;
