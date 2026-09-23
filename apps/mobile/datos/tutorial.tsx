/**
 * El tutorial de bienvenida: doce pasos sobre el Resumen, saltables.
 *
 * La primera vez que la app abre, el pinguino cuenta que significa cada cosa de
 * la pantalla mientras la va iluminando: el saldo, el periodo, el iceberg, la
 * lista, la `i` de las explicaciones, y despues uno por uno los seis destinos de
 * la barra de abajo y el mas del medio. Se sale en cualquier momento con la
 * equis, y se vuelve a ver desde Ajustes.
 *
 * ## Las pantallas no saben que existe
 *
 * No hay una sola rama de "si el tutorial esta abierto" en ninguna vista. Lo
 * unico que hacen es colgar un `ref` de este registro: `ref={ancla('saldo')}`.
 * El proveedor mide cada uno con `measureInWindow`, que devuelve coordenadas de
 * **ventana** y por eso sirve para anclas de tres arboles distintos --el
 * Resumen, el encabezado de `Pantalla` y la barra de `_layout`-- sin que ninguno
 * tenga que saber donde esta el otro. Es la misma primitiva que `ConDesplegable`
 * ya usa, y se porta igual en Android y en web.
 *
 * Todo elemento anclado lleva ademas `collapsable={false}`: Android colapsa en
 * el arbol nativo cualquier vista **que no dibuje nada propio** --sin fondo, sin
 * borde-- tenga hijos o no, y una vista colapsada no se puede medir. En web no
 * pasa, asi que sin la marca se ve bien mientras se desarrolla y se rompe en el
 * telefono.
 *
 * ## El hueco son cuatro rectangulos, no una mascara
 *
 * Se podria recortar con una mascara SVG, pero el velo ademas tiene que
 * **bloquear los toques** --durante el tutorial, tocar el saldo avanza, no abre
 * su detalle-- y `pointerEvents` sobre un `Svg` no se comporta igual en las dos
 * plataformas. Con cuatro vistas alrededor del hueco el bloqueo lo da el
 * `Pressable` de la raiz, que es lo mismo que hace cualquier otra capa de la
 * app, y la opacidad se anima con el driver nativo.
 *
 * ## Los rectangulos se recortan contra la franja util
 *
 * Dos veces, y las dos por un caso real:
 *
 * - **Contra la ventana a lo ancho.** La escena del iceberg se sale del padding
 *   del contenido a proposito, para que la linea de agua llegue a los dos
 *   bordes. Crecida por la holgura, medía mas que la pantalla y los lados del
 *   velo pedian ancho negativo.
 * - **Contra la zona de contenido a lo alto.** El encabezado esta arriba y la
 *   barra de abajo se dibuja **encima** del contenido: sin descontarla, un paso
 *   podia iluminar algo que la barra estaba tapando.
 *
 * Si el ancla queda fuera de la franja, la pantalla **corre su contenido** una
 * vez y se vuelve a medir: los ultimos movimientos caen bajo el pliegue en
 * cualquier telefono, y sin esto ese paso seria un velo entero con una burbuja
 * hablando de una lista que no se ve. Una vez y no en bucle: si el ancla es mas
 * alta que la franja --la lista con la letra en enorme-- correr no la hace
 * caber, y ahi se ilumina lo que se ve.
 */

import { ALTO_DE_LA_BARRA, capas, elevation, fonts, pesos, radii, spacing, type Letra, type Theme } from '@iceberg/ui';
import { CLAVE_TUTORIAL_VISTO, escribirAjuste, leerAjuste } from '@iceberg/db';
import { X } from 'phosphor-react-native/src/icons/X';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import {
  Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DialogoDelPinguino } from '../components/DialogoDelPinguino';
import { useDatos } from './BaseDeDatos';
import { useLetra } from './letra';

/**
 * Cada cosa que el tutorial puede iluminar.
 *
 * Las seis ultimas son **las rutas** de los destinos de la barra de abajo, que
 * es lo que esa barra ya tiene a mano para cada casilla: asi no hay que
 * mantener una segunda lista de nombres en paralelo a la de destinos.
 */
export type Ancla =
  | 'saldo' | 'periodo' | 'iceberg' | 'ayuda' | 'lista' | 'mas'
  | '/' | '/categorias' | '/calendario' | '/tempanos' | '/movimientos' | '/ajustes';

interface Paso {
  readonly ancla: Ancla;
  readonly texto: string;
  /**
   * Si el ancla vive dentro del contenido que se desplaza.
   *
   * Solo esas se traen a la vista corriendo la pantalla. Las del encabezado y
   * las de la barra de abajo estan **siempre** a la vista y fuera del scroll:
   * sin esta marca, el paso del periodo pediria correr el Resumen por estar
   * pegado al techo, y los de la barra por estar pegados al pie.
   */
  readonly desplaza?: boolean;
}

/**
 * Los doce pasos, en el orden en que se recorre la pantalla.
 *
 * Primero lo que se ve de arriba abajo en el Resumen, despues como pedir mas, y
 * al final a donde se puede ir. El orden importa: nadie entiende "Categorias"
 * antes de saber que la app habla de un periodo.
 */
const PASOS: readonly Paso[] = [
  {
    ancla: 'saldo',
    desplaza: true,
    texto: 'Este es tu **saldo disponible**. Sale de todo tu historial, no del período: '
      + 'el saldo inicial de tus cuentas, más todo lo que entró, menos todo lo que salió.',
  },
  {
    ancla: 'periodo',
    texto: 'Acá eliges **qué tramo de tiempo** estás mirando. Las flechas te mueven al '
      + 'anterior y al siguiente, y tocando el nombre cambias entre día, semana, mes, año '
      + 'o un rango que elijas tú.\n\nManda sobre toda la app: cambiarlo cambia todas las '
      + 'pantallas a la vez.',
  },
  {
    ancla: 'iceberg',
    desplaza: true,
    texto: 'El iceberg reparte tu gasto en dos. Sobre la línea de agua, lo **comprometido**: '
      + 'lo que llega igual todos los meses, como el arriendo o las cuentas. Bajo el agua, '
      + 'lo **variable**: lo que decides tú.\n\nEso de abajo es lo único sobre lo que '
      + 'puedes actuar, y por eso es la parte grande.',
  },
  {
    ancla: 'lista',
    desplaza: true,
    texto: 'Tus **últimos movimientos** del período. Tocar uno lo abre para editarlo o '
      + 'borrarlo, y el punto ámbar marca un gasto raro para ese comercio.',
  },
  {
    ancla: 'ayuda',
    desplaza: true,
    texto: 'Cada **i** como esta abre una explicación mía. Están por toda la app, al lado '
      + 'de lo que no se explica solo.\n\nY casi toda cifra se puede tocar para ver de '
      + 'dónde sale.',
  },
  { ancla: '/', texto: 'Acá estás ahora: el **Resumen**, cómo vas en el período.' },
  {
    ancla: '/categorias',
    texto: '**Categorías**: en qué se te va la plata. Acá puedes apagar una para ver mejor '
      + 'cómo se reparte el resto.',
  },
  { ancla: '/calendario', texto: '**Día a día**: el mes como calendario, con lo que gastaste cada día.' },
  {
    ancla: '/tempanos',
    texto: '**Témpanos**: lo que viene. Las cuentas que se repiten, con lo que falta por '
      + 'pagar y lo que ya está vencido.',
  },
  { ancla: '/movimientos', texto: '**Movimientos**: la lista completa, con filtros por tipo y categoría.' },
  {
    ancla: '/ajustes',
    texto: '**Ajustes**: tus cuentas, las categorías, importar la cartola del banco, el '
      + 'respaldo y la sincronización.\n\nDesde acá también puedes volver a ver esto.',
  },
  {
    ancla: 'mas',
    texto: 'Y este es el botón que vas a usar siempre: **agregar un gasto o un ingreso**.\n\n'
      + 'Eso es todo. Que te sirva.',
  },
];

/** Cuanto se agranda el hueco alrededor de lo que ilumina. */
const HOLGURA = 8;

/** Lo que se oscurece el resto de la pantalla. El mismo velo de siempre. */
const OPACIDAD_VELO = 0.82;

/** Cuantos fotogramas se espera a que un ancla tenga tamaño antes de rendirse. */
const INTENTOS = 30;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

interface ValorDelTutorial {
  /** Devuelve el `ref` que registra ese elemento como ancla. */
  readonly ancla: (nombre: Ancla) => (nodo: View | null) => void;
  /** Registra la zona donde vive el contenido, entre el encabezado y la barra. */
  readonly zona: (nodo: View | null) => void;
  /**
   * Registra como correr el contenido de la pantalla, si es que se desplaza.
   *
   * Recibe cuantos pixeles hay que moverse --positivo hacia abajo-- y es la
   * pantalla la que sabe como hacerlo. Solo lo necesita el Resumen: sus anclas
   * viven dentro de un scroll y la de la lista cae bajo el pliegue en cualquier
   * telefono.
   */
  readonly registrarDesplazador: (desplazar: ((dy: number) => void) | null) => void;
  /** Vuelve a mostrar el tutorial desde el primer paso. */
  readonly mostrar: () => void;
}

const Contexto = createContext<ValorDelTutorial>({
  ancla: () => () => {},
  zona: () => {},
  registrarDesplazador: () => {},
  mostrar: () => {},
});

/** El `ref` de un elemento que el tutorial puede iluminar. */
export function useAncla(): (nombre: Ancla) => (nodo: View | null) => void {
  return useContext(Contexto).ancla;
}

/** El `ref` del contenedor del contenido. Lo pone `Pantalla`, una sola vez. */
export function useZonaDeContenido(): (nodo: View | null) => void {
  return useContext(Contexto).zona;
}

/**
 * Le presta al tutorial la forma de correr el contenido de esta pantalla.
 *
 * `desplazar` tiene que ser estable --un `useCallback`-- porque se registra en
 * un efecto: una funcion nueva por render lo haria correr en cada uno.
 */
export function useDesplazadorDelTutorial(desplazar: (dy: number) => void): void {
  const { registrarDesplazador } = useContext(Contexto);
  useEffect(() => {
    registrarDesplazador(desplazar);
    return () => registrarDesplazador(null);
  }, [registrarDesplazador, desplazar]);
}

/** Vuelve a lanzar el tutorial. Lo llama Ajustes. */
export function useMostrarTutorial(): () => void {
  return useContext(Contexto).mostrar;
}

export function ProveedorDeTutorial(
  { theme, children }: { theme: Theme; children: ReactNode },
) {
  const { db } = useDatos();

  /**
   * Arranca solo si nunca se vio.
   *
   * En el inicializador de `useState`, que corre una sola vez: leer el ajuste en
   * cada render seria una consulta por fotograma. Y no hace falta que sea
   * reactivo, porque el unico que lo escribe es este mismo proveedor.
   */
  const [paso, setPaso] = useState<number | null>(
    () => ((leerAjuste(db, CLAVE_TUTORIAL_VISTO) ?? '') === '' ? 0 : null),
  );

  const nodos = useRef(new Map<Ancla, View>());
  const refs = useRef(new Map<Ancla, (nodo: View | null) => void>());
  const zonaNodo = useRef<View | null>(null);
  const desplazador = useRef<((dy: number) => void) | null>(null);

  /**
   * Cuantas anclas se han registrado. Sirve de aviso, no de dato.
   *
   * Sin esto el tutorial se queda esperando para siempre a un ancla que todavia
   * no existe. Pasa de verdad al lanzarlo desde Ajustes: el velo se monta
   * mientras la pantalla que tiene el ancla ni siquiera empezo a navegar, y
   * cuando llega no hay nada que le avise. Es un contador y no la lista porque
   * lo unico que hace falta es que **cambie**.
   *
   * Cuesta un render del proveedor por ancla nueva, y solo del proveedor: los
   * hijos llegan como prop, asi que React reusa el mismo elemento y no vuelve a
   * dibujar el arbol.
   */
  const [registradas, setRegistradas] = useState(0);

  /**
   * El `ref` de cada ancla, memoizado por nombre.
   *
   * Si devolviera una funcion nueva en cada llamada, React la trataria como un
   * `ref` distinto y desmontaria y volveria a montar el registro en cada render
   * de la barra de abajo.
   */
  const ancla = useCallback((nombre: Ancla) => {
    const guardado = refs.current.get(nombre);
    if (guardado !== undefined) return guardado;
    const nuevo = (nodo: View | null) => {
      if (nodo === null) {
        // Solo se borra si el que se va es el que estaba puesto. Durante una
        // transicion conviven la pantalla que entra y la que sale, y sin esta
        // comparacion el desmontaje de la saliente borra el ancla que la
        // entrante acaba de registrar.
        if (nodos.current.get(nombre) !== undefined) nodos.current.delete(nombre);
        return;
      }
      const habia = nodos.current.get(nombre);
      nodos.current.set(nombre, nodo);
      // Solo cuando aparece algo que no estaba: si avisara en cada montaje, el
      // proveedor se redibujaria en cada cambio de pantalla por nada.
      if (habia === undefined) setRegistradas((cuantas) => cuantas + 1);
    };
    refs.current.set(nombre, nuevo);
    return nuevo;
  }, []);

  const zona = useCallback((nodo: View | null) => { zonaNodo.current = nodo; }, []);

  const registrarDesplazador = useCallback(
    (fn: ((dy: number) => void) | null) => { desplazador.current = fn; },
    [],
  );

  const mostrar = useCallback(() => setPaso(0), []);

  const cerrar = useCallback(() => {
    escribirAjuste(db, CLAVE_TUTORIAL_VISTO, '1');
    setPaso(null);
  }, [db]);

  // Estable: las cuatro funciones que lleva son `useCallback` sin dependencias,
  // asi que el contexto nunca cambia y no arrastra a los hijos a redibujarse.
  const valor = useMemo(
    () => ({ ancla, zona, registrarDesplazador, mostrar }),
    [ancla, zona, registrarDesplazador, mostrar],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      {paso === null ? null : (
        <Velo
          theme={theme}
          paso={paso}
          registradas={registradas}
          nodos={nodos}
          zonaNodo={zonaNodo}
          desplazador={desplazador}
          onSiguiente={() => {
            if (paso + 1 >= PASOS.length) cerrar();
            else setPaso(paso + 1);
          }}
          onSaltar={cerrar}
        />
      )}
    </Contexto.Provider>
  );
}

function Velo(
  { theme, paso, registradas, nodos, zonaNodo, desplazador, onSiguiente, onSaltar }: {
    theme: Theme;
    paso: number;
    /** Cambia cuando aparece un ancla nueva. Solo sirve para volver a medir. */
    registradas: number;
    nodos: { current: Map<Ancla, View> };
    zonaNodo: { current: View | null };
    desplazador: { current: ((dy: number) => void) | null };
    onSiguiente: () => void;
    onSaltar: () => void;
  },
) {
  const letra = useLetra();
  const margenes = useSafeAreaInsets();
  const ventana = useWindowDimensions();
  const styles = crearEstilos(theme, letra);

  const [hueco, setHueco] = useState<Rect | null>(null);
  const [zona, setZona] = useState<Rect | null>(null);
  const entrada = useRef(new Animated.Value(0)).current;
  /**
   * La franja util, en refs y no en dependencias del efecto.
   *
   * El efecto es quien mide la zona de la que salen estos dos, asi que ponerlos
   * como dependencias lo haria correr por cada medicion: mide, cambia la franja,
   * vuelve a medir. Los lee de un ref, que siempre tiene el valor del ultimo
   * render.
   */
  const techoRef = useRef(0);
  const pieRef = useRef(0);

  const actual = PASOS[paso]!;

  /**
   * Medir el ancla del paso, reintentando mientras devuelva cero.
   *
   * El primer fotograma despues de montar una pantalla suele dar ceros en
   * Android, y `Pantalla` ademas funde su contenido durante 180 ms. Se reintenta
   * por fotograma hasta `INTENTOS`; agotados, se dibuja el velo sin hueco, que
   * es feo pero no traba el tutorial.
   *
   * Cuelga del tamaño de la ventana y de los margenes por lo mismo que
   * `ConDesplegable`: un paso dura lo que el usuario tarde en leerlo, y si gira
   * el telefono o achica el navegador las coordenadas viejas quedan sobre otra
   * cosa.
   */
  useEffect(() => {
    let vivo = true;
    let intento = 0;
    // Una sola vez por paso: correr, volver a medir, y si sigue sin caber,
    // dejarlo. Medir y correr en bucle no converge cuando el ancla es mas alta
    // que la franja, que es justo el caso de la lista con la letra grande.
    let yaCorrio = false;

    const medir = () => {
      if (!vivo) return;
      zonaNodo.current?.measureInWindow((x, y, ancho, alto) => {
        if (vivo && alto > 0) setZona({ x, y, ancho, alto });
      });

      const nodo = nodos.current.get(actual.ancla);
      if (nodo === undefined) {
        // Todavia no existe. Puede ser el primer fotograma o que la pantalla
        // que lo tiene aun no monto; cuando monte, `registradas` cambia y este
        // efecto vuelve a correr.
        return;
      }

      nodo.measureInWindow((x, y, ancho, alto) => {
        if (!vivo) return;
        if (ancho === 0 || alto === 0) {
          // Android devuelve ceros en el primer fotograma, y `Pantalla` ademas
          // funde su contenido: se reintenta por fotograma un rato corto.
          intento += 1;
          if (intento < INTENTOS) requestAnimationFrame(medir);
          return;
        }

        /**
         * Si no entra en la franja util, correr el contenido y volver a medir.
         *
         * Los ultimos movimientos caen bajo el pliegue en cualquier telefono:
         * sin esto el paso mostraria un velo entero y una burbuja hablando de
         * una lista que no se ve. Lo que corre es la pantalla, que es la unica
         * que sabe como; el tutorial solo dice cuanto.
         */
        const correr = desplazador.current;
        if (actual.desplaza === true && !yaCorrio && correr !== null) {
          const dy = y < techoRef.current
            ? y - techoRef.current
            : Math.max(0, Math.min(y + alto - pieRef.current, y - techoRef.current));
          if (Math.abs(dy) > 1) {
            yaCorrio = true;
            correr(dy);
            // El fotograma siguiente, que es cuando el desplazamiento --que no
            // se anima, justamente por esto-- ya esta aplicado.
            requestAnimationFrame(() => { if (vivo) medir(); });
            return;
          }
        }

        setHueco({ x, y, ancho, alto });
      });
    };

    setHueco(null);
    medir();
    return () => { vivo = false; };
  }, [
    actual.ancla, actual.desplaza, registradas, nodos, zonaNodo, desplazador,
    ventana.width, ventana.height, margenes.top, margenes.bottom,
  ]);

  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrada]);

  /**
   * La franja donde vive el contenido que se desplaza.
   *
   * Solo se usa para decidir si hay que correr la pantalla y cuanto. El
   * encabezado esta arriba y la barra de abajo se dibuja **encima** del
   * contenido, asi que el pie util no es el fin de la zona. Sin zona medida
   * todavia se usa la ventana, que es lo mas parecido que hay.
   */
  const techo = (zona?.y ?? margenes.top) + HOLGURA;
  const pie = (zona === null ? ventana.height - margenes.bottom : zona.y + zona.alto)
    - ALTO_DE_LA_BARRA - margenes.bottom - HOLGURA;
  techoRef.current = techo;
  pieRef.current = pie;

  /**
   * Contra que se recorta el hueco, y depende de donde viva el ancla.
   *
   * - **Las del contenido**, contra la franja de contenido. Si se recortaran
   *   contra la ventana, la lista --que llega hasta el borde de abajo-- dejaria
   *   iluminada tambien la barra de navegacion, y el paso pareceria hablar de
   *   ella.
   * - **Las demas, contra la ventana entera.** Viven fuera de esa franja a
   *   proposito: el periodo esta en el encabezado y los siete botones estan en
   *   la barra, que se dibuja encima del contenido. Recortandolas contra la
   *   franja, el periodo quedaba reducido a una linea y los destinos
   *   desaparecian del todo.
   */
  const recortado = hueco === null ? null : recortar(hueco, {
    izquierda: 0,
    derecha: ventana.width,
    arriba: actual.desplaza === true ? techo : margenes.top,
    abajo: actual.desplaza === true ? pie : ventana.height - margenes.bottom,
  });

  /**
   * De que lado va la tarjeta: donde sobre mas sitio.
   *
   * Y no "abajo salvo que el hueco pase de la mitad", que era la regla facil y
   * la que fallaba: el iceberg termina pasada la mitad en un telefono, asi que
   * mandaba la tarjeta arriba, donde no entra, y terminaba encima de lo que
   * estaba explicando.
   */
  const bordeArriba = margenes.top + HOLGURA;
  const bordeAbajo = ventana.height - margenes.bottom - HOLGURA;
  const sitioArriba = recortado === null ? 0 : recortado.y - bordeArriba - HOLGURA;
  const sitioAbajo = recortado === null ? 0 : bordeAbajo - (recortado.y + recortado.alto) - HOLGURA;
  const arriba = recortado !== null && sitioArriba > sitioAbajo;
  const maximo = Math.max(arriba ? sitioArriba : sitioAbajo, 0);

  const posicion = recortado === null
    ? { top: bordeArriba, maxHeight: Math.max(bordeAbajo - bordeArriba, 0) }
    : arriba
      // Pegada al hueco por abajo y creciendo hacia arriba: si se anclara al
      // techo, con un hueco bajo quedaria una franja vacia en el medio.
      ? { bottom: ventana.height - (recortado.y - HOLGURA), maxHeight: maximo }
      : { top: recortado.y + recortado.alto + HOLGURA, maxHeight: maximo };

  return (
    <View style={styles.capa}>
      {/*
        El que se come los toques y avanza. Va primero y suelto, no envolviendo
        a los demas: un tocable que contiene otros tocables es HTML invalido en
        web --`<button>` dentro de `<button>`-- y en Android los dos se pelean
        el gesto. Asi el velo bloquea la app de abajo --tocar el saldo durante
        el tutorial sigue, no abre su detalle-- y los botones de la tarjeta,
        que se dibujan despues, lo reciben normal.
      */}
      <Pressable
        style={styles.lleno}
        onPress={onSiguiente}
        accessibilityRole="button"
        accessibilityLabel={`Paso ${paso + 1} de ${PASOS.length}. Tocar para seguir`}
      />

      {/* El velo, en cuatro pedazos alrededor del hueco, sin recibir toques. */}
      <Animated.View style={[styles.lleno, { opacity: entrada }]} pointerEvents="none">
        {recortado === null ? (
          <View style={[styles.sombra, styles.lleno]} />
        ) : (
          <>
            <View style={[styles.sombra, { top: 0, left: 0, right: 0, height: Math.max(recortado.y, 0) }]} />
            <View style={[styles.sombra, { top: recortado.y + recortado.alto, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.sombra, {
              top: recortado.y, height: recortado.alto, left: 0, width: Math.max(recortado.x, 0),
            }]} />
            <View style={[styles.sombra, {
              top: recortado.y,
              height: recortado.alto,
              left: recortado.x + recortado.ancho,
              right: 0,
            }]} />
            {/*
              El marco va en tinta y no en el acento ni en el ambar. El acento
              **es el agua** --el mismo color del degradado del fondo y de la
              linea de flotacion-- asi que sobre el iceberg no separaria nada; y
              el ambar esta reservado para el mas, que es justo una de las cosas
              que hay que enmarcar, y quedaria ambar sobre ambar.
            */}
            <View style={[styles.marco, {
              top: recortado.y, left: recortado.x, width: recortado.ancho, height: recortado.alto,
            }]} />
          </>
        )}
      </Animated.View>

      <View style={[styles.tarjeta, posicion]}>
        <View style={styles.cabecera}>
          <Text style={styles.avance}>{paso + 1}/{PASOS.length}</Text>
          <Pressable
            onPress={onSaltar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Saltar el tutorial"
          >
            <X size={14} weight="bold" color={theme.silencio} />
          </Pressable>
        </View>

        <DialogoDelPinguino theme={theme} parrafos={enParrafos(actual.texto)} tamano={36} />

        <Pressable
          onPress={onSiguiente}
          style={styles.siguiente}
          accessibilityRole="button"
          accessibilityLabel={paso + 1 >= PASOS.length ? 'Terminar el tutorial' : 'Paso siguiente'}
        >
          <Text style={styles.siguienteTexto}>
            {paso + 1 >= PASOS.length ? 'Listo' : 'Siguiente'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** El texto partido por parrafos, que es como ya vienen escritos. */
function enParrafos(texto: string): string[] {
  return texto.split('\n\n').map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * El rectangulo crecido por la holgura y recortado contra la franja util.
 *
 * Recortar y no desplazar: si el ancla no cabe entera se ilumina la parte que se
 * ve. Correr la pantalla para que entre algo mas alto que la franja es un bucle
 * --se mide, se corre, se vuelve a medir y sigue sin caber--.
 */
function recortar(
  rect: Rect,
  limite: { izquierda: number; derecha: number; arriba: number; abajo: number },
): Rect {
  const x = Math.max(rect.x - HOLGURA, limite.izquierda);
  const y = Math.max(rect.y - HOLGURA, limite.arriba);
  const derecha = Math.min(rect.x + rect.ancho + HOLGURA, limite.derecha);
  const abajo = Math.min(rect.y + rect.alto + HOLGURA, limite.abajo);
  return { x, y, ancho: Math.max(derecha - x, 0), alto: Math.max(abajo - y, 0) };
}

function crearEstilos(theme: Theme, letra: Letra) {
  const lleno = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
  return StyleSheet.create({
    capa: { ...lleno, zIndex: capas.tutorial },
    lleno,
    // El velo es el fondo de la app con opacidad, igual que en el resto de las
    // capas: un negro puro sobre la noche polar se ve como un agujero.
    sombra: { position: 'absolute', backgroundColor: theme.fondo, opacity: OPACIDAD_VELO },
    marco: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: theme.tinta,
      borderRadius: radii.sm,
    },
    tarjeta: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      maxWidth: 480 - spacing.lg * 2,
      alignSelf: 'center',
      padding: spacing.lg,
      gap: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.superficie,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    avance: {
      fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(11), color: theme.silencio,
    },
    siguiente: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    siguienteTexto: {
      fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.sm, color: theme.sobreAcento,
    },
  });
}
