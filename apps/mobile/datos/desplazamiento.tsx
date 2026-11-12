/**
 * Cuánto aire dejarle al final de lo que desplaza: el alto de la barra de abajo
 * más la barra de gestos del sistema (la app dibuja a pantalla completa) y un
 * respiro. En un solo lugar para no tener que acordarse en cada pantalla.
 */

import { ALTO_DE_LA_BARRA, spacing } from '@iceberg/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useAireInferior(): number {
  return ALTO_DE_LA_BARRA + useSafeAreaInsets().bottom + spacing.md;
}
