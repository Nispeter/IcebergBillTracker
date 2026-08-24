/**
 * La navegacion, en una bandeja que sube desde abajo.
 *
 * Tercera forma que toma esto y conviene dejar escrito por que, para no volver
 * en circulo:
 *
 * 1. **Barra de pestañas fija abajo.** Se fue porque ocupaba una franja
 *    permanente de la pantalla para algo que se toca cada tantos minutos.
 * 2. **Panel lateral que se esconde.** Arreglaba eso, pero dejaba los seis
 *    destinos arriba a la izquierda, que en un telefono grande es justo donde el
 *    pulgar no llega.
 * 3. **Esta bandeja.** Se esconde igual que el panel lateral --el contenido usa
 *    el alto completo mientras no se la pide-- y ademas aparece **donde esta la
 *    mano**. Es lo que la barra de pestañas hacia bien, sin el costo de estar
 *    siempre puesta.
 *
 * Los destinos van en rejilla de tres y no en lista: seis filas apiladas desde
 * abajo taparian la pantalla entera, y en rejilla la bandeja ocupa un tercio.
 *
 * Se cierra tocando fuera, tocando una opcion, o con la X. Tres salidas, porque
 * una bandeja de la que no se sabe salir es peor que no tenerla.
 */

import {
  capas, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pinguino } from './Pinguino';
import { SelectorDeCuenta } from './SelectorDeCuenta';

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

/**
 * Desde donde entra mientras no se sabe cuanto mide.
 *
 * La bandeja se mide sola con `onLayout`, pero eso llega despues del primer
 * render y la primera apertura no tendria de donde salir. Se usa el mayor de los
 * dos: pasarse deja la bandeja fuera de pantalla un instante mas, que no se ve;
 * quedarse corto la hace aparecer a medio camino, que si.
 */
const ENTRADA_MINIMA = 360;

const OPACIDAD_VELO = 0.82;

export function Bandeja(
  { theme, abierta, onCerrar }: { theme: Theme; abierta: boolean; onCerrar: () => void },
) {
  const styles = crearEstilos(theme, useSafeAreaInsets());
  const router = useRouter();
  const ruta = usePathname();

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
          accessibilityLabel="Cerrar menú"
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

        {/*
          El selector de cuenta va aca y no en el encabezado.
          Estuvo bajo el periodo y dejaba una barra de dos lineas en todas las
          pantallas para algo que casi nunca se cambia: uno mira un libro y se
          queda ahi. Este menu es donde ya viven las decisiones de "que estoy
          mirando". No se dibuja con una sola cuenta.
        */}
        <SelectorDeCuenta theme={theme} alCerrar={onCerrar} />

        <View style={styles.rejilla}>
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
                style={({ pressed }) => [styles.celda, pressed && styles.celdaApretada]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={destino.etiqueta}
              >
                <View style={[styles.ficha, activo && styles.fichaActiva]}>
                  <Icono size={20} weight="regular" color={activo ? theme.acentoTexto : theme.silencio} />
                </View>
                <Text
                  style={activo ? styles.etiquetaActiva : styles.etiqueta}
                  numberOfLines={1}
                >
                  {destino.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
      paddingBottom: spacing.lg + margenes.bottom,
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
      marginBottom: spacing.md,
    },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.md,
    },
    marcaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    marca: { fontFamily: fonts.texto, fontWeight: pesos.bold, fontSize: fontSizes.xs, color: theme.tinta, letterSpacing: 3 },
    cerrar: {
      width: 22,
      height: 22,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    rejilla: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: spacing.sm,
    },
    /** Un tercio exacto: seis destinos son dos filas parejas de tres. */
    celda: {
      width: '33.333%',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
    },
    celdaApretada: { opacity: 0.6 },
    ficha: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.superficieHonda,
    },
    // Lo activo se marca en la ficha y no en el texto: el color de fondo se ve
    // de reojo, y con seis destinos uno busca donde esta parado sin leer.
    fichaActiva: { backgroundColor: theme.hieloSobreAgua },
    etiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 11, color: theme.silencio },
    etiquetaActiva: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: 11, color: theme.tinta },
  });
}
