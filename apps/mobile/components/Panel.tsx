/**
 * Un grupo de datos, hundido, y sus filas.
 *
 * Se hunde en vez de levantarse: sobre la noche polar una sombra es invisible,
 * así que la profundidad se hace con luminosidad, y lo más hondo está más lejos
 * de la luz. `superficie` queda para lo que flota encima (hojas, menús).
 *
 * Solo para datos agrupados: ahí el panel dice dónde termina el grupo, cosa que
 * una línea no puede. Para acciones no: los datos viven en paneles y las
 * acciones, sueltas.
 */

import { radii, spacing } from '@iceberg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useEstilos, type Estilo } from '../datos/estilos';

export function Panel({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  const styles = useEstilos(crearEstilos);
  return <View style={[styles.panel, estilo]}>{children}</View>;
}

/** Una fila de etiqueta y valor dentro de un `Panel`. */
export function Dato(
  { etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string },
) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.dato}>
      <View style={styles.fila}>
        <Text style={styles.etiqueta}>{etiqueta}</Text>
        <Text style={styles.valor} numberOfLines={1}>{valor}</Text>
      </View>
      {nota === undefined ? null : <Text style={styles.nota}>{nota}</Text>}
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    panel: {
      backgroundColor: theme.superficieHonda,
      borderRadius: radii.md,
      // Más abajo que arriba: la primera fila tiene el título encima dándole aire.
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    dato: { paddingVertical: 5, gap: 1 },
    fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
    // El gris de siempre no pasa AA sobre el fondo hundido en el tema claro.
    etiqueta: { ...t.etiqueta, color: theme.silencioHondo },
    valor: { ...t.cifra, fontWeight: t.accion.fontWeight, flexShrink: 1, textAlign: 'right' },
    nota: { ...t.nota, color: theme.silencioHondo },
  });
}
