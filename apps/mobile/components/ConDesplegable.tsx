/**
 * Un disparador con su panel abriéndose encima del contenido, sin empujarlo.
 *
 * El panel va absoluto, anclado justo debajo del disparador (medido con
 * `onLayout`, porque la fila cambia de alto según lo que tenga). Ser absoluto
 * tiene un costo: no le suma alto a nadie, y dentro de un `ScrollView` se podía
 * pasar del borde de la pantalla sin forma de alcanzarlo. Por eso el panel se
 * mide contra la ventana y nunca pide más de lo que hay:
 *
 * - `measureInWindow` da coordenadas de pantalla, que es lo que importa.
 * - A la ventana se le descuentan los márgenes del sistema: en Android la barra
 *   de gestos es parte de la ventana pero no es sitio.
 * - Si abajo no entra un panel usable, abre hacia arriba.
 * - Lo que sobra viaja por contexto (`useAltoDisponible`) hasta la lista, que se
 *   encoge y desplaza por dentro.
 *
 * La raíz se eleva solo mientras el panel se ve. Elevada siempre, un
 * desplegable cerrado empataba con uno abierto, y en Android pasa seguido: la
 * nueva arquitectura aplana las vistas que solo ordenan el layout, así que el
 * campo de un desplegable cerrado puede quedar como hermano del abierto. En un
 * empate gana el que viene después, y el panel abierto quedaba debajo.
 */

import { capas } from '@iceberg/ui';
import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer } from './Aparecer';

/** Aire entre el panel y el borde de la pantalla. */
const AIRE = 12;

/** Con menos de unas tres filas abajo, conviene abrir hacia arriba. */
const MINIMO = 132;

interface Sitio {
  readonly arriba: boolean;
  readonly maximo: number;
}

/** Va por contexto porque el panel lo arma quien llama, ya construido. */
const AltoDisponible = createContext<number | null>(null);

/** Cuánto alto tiene el panel para ocupar, o `null` si todavía no se midió. */
export function useAltoDisponible(): number | null {
  return useContext(AltoDisponible);
}

export function ConDesplegable(
  { disparador, panel, abierto }: {
    disparador: ReactNode;
    /** Se ignora si `abierto` es falso. */
    panel: ReactNode;
    abierto: boolean;
  },
) {
  const [alto, setAlto] = useState(0);
  const [sitio, setSitio] = useState<Sitio | null>(null);
  // Arriba desde que se abre hasta que el panel terminó de desvanecerse.
  const [encima, setEncima] = useState(abierto);
  const raiz = useRef<View>(null);
  const { height: pantalla } = useWindowDimensions();
  const margenes = useSafeAreaInsets();

  useEffect(() => {
    if (abierto) setEncima(true);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    raiz.current?.measureInWindow((_x, y, _ancho, altoDelDisparador) => {
      const abajo = pantalla - margenes.bottom - (y + altoDelDisparador) - AIRE;
      const arriba = y - margenes.top - AIRE;
      // Abajo mientras sea usable, que es hacia donde apunta el caret.
      const cabeAbajo = abajo >= MINIMO || abajo >= arriba;
      setSitio({
        arriba: !cabeAbajo,
        maximo: Math.max(cabeAbajo ? abajo : arriba, 0),
      });
    });
  }, [abierto, pantalla, margenes.top, margenes.bottom, alto]);

  const posicion = sitio?.arriba ? { bottom: alto } : { top: alto };

  return (
    <View ref={raiz} style={encima ? styles.encima : undefined} collapsable={false}>
      <View onLayout={(evento) => setAlto(evento.nativeEvent.layout.height)}>
        {disparador}
      </View>
      <Aparecer
        visible={abierto}
        alOcultarse={() => setEncima(false)}
        // El `maxHeight` es el cinturón: aunque un panel ignore el contexto,
        // no se pasa del sitio que hay.
        estilo={[styles.panel, posicion, sitio ? { maxHeight: sitio.maximo } : null]}
      >
        <AltoDisponible.Provider value={sitio?.maximo ?? null}>
          {panel}
        </AltoDisponible.Provider>
      </Aparecer>
    </View>
  );
}

const styles = StyleSheet.create({
  encima: { zIndex: capas.desplegable },
  panel: { position: 'absolute', left: 0, right: 0, zIndex: capas.desplegable, overflow: 'hidden' },
});
