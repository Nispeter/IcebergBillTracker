import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from '@expo-google-fonts/geist-mono';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
} from '@expo-google-fonts/schibsted-grotesk';
import { fontSizes, fonts, spacing, themes } from '@iceberg/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ProveedorDeDatos } from '../datos/BaseDeDatos';

export default function RootLayout() {
  const sistema = useColorScheme();
  const theme = themes[sistema === 'dark' ? 'dark' : 'light'];

  // Las claves quedan con el nombre de la familia porque es el mismo string que
  // usan los tokens en `fontFamily`.
  const [loaded] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });

  if (!loaded) return null;

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
            <ActivityIndicator color={theme.acento} />
            <Text style={{ fontFamily: fonts.ui.regular, fontSize: fontSizes.sm, color: theme.silencio }}>
              Preparando la base…
            </Text>
          </View>
        }
        error={(mensaje) => (
          <View style={centro}>
            <Text style={{ fontFamily: fonts.ui.semibold, fontSize: fontSizes.md, color: theme.vencidoTexto }}>
              No se pudo abrir la base
            </Text>
            <Text style={{ fontFamily: fonts.mono.regular, fontSize: fontSizes.xs, color: theme.silencio, textAlign: 'center' }}>
              {mensaje}
            </Text>
          </View>
        )}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="nuevo" options={{ presentation: 'modal' }} />
        </Stack>
      </ProveedorDeDatos>
    </GestureHandlerRootView>
  );
}
