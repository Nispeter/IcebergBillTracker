/**
 * El marco de las pantallas que se abren **encima** de la app.
 *
 * Formularios, importador, reglas: todo lo que entra como modal. Existe por lo
 * mismo que `Pantalla` --que es el marco de las vistas principales--: nueve
 * lugares repetian el mismo `View` con el fondo del tema y su `StatusBar`, y
 * cuando hubo que descontar el margen del sistema **ninguno lo tenia**. El
 * titulo y el "Cancelar" quedaban pegados al reloj, imposibles de tocar.
 *
 * Esa es la leccion: un arreglo que hay que aplicar en nueve archivos se olvida
 * en alguno. Ahora el marco es uno solo y el margen se descuenta en un lugar.
 *
 * Abajo tambien: en Android la barra de gestos se come el borde inferior, y
 * varios de estos formularios terminan en un boton.
 *
 * ## Entra subiendo
 *
 * `presentation: 'modal'` ya desliza en Android, pero **en web no anima nada**:
 * el formulario aparecia de golpe y se leia como un cambio de pantalla, no como
 * algo que se abre encima. La animacion se hace aca para que sea la misma en los
 * dos lados.
 *
 * Desde abajo por donde nace el gesto: el mas esta abajo al centro, y lo que
 * sube desde ahi se entiende como su consecuencia.
 */

import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../datos/tema';

export function PantallaModal({ children }: { children: ReactNode }) {
  const { nombre: tema, theme } = useTema();
  const margenes = useSafeAreaInsets();

  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      // Mas largo que el cambio de vista: aca si hay una escena --una hoja que
      // se levanta-- y no un simple acuse de recibo.
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrada]);

  return (
    <Animated.View
      style={[
        styles.raiz,
        {
          backgroundColor: theme.fondo,
          paddingTop: margenes.top,
          paddingBottom: margenes.bottom,
          opacity: entrada,
          transform: [{
            // 24 y no 8: esto no llega, se levanta. El recorrido mas largo es lo
            // que lo distingue del cambio de vista.
            translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
          }],
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
