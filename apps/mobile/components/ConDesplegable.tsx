/**
 * Un disparador con su panel abriéndose **encima** del contenido.
 *
 * Antes los desplegables entraban en el flujo: abrir el filtro de categorías
 * empujaba la lista de movimientos doscientos píxeles hacia abajo, y al cerrarlo
 * volvía de golpe. Uno pierde el lugar donde estaba mirando cada vez.
 *
 * El panel va absoluto, anclado **justo debajo del disparador**. Ese "justo
 * debajo" se mide con `onLayout` en vez de calcularse: la fila del disparador
 * cambia de alto según lo que tenga —un chip, dos, una etiqueta arriba— y
 * cualquier número fijo quedaría mal en alguna pantalla.
 *
 * El `zIndex` va en la raíz y no solo en el panel. Compite dentro de su propio
 * contexto de apilado, así que sin él cualquier hermano posterior en el orden
 * del documento le pasa por encima. Es el mismo problema que tuvo la burbuja de
 * `Ayuda`.
 *
 * ## Por qué el panel se salía de la pantalla
 *
 * Ser absoluto tiene un costo que tardó en aparecer: **no le suma alto a nadie**.
 * El desplegable de categorías vive dentro del `ScrollView` del formulario, y al
 * abrirse el contenido del scroll seguía midiendo lo mismo que antes. El panel
 * se dibujaba hacia abajo, se pasaba del borde de la pantalla, y no había a
 * dónde desplazarse para alcanzarlo: las últimas categorías eran inelegibles.
 *
 * Reservar el hueco en el flujo lo arreglaría y traería de vuelta el empujón que
 * este componente existe para evitar. Lo que se hace es lo contrario: **el panel
 * se mide contra la pantalla y nunca pide más de lo que hay**.
 *
 * - Se mide dónde quedó el disparador con `measureInWindow`, que da coordenadas
 *   de pantalla y no del padre. `onLayout` no sirve para esto: dice dónde está
 *   dentro de su contenedor, que es justo lo que no importa acá.
 * - Si abajo no entra un panel usable, se abre **hacia arriba**. Un disparador
 *   al pie de la pantalla es el caso normal, no el raro.
 * - El alto que sobra viaja por contexto hasta el panel, que se encoge y
 *   desplaza por dentro.
 *
 * El `maxHeight` del contenedor es el cinturón: aunque un panel ignore el
 * contexto, no puede pasarse del sitio que hay.
 */

import { capas } from '@iceberg/ui';
import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Aparecer } from './Aparecer';

/** Por encima de las filas de contenido y del botón flotante. */
const CAPA = capas.desplegable;

/** Aire entre el panel y el borde de la pantalla. */
const AIRE = 12;

/**
 * Menos que esto abajo y conviene abrir hacia arriba.
 *
 * Son unas tres filas. Con menos, el panel se lee como una ranura: hay que
 * desplazar desde la primera opción y no se ve que la lista siga.
 */
const MINIMO = 132;

interface Sitio {
  readonly arriba: boolean;
  readonly maximo: number;
}

/**
 * Cuánto alto tiene el panel para ocupar, o `null` si todavía no se midió.
 *
 * Va por contexto y no por prop porque el panel lo arma el llamador: `panel` es
 * un `ReactNode` ya construido, y meterle una prop desde acá obligaría a
 * cambiar la firma en los siete lugares que lo usan.
 */
export const AltoDisponible = createContext<number | null>(null);

export function useAltoDisponible(): number | null {
  return useContext(AltoDisponible);
}

export function ConDesplegable(
  { disparador, panel, abierto }: {
    /** La fila que se toca. Su alto decide dónde empieza el panel. */
    disparador: ReactNode;
    /** Lo que se muestra al abrir. Se ignora si `abierto` es falso. */
    panel: ReactNode;
    abierto: boolean;
  },
) {
  const [alto, setAlto] = useState(0);
  const [sitio, setSitio] = useState<Sitio | null>(null);
  const raiz = useRef<View>(null);
  const { height: pantalla } = useWindowDimensions();

  useEffect(() => {
    if (!abierto) return;
    raiz.current?.measureInWindow((_x, y, _ancho, altoDelDisparador) => {
      const abajo = pantalla - (y + altoDelDisparador) - AIRE;
      const arriba = y - AIRE;
      // Se prefiere abajo mientras sea usable: es hacia donde el caret apunta.
      // Solo se da vuelta cuando arriba hay bastante más.
      const cabeAbajo = abajo >= MINIMO || abajo >= arriba;
      setSitio({
        arriba: !cabeAbajo,
        maximo: Math.max(cabeAbajo ? abajo : arriba, 0),
      });
    });
  }, [abierto, pantalla, alto]);

  const posicion = sitio?.arriba ? { bottom: alto } : { top: alto };

  return (
    <View ref={raiz} style={styles.raiz} collapsable={false}>
      <View onLayout={(evento) => setAlto(evento.nativeEvent.layout.height)}>
        {disparador}
      </View>
      {/* `Aparecer` lo mantiene montado mientras se va, para que la
          animacion de salida llegue a verse. */}
      <Aparecer
        visible={abierto}
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
  raiz: { zIndex: CAPA },
  panel: { position: 'absolute', left: 0, right: 0, zIndex: CAPA, overflow: 'hidden' },
});
