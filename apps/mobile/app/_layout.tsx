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
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
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

  // GestureHandlerRootView tiene que envolver la app entera para que los gestos
  // y las hojas de @gorhom/bottom-sheet funcionen (swipe en filas, drill-down).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
