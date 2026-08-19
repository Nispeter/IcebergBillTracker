/**
 * Un `?` chico que abre una burbuja con la explicacion.
 *
 * La alternativa era dejar la frase escrita siempre, y eso convierte cada
 * definicion en ruido permanente para quien ya la sabe —que despues de la
 * primera semana es siempre—. Con el `?` la explicacion esta cuando se busca y
 * no ocupa cuando no.
 *
 * La burbuja va **absoluta**, no en el flujo: abrir una ayuda no puede correr
 * media pantalla hacia abajo. Se cierra tocando el mismo `?`.
 *
 * No es hover: en Android no hay puntero. Es tocar.
 */

import { elevation, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function Ayuda({ texto, theme }: { texto: string; theme: Theme }) {
  const styles = crearEstilos(theme);
  const [abierta, setAbierta] = useState(false);

  return (
    <View style={styles.raiz}>
      <Pressable
        onPress={() => setAbierta(!abierta)}
        style={[styles.boton, abierta && styles.botonAbierto]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Qué significa esto"
        accessibilityState={{ expanded: abierta }}
      >
        <Text style={[styles.signo, abierta && styles.signoAbierto]}>?</Text>
      </Pressable>

      {abierta ? (
        <View style={styles.burbuja}>
          <Text style={styles.texto}>{texto}</Text>
        </View>
      ) : null}
    </View>
  );
}

const LADO = 16;

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    // El `zIndex` va tambien en la raiz, no solo en la burbuja: sin el, la
    // burbuja solo compite dentro de este subarbol y cualquier hermano que
    // venga despues en el orden del documento le pasa por encima.
    raiz: { position: 'relative', zIndex: 20 },
    boton: {
      width: LADO,
      height: LADO,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    botonAbierto: { backgroundColor: theme.acento, borderColor: theme.acento },
    signo: { fontFamily: fonts.ui, fontWeight: pesos.bold, fontSize: 10, lineHeight: 12, color: theme.silencio },
    signoAbierto: { color: theme.sobreAcento },
    // Anclada a la derecha del `?`: asi crece hacia adentro de la pantalla y no
    // se sale por el borde cuando el boton esta en una esquina.
    burbuja: {
      position: 'absolute',
      top: LADO + spacing.xs,
      right: 0,
      width: 232,
      padding: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
      zIndex: 20,
    },
    texto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 17, color: theme.tinta },
  });
}
