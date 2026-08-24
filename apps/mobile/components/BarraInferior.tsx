/**
 * La barra de navegacion, siempre puesta, con el mas en el medio.
 *
 * Cuarta forma que toma esto. El recorrido, para no volver en circulo:
 *
 * 1. **Pestañas fijas abajo.** Se fueron por gastar una franja permanente en
 *    algo que se toca cada tantos minutos.
 * 2. **Panel lateral escondido.** Recuperaba la franja, pero dejaba los destinos
 *    arriba a la izquierda, donde el pulgar no llega.
 * 3. **Bandeja que sube desde abajo.** Ya estaba al alcance, pero seguian siendo
 *    dos toques para cambiar de vista.
 * 4. **Esta barra.** Un toque, y el mas deja de flotar sobre el contenido.
 *
 * ## El mas sobresale, y eso arregla un problema viejo
 *
 * Flotando tapaba algo siempre: a la derecha la columna de montos, a la
 * izquierda los nombres de categoria. Por eso se escondia al desplazar hacia
 * abajo. **Metido en la barra ya no tapa nada** --el contenido reserva el alto
 * de la barra-- asi que esconderse dejo de tener motivo y se saco.
 *
 * Asoma por encima del borde para que no se lea como un destino mas: es la
 * accion, no un lugar al que ir.
 *
 * ## Sin etiquetas
 *
 * Seis destinos mas el mas dejan unos 48 px por casilla, y ahi no entra
 * "Movimientos" ni recortado a nueve puntos: quedaria "Movimien…", que ocupa
 * igual y no dice mas que el icono. Lo activo se marca con el icono **relleno**
 * y en color, que se ve de reojo. El nombre viaja en la etiqueta de
 * accesibilidad.
 */

import { capas, elevation, radii, spacing, type Theme } from '@iceberg/ui';
import { Link, usePathname, useRouter } from 'expo-router';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ChartPieSlice } from 'phosphor-react-native/src/icons/ChartPieSlice';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Snowflake } from 'phosphor-react-native/src/icons/Snowflake';
import { Waves } from 'phosphor-react-native/src/icons/Waves';
import type { IconProps } from 'phosphor-react-native';
import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Destino {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: ComponentType<IconProps>;
}

/**
 * Tres a cada lado del mas.
 *
 * El orden no es casual: va de lo mas general a lo mas detallado, que es el
 * mismo orden en que uno mira sus cuentas. Ajustes al final porque es el unico
 * que no responde una pregunta sobre la plata.
 */
const IZQUIERDA: readonly Destino[] = [
  { ruta: '/', etiqueta: 'Resumen', icono: Waves },
  { ruta: '/categorias', etiqueta: 'Categorías', icono: ChartPieSlice },
  { ruta: '/calendario', etiqueta: 'Día a día', icono: CalendarBlank },
];

const DERECHA: readonly Destino[] = [
  { ruta: '/tempanos', etiqueta: 'Témpanos', icono: Snowflake },
  { ruta: '/movimientos', etiqueta: 'Movimientos', icono: ListBullets },
  { ruta: '/ajustes', etiqueta: 'Ajustes', icono: Gear },
];

/** Alto de la barra, **sin** el margen del sistema, que se suma aparte. */
export const ALTO_DE_LA_BARRA = 58;

const MAS = 52;
/** Cuanto asoma el mas por encima del borde de la barra. */
const SOBRESALE = 16;

export function BarraInferior({ theme }: { theme: Theme }) {
  const margenes = useSafeAreaInsets();
  const styles = crearEstilos(theme, margenes.bottom);
  const router = useRouter();
  const ruta = usePathname();
  // Ver `FilaMovimiento`: dentro de `Link asChild` el estilo del hijo tiene que
  // ser un objeto aplanado, asi que el estado de presion se lleva a mano.
  const [masApretado, setMasApretado] = useState(false);

  const casilla = (destino: Destino) => {
    const Icono = destino.icono;
    const activo = ruta === destino.ruta;
    return (
      <Pressable
        key={destino.ruta}
        onPress={() => { if (!activo) router.replace(destino.ruta as never); }}
        style={({ pressed }) => [styles.casilla, pressed && styles.casillaApretada]}
        accessibilityRole="button"
        accessibilityState={{ selected: activo }}
        accessibilityLabel={destino.etiqueta}
      >
        <Icono
          size={22}
          weight={activo ? 'fill' : 'regular'}
          color={activo ? theme.acentoTexto : theme.silencio}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.raiz} pointerEvents="box-none">
      <View style={styles.barra}>
        {IZQUIERDA.map(casilla)}
        {/* El hueco del mas. Va como casilla vacia para que los seis destinos
            queden repartidos parejo a los dos lados. */}
        <View style={styles.hueco} />
        {DERECHA.map(casilla)}
      </View>

      {/* Fuera de la barra y centrado por una franja del ancho completo: un
          elemento absoluto no se centra con `alignSelf`. Ver `datos/aviso.tsx`. */}
      <View style={styles.franjaDelMas} pointerEvents="box-none">
        <Link href="/nuevo" asChild>
          <Pressable
            style={StyleSheet.flatten([styles.mas, masApretado && styles.masApretado])}
            onPressIn={() => setMasApretado(true)}
            onPressOut={() => setMasApretado(false)}
            accessibilityRole="button"
            accessibilityLabel="Agregar movimiento"
          >
            <Plus size={24} weight="bold" color={theme.sobreAcento} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme, aireDelSistema: number) {
  return StyleSheet.create({
    raiz: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: capas.flotante,
    },
    barra: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ALTO_DE_LA_BARRA + aireDelSistema,
      // El margen del sistema va como relleno y no como alto extra: asi los
      // iconos quedan centrados en la franja util y no encima de la barra de
      // gestos de Android.
      paddingBottom: aireDelSistema,
      backgroundColor: theme.superficie,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    casilla: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    casillaApretada: { opacity: 0.5 },
    hueco: { flex: 1 },
    franjaDelMas: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      bottom: aireDelSistema + ALTO_DE_LA_BARRA - (MAS - SOBRESALE),
    },
    mas: {
      width: MAS,
      height: MAS,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.acento,
      // El anillo del color de la barra separa el circulo del borde que cruza
      // por detras. Sin el, el mas se lee pegado a la linea.
      borderWidth: 3,
      borderColor: theme.superficie,
    },
    masApretado: { opacity: 0.85, transform: [{ scale: 0.92 }] },
  });
}
