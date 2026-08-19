/**
 * La hoja que sube desde abajo, para responder "de donde sale este numero".
 *
 * Envuelve `@gorhom/bottom-sheet` en vez de usarlo directo en cada pantalla:
 * asi el alto, el velo, el color y el comportamiento al cerrar se deciden una
 * vez. Las pantallas solo dicen que va adentro.
 *
 * Se abre y se cierra con una prop, no con un `ref` imperativo: el estado de
 * "que cifra se esta mirando" ya vive en la pantalla, y tener ademas un ref que
 * hay que presentar y descartar a mano son dos fuentes de verdad para lo mismo.
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { elevation, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function Hoja(
  { abierta, titulo, theme, onCerrar, children }:
  {
    abierta: boolean;
    titulo: string;
    theme: Theme;
    onCerrar: () => void;
    children: ReactNode;
  },
) {
  const styles = crearEstilos(theme);
  const hoja = useRef<BottomSheet>(null);

  useEffect(() => {
    if (abierta) hoja.current?.expand();
    else hoja.current?.close();
  }, [abierta]);

  const velo = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={hoja}
      index={-1}
      enablePanDownToClose
      backdropComponent={velo}
      onClose={onCerrar}
      backgroundStyle={styles.fondo}
      handleIndicatorStyle={styles.tirador}
    >
      <BottomSheetView style={styles.contenido}>
        <Text style={styles.titulo}>{titulo}</Text>
        <View style={styles.linea} />
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    fondo: { backgroundColor: theme.superficie },
    tirador: { backgroundColor: theme.hairline, width: 36 },
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    titulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.tinta },
    linea: { height: elevation.hairlineWidth, backgroundColor: theme.hairline, marginBottom: spacing.xs },
  });
}
