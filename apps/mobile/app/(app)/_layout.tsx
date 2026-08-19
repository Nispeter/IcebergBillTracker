/**
 * Las vistas principales, una por pregunta.
 *
 * Es un `Stack` y no `Tabs` porque la navegacion la hace la barra lateral
 * (`components/Sidebar.tsx`), que se esconde. Se probo `Tabs` con la barra
 * oculta —tanto `tabBarStyle: { display: 'none' }` como `tabBar={() => null}`—
 * y en web ninguna de las dos la saca: sigue ocupando su franja abajo.
 *
 * El **periodo es global** y vive arriba, en `Pantalla`: cambiar de vista no
 * cambia la fecha que uno esta mirando.
 */

import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="categorias" />
      <Stack.Screen name="calendario" />
      <Stack.Screen name="tempanos" />
      <Stack.Screen name="movimientos" />
      <Stack.Screen name="ajustes" />
    </Stack>
  );
}
