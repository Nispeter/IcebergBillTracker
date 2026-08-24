/**
 * La bandeja de "que estoy mirando": elegir con que cuenta ver la app.
 *
 * Llego a tener adentro los seis destinos, y se los llevo la barra de abajo:
 * ver `BarraInferior`, que ademas cuenta el recorrido completo de la navegacion.
 * Lo que quedo aca es lo unico que **no** es un lugar al que ir sino un filtro
 * sobre todo lo demas.
 *
 * Sigue siendo una bandeja y no un desplegable en el encabezado por donde ya
 * estuvo: bajo el periodo dejaba una barra de dos lineas en todas las pantallas
 * para algo que casi nunca se cambia, porque uno mira un libro y se queda ahi.
 *
 * **No se abre con una sola cuenta.** `Pantalla` ni siquiera dibuja el boton que
 * la abre: una bandeja vacia es peor que ninguna.
 *
 * Se cierra tocando fuera, con la X, o al elegir una cuenta.
 *
 * ## Por que se monta desde el layout y no desde `Pantalla`
 *
 * Estuvo dentro de `Pantalla`, y desde que la barra de abajo se mudo al layout
 * la barra le quedaba **encima**: son ramas distintas del arbol, y la que lleva
 * `zIndex` explicito le gana a cualquier hermano sin importar quien tenga el
 * numero mas alto adentro de su propia rama. Montada aca, despues de la barra,
 * el orden del documento la deja arriba sin pelear.
 *
 * El disparador vive en el encabezado, que si es de `Pantalla`, asi que la
 * bandeja expone `useAbrirBandeja()` en vez de recibir el estado por props.
 */

import { capas, elevation, radii, spacing, type Theme } from '@iceberg/ui';
import { X } from 'phosphor-react-native/src/icons/X';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SelectorDeCuenta } from './SelectorDeCuenta';

/**
 * Desde donde entra mientras no se sabe cuanto mide.
 *
 * La bandeja se mide sola con `onLayout`, pero eso llega despues del primer
 * render y la primera apertura no tendria de donde salir. Se usa el mayor de los
 * dos: pasarse la deja fuera de pantalla un instante mas, que no se ve;
 * quedarse corto la hace aparecer a medio camino, que si.
 */
const ENTRADA_MINIMA = 260;

const OPACIDAD_VELO = 0.82;

const Contexto = createContext<() => void>(() => {});

/** Abre la bandeja. Lo llama la hamburguesa del encabezado. */
export function useAbrirBandeja(): () => void {
  return useContext(Contexto);
}

/** Monta la bandeja al final del arbol y deja como abrirla a quien este dentro. */
export function ProveedorDeBandeja({ theme, children }: { theme: Theme; children: ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  const abrir = useCallback(() => setAbierta(true), []);

  return (
    <Contexto.Provider value={abrir}>
      {children}
      <Bandeja theme={theme} abierta={abierta} onCerrar={() => setAbierta(false)} />
    </Contexto.Provider>
  );
}

function Bandeja(
  { theme, abierta, onCerrar }: { theme: Theme; abierta: boolean; onCerrar: () => void },
) {
  const styles = crearEstilos(theme, useSafeAreaInsets());

  // `montada` sobrevive al cierre: si se desmontara al tocar fuera, la bandeja
  // desapareceria de golpe y la animacion de salida no se veria nunca.
  const [montada, setMontada] = useState(abierta);
  const [alto, setAlto] = useState(0);
  const progreso = useRef(new Animated.Value(abierta ? 1 : 0)).current;

  useEffect(() => {
    if (abierta) setMontada(true);
    // Sale mas rapido de lo que entra: al cerrar uno ya decidio, y esperar la
    // animacion completa se siente lento.
    Animated.timing(progreso, {
      toValue: abierta ? 1 : 0,
      duration: abierta ? 190 : 140,
      easing: abierta ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !abierta) setMontada(false);
    });
  }, [abierta, progreso]);

  if (!montada) return null;

  const desplazamiento = progreso.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(alto, ENTRADA_MINIMA), 0],
  });
  const velo = progreso.interpolate({ inputRange: [0, 1], outputRange: [0, OPACIDAD_VELO] });

  return (
    <View style={styles.capa}>
      {/* El velo cierra al tocar fuera. Va primero para quedar por debajo. */}
      <Animated.View style={[styles.velo, { opacity: velo }]}>
        <Pressable
          style={styles.veloTocable}
          onPress={onCerrar}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
      </Animated.View>

      <Animated.View
        onLayout={(evento) => setAlto(evento.nativeEvent.layout.height)}
        style={[styles.panel, { transform: [{ translateY: desplazamiento }] }]}
      >
        {/* El tirador no hace nada: dice que esto sube y baja. Arrastrar para
            cerrar seria el gesto natural y todavia no esta. */}
        <View style={styles.tirador} />

        <View style={styles.cabecera}>
          <Pressable
            onPress={onCerrar}
            style={styles.cerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={8}
          >
            <X size={14} weight="bold" color={theme.silencio} />
          </Pressable>
        </View>

        <SelectorDeCuenta theme={theme} alCerrar={onCerrar} />
      </Animated.View>
    </View>
  );
}

function crearEstilos(theme: Theme, margenes: { bottom: number }) {
  const lleno = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
  return StyleSheet.create({
    // `flex-end` es lo que la pega abajo. El resto de la capa es el velo.
    capa: { ...lleno, justifyContent: 'flex-end', zIndex: capas.lateral },
    velo: { ...lleno, backgroundColor: theme.fondo },
    veloTocable: lleno,
    panel: {
      width: '100%',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      // El margen del sistema va sumado y no fijo: la bandeja termina justo
      // donde empieza la barra de gestos de Android, que la taparia.
      paddingBottom: spacing.xl + margenes.bottom,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      backgroundColor: theme.superficie,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    tirador: {
      width: 36,
      height: 4,
      borderRadius: radii.full,
      alignSelf: 'center',
      backgroundColor: theme.hairline,
      marginBottom: spacing.sm,
    },
    cabecera: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.sm },
    cerrar: {
      width: 22,
      height: 22,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
  });
}
