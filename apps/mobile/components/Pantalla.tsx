/**
 * El marco de las seis vistas: el encabezado con el período, el nombre de la
 * vista y el fondo de agua.
 *
 * El período está en todas porque es global: cambiar de vista no cambia la
 * fecha que se mira. La barra de abajo no vive acá sino en el layout del grupo,
 * para que no se desvanezca en cada cambio de vista.
 *
 * El fondo es una columna de agua que se hace más honda hacia abajo, fija a la
 * pantalla: lo hondo es la parte baja de la pantalla, no del contenido.
 *
 * Al entrar solo se funde el contenido (el encabezado, el agua y la barra son
 * los mismos en las seis vistas). Fundido y no deslizamiento: las vistas son
 * hermanas, no pasos de un recorrido.
 */

import { capas, columna, durations, holguraDeToque, spacing } from '@iceberg/ui';
import { StatusBar } from 'expo-status-bar';
import { List } from 'phosphor-react-native/src/icons/List';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ayuda } from './Ayuda';
import { BarraDePeriodo } from './BarraDePeriodo';
import { FueraDelPeriodo } from './FueraDelPeriodo';
import { Pinguino } from './Pinguino';
import { useAbrirMenuDeCuenta } from './MenuDeCuenta';
import { transicion, useMovimientoReducido } from '../datos/animacion';
import { useCuentas } from '../datos/consultas';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useTema } from '../datos/tema';
import { useAncla, useZonaDeContenido } from '../datos/tutorial';

/** El ancho de cada costado del encabezado: el período queda centrado en la pantalla. */
const COSTADO = 44;

export function Pantalla(
  { children, titulo, ayudaDelTitulo, sinPeriodo, permitirFuturo }: {
    children: ReactNode;
    /** El nombre de la vista, el mismo que lleva en la barra de abajo. */
    titulo: string;
    /** Qué es esta vista, si el nombre no alcanza. */
    ayudaDelTitulo?: string;
    sinPeriodo?: boolean;
    /** Ver `BarraDePeriodo`: solo Témpanos mira hacia adelante. */
    permitirFuturo?: boolean;
  },
) {
  const { nombre: tema, theme } = useTema();
  const styles = useEstilos(crearEstilos);
  // La app va a pantalla completa: el encabezado empieza debajo del reloj.
  const margenes = useSafeAreaInsets();
  const abrirMenuDeCuenta = useAbrirMenuDeCuenta();
  // Las rayitas abren la lista de cuentas: con una sola no hay qué elegir.
  const hayQueElegirCuenta = useCuentas().length > 1;
  const rayitas = useRef<View>(null);
  const ancla = useAncla();
  const zona = useZonaDeContenido();

  const reducido = useMovimientoReducido();
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    transicion(entrada, 1, { duracion: durations.cambio, reducido }).start();
  }, [entrada, reducido]);

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="columnaDeAgua" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.aguaSuperficie} />
            <Stop offset="1" stopColor={theme.aguaProfunda} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#columnaDeAgua)" />
      </Svg>

      <View style={[styles.marco, { paddingTop: spacing.lg + margenes.top }]}>
        <View style={styles.encabezado}>
          {hayQueElegirCuenta ? (
            <Pressable
              ref={rayitas}
              // Sin esto Android colapsa la vista en el árbol nativo y no hay qué medir.
              collapsable={false}
              // Se mide al tocar: en ese instante el botón ya está dibujado y quieto.
              onPress={() => rayitas.current?.measureInWindow(
                (x, y, _ancho, alto) => abrirMenuDeCuenta({ x, y, alto }),
              )}
              style={styles.costado}
              accessibilityRole="button"
              accessibilityLabel="Cambiar de cuenta"
              hitSlop={holguraDeToque(22)}
            >
              <List size={18} weight="bold" color={theme.tinta} />
            </Pressable>
          ) : <View style={styles.costado} />}

          {sinPeriodo ? (
            <View style={styles.centro}>
              <Pinguino tamano={18} />
            </View>
          ) : (
            <View ref={ancla('periodo')} collapsable={false} style={styles.centro}>
              <BarraDePeriodo permitirFuturo={permitirFuturo} />
            </View>
          )}
          {/* El costado derecho mide lo mismo que el del menú, para que el centro
              quede centrado en la pantalla. Ahí vive el aviso de "esto no es
              hoy", que no dibuja nada en el período actual. */}
          <View style={[styles.costado, styles.costadoDerecho]}>
            {sinPeriodo ? null : <FueraDelPeriodo />}
          </View>
        </View>

        <View style={styles.filaDelTitulo}>
          <Text style={styles.titulo} accessibilityRole="header">{titulo}</Text>
          {ayudaDelTitulo === undefined ? null : <Ayuda titulo={titulo} texto={ayudaDelTitulo} />}
        </View>
      </View>

      <Animated.View
        ref={zona}
        collapsable={false}
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

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    cuerpo: { flex: 1 },
    // Sobre el contenido, para que el selector de período se abra por encima:
    // el marco va antes en el documento y sin esto las filas le pasan por arriba.
    marco: { ...columna, paddingBottom: spacing.sm, zIndex: capas.encabezado },
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, zIndex: capas.encabezado },
    centro: { flex: 1, alignItems: 'center', zIndex: capas.encabezado },
    costado: { width: COSTADO, height: 22, alignItems: 'flex-start', justifyContent: 'center' },
    costadoDerecho: { alignItems: 'flex-end' },
    filaDelTitulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
    titulo: t.titulo,
  });
}
