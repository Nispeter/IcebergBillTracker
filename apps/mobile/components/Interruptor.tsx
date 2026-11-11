/**
 * Un interruptor de dos estados con la perilla que se desliza.
 *
 * Los colores son los del iceberg: encendido es comprometido y pinta la pista
 * de hielo; apagado es variable y la pinta de agua. Si el interruptor usara los
 * mismos dos colores al revés que el dibujo, quien aprendió uno leería mal el
 * otro.
 */

import { durations, holguraDeToque, radii } from '@iceberg/ui';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { transicion, useMovimientoReducido } from '../datos/animacion';
import { useTema } from '../datos/tema';

const ANCHO = 46;
const ALTO = 26;
const PERILLA = 20;
const MARGEN = (ALTO - PERILLA) / 2;

export function Interruptor(
  { encendido, onCambiar, accesible }: {
    encendido: boolean;
    onCambiar: (valor: boolean) => void;
    accesible: string;
  },
) {
  const { theme } = useTema();
  const reducido = useMovimientoReducido();
  const progreso = useRef(new Animated.Value(encendido ? 1 : 0)).current;

  useEffect(() => {
    // El color no corre en el hilo nativo, y un mismo valor no puede mezclar drivers.
    transicion(progreso, encendido ? 1 : 0, {
      duracion: durations.salida, reducido, nativo: false,
    }).start();
  }, [encendido, progreso, reducido]);

  return (
    <Pressable
      onPress={() => onCambiar(!encendido)}
      hitSlop={holguraDeToque(ALTO)}
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
              outputRange: [theme.acento, theme.hieloSobreAgua],
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
