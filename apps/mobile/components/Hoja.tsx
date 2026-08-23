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
 *
 * ## Cerrada no se monta
 *
 * La primera version dejaba el `BottomSheet` montado siempre en `index={-1}`.
 * En web quedaba invisible; en Android **se abria sola** al entrar a la pantalla
 * y al volver al Resumen, mostrando una hoja vacia. Con dimensionado dinamico la
 * hoja mide su contenido despues del primer render y ahi decide a que posicion
 * ir, y ese arranque le gana al indice inicial.
 *
 * Se resuelve no montandola cuando no hay nada que mostrar. Para no perder la
 * animacion de salida se queda montada mientras se va: `onClose` avisa cuando
 * termino de cerrarse, y recien ahi se desmonta.
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { elevation, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // El aire de abajo no puede ser una constante: la hoja termina justo donde
  // empiezan los botones o la barra de gestos de Android, que los tapan. Cuanto
  // miden lo sabe el sistema, no nosotros.
  const insets = useSafeAreaInsets();
  const styles = crearEstilos(theme, insets.bottom);
  const hoja = useRef<BottomSheet>(null);
  const [montada, setMontada] = useState(false);

  useEffect(() => {
    if (abierta) setMontada(true);
  }, [abierta]);

  // Solo el cierre se pide a mano. Abrir no: como la hoja **se monta abierta**,
  // llega a su posicion sola y animada. Pedir `expand()` en el mismo frame del
  // montaje no funciona --la hoja todavia no termina de inicializarse-- y se
  // quedaba sin abrir.
  useEffect(() => {
    if (montada && !abierta) hoja.current?.close();
  }, [montada, abierta]);

  const velo = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  if (!montada) return null;

  return (
    <BottomSheet
      ref={hoja}
      index={abierta ? 0 : -1}
      enablePanDownToClose
      backdropComponent={velo}
      // Desmontar recien aca: `onClose` corre cuando la animacion de salida ya
      // termino, asi que se ve entera.
      onClose={() => { setMontada(false); onCerrar(); }}
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

function crearEstilos(theme: Theme, aireDelSistema: number) {
  return StyleSheet.create({
    fondo: { backgroundColor: theme.superficie },
    tirador: { backgroundColor: theme.hairline, width: 36 },
    contenido: {
      paddingHorizontal: spacing.lg,
      // `xxxl` y no `xxl`: con el aire justo, la ultima linea quedaba pegada al
      // borde y en un telefono se leia como si el texto siguiera mas abajo.
      paddingBottom: spacing.xxxl + aireDelSistema,
      gap: spacing.sm,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    titulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.tinta },
    linea: { height: elevation.hairlineWidth, backgroundColor: theme.hairline, marginBottom: spacing.xs },
  });
}
