/**
 * El marco de lo que se abre encima de la app: formularios, importador, reglas.
 * Descuenta los márgenes del sistema en un solo lugar (arriba el reloj, abajo
 * la barra de gestos) y entra subiendo desde abajo, que es donde nace el más.
 *
 * La animación se hace acá y no en el Stack porque `presentation: 'modal'` no
 * anima nada en web.
 */

import { durations } from '@iceberg/ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { transicion, useMovimientoReducido } from '../datos/animacion';
import { useTema } from '../datos/tema';

export function PantallaModal({ children }: { children: ReactNode }) {
  const { nombre: tema, theme } = useTema();
  const margenes = useSafeAreaInsets();
  const reducido = useMovimientoReducido();

  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    transicion(entrada, 1, { duracion: durations.escena, reducido }).start();
  }, [entrada, reducido]);

  return (
    <Animated.View
      style={[
        styles.raiz,
        {
          backgroundColor: theme.fondo,
          paddingTop: margenes.top,
          paddingBottom: margenes.bottom,
          opacity: entrada,
          // Sube más que el cambio de vista: esto no llega, se levanta.
          transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
});
