/**
 * Las vistas principales, una por pregunta.
 *
 * Es un `Stack` y no `Tabs` porque la navegacion la hace la bandeja de abajo
 * (`components/Bandeja.tsx`), que se esconde. Se probo `Tabs` con la barra
 * oculta, tanto con `tabBarStyle: { display: 'none' }` como con
 * `tabBar={() => null}`, y en web ninguna de las dos la saca: sigue ocupando su
 * franja abajo.
 *
 * El **periodo es global** y vive arriba, en `Pantalla`: cambiar de vista no
 * cambia la fecha que uno esta mirando.
 */

import { Stack } from 'expo-router';
import { useTema } from '../../datos/tema';

export default function AppLayout() {
  const { theme } = useTema();

  // `contentStyle` con el fondo del tema: sin el, el contenedor de cada pantalla
  // arranca en blanco y al cambiar de vista se ve un destello. En web no pasaba
  // porque ahi no hay contenedor nativo por pantalla.
  return (
      <Stack
        screenOptions={{
          headerShown: false,
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
  );
}
