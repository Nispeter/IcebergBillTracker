/**
 * El iceberg: la pantalla estrella del proyecto hecha grafico.
 *
 * Sobre la linea de agua va el gasto **comprometido** —arriendo, cuentas,
 * cuotas— y debajo el **variable**, que es el que uno no ve venir. La linea de
 * agua no esta puesta a ojo: se calcula para que el **area** sobre ella sea
 * exactamente la proporcion del gasto comprometido.
 *
 * Eso importa porque la silueta es angosta arriba y ancha abajo. Trazar la
 * linea al 62% de la **altura** dejaria muchisimo menos del 62% de superficie
 * pintada, y lo que la persona lee es la superficie. El calculo vive en
 * `@iceberg/ui/geometry`, con sus tests.
 */

import { toPathData, waterlineForShare, type Point, type Theme } from '@iceberg/ui';
import * as React from 'react';
import Svg, {
  Defs, G, Image, Line, LinearGradient, Path, Pattern, Stop,
} from 'react-native-svg';
import { Animated, Easing, View } from 'react-native';

const ANCHO = 200;
const ALTO = 236;

/**
 * Silueta. Un pico principal y dos espolones menores, con la masa submarina
 * ancha e irregular. Se dibujo a mano y se verifico rasterizandola: las curvas
 * suaves se leian como una gota y no como hielo.
 */
const SILUETA: Point[] = [
  [92, 0], [104, 26], [98, 44], [126, 30], [136, 62], [150, 52],
  [162, 96], [186, 118], [168, 150], [194, 180], [150, 216], [100, 236],
  [48, 222], [12, 186], [36, 152], [4, 118], [40, 92], [58, 62], [78, 30],
];

const RUTA = toPathData(SILUETA);

/**
 * Las facetas, en coordenadas del `viewBox`.
 *
 * Un iceberg es un cristal, y lo que lo hace leerse como hielo son los planos,
 * no la textura granulada: la primera version puso motas y se veian como
 * suciedad sobre el dibujo.
 *
 * Cada faceta es un triangulo entre una arista de la silueta y un vertice
 * interior. **Estan verificadas una por una**: se muestreo cada triangulo por
 * coordenadas baricentricas comprobando que ningun punto se sale del contorno.
 * Recortar con `ClipPath` era el camino obvio y es el que ya fallo en Android en
 * este mismo archivo, dejando el iceberg de un solo color.
 *
 * `tono` va de -1 a 1 segun cuanto le da la luz, que entra desde arriba a la
 * izquierda. Se calculo una vez y se dejo escrito: nada de esto cambia en
 * tiempo de ejecucion.
 */
const FACETAS: readonly { puntos: Point[]; tono: number }[] = [
  { puntos: [[92, 0], [104, 26], [86, 72]], tono: 0.85 },
  { puntos: [[104, 26], [98, 44], [73, 88]], tono: 0.84 },
  { puntos: [[98, 44], [126, 30], [104, 96]], tono: 0.75 },
  { puntos: [[126, 30], [136, 62], [106, 101]], tono: 0.53 },
  { puntos: [[136, 62], [150, 52], [106, 104]], tono: 0.31 },
  { puntos: [[150, 52], [162, 96], [106, 107]], tono: -0.01 },
  { puntos: [[162, 96], [186, 118], [114, 109]], tono: -0.53 },
  { puntos: [[186, 118], [168, 150], [120, 115]], tono: -0.78 },
  { puntos: [[168, 150], [194, 180], [132, 130]], tono: -0.93 },
  { puntos: [[194, 180], [150, 216], [135, 151]], tono: -0.99 },
  { puntos: [[150, 216], [100, 236], [114, 167]], tono: -0.92 },
  { puntos: [[100, 236], [48, 222], [88, 171]], tono: -0.68 },
  { puntos: [[48, 222], [12, 186], [66, 156]], tono: -0.33 },
  { puntos: [[12, 186], [36, 152], [72, 132]], tono: -0.07 },
  { puntos: [[36, 152], [4, 118], [77, 117]], tono: 0.27 },
  { puntos: [[4, 118], [40, 92], [82, 108]], tono: 0.59 },
  { puntos: [[40, 92], [58, 62], [100, 108]], tono: 0.9 },
  { puntos: [[58, 62], [78, 30], [97, 99]], tono: 0.99 },
  { puntos: [[78, 30], [92, 0], [96, 74]], tono: 0.92 },
];



/**
 * La textura de hielo agrietado.
 *
 * Es **blanca con transparencia**, generada por `tools/texturas/hielo.mjs`: asi
 * se pinta encima del degradado de hielo y agua y se tiñe sola de lo que haya
 * debajo, sin depender de que tema este puesto ni de donde caiga la linea de
 * agua.
 *
 * Se genera y no se descarga a proposito: las texturas de banco de imagenes
 * traen licencia y marca de agua, y esto vive en un repositorio publico.
 */
const TEXTURA = require('../assets/hielo.png');

/** Lado del mosaico, en unidades del `viewBox`. */
const LADO_DEL_MOSAICO = 100;
/** Cuanto se nota la textura. Pasando de esto tapa las facetas. */
const FUERZA_DE_LA_TEXTURA = 0.5;

/** Cuanto oscurece la faceta mas en sombra. Mas que esto y parece sucio. */
const SOMBRA_MAXIMA = 0.2;
/** La arista de cada plano. Es lo que se lee como cristal. */
const ARISTA = 0.09;
/** Desde que tono una faceta lleva reflejo. Solo las que miran a la luz. */
const TONO_CON_BRILLO = 0.7;
const BRILLO_MAXIMO = 0.28;

/**
 * De donde a donde va la rampa de luz, en coordenadas del `viewBox`.
 *
 * Del vertice iluminado al opuesto. Es lo que hace que **dentro de una misma
 * faceta** el sombreado varie en vez de ser un tono plano: una faceta plana se
 * ve dibujada, una con caida se ve iluminada.
 */
const DE_LA_LUZ = { x1: 0, y1: 0, x2: ANCHO, y2: ALTO };



export interface IcebergProps {
  /** Proporcion del gasto que es comprometido, de 0 a 1. */
  readonly shareComprometido: number;
  readonly theme: Theme;
  readonly agua: string;
  readonly profundidad: string;
  readonly alto?: number;
  /**
   * Si el dibujo pinta su propia linea de agua.
   *
   * En falso la omite para que la pantalla dibuje una **a todo el ancho**, con
   * `alturaDeLineaDeAgua` para saber donde. Es la diferencia entre un iceberg
   * metido en una caja y un iceberg flotando en la pantalla.
   */
  readonly dibujarLinea?: boolean;
}

/**
 * A que altura cae la linea de agua dentro de un iceberg de `alto` pixeles.
 *
 * La pantalla la necesita para alinear su propia linea con la del dibujo. El
 * calculo del area vive en `waterlineForShare`; aca solo se pasa de las
 * unidades del `viewBox` a pixeles.
 */
export function alturaDeLineaDeAgua(shareComprometido: number, alto: number): number {
  return (waterlineForShare(SILUETA, shareComprometido) / ALTO) * alto;
}

/**
 * Cuanto mide de ancho el dibujo para un alto dado.
 *
 * La pantalla lo necesita para poner cosas **encima del hielo**: la escena es
 * mucho mas ancha que el iceberg --la linea de agua cruza de borde a borde-- asi
 * que un porcentaje del contenedor no cae donde uno cree.
 */
export function anchoDelIceberg(alto: number): number {
  return alto * (ANCHO / ALTO);
}

/**
 * Un `G` animable que no arrastra `collapsable` al DOM.
 *
 * `Animated.createAnimatedComponent` le pasa `collapsable={false}` a lo que
 * envuelve, porque en Android le sirve para que la vista no se colapse. El `G`
 * de la version web reenvia lo que no conoce al DOM, y React protesta: recibe
 * `false` para un atributo que no es booleano. Se filtra aca en vez de
 * silenciarlo, que es lo unico que arregla la causa.
 */
const GParaAnimar = React.forwardRef<
  React.ComponentRef<typeof G>,
  React.ComponentProps<typeof G> & { collapsable?: boolean }
>(({ collapsable, ...resto }, ref) => <G ref={ref} {...resto} />);
GParaAnimar.displayName = 'GParaAnimar';

const AnimatedG = Animated.createAnimatedComponent(GParaAnimar);

/** Cuanto tarda el brillo en ir y volver. Lento: es luz cambiando, no un latido. */
const RESPIRACION = 3800;

export function Iceberg(
  { shareComprometido, theme, agua, profundidad, alto = 200, dibujarLinea = true }: IcebergProps,
) {
  /**
   * El brillo de las grietas, yendo y viniendo.
   *
   * `useNativeDriver` no puede: la opacidad de un nodo de SVG no es una
   * propiedad que el hilo nativo sepa interpolar. Por eso es **un solo nodo** y
   * una sola animacion lenta: a 3,8 segundos por tramo, el costo por cuadro es
   * irrelevante y el efecto se nota igual.
   */
  const brillo = React.useRef(new Animated.Value(0.6)).current;
  React.useEffect(() => {
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(brillo, { toValue: 1, duration: RESPIRACION, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(brillo, { toValue: 0.6, duration: RESPIRACION, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [brillo]);

  const linea = waterlineForShare(SILUETA, shareComprometido);
  const ancho = alto * (ANCHO / ALTO);
  // Donde corta el degradado, en la escala 0..1 que piden los `offset`.
  const corte = Math.min(1, Math.max(0, linea / ALTO));

  return (
    <View style={{ width: ancho, height: alto }}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ANCHO} ${ALTO}`}>
        <Defs>
          {/*
            Hielo arriba y agua abajo **en un solo degradado**, con dos paradas
            en el mismo `offset` para que el cambio sea un corte y no una mezcla.

            La primera version recortaba: la silueta dibujada dos veces, cada una
            dentro de un `ClipPath` con un `Rect`. En web se veia bien y en
            Android salia el iceberg **entero del color del agua**, porque el
            recorte del hielo no se aplicaba y ese trozo no llegaba a pintarse.
            Un degradado no depende de que el recorte funcione: es un relleno, y
            un relleno se pinta igual en las dos plataformas.

            Debajo del corte sigue oscureciendose con la profundidad. Los dos
            extremos son colores de la serie de graficos, no inventados.
          */}
          <LinearGradient id="hieloYAgua" x1="0" y1="0" x2="0" y2={ALTO} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={theme.hieloSobreAgua} />
            <Stop offset={corte} stopColor={theme.hieloSobreAgua} />
            <Stop offset={corte} stopColor={agua} />
            <Stop offset="1" stopColor={profundidad} />
          </LinearGradient>

          {/*
            La rampa de sombra. Va aparte del degradado de hielo y agua porque
            hace otra cosa: aquel dice **que material** hay a cada altura, esta
            dice **cuanta luz** llega a cada punto. Se multiplican.
          */}
          <LinearGradient
            id="rampaDeLuz"
            x1={DE_LA_LUZ.x1}
            y1={DE_LA_LUZ.y1}
            x2={DE_LA_LUZ.x2}
            y2={DE_LA_LUZ.y2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={theme.sobreElHielo} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.sobreElHielo} stopOpacity={1} />
          </LinearGradient>

          {/* El reflejo se apaga hacia adentro de la faceta: si fuera parejo se
              leeria como una mancha y no como un brillo. */}
          <LinearGradient
            id="rampaDeBrillo"
            x1={DE_LA_LUZ.x1}
            y1={DE_LA_LUZ.y1}
            x2={DE_LA_LUZ.x2}
            y2={DE_LA_LUZ.y2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={theme.brilloDelHielo} stopOpacity={1} />
            <Stop offset="0.45" stopColor={theme.brilloDelHielo} stopOpacity={0} />
          </LinearGradient>
          {/*
            El lado del mosaico va en unidades del `viewBox`: 100 sobre un
            dibujo de 200 x 236 deja la textura repetida dos veces de ancho, que
            es donde las grietas quedan del grosor de una grieta y no de una
            cuerda.
          */}
          <Pattern
            id="texturaDeHielo"
            patternUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={LADO_DEL_MOSAICO}
            height={LADO_DEL_MOSAICO}
          >
            <Image
              href={TEXTURA}
              x={0}
              y={0}
              width={LADO_DEL_MOSAICO}
              height={LADO_DEL_MOSAICO}
              preserveAspectRatio="none"
              opacity={FUERZA_DE_LA_TEXTURA}
            />
          </Pattern>
        </Defs>

        <Path d={RUTA} fill="url(#hieloYAgua)" />

        {/*
          Las facetas van **encima** del degradado y semitransparentes, no con
          color propio: asi la que cruza la linea de agua se tiñe sola de hielo
          arriba y de agua abajo, sin tener que saber donde esta la linea.
        */}
        {FACETAS.map(({ puntos, tono }) => {
          const clave = `${puntos[0]![0]}-${puntos[0]![1]}-${puntos[1]![0]}`;
          // De 0 en la cara mas iluminada a 1 en la mas de espaldas.
          const sombra = (1 - tono) / 2;
          const ruta = toPathData(puntos);
          return (
            <React.Fragment key={clave}>
              <Path
                d={ruta}
                fill="url(#rampaDeLuz)"
                fillOpacity={sombra * SOMBRA_MAXIMA}
                stroke={theme.sobreElHielo}
                strokeOpacity={ARISTA}
                strokeWidth={0.5}
              />
              {/* El reflejo, solo en las caras que miran a la luz. */}
              {tono > TONO_CON_BRILLO ? (
                <Path
                  d={ruta}
                  fill="url(#rampaDeBrillo)"
                  fillOpacity={(tono - TONO_CON_BRILLO) / (1 - TONO_CON_BRILLO) * BRILLO_MAXIMO}
                />
              ) : null}
            </React.Fragment>
          );
        })}

        {/*
          La textura, encima de todo y **con la silueta como forma**: se pinta
          rellenando el mismo camino con un patron, no recortando una imagen.
          Recortar es lo que fallo en Android; rellenar es lo que siempre
          funciona.

          Respira en un solo nodo animado. Animar la imagen misma haria que el
          hielo pareciera deslizarse; lo que cambia es cuanta luz le llega.
        */}
        <AnimatedG opacity={brillo}>
          <Path d={RUTA} fill="url(#texturaDeHielo)" />
        </AnimatedG>

        {/* La linea de agua cruza entera, no solo el ancho del hielo: es el
            nivel del mar, no un borde de la figura. Cuando la dibuja la
            pantalla, aca se omite para no pintarla dos veces. */}
        {dibujarLinea ? (
          <Line
            x1={0}
            y1={linea}
            x2={ANCHO}
            y2={linea}
            stroke={theme.acento}
            strokeWidth={2}
          />
        ) : null}
      </Svg>
    </View>
  );
}
