/**
 * El encabezado de una sección, sin regla: lo que separa es el aire de arriba,
 * que es más que el de abajo.
 *
 * `separado` cierra el bloque anterior con una hairline, para pantallas donde
 * las secciones se ven todas iguales (Ajustes). Donde el contenido ya forma
 * bloques, la línea sobra. La `i` va pegada al título, que es lo que explica.
 */

import { elevation, spacing } from '@iceberg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ayuda } from './Ayuda';
import { useEstilos, type Estilo } from '../datos/estilos';

export function Titulo(
  { texto, ayuda, estilo, derecha, separado, primero }: {
    texto: string;
    /** Si viene, agrega la `i` que abre esta explicación. */
    ayuda?: string;
    estilo?: StyleProp<ViewStyle>;
    /** Algo alineado al otro extremo: un "vs. julio", un contador. */
    derecha?: ReactNode;
    separado?: boolean;
    /** El primero de la pantalla: el título de la vista ya le da el aire. */
    primero?: boolean;
  },
) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={[separado && styles.separado, estilo]}>
      <View style={[styles.fila, primero && styles.primero]}>
        <Text style={styles.texto} accessibilityRole="header">{texto}</Text>
        {ayuda === undefined ? null : <Ayuda titulo={texto} texto={ayuda} />}
        {derecha === undefined ? null : <View style={styles.derecha}>{derecha}</View>}
      </View>
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    primero: { marginTop: 0 },
    // Como borde del contenedor, el aire de la fila queda entre la línea y el
    // título: la línea se lee pegada a lo que termina.
    separado: {
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
      marginTop: spacing.xl,
    },
    texto: t.seccion,
    derecha: { flex: 1, alignItems: 'flex-end' },
  });
}
