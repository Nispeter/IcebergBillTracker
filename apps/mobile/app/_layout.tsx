// Primero de todo y por su efecto: instala `crypto.getRandomValues`, que Hermes
// no trae y que `ulid` necesita para el identificador de la primera fila. Sin
// esto la app arranca y muere en "No se pudo abrir la base".
import '../datos/aleatorio';

import { fontSizes, fonts, pesos, spacing } from '@iceberg/ui';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pinguino } from '../components/Pinguino';
import { ProveedorDeDatos } from '../datos/BaseDeDatos';
import { useFechaDeCorte } from '../datos/consultas';
import { ProveedorDeCuenta } from '../datos/cuenta';
import { ProveedorDeExplicacion } from '../datos/explicacion';
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
      {/*
        `edgeToEdgeEnabled` hace que la app dibuje **debajo** de la barra de
        estado y de la de gestos. En web no hay ninguna de las dos, asi que esto
        no se noto hasta abrirla en el telefono: el encabezado quedaba tapado por
        el reloj y la señal. El proveedor mide esos margenes; quien los aplica es
        `Pantalla`.
      */}
      <SafeAreaProvider>
      <ProveedorDeDatos
        cargando={
          <View style={centro}>
            <Pinguino theme={theme} tamano={48} />
            <ActivityIndicator color={theme.acento} />
            <Text style={{ fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio }}>
              Preparando la base…
            </Text>
          </View>
        }
        error={(mensaje) => (
          <View style={centro}>
            <Text style={{ fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.vencidoTexto }}>
              No se pudo abrir la base
            </Text>
            <Text style={{ fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio, textAlign: 'center' }}>
              {mensaje}
            </Text>
          </View>
        )}
      >
        <ConPeriodo>
          {/* La cuenta activa es un alcance global, igual que el periodo. */}
          <ProveedorDeCuenta>
          {/* Una sola hoja de explicaciones para toda la app: ver
              `datos/explicacion.tsx`. */}
          <ProveedorDeExplicacion theme={theme}>
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fondo } }}
            >
              <Stack.Screen name="(app)" />
              <Stack.Screen name="nuevo" options={{ presentation: 'modal' }} />
              <Stack.Screen name="movimiento/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="regla/nueva" options={{ presentation: 'modal' }} />
              <Stack.Screen name="regla/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="importar" options={{ presentation: 'modal' }} />
              <Stack.Screen name="cuenta/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="reglas-categoria" options={{ presentation: 'modal' }} />
            </Stack>
          </ProveedorDeExplicacion>
          </ProveedorDeCuenta>
        </ConPeriodo>
      </ProveedorDeDatos>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
