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
 * Desde que el boton de agregar lo lleva, el ambar tiene **dos trabajos**: la
 * accion principal y lo que pide atencion --un vencido, un gasto fuera de lo
 * habitual--. Conviven porque el boton esta siempre en el mismo lugar y lo otro
 * aparece dentro del contenido, pero es la tension a vigilar si algun dia el
 * ambar se usa en un tercer lugar.
 *
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
  /**
   * Ojo: este valor esta **repetido a mano** en `apps/mobile/app.json`, como
   * `backgroundColor` de la ventana de Android. Es la unica copia fuera de este
   * archivo y no hay forma de evitarla: `app.json` es configuracion estatica y
   * no puede importar nada. La ventana es el ultimo plano bajo la app --debajo
   * de todo lo que React dibuja-- y en blanco asomaba en cada transicion de
   * pantalla. Si este color cambia, hay que cambiarlo alla tambien.
   */
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
  /**
   * El agua como texto sobre fondo claro.
   *
   * Es `agua` con el mismo matiz y menos luz, no otro azul: `profundidad` fue el
   * primer intento y el test de coherencia lo rechazo --23 grados de matiz de
   * diferencia--, porque se habria leido como un color distinto en vez del mismo
   * mas oscuro.
   */
  aguaHonda: '#1A6C8C',
  profundidad: '#1B4F72',
  aurora: '#6EE7C8',
  auroraProfunda: '#157E63',
  cieloPalido: '#8AB4F8',
  nieblaAzul: '#B9C7D6',

  /**
   * Los dos extremos de la profundidad, para el prototipo "Hielo".
   *
   * La idea es que la pantalla **sea** el agua y se haga mas honda hacia abajo,
   * en vez de que el iceberg sea un dibujo dentro de una caja. Por eso son dos
   * valores por tema y no uno: arriba la superficie, abajo el abismo.
   */
  abismo: '#070E18',
  deshieloProfundo: '#DDE9F2',
  deshieloHondo: '#D3E1EC',
  /**
   * El gris apagado del tema claro, **oscurecido para el fondo hundido**.
   *
   * `silencioClaro` pasa AA sobre el hielo por muy poco --4,55 contra 4,5-- asi
   * que sobre cualquier fondo mas oscuro que el hielo deja de pasar. Una
   * etiqueta sobre la tarjeta honda necesita su propio valor o deja de leerse.
   */
  silencioHondido: '#4C6070',

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
  /**
   * El pico. **El unico ambar que queda en la app.**
   *
   * Era el acento de toda la interfaz, y de ahi salia buena parte de la razon
   * por la que la app se veia como un panel generado: naranjo de acento sobre
   * azul medianoche es la paleta por defecto del genero. El acento paso al agua
   * y el ambar volvio al lugar de donde habia salido --el pico del pinguino--,
   * que es donde significa algo.
   */
  readonly pinguinoPico: string;
  /**
   * La tinta que se escribe **encima del dibujo del iceberg**.
   *
   * Un solo valor para el hielo y para el agua: el hielo es casi blanco y el
   * agua junto a la superficie es un cian claro, asi que la misma tinta profunda
   * se lee sobre los dos. Con blanco no pasaba: sobre el cian da 2,4:1.
   */
  readonly sobreElHielo: string;
  /**
   * El hielo que asoma sobre el agua.
   *
   * Tiene rol propio porque **no puede salir de `gasto`**, que es lo que usaba
   * antes. `gasto` es un color de texto y de barra, y como tal se invierte con
   * el tema: claro sobre la noche polar, casi negro sobre el deshielo. En una
   * barra eso esta bien; en un iceberg deja la punta pintada de negro, que es
   * exactamente lo contrario de lo que es el hielo. Se noto recien al agrandar
   * el dibujo, y llevaba ahi desde el primer boceto.
   *
   * Tampoco puede ser el mismo en los dos temas: el blanco hielo que funciona
   * de noche es el color del fondo claro, y ahi la punta desapareceria. Cambia
   * de valor pero no de idea: siempre el hielo mas claro que se despegue del
   * fondo que tenga detras.
   */
  readonly hieloSobreAgua: string;
  /**
   * El reflejo sobre la cara del hielo que mira a la luz.
   *
   * Blanco en los dos temas, y en los dos tiene con que brillar: en el claro el
   * hielo es `nieblaAzul` y en el oscuro es `hielo`, asi que el blanco queda por
   * encima de ambos. Es el unico color que se usa **por encima** del hielo, no
   * sobre el.
   */
  readonly brilloDelHielo: string;
  /**
   * El agua junto a la superficie: el tope del degradado de la pantalla.
   *
   * Va con `aguaProfunda`. Los dos existen para que el fondo tenga profundidad
   * en vez de ser un color plano: mas arriba mas claro, mas abajo mas hondo. Es
   * la misma idea que ordena la serie de graficos --por profundidad de agua, no
   * por matiz-- llevada al fondo de la pantalla.
   */
  readonly aguaSuperficie: string;
  /** El agua honda: el pie del degradado. */
  readonly aguaProfunda: string;
  /**
   * Una superficie que **se hunde** en vez de levantarse.
   *
   * `superficie` va hacia el espectador: hojas, menus, burbujas, todo lo que
   * flota por encima del contenido. Esta va al reves, y es la unica forma de
   * dar profundidad que le sirve a este proyecto: sobre la noche polar una
   * sombra negra es invisible, asi que la elevacion se hace con luminosidad, y
   * hundir es alejarse de la luz.
   */
  readonly superficieHonda: string;
  /** El gris de etiqueta que se lee sobre `superficieHonda`. */
  readonly silencioHondo: string;
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
  // El acento es el agua, no el ambar. Ver `pinguinoPico`.
  acento: palette.agua,
  // Sobre un fondo casi blanco el cian da 2,2:1 como texto. `aguaHonda` es el
  // mismo matiz con menos luz, y da 5,5:1.
  acentoTexto: palette.aguaHonda,
  sobreAcento: palette.tintaProfunda,
  pinguinoCuerpo: palette.profundidad,
  pinguinoPanza: palette.hielo,
  pinguinoPico: palette.ambar,
  sobreElHielo: palette.tintaProfunda,
  // Sobre el fondo hielo, el blanco desapareceria: va la niebla azul, que se
  // lee como nieve en sombra.
  hieloSobreAgua: palette.nieblaAzul,
  brilloDelHielo: palette.blanco,
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
  acento: palette.agua,
  acentoTexto: palette.agua,
  sobreAcento: palette.tintaProfunda,
  pinguinoCuerpo: palette.profundidad,
  pinguinoPanza: palette.hielo,
  pinguinoPico: palette.ambar,
  sobreElHielo: palette.tintaProfunda,
  hieloSobreAgua: palette.hielo,
  brilloDelHielo: palette.blanco,
  aguaSuperficie: palette.superficieNoche,
  aguaProfunda: palette.abismo,
  superficieHonda: palette.abismo,
  // Sobre el abismo el gris de siempre da 6,6:1: no hace falta cambiarlo.
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
 * Alto de la barra de navegacion de abajo, **sin** el margen del sistema.
 *
 * Lo usan la barra para dibujarse y las pantallas para reservar aire al final de
 * lo que scrollea. Vive aca y no en el componente porque las dos cosas tienen
 * que estar de acuerdo: si no, o la ultima fila queda debajo de la barra o
 * sobra un hueco.
 */
export const ALTO_DE_LA_BARRA = 58;

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

/**
 * La sans del sistema, para el prototipo "Hielo".
 *
 * Que `ui` y `mono` sean **la misma familia** deja toda la app en
 * monoespaciada, y una interfaz entera en mono oscuro se lee como terminal:
 * es uno de los rasgos que la hacen parecer generada. Separar el rol de texto
 * del de cifras es el cambio que mas mueve la cara sin tocar el layout.
 *
 * Es la del sistema y no una empaquetada porque esto es un prototipo. Cuando se
 * elija la definitiva --hay que empaquetar una igual, Consolas es propietaria--
 * se cambia aca y listo.
 */
const PILA_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const fonts = {
  ui: PILA_CONSOLAS,
  mono: PILA_CONSOLAS,
  /** Texto que se lee como texto: etiquetas, frases, titulos. */
  texto: PILA_SANS,
} as const;

export const pesos = {
  /** Para cifras muy grandes, donde el regular pesa demasiado. */
  ligero: '300',
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

/**
 * Que va encima de que.
 *
 * Estaban repartidas como numeros sueltos en cinco componentes, y eso ya causo
 * un bug: al subir el encabezado para que el selector de periodo se abriera por
 * encima del contenido, quedo **tambien por encima del menu lateral**, que se
 * veia con el boton de hamburguesa dibujado arriba del panel.
 *
 * De abajo hacia arriba, y el orden es el que importa: el contenido; el boton
 * flotante, que va sobre el contenido pero cede ante cualquier panel; los
 * desplegables; las burbujas de ayuda; el encabezado, que lleva el selector de
 * periodo; el menu lateral, que tapa todo porque es el unico que ocupa la
 * pantalla entera; la hoja deslizante, que es la unica que se abre **sobre** el
 * menu; y el aviso de guardado, que va sobre todo porque confirma algo que
 * acaba de pasar y no tendria sentido que algo lo tapara.
 */
export const capas = {
  flotante: 10,
  desplegable: 20,
  ayuda: 30,
  encabezado: 40,
  lateral: 50,
  hoja: 55,
  aviso: 60,
} as const;
