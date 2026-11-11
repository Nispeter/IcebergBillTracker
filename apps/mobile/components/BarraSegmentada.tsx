/**
 * La barra del gasto por categoría, en muescas de un valor fijo: además de
 * comparar largos, se pueden contar. Las vacías quedan como marcas cortas que
 * dan la escala sin pesar más que el dato, y la esquina viva la aleja de una
 * barra de progreso de sistema.
 */

import { charts, elevation, notchesFor } from '@iceberg/ui';
import { StyleSheet, View } from 'react-native';
import { useTema } from '../datos/tema';

const ALTO = 14;
const ALTO_VACIA = 4;

export function BarraSegmentada(
  { valor, unidad, total, apagada }: {
    /** Monto de esta fila, en pesos enteros. */
    valor: number;
    /** Cuánto vale cada muesca. Sale de `niceUnit`. */
    unidad: number;
    /** Muescas de la pista: las que ocupa la fila más grande. */
    total: number;
    /** Fuera del reparto: conserva el largo, que dice cuánto era, y pierde el color. */
    apagada?: boolean;
  },
) {
  const { theme } = useTema();
  const llenas = notchesFor(valor, unidad);

  return (
    <View style={styles.pista}>
      {Array.from({ length: total }, (_, i) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          style={
            i < llenas
              ? [styles.llena, { backgroundColor: apagada === true ? theme.hairline : charts[0] }]
              : [styles.vacia, { backgroundColor: theme.hairline }]
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Las muescas reparten el ancho con flex: la barra se adapta sin medir.
  pista: { flex: 1, flexDirection: 'row', alignItems: 'center', height: ALTO, gap: 2 },
  llena: { flex: 1, height: ALTO },
  vacia: { flex: 1, height: elevation.hairlineWidth * ALTO_VACIA },
});
