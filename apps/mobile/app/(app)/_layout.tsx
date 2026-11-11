/**
 * Las seis vistas, una por pregunta.
 *
 * Es un `Stack` y no `Tabs` porque la navegación la hace `BarraInferior`, que se
 * dibuja acá y no dentro de `Pantalla` para quedarse quieta en cada cambio de
 * vista. Con `Tabs` y la barra oculta, en web la franja seguía ocupando lugar.
 */

import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BarraInferior } from '../../components/BarraInferior';
import { ProveedorDeMenuDeCuenta } from '../../components/MenuDeCuenta';
import { useVolverATodasSiSeBorroLaCuenta } from '../../datos/consultas';
import { useTema } from '../../datos/tema';
import { ProveedorDeTutorial } from '../../datos/tutorial';

export default function AppLayout() {
  const { theme } = useTema();

  // Un invariante del alcance: si se borró la cuenta que se mira, volver a
  // "todas". Va acá porque este layout está montado mientras la app vive.
  useVolverATodasSiSeBorroLaCuenta();

  return (
    <ProveedorDeTutorial>
      <ProveedorDeMenuDeCuenta>
        <View style={styles.lleno}>
          <Stack
            screenOptions={{
              headerShown: false,
              // El fundido lo hace `Pantalla` sobre su contenido: el Stack en web
              // no anima, y dos animaciones del mismo cambio se pisarían.
              animation: 'none',
              // Sin fondo, el contenedor nativo de cada vista destella en blanco.
              contentStyle: { backgroundColor: theme.fondo },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="categorias" />
            <Stack.Screen name="calendario" />
            <Stack.Screen name="tempanos" />
            <Stack.Screen name="movimientos" />
            <Stack.Screen name="ajustes" />
          </Stack>
          <BarraInferior />
        </View>
      </ProveedorDeMenuDeCuenta>
    </ProveedorDeTutorial>
  );
}

const styles = StyleSheet.create({
  lleno: { flex: 1 },
});
