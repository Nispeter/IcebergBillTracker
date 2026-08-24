/**
 * El marco que comparten todas las vistas: menu, marca, periodo y el boton de agregar.
 *
 * Existe para que el periodo este **en todas partes**. Si cada pantalla armara
 * su propio encabezado, tarde o temprano alguna se olvidaria de la barra y el
 * usuario perderia la referencia de que fecha esta mirando.
 *
 * El **mas flota abajo a la izquierda**, no en el encabezado. Es la accion mas
 * frecuente de la app y arriba quedaba lejos del pulgar; ademas competia por
 * ancho con el nombre del periodo, que en "17 al 23 de agosto" ya va justo.
 * A la izquierda y no a la derecha porque ahi caen los montos de cada fila, y un
 * circulo opaco sobre la columna de cifras tapa justo lo que uno esta mirando.
 *
 * El **fondo es una columna de agua**: un degradado que se hace mas hondo hacia
 * abajo. Va aca y no en cada pantalla para que la profundidad sea de la app y no
 * de una vista, y **no se desplaza**: lo hondo es la parte baja de la pantalla,
 * no la parte baja del contenido.
 *
 * Y **se esconde mientras uno baja**. Flote donde flote tapa algo: a la derecha
 * los montos, a la izquierda los nombres de categoria. La unica salida es que se
 * quite del medio cuando uno esta leyendo y vuelva apenas frena o sube, que es
 * justo cuando podria querer usarlo.
 */

import { capas, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { List } from 'phosphor-react-native/src/icons/List';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BarraDePeriodo } from './BarraDePeriodo';
import { Pinguino } from './Pinguino';
import { Bandeja } from './Bandeja';
import { useEstadoDelFlotante } from '../datos/desplazamiento';
import { useTema } from '../datos/tema';

export function Pantalla(
  { children, sinPeriodo, permitirFuturo }: {
    children: ReactNode;
    sinPeriodo?: boolean;
    /** Ver `BarraDePeriodo`: solo Tempanos necesita mirar hacia adelante. */
    permitirFuturo?: boolean;
  },
) {
  const { nombre: tema, theme } = useTema();
  // Sin esto el encabezado se dibuja debajo del reloj y el flotante debajo de la
  // barra de gestos: la app va a pantalla completa por `edgeToEdgeEnabled`.
  const margenes = useSafeAreaInsets();
  const styles = crearEstilos(theme, margenes);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Ver `FilaMovimiento`: dentro de `Link asChild` el estilo tiene que ser un
  // objeto aplanado, asi que el estado de presion se lleva a mano.
  const [masApretado, setMasApretado] = useState(false);

  const { oculto, reiniciar } = useEstadoDelFlotante();
  const salida = useRef(new Animated.Value(0)).current;

  // Cada vista arranca arriba de todo: si se llega a ella con el mas escondido,
  // se quedaria escondido hasta que alguien vuelva a desplazar.
  useEffect(reiniciar, [reiniciar]);

  useEffect(() => {
    Animated.timing(salida, {
      toValue: oculto ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [oculto, salida]);

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />

      {/* La columna de agua. Detras de todo y quieta. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="columnaDeAgua" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.aguaSuperficie} />
            <Stop offset="1" stopColor={theme.aguaProfunda} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#columnaDeAgua)" />
      </Svg>
      <View style={styles.marco}>
        <View style={styles.encabezado}>
          {/* Sin burbuja: tres lineas ya se leen como menu, y el circulo solo
              agregaba un borde mas a una fila que ya tiene varios. El area
              tocable la sostiene el `hitSlop`, no el dibujo. */}
          <Pressable
            onPress={() => setMenuAbierto(true)}
            style={styles.boton}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú"
            hitSlop={12}
          >
            <List size={18} weight="bold" color={theme.tinta} />
          </Pressable>

          {sinPeriodo ? (
            <View style={styles.marcaFila}>
              <Pinguino theme={theme} tamano={18} />
              <Text style={styles.marca}>ICEBERG</Text>
            </View>
          ) : (
            <>
              <View style={styles.periodo}><BarraDePeriodo theme={theme} permitirFuturo={permitirFuturo} /></View>
              {/* Un hueco del ancho del menu, al otro lado. Sin el, el periodo se
                  centra en el espacio que sobra despues del boton y queda corrido
                  media hamburguesa a la derecha. */}
              <View style={styles.boton} />
            </>
          )}
        </View>
      </View>

      {children}

      {/* La animacion va en una caja aparte y no en el `Pressable`: dentro de
          `Link asChild` el estilo del hijo tiene que ser un objeto plano, y un
          `Animated.Value` ahi adentro vuelve a romper el enlace. */}
      <Animated.View
        style={[styles.flotanteCaja, {
          opacity: salida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ translateY: salida.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) }],
        }]}
        pointerEvents={oculto ? 'none' : 'auto'}
      >
        <Link href="/nuevo" asChild>
          <Pressable
            style={StyleSheet.flatten([styles.flotante, masApretado && styles.flotanteApretado])}
            onPressIn={() => setMasApretado(true)}
            onPressOut={() => setMasApretado(false)}
            accessibilityRole="button"
            accessibilityLabel="Agregar movimiento"
          >
            <Plus size={22} weight="bold" color={theme.sobreAcento} />
          </Pressable>
        </Link>
      </Animated.View>

      <Bandeja theme={theme} abierta={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </View>
  );
}

function crearEstilos(theme: Theme, margenes: { top: number; bottom: number }) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    /**
     * Elevado sobre el contenido para que el panel del periodo se abra encima.
     *
     * El marco va **antes** que los hijos en el orden del documento, asi que sin
     * esto cualquier fila de la pantalla le pasa por arriba. El numero es mayor
     * que el de los desplegables de contenido: si los dos estan abiertos, el del
     * periodo manda, porque es el que se acaba de tocar.
     */
    marco: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg + margenes.top,
      paddingBottom: spacing.sm,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      zIndex: capas.encabezado,
    },
    // El periodo va en la misma linea que el menu: es marco, no contenido, y no
    // merece una franja propia.
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, zIndex: capas.encabezado },
    periodo: { flex: 1, zIndex: capas.encabezado },
    marcaFila: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    marca: { fontFamily: fonts.texto, fontWeight: pesos.bold, fontSize: fontSizes.xs, color: theme.tinta, letterSpacing: 3 },
    boton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },

    /**
     * Abajo a la izquierda y de 44 px.
     *
     * A la izquierda porque el lado derecho es donde caen los montos de cada
     * fila, y un circulo opaco encima de la columna de cifras tapa justo lo que
     * uno esta mirando. 44 es el minimo que se toca sin apuntar; los 56 de la
     * primera version pesaban demasiado para una pantalla de 480.
     */
    flotanteCaja: {
      position: 'absolute',
      left: spacing.lg,
      bottom: spacing.lg + margenes.bottom,
      zIndex: capas.flotante,
    },
    flotante: {
      width: 44,
      height: 44,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.acento,
    },
    flotanteApretado: { opacity: 0.8, transform: [{ scale: 0.92 }] },
  });
}
