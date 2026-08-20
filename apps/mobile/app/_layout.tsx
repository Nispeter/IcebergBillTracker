import { fontSizes, fonts, pesos, spacing } from '@iceberg/ui';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pinguino } from '../components/Pinguino';
import { ProveedorDeDatos } from '../datos/BaseDeDatos';
import { useFechaDeCorte } from '../datos/consultas';
import { ProveedorDePeriodo } from '../datos/periodo';
import { ProveedorDeTema, useTema } from '../datos/tema';

export default function RootLayout() {
  // El proveedor de tema envuelve todo, incluidas las pantallas de carga y de
  // error: si no, el arranque parpadearia en el tema equivocado.
  return (
    <ProveedorDeTema>
      <Contenido />
    </ProveedorDeTema>
  );
}

/**
 * Va aparte porque `useFechaDeCorte` necesita la base ya abierta: dentro del
 * proveedor de datos, no fuera.
 */
function ConPeriodo({ children }: { children: ReactNode }) {
  return <ProveedorDePeriodo corte={useFechaDeCorte()}>{children}</ProveedorDePeriodo>;
}

function Contenido() {
  const { theme } = useTema();

  // Sin `useFonts`: Consolas viene del sistema, no se empaqueta.

  const centro = {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.fondo,
    padding: spacing.xxl,
    gap: spacing.lg,
  };

  // GestureHandlerRootView tiene que envolver la app entera para que los gestos
  // y las hojas de @gorhom/bottom-sheet funcionen (swipe en filas, drill-down).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProveedorDeDatos
        cargando={
          <View style={centro}>
            <Pinguino theme={theme} tamano={48} />
            <ActivityIndicator color={theme.acento} />
            <Text style={{ fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio }}>
              Preparando la base…
            </Text>
          </View>
        }
        error={(mensaje) => (
          <View style={centro}>
            <Text style={{ fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.vencidoTexto }}>
              No se pudo abrir la base
            </Text>
            <Text style={{ fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, textAlign: 'center' }}>
              {mensaje}
            </Text>
          </View>
        )}
      >
        <ConPeriodo>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="nuevo" options={{ presentation: 'modal' }} />
            <Stack.Screen name="movimiento/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="regla/nueva" options={{ presentation: 'modal' }} />
            <Stack.Screen name="regla/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="importar" options={{ presentation: 'modal' }} />
            <Stack.Screen name="cuenta/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="reglas-categoria" options={{ presentation: 'modal' }} />
          </Stack>
        </ConPeriodo>
      </ProveedorDeDatos>
    </GestureHandlerRootView>
  );
}
