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
 */

import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../datos/tema';

export function PantallaModal({ children }: { children: ReactNode }) {
  const { nombre: tema, theme } = useTema();
  const margenes = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.raiz,
        {
          backgroundColor: theme.fondo,
          paddingTop: margenes.top,
          paddingBottom: margenes.bottom,
        },
      ]}
    >
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
});
