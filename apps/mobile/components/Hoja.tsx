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
 *
 * ## El contenido desplaza
 *
 * `BottomSheetScrollView` y no `BottomSheetView`. El segundo es una caja quieta:
 * cuando el texto pasaba del alto de la hoja, el sobrante quedaba abajo del borde
 * sin forma de alcanzarlo. Le paso a la ayuda de sincronizacion, y se "arreglo"
 * acortando el texto --que es tapar el problema, porque el siguiente texto largo
 * lo repite--. El desplazamiento no le hace nada a las hojas cortas: solo aparece
 * cuando sobra contenido.
 *
 * Es la misma falla que tenia el desplegable de categorias, en otro envase:
 * contenido que se pasa de la pantalla sin ningun camino para llegar a el. Ver
 * `ConDesplegable`.
 *
 * ## Y el scroll necesita un techo
 *
 * `BottomSheetScrollView` solo desplaza si la hoja tiene un alto que respetar.
 * Con dimensionado dinamico y sin tope, la hoja **crece con su contenido hasta
 * pasarse de la pantalla**: la ayuda de Sincronizar son ocho parrafos y el
 * titulo terminaba dibujado debajo del reloj, con el ultimo parrafo fuera por
 * abajo y nada que desplazar, porque para la hoja no sobraba nada.
 *
 * `maxDynamicContentSize` es ese techo. Se calcula con la ventana en vez de
 * fijarlo: un plegable y un telefono chico no tienen el mismo alto, y la franja
 * de estado tampoco mide igual en todos.
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  ALTO_DE_LA_BARRA, capas, elevation, fonts, pesos, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { X } from 'phosphor-react-native/src/icons/X';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLetra } from '../datos/letra';

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
  const ventana = useWindowDimensions();
  const letra = useLetra();
  /**
   * Hasta donde puede crecer la hoja.
   *
   * Se le descuenta la franja de estado y un respiro. El respiro no es
   * decorativo: deja ver un poco de la pantalla de atras, que es lo que dice
   * que esto es una hoja encima de algo y no una pantalla nueva.
   */
  const techo = ventana.height - insets.top - spacing.xxxl;
  const styles = crearEstilos(theme, insets.bottom, letra);
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
      // El boton flotante lleva `zIndex` propio y la hoja no llevaba ninguno,
      // asi que el `+` le quedaba encima: un elemento con capa explicita le gana
      // a cualquier hermano sin ella, por mas tarde que venga en el arbol.
      maxDynamicContentSize={techo}
      containerStyle={styles.capa}
      backgroundStyle={styles.fondo}
      handleIndicatorStyle={styles.tirador}
    >
      <BottomSheetScrollView contentContainerStyle={styles.contenido}>
        {/*
          La X, al otro extremo del titulo.

          Cerrar ya se podia de tres maneras --deslizar hacia abajo, tocar el
          velo, el boton de atras de Android-- y ninguna esta escrita en la
          pantalla: hay que saberlas. La X es la que se ve, y en una hoja que a
          veces cubre media pantalla el gesto no siempre es evidente.

          Pegada al borde derecho y no separada del titulo: el pulgar la busca
          en la esquina, no en el medio. El `hitSlop` le da el area que el icono
          de catorce puntos no tiene.
        */}
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>{titulo}</Text>
          <Pressable
            onPress={() => hoja.current?.close()}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <X size={16} weight="bold" color={theme.silencio} />
          </Pressable>
        </View>
        <View style={styles.linea} />
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function crearEstilos(theme: Theme, aireDelSistema: number, letra: Letra) {
  return StyleSheet.create({
    capa: { zIndex: capas.hoja },
    fondo: { backgroundColor: theme.superficie },
    tirador: { backgroundColor: theme.hairline, width: 36 },
    contenido: {
      paddingHorizontal: spacing.lg,
      /**
       * `xxxl` y no `xxl`: con el aire justo, la ultima linea quedaba pegada al
       * borde y en un telefono se leia como si el texto siguiera mas abajo.
       *
       * Se suma ademas el alto de la barra de abajo. La barra vive en el layout
       * del grupo y la hoja dentro de la pantalla, asi que **la barra le queda
       * encima** y tapaba la ultima linea. Reservar su alto no arregla el orden
       * de dibujo, pero deja de esconder texto, que es lo que importaba.
       */
      paddingBottom: spacing.xxxl + aireDelSistema + ALTO_DE_LA_BARRA,
      gap: spacing.sm,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    // El titulo se lleva el ancho que sobra para que la X quede contra el
    // borde aunque el titulo sea corto.
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    titulo: {
      flex: 1,
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: letra.md,
      color: theme.tinta,
    },
    linea: { height: elevation.hairlineWidth, backgroundColor: theme.hairline, marginBottom: spacing.xs },
  });
}
