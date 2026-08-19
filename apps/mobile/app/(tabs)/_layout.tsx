/**
 * Navegacion principal: una vista por pregunta.
 *
 * Antes todo se apilaba en Home y habia que bajar mucho para llegar a lo de
 * abajo. Ahora cada pestaña responde una cosa: como voy (resumen), en que se me
 * va (categorias), cuando gasto (dia a dia) y que compre (movimientos).
 *
 * El **periodo es global** y vive arriba, en `Pantalla`: cambiar de pestaña no
 * cambia la fecha que uno esta mirando.
 */

import { elevation, fontSizes, fonts, pesos } from '@iceberg/ui';
import { Tabs } from 'expo-router';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ChartPieSlice } from 'phosphor-react-native/src/icons/ChartPieSlice';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { Waves } from 'phosphor-react-native/src/icons/Waves';
import { useTema } from '../../datos/tema';

export default function TabsLayout() {
  const { theme } = useTema();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.acentoTexto,
        tabBarInactiveTintColor: theme.silencio,
        tabBarStyle: {
          backgroundColor: theme.superficie,
          borderTopWidth: elevation.hairlineWidth,
          borderTopColor: theme.hairline,
        },
        tabBarLabelStyle: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color }) => <Waves size={20} weight="regular" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="categorias"
        options={{
          title: 'Categorías',
          tabBarIcon: ({ color }) => <ChartPieSlice size={20} weight="regular" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Día a día',
          tabBarIcon: ({ color }) => <CalendarBlank size={20} weight="regular" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="movimientos"
        options={{
          title: 'Movimientos',
          tabBarIcon: ({ color }) => <ListBullets size={20} weight="regular" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
