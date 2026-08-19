/**
 * Barra segmentada: la escala del gasto por categoria.
 *
 * En vez de una pildora continua —que solo deja comparar largos y es el patron
 * por defecto de cualquier framework— la barra se divide en muescas discretas
 * de un valor fijo. Se lee como un instrumento de medicion: no solo se compara,
 * se **cuenta**.
 *
 * Las muescas vacias quedan como marcas cortas en vez de un riel macizo. Dan la
 * escala —hasta donde podria llegar— sin pesar mas que el dato.
 *
 * Sin `borderRadius`: la esquina viva es parte de que no se lea como una barra
 * de progreso de sistema operativo.
 */

import { charts, elevation, notchesFor, type Theme } from '@iceberg/ui';
import { StyleSheet, View } from 'react-native';

export interface BarraSegmentadaProps {
  /** Monto de esta fila, en pesos enteros. */
  readonly valor: number;
  /** Cuanto vale cada muesca, en pesos enteros. Sale de `niceUnit`. */
  readonly unidad: number;
  /** Muescas totales de la pista: las que ocupa la fila mas grande. */
  readonly total: number;
  readonly theme: Theme;
}

const ALTO = 14;
const ALTO_VACIA = 4;

export function BarraSegmentada({ valor, unidad, total, theme }: BarraSegmentadaProps) {
  const llenas = notchesFor(valor, unidad);

  return (
    <View style={styles.pista}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={
            i < llenas
              ? [styles.llena, { backgroundColor: charts[0] }]
              : [styles.vacia, { backgroundColor: theme.hairline }]
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Las muescas reparten el ancho con flex, asi la barra se adapta a la
  // pantalla sin tener que medirla.
  pista: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: ALTO,
    gap: 2,
  },
  llena: { flex: 1, height: ALTO },
  vacia: { flex: 1, height: elevation.hairlineWidth * ALTO_VACIA },
});
