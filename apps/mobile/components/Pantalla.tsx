/**
 * El marco que comparten todas las vistas: menu, marca, periodo y el boton de agregar.
 *
 * Existe para que el periodo este **en todas partes**. Si cada pantalla armara
 * su propio encabezado, tarde o temprano alguna se olvidaria de la barra y el
 * usuario perderia la referencia de que fecha esta mirando.
 *
 * El **mas vive en la barra de abajo**, en el medio y sobresaliendo. Esa barra
 * no se dibuja aca sino en `app/(app)/_layout.tsx`, un nivel mas arriba: si
 * viviera dentro de la pantalla se desvaneceria con ella en cada transicion, y
 * lo que tiene que hacer es quedarse quieta. Ver `BarraInferior`.
 *
 * El **fondo es una columna de agua**: un degradado que se hace mas hondo hacia
 * abajo. Va aca y no en cada pantalla para que la profundidad sea de la app y no
 * de una vista, y **no se desplaza**: lo hondo es la parte baja de la pantalla,
 * no la parte baja del contenido.
 *
 * El **menu de la hamburguesa quedo solo para cambiar de cuenta**, y por eso no
 * se dibuja si hay una sola: los destinos se mudaron a la barra de abajo.
 *
 * ## El nombre de la vista, bajo el encabezado
 *
 * Existe por lo mismo que la barra: seis iconos sin etiqueta dicen a donde se
 * puede ir, pero no **donde se esta**. El titulo lo confirma despues del toque,
 * que es cuando hace falta, y ademas le pone nombre a pantallas que antes
 * empezaban directo con una cifra sin decir de que eran.
 *
 * ## Al entrar, el contenido se funde
 *
 * **Solo el contenido.** El encabezado, la columna de agua y la barra de abajo
 * se quedan quietos: son los mismos en las seis vistas, y fundirlos seria un
 * parpadeo de cosas que no cambiaron. Lo que cambia es lo del medio.
 *
 * Fundido y no deslizamiento porque las seis vistas son **hermanas**: deslizar
 * de lado contaria un avance que no existe, y ademas habria que decidir hacia
 * que lado va cada par de destinos. Sube 8 px, lo justo para que se lea como
 * contenido que llega y no como un destello.
 */

import { capas, fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { StatusBar } from 'expo-status-bar';
import { List } from 'phosphor-react-native/src/icons/List';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BarraDePeriodo } from './BarraDePeriodo';
import { Pinguino } from './Pinguino';
import { useAbrirBandeja } from './Bandeja';
import { useCuentas } from '../datos/consultas';
import { useTema } from '../datos/tema';

export function Pantalla(
  { children, titulo, sinPeriodo, permitirFuturo }: {
    children: ReactNode;
    /** El nombre de la vista. El mismo que lleva en la barra de abajo. */
    titulo?: string;
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
  const abrirBandeja = useAbrirBandeja();
  // Con una sola cuenta el menu no tendria nada adentro: es lo unico que quedo
  // ahi desde que los destinos se mudaron a la barra de abajo.
  const hayQueElegirCuenta = useCuentas().length > 1;

  // Corre una sola vez por montaje, y cada destino monta su propia `Pantalla`:
  // eso es lo que hace que la animacion coincida con el cambio de vista.
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      // Corto a proposito: es el acuse de que el toque llego, no una escena.
      // Pasando los 200 ms, navegar empieza a sentirse lento.
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrada]);

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
          {hayQueElegirCuenta ? (
            <Pressable
              onPress={abrirBandeja}
              style={styles.boton}
              accessibilityRole="button"
              accessibilityLabel="Cambiar de cuenta"
              hitSlop={12}
            >
              <List size={18} weight="bold" color={theme.tinta} />
            </Pressable>
          ) : <View style={styles.boton} />}

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
        {titulo === undefined ? null : (
          <Text style={styles.tituloDeVista}>{titulo}</Text>
        )}
      </View>

      <Animated.View
        style={[styles.cuerpo, {
          opacity: entrada,
          transform: [{
            translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
          }],
        }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function crearEstilos(theme: Theme, margenes: { top: number; bottom: number }) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    // `flex: 1` para que envolver el contenido no le cambie el alto a ninguna
    // pantalla: antes colgaban directo de la raiz.
    cuerpo: { flex: 1 },
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
     * Mas grande que un titulo de seccion y mas chico que una cifra.
     *
     * `lg` contra los `sm` de `Titulo`: tiene que leerse como el nombre de la
     * pantalla y no como una seccion mas, pero sin competir con el numero
     * protagonista que viene abajo en varias vistas.
     */
    tituloDeVista: {
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: fontSizes.lg,
      color: theme.tinta,
      marginTop: spacing.md,
    },

  });
}
