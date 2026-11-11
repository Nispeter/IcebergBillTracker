/**
 * Un aviso corto que aparece abajo y se va solo: la confirmación de lo que se
 * acaba de hacer. Casi todo lo que se guarda cierra la pantalla, y cuando el
 * cambio no se ve en la lista de atrás no queda otra señal.
 *
 * Vive una sola vez, al final del árbol, para dibujarse encima de todo sin
 * pelear el apilado. No se toca ni bloquea: los toques pasan de largo.
 */

import { ALTO_DE_LA_BARRA, capas, durations, elevation, radii, spacing } from '@iceberg/ui';
import { Check } from 'phosphor-react-native/src/icons/Check';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CURVA, transicion, useMovimientoReducido } from './animacion';
import { useEstilo, type Estilo } from './estilos';

/** Cuánto queda a la vista antes de irse. */
const EN_PANTALLA = 1900;

type Avisar = (texto: string) => void;

const Contexto = createContext<Avisar>(() => {});

/** Confirma algo que acaba de pasar. */
export function useAvisar(): Avisar {
  return useContext(Contexto);
}

export function ProveedorDeAviso({ children }: { children: ReactNode }) {
  const estilo = useEstilo();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(estilo, insets.bottom), [estilo, insets.bottom]);
  const reducido = useMovimientoReducido();
  const [aviso, setAviso] = useState<{ texto: string; clave: number } | null>(null);
  const entrada = useRef(new Animated.Value(0)).current;

  // La clave cambia aunque el texto se repita: guardar dos veces seguidas
  // tiene que volver a mostrarlo.
  const avisar = useCallback<Avisar>((texto) => setAviso({ texto, clave: Date.now() }), []);

  useEffect(() => {
    if (aviso === null) return undefined;
    entrada.setValue(0);
    transicion(entrada, 1, { duracion: durations.entrada, reducido }).start();
    const irse = setTimeout(() => {
      transicion(entrada, 0, { duracion: durations.salida, curva: CURVA.sale, reducido })
        .start(({ finished }) => { if (finished) setAviso(null); });
    }, EN_PANTALLA);
    return () => clearTimeout(irse);
  }, [aviso, entrada, reducido]);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      {aviso === null ? null : (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.franja,
            {
              opacity: entrada,
              transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
        >
          <View style={styles.pastilla}>
            <Check size={14} weight="bold" color={estilo.theme.acento} />
            <Text style={styles.texto}>{aviso.texto}</Text>
          </View>
        </Animated.View>
      )}
    </Contexto.Provider>
  );
}

function crearEstilos({ theme, t }: Estilo, aireDelSistema: number) {
  return StyleSheet.create({
    // Un absoluto no se centra con `alignSelf`: la franja va a lo ancho y
    // centra la pastilla, que conserva el ancho de su texto.
    franja: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      // Por encima de la barra de abajo y del más, que sobresale de ella.
      bottom: aireDelSistema + ALTO_DE_LA_BARRA + spacing.xl,
      zIndex: capas.aviso,
    },
    // Flota, así que va en `superficie` y con borde, como el resto de lo que flota.
    pastilla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: '86%',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: theme.superficie,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    texto: { ...t.etiqueta, fontWeight: t.accion.fontWeight, color: theme.tinta },
  });
}
