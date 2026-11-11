// Primero de todo y por su efecto: instala `crypto.getRandomValues`, que Hermes
// no trae y que `ulid` necesita para el primer identificador.
import '../datos/aleatorio';

import { durations, spacing } from '@iceberg/ui';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pinguino } from '../components/Pinguino';
import { ProveedorDeAviso } from '../datos/aviso';
import { ProveedorDeDatos } from '../datos/BaseDeDatos';
import { useFechaDeCorte } from '../datos/consultas';
import { ProveedorDeCuenta } from '../datos/cuenta';
import { useEstilos, type Estilo } from '../datos/estilos';
import { ProveedorDeExplicacion } from '../datos/explicacion';
import { ProveedorDeLetra } from '../datos/letra';
import { ProveedorDePeriodo } from '../datos/periodo';
import { ProveedorDeTema, TemaGuardado, useTema } from '../datos/tema';

/**
 * Todo lo que se escribe sube desde abajo, desde donde nace el más. Declarada
 * acá porque `presentation: 'modal'` sola no anima nada en web.
 */
const COMO_HOJA = {
  presentation: 'modal',
  animation: 'slide_from_bottom',
  animationDuration: durations.escena,
} as const;

export default function RootLayout() {
  // El tema envuelve también la carga y el error, para que el arranque no
  // parpadee en el tema equivocado.
  return (
    <ProveedorDeTema>
      <Contenido />
    </ProveedorDeTema>
  );
}

/** Aparte porque `useFechaDeCorte` necesita la base ya abierta. */
function ConPeriodo({ children }: { children: ReactNode }) {
  return <ProveedorDePeriodo corte={useFechaDeCorte()}>{children}</ProveedorDePeriodo>;
}

function Contenido() {
  const { theme } = useTema();
  const styles = useEstilos(crearEstilos);

  return (
    <GestureHandlerRootView style={styles.lleno}>
      {/* La app dibuja bajo las barras del sistema (`edgeToEdgeEnabled`): el
          proveedor mide los márgenes y `Pantalla` los aplica. */}
      <SafeAreaProvider>
        <ProveedorDeDatos
          cargando={(
            <View style={styles.centro}>
              <Pinguino tamano={48} />
              <ActivityIndicator color={theme.acento} />
              <Text style={styles.cargando}>Preparando la base…</Text>
            </View>
          )}
          error={(mensaje) => (
            <View style={styles.centro}>
              <Text style={styles.error}>No se pudo abrir la base</Text>
              <Text style={styles.detalle}>{mensaje}</Text>
            </View>
          )}
        >
          {/* No dibuja nada: le pasa al tema la elección guardada cuando la base abre. */}
          <TemaGuardado />
          {/* El tamaño de letra sale de la base, así que cuelga de ella. */}
          <ProveedorDeLetra>
            <ProveedorDeAviso>
              <ConPeriodo>
                <ProveedorDeCuenta>
                  <ProveedorDeExplicacion>
                    <Stack
                      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fondo } }}
                    >
                      <Stack.Screen name="(app)" />
                      <Stack.Screen name="nuevo" options={COMO_HOJA} />
                      <Stack.Screen name="movimiento/[id]" options={COMO_HOJA} />
                      <Stack.Screen name="regla/nueva" options={COMO_HOJA} />
                      <Stack.Screen name="regla/[id]" options={COMO_HOJA} />
                      <Stack.Screen name="importar" options={COMO_HOJA} />
                      <Stack.Screen name="cuenta/[id]" options={COMO_HOJA} />
                      <Stack.Screen name="categoria/[id]" options={COMO_HOJA} />
                      <Stack.Screen name="reglas-categoria" options={COMO_HOJA} />
                    </Stack>
                  </ProveedorDeExplicacion>
                </ProveedorDeCuenta>
              </ConPeriodo>
            </ProveedorDeAviso>
          </ProveedorDeLetra>
        </ProveedorDeDatos>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    lleno: { flex: 1 },
    centro: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.fondo,
      padding: spacing.xxl,
      gap: spacing.lg,
    },
    cargando: { ...t.cuerpo, color: theme.silencio },
    error: { ...t.subtitulo, color: theme.vencidoTexto },
    detalle: { ...t.cifra, color: theme.silencio, textAlign: 'center' },
  });
}
