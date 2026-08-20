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
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** Por encima de las filas de contenido, por debajo del botón flotante. */
const CAPA = 30;

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

  return (
    <View style={styles.raiz}>
      <View onLayout={(evento) => setAlto(evento.nativeEvent.layout.height)}>
        {disparador}
      </View>
      {abierto ? <View style={[styles.panel, { top: alto }]}>{panel}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { zIndex: CAPA },
  panel: { position: 'absolute', left: 0, right: 0, zIndex: CAPA },
});
