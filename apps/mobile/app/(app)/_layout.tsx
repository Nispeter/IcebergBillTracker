/**
 * Las vistas principales, una por pregunta.
 *
 * Es un `Stack` y no `Tabs` porque la navegacion la hace la barra de abajo
 * (`components/BarraInferior.tsx`). Se probo `Tabs` con la barra oculta, tanto
 * con `tabBarStyle: { display: 'none' }` como con `tabBar={() => null}`, y en
 * web ninguna de las dos la saca: sigue ocupando su franja abajo.
 *
 * La **barra se dibuja aca y no dentro de `Pantalla`**, que es donde estuvo
 * primero. Puesta ahi era parte de la pantalla, asi que se desvanecia con ella
 * en cada transicion: la navegacion parpadeaba justo cuando uno la esta
 * mirando. Aca queda fuera de lo que se anima y se queda quieta.
 *
 * El **periodo es global** y vive arriba, en `Pantalla`: cambiar de vista no
 * cambia la fecha que uno esta mirando.
 */

import { Stack } from 'expo-router';
import { View } from 'react-native';
import { BarraInferior } from '../../components/BarraInferior';
import { ProveedorDeBandeja } from '../../components/Bandeja';
import { useTema } from '../../datos/tema';

export default function AppLayout() {
  const { theme } = useTema();

  // `contentStyle` con el fondo del tema: sin el, el contenedor de cada pantalla
  // arranca en blanco y al cambiar de vista se ve un destello. En web no pasaba
  // porque ahi no hay contenedor nativo por pantalla.
  return (
    <ProveedorDeBandeja theme={theme}>
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          /**
           * La transicion **no** la hace el Stack.
           *
           * Se probo con `animation: 'fade'` y en web no anima nada: la pantalla
           * vieja se desmonta en el mismo frame, medido cuadro a cuadro. Como
           * hacia falta que se viera igual en los dos lados, el fundido lo hace
           * `Pantalla` sobre su propio contenido; ver ahi por que fundido y no
           * deslizamiento. Dejar las dos animaciones seria animar dos veces lo
           * mismo con curvas distintas.
           */
          animation: 'none',
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

      <BarraInferior theme={theme} />
    </View>
    </ProveedorDeBandeja>
  );
}
