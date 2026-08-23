/**
 * Un interruptor de dos estados, con la perilla que se desliza.
 *
 * La primera version de esto fueron tres botones --Automatico, Comprometido,
 * Variable-- y era demasiado aparato para una pregunta binaria que se contesta
 * de un toque. El interruptor **llega puesto** en lo que la app dedujo, y
 * cambiarlo es un gesto, no una eleccion entre tres cosas.
 *
 * El estado "automatico" no desaparecio: dejo de ser visible. Quien no lo toca
 * guarda `null` y la deduccion sigue mandando; ver `FormularioMovimiento`.
 *
 * ## El color
 *
 * Blanco para variable, cian para comprometido, como el hielo y el agua del
 * iceberg. Ojo: en el dibujo es al reves --el hielo blanco es lo comprometido y
 * el agua lo variable--, asi que si algun dia hay que unificarlos, este es el
 * que se da vuelta.
 */

import { radii, type Theme } from '@iceberg/ui';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

const ANCHO = 46;
const ALTO = 26;
const PERILLA = 20;
const MARGEN = (ALTO - PERILLA) / 2;

export function Interruptor(
  { encendido, onCambiar, theme, accesible }: {
    /** Verdadero mueve la perilla a la derecha y pinta la pista de cian. */
    encendido: boolean;
    onCambiar: (valor: boolean) => void;
    theme: Theme;
    accesible: string;
  },
) {
  const progreso = useRef(new Animated.Value(encendido ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progreso, {
      toValue: encendido ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      // El color no se puede animar en el hilo nativo; el desplazamiento si,
      // pero mezclar los dos drivers en un mismo valor tira error.
      useNativeDriver: false,
    }).start();
  }, [encendido, progreso]);

  return (
    <Pressable
      onPress={() => onCambiar(!encendido)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: encendido }}
      accessibilityLabel={accesible}
    >
      <Animated.View
        style={[
          styles.pista,
          {
            backgroundColor: progreso.interpolate({
              inputRange: [0, 1],
              outputRange: [theme.hieloSobreAgua, theme.acento],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.perilla,
            {
              backgroundColor: theme.sobreElHielo,
              transform: [{
                translateX: progreso.interpolate({
                  inputRange: [0, 1],
                  outputRange: [MARGEN, ANCHO - PERILLA - MARGEN],
                }),
              }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pista: {
    width: ANCHO,
    height: ALTO,
    borderRadius: radii.full,
    justifyContent: 'center',
  },
  perilla: {
    width: PERILLA,
    height: PERILLA,
    borderRadius: radii.full,
  },
});
