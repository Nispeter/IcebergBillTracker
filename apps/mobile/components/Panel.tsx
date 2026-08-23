/**
 * Un grupo de datos, hundido.
 *
 * Es la unica forma de profundidad que le sirve a este proyecto. La obvia serian
 * sombras, y no funcionan: sobre la noche polar una sombra negra es invisible,
 * por eso las interfaces oscuras resuelven la elevacion con **luminosidad**. El
 * checklist anti-generico ademas las prohibe explicitamente --"sin sombras
 * `elevation` por defecto"--, y con razon: son la marca de casa del panel
 * generado.
 *
 * Se hunde en vez de levantarse, que es lo coherente con la metafora: lo que
 * esta mas hondo esta mas lejos de la luz. `superficie` sigue existiendo para lo
 * que **flota** por encima del contenido --hojas, menus, desplegables--.
 *
 * ## Cuando usarlo
 *
 * Para **datos agrupados**: dos o mas filas de etiqueta y valor que se leen
 * juntas. Ahi el panel hace un trabajo que una linea horizontal no puede hacer,
 * que es decir donde **termina** el grupo.
 *
 * Para acciones **no**. Un recuadro alrededor de dos botones es una caja por
 * nada, y una pantalla entera de tarjetas con el mismo padding es justo lo que
 * el checklist llama generico. La regla es: los datos viven en paneles, las
 * acciones viven sueltas en la pagina.
 */

import { radii, spacing, type Theme } from '@iceberg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export function Panel(
  { theme, children, estilo }: { theme: Theme; children: ReactNode; estilo?: StyleProp<ViewStyle> },
) {
  return <View style={[crearEstilos(theme).panel, estilo]}>{children}</View>;
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    panel: {
      backgroundColor: theme.superficieHonda,
      borderRadius: radii.md,
      // Mas abajo que arriba, y no por capricho: la ultima fila quedaba pegada
      // al borde del panel mientras la primera tenia el titulo de la seccion
      // dandole aire. Sin esto el grupo se lee cortado por abajo.
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.md,
    },
  });
}
