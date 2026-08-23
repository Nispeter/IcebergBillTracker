/**
 * Un aviso corto que aparece abajo y se va solo.
 *
 * Existe porque casi todo lo que se guarda en esta app **cierra la pantalla al
 * guardar**: se toca Guardar, el formulario se va, y lo unico que confirma que
 * paso algo es que la lista de atras cambio. Cuando el cambio no se ve --editar
 * la categoria de un movimiento que quedo fuera del periodo, renombrar el
 * telefono-- no queda ninguna senal, y la duda es razonable.
 *
 * Vive una sola vez y arriba de todo, por la misma razon que la hoja de
 * explicaciones: un elemento flotante solo compite dentro de su contexto de
 * apilado, y ese contexto lo decide cualquier ancestro. Ver `explicacion.tsx`.
 *
 * No lleva boton de cerrar ni bloquea nada: `pointerEvents="none"` deja pasar
 * los toques, asi que nunca se interpone entre el usuario y lo que iba a tocar.
 */

import { capas, durations, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Check } from 'phosphor-react-native/src/icons/Check';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Cuanto queda a la vista antes de irse solo. */
const EN_PANTALLA = 1900;

type Avisar = (texto: string) => void;

const Contexto = createContext<Avisar>(() => {});

/** Confirma algo que acaba de pasar. Para lo que se guarda, `'Guardado'`. */
export function useAvisar(): Avisar {
  return useContext(Contexto);
}

export function ProveedorDeAviso({ theme, children }: { theme: Theme; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const styles = crearEstilos(theme, insets.bottom);
  const [aviso, setAviso] = useState<{ texto: string; clave: number } | null>(null);
  const entrada = useRef(new Animated.Value(0)).current;

  // La clave cambia aunque el texto sea el mismo: guardar dos veces seguidas
  // tiene que volver a animar, y sin ella el efecto no se entera.
  const avisar = useCallback<Avisar>(
    (texto) => setAviso({ texto, clave: Date.now() }),
    [],
  );

  useEffect(() => {
    if (aviso === null) return undefined;

    entrada.setValue(0);
    Animated.timing(entrada, {
      toValue: 1,
      duration: durations.quick,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const irse = setTimeout(() => {
      Animated.timing(entrada, {
        toValue: 0,
        duration: durations.quick,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setAviso(null); });
    }, EN_PANTALLA);

    return () => clearTimeout(irse);
  }, [aviso, entrada]);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      {/* Despues de los hijos: es lo ultimo del arbol, asi que se dibuja encima
          sin depender de que ningun ancestro colabore. */}
      {aviso === null ? null : (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.franja,
            {
              opacity: entrada,
              transform: [{
                translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              }],
            },
          ]}
        >
          <View style={styles.pastilla}>
            <Check size={14} weight="bold" color={theme.acento} />
            <Text style={styles.texto}>{aviso.texto}</Text>
          </View>
        </Animated.View>
      )}
    </Contexto.Provider>
  );
}

function crearEstilos(theme: Theme, aireDelSistema: number) {
  return StyleSheet.create({
    /**
     * La franja que ocupa el ancho y centra la pastilla.
     *
     * Va aparte porque un elemento absoluto no se centra con `alignSelf`: se
     * anclan los dos extremos y **el hijo** se centra adentro. Asi la pastilla
     * conserva el ancho de su texto en vez de estirarse de lado a lado.
     */
    franja: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      // Por encima del boton flotante y de la barra de gestos de Android.
      bottom: aireDelSistema + spacing.xxxl,
      zIndex: capas.aviso,
    },
    pastilla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: '86%',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.full,
      // `superficie` es lo que flota por encima del contenido; el panel hundido
      // seria lo contrario de lo que este elemento hace. Ver `Panel.tsx`.
      backgroundColor: theme.superficie,
    },
    texto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: fontSizes.xs,
      color: theme.tinta,
    },
  });
}
