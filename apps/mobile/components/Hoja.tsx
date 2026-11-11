/**
 * La hoja que sube desde abajo: "de dónde sale este número", las explicaciones
 * y los créditos. Envuelve `@gorhom/bottom-sheet` para que el alto, el velo y
 * el cierre se decidan una vez; las pantallas solo dicen qué va adentro.
 *
 * Se abre y se cierra con una prop: el estado de qué se está mirando ya vive en
 * la pantalla, y un `ref` imperativo sería otra fuente de verdad.
 *
 * Cerrada no se monta: montada en `index={-1}` se abría sola en Android al
 * medir su contenido. Se queda montada mientras se va, y `onClose` la desmonta
 * cuando la animación terminó.
 *
 * El contenido desplaza (`BottomSheetScrollView`) con un techo calculado contra
 * la ventana: sin techo, la hoja crecía con su texto hasta pasarse de la
 * pantalla y no había nada que desplazar.
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ALTO_DE_LA_BARRA, capas, columna, elevation, spacing } from '@iceberg/ui';
import { X } from 'phosphor-react-native/src/icons/X';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotonDeIcono } from './Boton';
import { useEstilo, type Estilo } from '../datos/estilos';

export function Hoja(
  { abierta, titulo, onCerrar, children }:
  {
    abierta: boolean;
    titulo: string;
    onCerrar: () => void;
    children: ReactNode;
  },
) {
  const estilo = useEstilo();
  // La hoja termina donde empiezan los botones de Android: cuánto miden lo sabe el sistema.
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(estilo, insets.bottom), [estilo, insets.bottom]);
  const ventana = useWindowDimensions();
  // Un respiro arriba deja ver la pantalla de atrás: dice que esto está encima de algo.
  const techo = ventana.height - insets.top - spacing.xxxl;
  const hoja = useRef<BottomSheet>(null);
  const [montada, setMontada] = useState(false);

  useEffect(() => {
    if (abierta) setMontada(true);
  }, [abierta]);

  // Solo el cierre se pide a mano: se monta abierta y llega sola a su posición.
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
      onClose={() => { setMontada(false); onCerrar(); }}
      maxDynamicContentSize={techo}
      containerStyle={styles.capa}
      backgroundStyle={styles.fondo}
      handleIndicatorStyle={styles.tirador}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contenido}>
        {/* Cerrar ya se puede deslizando, tocando el velo o con atrás, pero
            nada de eso está escrito: la X es la forma que se ve. */}
        <View style={styles.encabezado}>
          <Text style={styles.titulo} accessibilityRole="header">{titulo}</Text>
          <BotonDeIcono
            icono={X}
            peso="bold"
            onPress={() => hoja.current?.close()}
            accesible="Cerrar"
          />
        </View>
        <View style={styles.linea} />
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function crearEstilos({ theme, t }: Estilo, aireDelSistema: number) {
  return StyleSheet.create({
    // Con capa propia: el más de la barra lleva `zIndex` y sin esto le quedaba encima.
    capa: { zIndex: capas.hoja },
    fondo: { backgroundColor: theme.superficie },
    tirador: { backgroundColor: theme.hairline, width: 36 },
    contenido: {
      ...columna,
      // La barra de abajo vive en otra rama y se dibuja encima de la hoja:
      // reservar su alto evita que tape la última línea.
      paddingBottom: spacing.xxxl + aireDelSistema + ALTO_DE_LA_BARRA,
      gap: spacing.sm,
    },
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    titulo: { ...t.subtitulo, flex: 1 },
    linea: { height: elevation.hairlineWidth, backgroundColor: theme.hairline, marginBottom: spacing.xs },
  });
}
