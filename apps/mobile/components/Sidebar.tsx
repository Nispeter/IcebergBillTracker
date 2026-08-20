/**
 * Navegacion lateral que se esconde.
 *
 * Reemplaza a la barra de abajo, que ocupaba una franja permanente de la
 * pantalla para algo que se usa cada tantos minutos. La lateral solo aparece
 * cuando se la pide, y mientras tanto el contenido usa el alto completo.
 *
 * Se cierra tocando fuera, tocando una opcion, o con la X. Tres salidas, porque
 * un panel del que no se sabe salir es peor que no tenerlo.
 *
 * Entra deslizandose desde el borde. La animacion no es decoracion: un panel
 * que aparece de golpe se lee como un cambio de pantalla, y uno que entra desde
 * la izquierda deja claro que el contenido sigue ahi, detras.
 */

import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { usePathname, useRouter } from 'expo-router';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ChartPieSlice } from 'phosphor-react-native/src/icons/ChartPieSlice';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { Snowflake } from 'phosphor-react-native/src/icons/Snowflake';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { Waves } from 'phosphor-react-native/src/icons/Waves';
import { X } from 'phosphor-react-native/src/icons/X';
import type { IconProps } from 'phosphor-react-native';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pinguino } from './Pinguino';

interface Destino {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: ComponentType<IconProps>;
}

const DESTINOS: readonly Destino[] = [
  { ruta: '/', etiqueta: 'Resumen', icono: Waves },
  { ruta: '/categorias', etiqueta: 'Categorías', icono: ChartPieSlice },
  { ruta: '/calendario', etiqueta: 'Día a día', icono: CalendarBlank },
  { ruta: '/tempanos', etiqueta: 'Témpanos', icono: Snowflake },
  { ruta: '/movimientos', etiqueta: 'Movimientos', icono: ListBullets },
  { ruta: '/ajustes', etiqueta: 'Ajustes', icono: Gear },
];

const ANCHO = 220;
const OPACIDAD_VELO = 0.82;

export function Sidebar(
  { theme, abierta, onCerrar }: { theme: Theme; abierta: boolean; onCerrar: () => void },
) {
  const styles = crearEstilos(theme);
  const router = useRouter();
  const ruta = usePathname();

  // `montada` sobrevive al cierre: si se desmontara al tocar fuera, el panel
  // desapareceria de golpe y la animacion de salida no se veria nunca.
  const [montada, setMontada] = useState(abierta);
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

  const desplazamiento = progreso.interpolate({ inputRange: [0, 1], outputRange: [-ANCHO, 0] });
  const velo = progreso.interpolate({ inputRange: [0, 1], outputRange: [0, OPACIDAD_VELO] });

  return (
    <View style={styles.capa}>
      {/* El velo cierra al tocar fuera. Va primero para quedar por debajo. */}
      <Animated.View style={[styles.velo, { opacity: velo }]}>
        <Pressable
          style={styles.veloTocable}
          onPress={onCerrar}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
        />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateX: desplazamiento }] }]}>
        <View style={styles.cabecera}>
          <View style={styles.marcaFila}>
            <Pinguino theme={theme} tamano={24} />
            <Text style={styles.marca}>ICEBERG</Text>
          </View>
          <Pressable
            onPress={onCerrar}
            style={styles.cerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú"
            hitSlop={8}
          >
            <X size={14} weight="bold" color={theme.silencio} />
          </Pressable>
        </View>

        {DESTINOS.map((destino) => {
          const Icono = destino.icono;
          const activo = ruta === destino.ruta;
          return (
            <Pressable
              key={destino.ruta}
              onPress={() => {
                onCerrar();
                if (!activo) router.replace(destino.ruta as never);
              }}
              style={[styles.item, activo && styles.itemActivo]}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={destino.etiqueta}
            >
              <Icono size={17} weight="regular" color={activo ? theme.acentoTexto : theme.silencio} />
              <Text style={activo ? styles.etiquetaActiva : styles.etiqueta}>{destino.etiqueta}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  const lleno = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
  return StyleSheet.create({
    capa: { ...lleno, flexDirection: 'row', zIndex: 10 },
    velo: { ...lleno, backgroundColor: theme.fondo },
    veloTocable: lleno,
    panel: {
      width: ANCHO,
      height: '100%',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      gap: 2,
      backgroundColor: theme.superficie,
      borderRightWidth: elevation.hairlineWidth,
      borderRightColor: theme.hairline,
    },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.lg,
    },
    marcaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    marca: { fontFamily: fonts.ui, fontWeight: pesos.bold, fontSize: fontSizes.xs, color: theme.tinta, letterSpacing: 3 },
    cerrar: {
      width: 22,
      height: 22,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
    },
    itemActivo: { backgroundColor: theme.fondo },
    etiqueta: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.tinta },
    etiquetaActiva: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },
  });
}
